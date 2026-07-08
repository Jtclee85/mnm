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

// 검색어 자체에 topic이 이미 들어 있으므로 topic 미포함은 제외 조건이 아니라
// 감점 없는 점수 가산 요소로만 쓴다. 필수 필드·금지어만 통과하면 후보로 남긴다.
function scoreVideoForStudents(video, topic) {
  if (!hasRequiredFields(video)) return null;
  if (findKeyword(video, BANNED_KEYWORDS)) return null;

  const preferred = findKeyword(video, PREFERRED_KEYWORDS);
  const topicMatched = matchesTopic(video, topic);

  let score = 0;
  if (topicMatched) score += 2;
  if (preferred) score += 2;

  return {
    video: {
      ...video,
      reason: preferred
        ? `'${preferred}' 관련 채널·영상이라 믿을 수 있어요`
        : topicMatched
          ? '조사 주제와 관련된 설명 영상이에요'
          : '검색어와 관련성이 높은 영상이에요',
    },
    score,
  };
}

// 검색 결과 배열에서 학습용 영상을 점수순으로 골라 최대 3개 반환한다.
// video: { videoId, title, channelTitle, description, thumbnailUrl, url }
export function filterVideosForStudents(videos, topic) {
  const scored = (videos || [])
    .map(video => scoreVideoForStudents(video, topic))
    .filter(Boolean);

  const ranked = scored.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS).map(item => item.video);
  if (ranked.length > 0) return ranked;

  // 점수 매길 후보가 아예 없을 때(=필수 필드 또는 금지어 탈락)의 안전망.
  // YouTube가 topic으로 검색해 준 결과이므로 필수 필드·금지어만 통과하면 그대로 보여준다.
  return pickFallbackVideos(videos);
}

// filterVideosForStudents가 0개를 반환할 일은 이제 거의 없지만(topic 불일치가 더 이상
// 제외 사유가 아니므로), 만에 하나를 대비해 필수 필드+금지어 검사만 통과한 원본 후보를
// 앞에서부터 최대 3개 돌려준다.
function pickFallbackVideos(videos) {
  return (videos || [])
    .filter(video => hasRequiredFields(video) && !findKeyword(video, BANNED_KEYWORDS))
    .slice(0, MAX_RESULTS)
    .map(video => ({ ...video, reason: '조사 주제와 관련성이 높은 영상이에요' }));
}
