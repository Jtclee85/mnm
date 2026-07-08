import { getActiveApprovedYoutubeChannels } from '../../lib/approvedYoutubeChannels';
import { filterVideosForStudents, getRejectedVideoSamples } from '../../lib/youtubeVideoFilter';

// 조사주제와 관련된 YouTube 영상을 교사가 승인한 채널 안에서만 검색해 추천한다.
// API Key는 서버 환경변수(YOUTUBE_API_KEY)로만 다루며 클라이언트에 노출하지 않는다.
// 보조 기능이므로 키가 없거나 호출이 실패해도 200 + 빈 배열로 답해 앱을 깨지 않는다.
export const config = {
  runtime: 'edge',
};

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

const MAX_CHANNELS = 5;
const MAX_QUERIES = 4;
const MAX_QUERIES_PER_CHANNEL = 3;
const MAX_CANDIDATES_BEFORE_DETAILS = 24;

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  // 같은 검색어에 대한 반복 호출을 CDN에서 흡수해 YouTube API 쿼터를 아낀다.
  'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
};

function decodeHtmlEntities(text = '') {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

function getFocusedChannelTags(text) {
  if (/독도/.test(text)) return ['독도', '동북아'];
  if (/독립운동|일제강점기|대한민국 임시정부|임시정부/.test(text)) {
    return ['독립운동', '근현대사'];
  }
  if (/전쟁|임진왜란|6·25|호국/.test(text)) {
    return ['전쟁사', '호국', '근현대사'];
  }
  if (/한국사|사료|조선|대한민국|고구려|발해|세종대왕/.test(text)) {
    return ['한국사', '사료', '동북아'];
  }
  if (/문화유산|국가유산|문화재|국보|보물|사찰|유적|고인돌|지석묘|선사|청동기|석탑|석등|박물관/.test(text)) {
    return ['문화유산', '박물관'];
  }
  if (/과학|광합성|전기|자석|화산|날씨|생물|식물|동물|우주|생태|환경|갯벌/.test(text)) {
    return ['과학', '생태', '환경'];
  }
  return [];
}

function hasAnyTag(channel, tags) {
  return channel.tags?.some(tag => tags.includes(tag));
}

function getFocusedTagRank(channel, focusedTags) {
  const ranks = (channel.tags || [])
    .map(tag => focusedTags.indexOf(tag))
    .filter(index => index !== -1);
  return ranks.length > 0 ? Math.min(...ranks) : 99;
}

function sortChannelsForTopic(channels, focusedTags) {
  return [...channels].sort((a, b) => {
    const aFocused = hasAnyTag(a, focusedTags) ? 0 : 1;
    const bFocused = hasAnyTag(b, focusedTags) ? 0 : 1;
    if (aFocused !== bFocused) return aFocused - bFocused;
    const aFocusedRank = getFocusedTagRank(a, focusedTags);
    const bFocusedRank = getFocusedTagRank(b, focusedTags);
    if (aFocusedRank !== bFocusedRank) return aFocusedRank - bFocusedRank;
    return (a.priority || 99) - (b.priority || 99);
  });
}

export function selectApprovedChannels(topic, sourceText, channels) {
  const text = `${topic || ''} ${sourceText || ''}`;
  const focusedTags = getFocusedChannelTags(text);

  const isHeritage = /문화유산|국가유산|문화재|국보|보물|사찰|유적|고인돌|지석묘|선사|청동기|석탑|석등|박물관|화엄사/.test(text);
  const isHistory = /한국사|역사|사료|독립운동|일제강점기|근현대사|조선|대한민국|독도|고구려|발해|전쟁|임진왜란|6·25|호국|박물관/.test(text);
  const isScience = /과학|광합성|전기|자석|화산|날씨|생물|식물|동물|우주|생태|환경|갯벌/.test(text);

  let selected = [];

  if (isHeritage || isHistory) {
    selected = channels.filter(c =>
      c.tags?.some(tag =>
        [
          '문화유산',
          '국가유산',
          '역사',
          '한국사',
          '사료',
          '근현대사',
          '독립운동',
          '동북아',
          '독도',
          '전쟁사',
          '호국',
          '박물관',
          '사회',
          '교육',
        ].includes(tag)
      )
    );
  } else if (isScience) {
    selected = channels.filter(c =>
      c.tags?.some(tag =>
        ['과학', '생태', '환경'].includes(tag)
      )
    );
    if (selected.length < MAX_CHANNELS) {
      const selectedIds = new Set(selected.map(channel => channel.channelId));
      selected.push(...channels.filter(c =>
        !selectedIds.has(c.channelId) &&
        c.tags?.some(tag => ['교육', '초등'].includes(tag))
      ));
    }
  } else {
    selected = channels.filter(c =>
      c.tags?.some(tag =>
        ['교육', '초등', '사회', '과학', '역사'].includes(tag)
      )
    );
  }

  return sortChannelsForTopic(selected, focusedTags).slice(0, MAX_CHANNELS);
}

// "어린이"를 무조건 넣지 않는다. 키즈/더빙/애니 영상 유입을 줄이기 위해
// 주제 성격에 맞는 구체적인 검색어만 만든다.
export function buildVideoSearchQueries(topic, sourceText = '') {
  const normalized = String(topic || '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const text = `${topic || ''} ${sourceText || ''}`;
  const queries = [];

  const hasDolmen = /고인돌|지석묘|선사|청동기|세계문화유산|강화/.test(text);

  if (hasDolmen) {
    queries.push('고인돌');
    queries.push('지석묘');
    queries.push('선사시대 고인돌');
    queries.push('강화 고인돌');
    queries.push('고인돌 문화유산');
  }

  const isHeritage = /문화유산|국가유산|문화재|국보|보물|사찰|유적|역사|석탑|석등|박물관|화엄사/.test(text);
  const isHistory = /한국사|사료|독립운동|일제강점기|근현대사|조선|대한민국|독도|고구려|발해|전쟁|임진왜란|6·25|호국|세종대왕/.test(text);
  const isScience = /과학|광합성|전기|자석|화산|날씨|생물|식물|동물|우주|생태|환경|갯벌/.test(text);

  if (normalized) {
    if (isHeritage) {
      queries.push(normalized);
      queries.push(`${normalized} 문화유산`);
      queries.push(`${normalized} 역사`);
      queries.push(`${normalized} 초등 사회`);
    } else if (isHistory) {
      queries.push(normalized);
      queries.push(`${normalized} 역사`);
      queries.push(`${normalized} 한국사`);
      queries.push(`${normalized} 초등 사회`);
    } else if (isScience) {
      queries.push(normalized);
      queries.push(`${normalized} 과학`);
      queries.push(`${normalized} 초등 과학`);
    } else {
      queries.push(normalized);
      queries.push(`${normalized} 설명`);
      queries.push(`${normalized} 초등`);
    }
  }

  return dedupe(queries).slice(0, MAX_QUERIES);
}

function mapYoutubeItem(item, channel, query) {
  return {
    videoId: item.id?.videoId || '',
    title: decodeHtmlEntities(item.snippet?.title || ''),
    channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || ''),
    description: decodeHtmlEntities(item.snippet?.description || ''),
    thumbnailUrl:
      item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    url: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : '',
    approvedChannelName: channel.name,
    approvedChannelId: channel.channelId,
    matchedQuery: query,
  };
}

async function searchYoutubeWithinChannel({ apiKey, channel, query }) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    channelId: channel.channelId,
    q: query,
    maxResults: '5',
    safeSearch: 'strict',
    relevanceLanguage: 'ko',
    regionCode: 'KR',
    videoEmbeddable: 'true',
    key: apiKey,
  });

  const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
  if (!res.ok) {
    console.error('YouTube 승인 채널 검색 오류:', channel.name, query, res.status);
    return [];
  }
  const data = await res.json();
  return (data.items || []).map(item => mapYoutubeItem(item, channel, query));
}

async function collectApprovedChannelCandidates({ apiKey, channels, queries }) {
  const candidateMap = new Map();
  const usedSearches = [];

  for (const channel of channels.slice(0, MAX_CHANNELS)) {
    for (const query of queries.slice(0, MAX_QUERIES_PER_CHANNEL)) {
      const results = await searchYoutubeWithinChannel({ apiKey, channel, query });
      usedSearches.push({ channelName: channel.name, channelId: channel.channelId, query, count: results.length });

      for (const video of results) {
        if (video.videoId && !candidateMap.has(video.videoId)) {
          candidateMap.set(video.videoId, video);
        }
      }

      if (candidateMap.size >= MAX_CANDIDATES_BEFORE_DETAILS) break;
    }
    if (candidateMap.size >= MAX_CANDIDATES_BEFORE_DETAILS) break;
  }

  return {
    candidates: [...candidateMap.values()],
    usedSearches,
    rawCount: usedSearches.reduce((sum, item) => sum + item.count, 0),
  };
}

export function parseYoutubeDurationToSeconds(duration = '') {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h = 0, m = 0, s = 0] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

async function fetchVideoDetails(videoIds, apiKey) {
  const ids = dedupe(videoIds).slice(0, 50);
  if (ids.length === 0) return new Map();

  const params = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: ids.join(','),
    key: apiKey,
  });

  const res = await fetch(`${YOUTUBE_VIDEOS_URL}?${params.toString()}`);
  if (!res.ok) {
    console.error('YouTube 영상 세부정보 조회 오류:', res.status);
    return new Map();
  }

  const data = await res.json();
  return new Map((data.items || []).map(item => [
    item.id,
    {
      duration: item.contentDetails?.duration || '',
      durationSeconds: parseYoutubeDurationToSeconds(item.contentDetails?.duration || ''),
      viewCount: Number(item.statistics?.viewCount || 0),
      publishedAt: item.snippet?.publishedAt || '',
    },
  ]));
}

async function enrichCandidatesWithDetails(candidates, apiKey) {
  const details = await fetchVideoDetails(candidates.map(video => video.videoId), apiKey);
  return candidates.map(video => ({
    ...video,
    ...(details.get(video.videoId) || {}),
  }));
}

function buildDebugBody({ topic, activeChannelCount, selectedChannels, queries, usedSearches, rawCount, candidates, videos, sourceText }) {
  return {
    topic,
    activeChannelCount,
    selectedChannels: selectedChannels.map(channel => ({
      name: channel.name,
      channelId: channel.channelId,
      tags: channel.tags || [],
      priority: channel.priority,
    })),
    queries,
    usedSearches,
    rawCount,
    dedupedCount: candidates.length,
    filteredCount: videos.length,
    selectedCount: videos.length,
    rejectedSamples: getRejectedVideoSamples(candidates, topic, sourceText),
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ videos: [], error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const { topic = '', sourceText = '', debug = false } = await req.json();
  const trimmedTopic = String(topic).trim();
  const trimmedSourceText = String(sourceText || '');

  if (!trimmedTopic) {
    return new Response(JSON.stringify({ videos: [] }), { status: 200, headers: jsonHeaders });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ videos: [], error: 'YOUTUBE_API_KEY가 설정되어 있지 않습니다.' }),
      { status: 200, headers: jsonHeaders }
    );
  }

  try {
    const activeChannels = getActiveApprovedYoutubeChannels();
    const selectedChannels = selectApprovedChannels(trimmedTopic, trimmedSourceText, activeChannels);
    const queries = buildVideoSearchQueries(trimmedTopic, trimmedSourceText).slice(0, MAX_QUERIES);

    if (selectedChannels.length === 0 || queries.length === 0) {
      const body = debug === true
        ? {
            videos: [],
            debug: buildDebugBody({
              topic: trimmedTopic,
              activeChannelCount: activeChannels.length,
              selectedChannels,
              queries,
              usedSearches: [],
              rawCount: 0,
              candidates: [],
              videos: [],
              sourceText: trimmedSourceText,
            }),
          }
        : { videos: [] };

      return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders });
    }

    const { candidates, usedSearches, rawCount } = await collectApprovedChannelCandidates({
      apiKey,
      channels: selectedChannels,
      queries,
    });
    const enrichedCandidates = await enrichCandidatesWithDetails(candidates, apiKey);
    const videos = filterVideosForStudents(enrichedCandidates, trimmedTopic, trimmedSourceText);

    const body = debug === true
      ? {
          videos,
          debug: buildDebugBody({
            topic: trimmedTopic,
            activeChannelCount: activeChannels.length,
            selectedChannels,
            queries,
            usedSearches,
            rawCount,
            candidates: enrichedCandidates,
            videos,
            sourceText: trimmedSourceText,
          }),
        }
      : { videos };

    return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('추천 영상 검색 오류:', error);
    return new Response(
      JSON.stringify({ videos: [], error: '추천 영상을 불러오지 못했어요.' }),
      { status: 200, headers: jsonHeaders }
    );
  }
}
