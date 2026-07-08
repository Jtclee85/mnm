import { filterVideosForStudents } from '../../lib/youtubeVideoFilter';

// 조사주제와 관련된 초등학생용 YouTube 영상을 검색해 추천한다.
// API Key는 서버 환경변수(YOUTUBE_API_KEY)로만 다루며 클라이언트에 노출하지 않는다.
// 보조 기능이므로 키가 없거나 호출이 실패해도 200 + 빈 배열로 답해 앱을 깨지 않는다.
export const config = {
  runtime: 'edge',
};

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  // 같은 검색어에 대한 반복 호출을 CDN에서 흡수 — YouTube API 쿼터 절약
  'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
};

// YouTube Search API의 snippet.title은 HTML 이스케이프되어 온다 (&quot; 등)
function decodeHtmlEntities(text = '') {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// "초등학생 어린이" 같은 넓은 검색어는 더빙 영상·키즈 채널·잡영상을 끌어온다.
// topic 자체와 주제 성격(문화유산 등)에 맞춘 여러 개의 구체적인 검색어를 만들어
// 그중 필요한 만큼만 순서대로 사용한다 (품질이 낮으면 다음 검색어로 보충).
export function buildVideoSearchQueries(topic, sourceText = '') {
  const normalized = String(topic || '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const queries = [];
  const haystack = `${topic} ${sourceText}`;

  const hasDolmen = /고인돌|지석묘|선사|청동기|세계문화유산|강화/.test(haystack);
  if (hasDolmen) {
    queries.push('고인돌 문화유산 설명');
    queries.push('지석묘 고인돌 선사시대');
    queries.push('강화 고인돌 세계문화유산');
    queries.push('고인돌 초등 사회');
  }

  const heritageHints = ['문화유산', '문화재', '국보', '보물', '사찰', '유적', '역사', '석탑', '석등'];
  const isHeritageTopic = heritageHints.some(k => haystack.includes(k));

  if (isHeritageTopic) {
    queries.push(`${normalized} 문화유산 설명`);
    queries.push(`${normalized} 역사 교육`);
    queries.push(`${normalized} 초등 사회`);
  } else {
    queries.push(`${normalized} 설명 교육`);
    queries.push(`${normalized} 초등`);
  }

  return [...new Set(queries)].slice(0, 4);
}

// YouTube Search API 원본 아이템을 후보 영상 형태로 변환한다.
function mapYoutubeItem(item) {
  return {
    videoId: item.id?.videoId || '',
    title: decodeHtmlEntities(item.snippet?.title || ''),
    channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || ''),
    description: decodeHtmlEntities(item.snippet?.description || ''),
    thumbnailUrl:
      item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    url: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : '',
  };
}

// 검색어 하나로 YouTube Search API를 한 번 호출한다. 실패 시 빈 배열(그 검색어만 포기).
async function searchYoutubeOnce(query, apiKey) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: '6',
    safeSearch: 'strict',
    relevanceLanguage: 'ko',
    regionCode: 'KR',
    videoEmbeddable: 'true',
    videoDuration: 'medium',
    key: apiKey,
  });

  const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
  if (!res.ok) {
    console.error('YouTube API 오류:', query, res.status, await res.text().catch(() => ''));
    return [];
  }
  const data = await res.json();
  return (data.items || []).map(mapYoutubeItem);
}

function dedupeByVideoId(candidates) {
  const seen = new Set();
  return candidates.filter(video => {
    if (!video.videoId || seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    return true;
  });
}

// 검색어를 앞에서부터 사용해 후보를 모은다. 처음 2개는 병렬로 호출해 지연을 줄이고,
// 후보가 충분(6개 이상)하지 않으면 남은 검색어를 순서대로 추가 호출한다.
// YouTube 검색은 호출당 쿼터 비용이 있으므로 검색어 전부를 매번 쓰지는 않는다.
async function collectCandidates(queries, apiKey) {
  const usedQueries = [];
  let rawItems = [];

  const firstBatch = queries.slice(0, 2);
  const firstResults = await Promise.all(firstBatch.map(q => searchYoutubeOnce(q, apiKey)));
  usedQueries.push(...firstBatch);
  rawItems.push(...firstResults.flat());

  let candidates = dedupeByVideoId(rawItems);

  let nextIndex = firstBatch.length;
  while (candidates.length < 6 && nextIndex < queries.length) {
    const more = await searchYoutubeOnce(queries[nextIndex], apiKey);
    usedQueries.push(queries[nextIndex]);
    rawItems.push(...more);
    candidates = dedupeByVideoId(rawItems);
    nextIndex += 1;
  }

  return { candidates, usedQueries, rawCount: rawItems.length };
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
    const queries = buildVideoSearchQueries(trimmedTopic, String(sourceText || ''));
    const { candidates, usedQueries, rawCount } = await collectCandidates(queries, apiKey);

    if (rawCount === 0) {
      return new Response(
        JSON.stringify({ videos: [], error: '추천 영상을 불러오지 못했어요.' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const videos = filterVideosForStudents(candidates, trimmedTopic);

    const body = debug === true
      ? {
          videos,
          debug: {
            topic: trimmedTopic,
            queries,
            usedQueries,
            rawCount,
            dedupedCount: candidates.length,
            filteredCount: videos.length,
          },
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
