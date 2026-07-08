// 교사가 승인할 후보 YouTube 채널 목록.
// channelId는 사람이 실제 채널을 확인한 뒤에만 채운다.
// 빈 channelId 또는 UC로 시작하지 않는 값은 추천 검색에서 제외된다.

export const APPROVED_YOUTUBE_CHANNELS = [
  {
    name: '문화유산채널',
    handle: '',
    searchName: '문화유산채널',
    channelId: '',
    tags: ['문화유산', '역사', '사회'],
    note: '문화유산·국가유산 관련 공식/교육 영상 후보',
  },
  {
    name: '국가유산청',
    handle: '',
    searchName: '국가유산청',
    channelId: '',
    tags: ['문화유산', '역사', '사회'],
    note: '국가유산 관련 공식 채널 후보',
  },
  {
    name: '국립중앙박물관',
    handle: '',
    searchName: '국립중앙박물관',
    channelId: '',
    tags: ['문화유산', '역사', '박물관', '사회'],
    note: '박물관·역사·문화유산 관련 공식 채널 후보',
  },
  {
    name: 'EBS',
    handle: '',
    searchName: 'EBS',
    channelId: '',
    tags: ['교육', '초등', '과학', '사회', '역사'],
    note: '초등 교육 자료 후보. EBS 계열 채널은 여러 개이므로 반드시 확인 필요',
  },
  {
    name: 'KBS 교양/다큐 계열',
    handle: '',
    searchName: 'KBS 다큐',
    channelId: '',
    tags: ['교육', '역사', '과학', '사회'],
    note: 'KBS 계열 채널은 여러 개이므로 반드시 확인 필요',
  },
  {
    name: '국립민속박물관',
    handle: '',
    searchName: '국립민속박물관',
    channelId: '',
    tags: ['문화유산', '역사', '박물관', '사회'],
    note: '생활사·민속·역사 자료 후보',
  },
  {
    name: '국립과천과학관',
    handle: '',
    searchName: '국립과천과학관',
    channelId: '',
    tags: ['과학', '교육', '초등'],
    note: '과학 주제 영상 후보',
  },
  {
    name: '국립생태원',
    handle: '',
    searchName: '국립생태원',
    channelId: '',
    tags: ['과학', '생태', '환경', '교육'],
    note: '생태·환경 주제 영상 후보',
  },
  {
    name: '한국교육학술정보원',
    handle: '',
    searchName: 'KERIS 한국교육학술정보원',
    channelId: '',
    tags: ['교육', '디지털', '사회'],
    note: '교육 관련 자료 후보',
  },
];

export function getActiveApprovedYoutubeChannels() {
  return APPROVED_YOUTUBE_CHANNELS.filter(channel =>
    typeof channel.channelId === 'string' &&
    channel.channelId.startsWith('UC')
  );
}
