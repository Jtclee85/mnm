const { test, expect } = require('@playwright/test');
const { filterVideosForStudents } = require('../lib/youtubeVideoFilter');
const { buildYoutubeSearchPlan } = require('../pages/api/recommended-videos');

function makeVideo(overrides) {
  return {
    videoId: 'video-id',
    title: '교육 영상',
    channelTitle: '승인 교육 채널',
    description: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/video-id/mqdefault.jpg',
    approvedChannelId: 'UC-approved-channel',
    durationSeconds: 300,
    viewCount: 10000,
    ...overrides,
  };
}

test.describe('YouTube 승인 영상 주제 관련성 필터', () => {
  test('강화 고인돌에서는 장소명·동사 강화만 겹치는 영상을 제외한다', () => {
    const videos = [
      makeVideo({
        videoId: 'ganghwa-field-trip',
        title: '[교원 답사] 강화도 포함외교와 개항',
        description: '강화도 초지진과 개항의 현장을 걷는 역사 답사 영상',
      }),
      makeVideo({
        videoId: 'student-record-guide',
        title: '2026학년도 학교생활기록부 기재요령',
        description: '학교생활기록부 작성 역량을 강화할 수 있도록 만든 안내 영상',
      }),
      makeVideo({
        videoId: 'dolmen-guide',
        title: '강화 고인돌과 지석묘 알아보기',
        description: '청동기시대 고인돌의 구조와 강화 고인돌 유적을 설명하는 교육 영상',
      }),
    ];

    const result = filterVideosForStudents(videos, '강화 고인돌');

    expect(result.map(video => video.videoId)).toEqual(['dolmen-guide']);
  });

  test('실시간 YouTube 검색 계획은 요청당 최대 3회로 제한한다', () => {
    const channels = Array.from({ length: 8 }, (_, index) => ({
      name: `승인 채널 ${index + 1}`,
      channelId: `UC-approved-${index + 1}`,
    }));
    const queries = ['고인돌', '지석묘', '선사시대 고인돌', '강화 고인돌'];

    const plan = buildYoutubeSearchPlan(channels, queries);

    expect(plan).toHaveLength(3);
    expect(plan.map(item => item.query)).toEqual(['고인돌', '고인돌', '고인돌']);
    expect(plan.map(item => item.channel.channelId)).toEqual([
      'UC-approved-1',
      'UC-approved-2',
      'UC-approved-3',
    ]);
  });
});
