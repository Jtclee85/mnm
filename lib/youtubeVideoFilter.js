// 승인 채널에서 검색된 YouTube 후보를 초등학생 학습용으로 2차 필터링한다.
// 서버(/api/recommended-videos)와 테스트에서 함께 사용한다.

export const BLOCKED_VIDEO_IDS = [
  '0uLTQzs2hwU',
];

export const BANNED_KEYWORDS = [
  '쇼츠', 'shorts',
  '더빙', '성우', '목소리', '더빙판',
  '만화', '애니', '애니메이션',
  '키즈', 'kids', 'kid',
  '장난감', '놀이', '상황극',
  '몰카', '충격', '레전드', '실화', '괴담', '공포', '썰',
  '연예인', '아이돌', '논란', '사건', '사고',
  '먹방', '게임', '광고', '투자', '주식', '정치',
  'asmr', '챌린지', '반응', '리액션',
];

export const EDUCATIONAL_KEYWORDS = [
  '설명', '알아보기', '문화유산', '문화재', '역사', '사회', '과학',
  '초등', '수업', '학습', '박물관', '탐방', '강의', '교육',
];

const MAX_RESULTS = 3;
const MIN_DURATION_SECONDS = 90;
const MAX_DURATION_SECONDS = 25 * 60;
const IDEAL_MIN_DURATION_SECONDS = 3 * 60;
const IDEAL_MAX_DURATION_SECONDS = 15 * 60;
const DOLMEN_KEYWORDS = ['고인돌', '지석묘', '선사시대', '청동기', '강화 고인돌', '세계문화유산'];

function hasRequiredFields(video) {
  return !!(video?.videoId && video?.thumbnailUrl && video?.title && video?.channelTitle);
}

function includesText(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

function normalizeSpaces(text) {
  return String(text || '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

function isDolmenTopic(topic, sourceText = '') {
  return /고인돌|지석묘|청동기|선사시대|강화 고인돌|세계문화유산/.test(`${topic || ''} ${sourceText || ''}`);
}

function getTopicKeywords(topic, sourceText = '') {
  const normalizedTopic = normalizeSpaces(topic);
  const topicTokens = normalizedTopic
    .split(/[\s,./·:;!?[\]{}'"“”‘’]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);

  const haystack = `${topic || ''} ${sourceText || ''}`;
  const domainKeywords = [
    '문화유산', '문화재', '국보', '보물', '사찰', '유적', '역사', '석탑', '석등', '박물관',
    '과학', '광합성', '전기', '자석', '화산', '날씨', '생물', '식물', '동물', '우주', '생태', '환경', '갯벌',
    '세종대왕', '독도', '신석기',
  ].filter(keyword => haystack.includes(keyword));

  return uniq([
    ...(isDolmenTopic(topic, sourceText) ? DOLMEN_KEYWORDS : []),
    normalizedTopic,
    ...topicTokens,
    ...domainKeywords,
  ]);
}

function findKeyword(video, keywords) {
  const haystack = `${video.title} ${video.description || ''} ${video.channelTitle}`.toLowerCase();
  return keywords.find(k => haystack.includes(k.toLowerCase())) || null;
}

function getVideoText(video) {
  return `${video.title || ''} ${video.description || ''} ${video.channelTitle || ''}`;
}

function matchesAnyKeyword(text, keywords) {
  return keywords.some(keyword => includesText(text, keyword));
}

function reject(reason) {
  return { accepted: false, reason };
}

export function scoreVideoForStudents(video, topic, sourceText = '') {
  if (!hasRequiredFields(video)) return reject('required field missing');
  if (!video.approvedChannelId) return reject('missing approved channel');
  if (BLOCKED_VIDEO_IDS.includes(video.videoId)) return reject(`blocked videoId: ${video.videoId}`);

  const bannedKeyword = findKeyword(video, BANNED_KEYWORDS);
  if (bannedKeyword) return reject(`banned keyword: ${bannedKeyword}`);

  const durationSeconds = Number(video.durationSeconds || 0);
  if (durationSeconds > 0 && durationSeconds < MIN_DURATION_SECONDS) return reject('duration too short');
  if (durationSeconds > MAX_DURATION_SECONDS) return reject('duration too long');

  const topicKeywords = getTopicKeywords(topic, sourceText);
  const videoText = getVideoText(video);
  const title = video.title || '';
  const description = video.description || '';
  const channelTitle = video.channelTitle || '';
  const hasTopicKeyword = topicKeywords.length === 0 || matchesAnyKeyword(videoText, topicKeywords);

  if (!hasTopicKeyword) return reject('topic keyword not found');

  const normalizedTopic = normalizeSpaces(topic);
  const exactTopicInTitle = normalizedTopic && includesText(title, normalizedTopic);
  const topicKeywordInTitle = topicKeywords.some(keyword => includesText(title, keyword));
  const topicKeywordInDescription = topicKeywords.some(keyword => includesText(description, keyword));
  const educationalKeywordMatched = findKeyword(video, EDUCATIONAL_KEYWORDS);
  const viewCount = Number(video.viewCount || 0);

  let score = 0;
  if (video.approvedChannelId) score += 10;
  if (exactTopicInTitle) score += 6;
  if (topicKeywordInTitle) score += 4;
  if (topicKeywordInDescription) score += 2;
  if (educationalKeywordMatched) score += 2;
  if (durationSeconds >= IDEAL_MIN_DURATION_SECONDS && durationSeconds <= IDEAL_MAX_DURATION_SECONDS) score += 2;
  if (viewCount > 1000) score += 1;

  if (score < 8) return reject(`score too low: ${score}`);

  return {
    accepted: true,
    score,
    video: {
      ...video,
      reason: '조사 주제와 관련된 승인 채널 영상이에요',
    },
  };
}

// 승인 채널 후보 배열에서 학습용 영상을 점수순으로 골라 최대 3개 반환한다.
// video: { videoId, title, channelTitle, description, thumbnailUrl, url }
export function filterVideosForStudents(videos, topic, sourceText = '') {
  const scored = (videos || [])
    .map(video => scoreVideoForStudents(video, topic, sourceText))
    .filter(result => result.accepted);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(item => item.video);
}

export function getRejectedVideoSamples(videos, topic, sourceText = '', limit = 5) {
  return (videos || [])
    .map(video => ({ video, result: scoreVideoForStudents(video, topic, sourceText) }))
    .filter(item => !item.result.accepted)
    .slice(0, limit)
    .map(({ video, result }) => ({
      title: video?.title || '',
      channelTitle: video?.channelTitle || '',
      reason: result.reason,
    }));
}
