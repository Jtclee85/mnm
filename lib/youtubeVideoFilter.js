// YouTube 검색 결과를 초등학생 학습용으로 2차 필터링한다.
// 서버(/api/recommended-videos)와 테스트에서 함께 사용한다.

// 채널명·제목·설명에 있으면 가산점을 주는 교육 계열 표현
export const PREFERRED_KEYWORDS = [
  'EBS', 'KBS', '국립', '국가유산청', '문화유산채널', '박물관',
  '어린이', '초등', '교육', '역사', '문화재', '문화유산',
];

// 제목·설명·채널명에 있으면 제외하는 표현 — 자극적이거나 학습과 무관한 콘텐츠
export const BANNED_KEYWORDS = [
  '쇼츠', 'shorts', '몰카', '충격', '레전드', '실화', '괴담', '공포', '썰',
  '연예인', '아이돌', '논란', '사건', '사고', '먹방', '게임', '광고', '투자', '주식', '정치',
];

const MAX_RESULTS = 3;

// 하나의 검색 결과가 최소 조건(필수 필드)을 갖췄는지
function hasRequiredFields(video) {
  return !!(video?.videoId && video?.thumbnailUrl && video?.title && video?.channelTitle);
}

// topic의 낱말 중 하나라도 제목·설명에 들어 있는지 (2글자 이상 낱말만 비교)
function matchesTopic(video, topic) {
  const tokens = String(topic || '')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);
  if (tokens.length === 0) return true;
  const haystack = `${video.title} ${video.description || ''}`.toLowerCase();
  return tokens.some(token => haystack.includes(token.toLowerCase()));
}

function findKeyword(video, keywords) {
  const haystack = `${video.title} ${video.description || ''} ${video.channelTitle}`.toLowerCase();
  return keywords.find(k => haystack.includes(k.toLowerCase())) || null;
}

// 검색 결과 배열에서 학습용 영상을 점수순으로 골라 최대 3개 반환한다.
// video: { videoId, title, channelTitle, description, thumbnailUrl, url }
export function filterVideosForStudents(videos, topic) {
  const scored = [];

  for (const video of videos || []) {
    if (!hasRequiredFields(video)) continue;
    if (findKeyword(video, BANNED_KEYWORDS)) continue;
    if (!matchesTopic(video, topic)) continue;

    const preferred = findKeyword(video, PREFERRED_KEYWORDS);
    scored.push({
      video: {
        ...video,
        reason: preferred
          ? `'${preferred}' 관련 채널·영상이라 믿을 수 있어요`
          : '초등학생 눈높이에 맞춰 고른 설명 영상이에요',
      },
      score: preferred ? 2 : 0,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(item => item.video);
}
