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

// "역사 문화유산" 고정 검색어는 문화유산 주제에는 맞지만 과학·인물·지리 등
// 다른 주제에서는 오히려 검색 결과를 좁힌다. topic이나 자료에 문화유산 관련
// 낱말이 있을 때만 그 표현을 붙이고, 그 외에는 범용 교육 검색어를 쓴다.
const HERITAGE_HINT_KEYWORDS = [
  '문화유산', '문화재', '국보', '보물', '사찰', '유적', '역사', '석탑', '석등',
];

function buildSearchQuery(topic, sourceText) {
  const isHeritageTopic = HERITAGE_HINT_KEYWORDS.some(
    k => topic.includes(k) || (sourceText || '').includes(k)
  );
  return isHeritageTopic
    ? `${topic} 초등학생 문화유산 역사 설명`
    : `${topic} 초등학생 설명 교육`;
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
    const query = buildSearchQuery(trimmedTopic, String(sourceText || ''));
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: '8',
      safeSearch: 'strict',
      relevanceLanguage: 'ko',
      regionCode: 'KR',
      videoEmbeddable: 'true',
      videoDuration: 'medium',
      key: apiKey,
    });

    const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
    if (!res.ok) {
      console.error('YouTube API 오류:', res.status, await res.text().catch(() => ''));
      return new Response(
        JSON.stringify({ videos: [], error: '추천 영상을 불러오지 못했어요.' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const data = await res.json();
    const candidates = (data.items || []).map(item => ({
      videoId: item.id?.videoId || '',
      title: decodeHtmlEntities(item.snippet?.title || ''),
      channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || ''),
      description: decodeHtmlEntities(item.snippet?.description || ''),
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
      url: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : '',
    }));

    const videos = filterVideosForStudents(candidates, trimmedTopic);

    const body = debug === true
      ? { videos, debug: { topic: trimmedTopic, rawCount: candidates.length, filteredCount: videos.length, query } }
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
