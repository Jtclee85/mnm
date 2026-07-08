const { test, expect } = require('@playwright/test');

// 자료분석 로딩 꿀팁 + 분석 완료 후 추천 영상 기능 검증.

const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>테스트 이해 문장입니다.</understanding_sentence>
<easy>테스트 쉬운설명입니다.</easy>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;
const NORMAL_SOURCE =
  '강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다.';

const FAKE_VIDEOS = {
  videos: [
    {
      videoId: 'abc123',
      title: '고인돌을 쉽게 설명하는 영상',
      channelTitle: '문화유산 교육 채널',
      description: '초등학생용 설명',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
      url: 'https://www.youtube.com/watch?v=abc123',
      reason: '초등학생 눈높이에 맞춰 고른 설명 영상이에요',
    },
    {
      videoId: 'def456',
      title: '청동기 시대 이야기',
      channelTitle: '어린이 역사 채널',
      description: '역사 교육 영상',
      thumbnailUrl: 'https://i.ytimg.com/vi/def456/mqdefault.jpg',
      url: 'https://www.youtube.com/watch?v=def456',
      reason: "'어린이' 관련 채널·영상이라 믿을 수 있어요",
    },
  ],
};

async function fillAndAnalyze(page) {
  await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
  await page.getByTestId('source-textarea').fill(NORMAL_SOURCE);
  await page.getByTestId('analyze-button').click();
}

test.describe('뭐냐면 — 로딩 꿀팁 / 추천 영상', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[loading-tips] 분석 로딩 중 자료조사 꿀팁이 보인다', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      // 로딩 상태를 관찰할 수 있도록 응답을 지연시킨다
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY });
    });
    await page.route('**/api/recommended-videos', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [] }) })
    );

    await fillAndAnalyze(page);

    const tips = page.getByTestId('research-loading-tips');
    await expect(tips).toBeVisible();
    await expect(tips).toContainText('오늘의 자료조사 꿀팁');
    await expect(tips).toContainText('쉬운 설명을 준비하고 있어요');

    // 분석이 끝나면 로딩 꿀팁이 사라지고 결과가 보인다
    await expect(tips).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByTestId('result-canvas')).toBeVisible();
  });

  test('[videos-shown] 분석 완료 후 좌측 하단에 추천 영상 카드가 보인다', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
    );
    await page.route('**/api/recommended-videos', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_VIDEOS) })
    );

    await fillAndAnalyze(page);
    await expect(page.getByTestId('result-canvas')).toBeVisible();

    const section = page.getByTestId('recommended-videos');
    await expect(section).toBeVisible();
    await expect(section).toContainText('함께 보면 좋은 영상');
    await expect(section).toContainText('고인돌을 쉽게 설명하는 영상');
    await expect(section).toContainText('문화유산 교육 채널');

    // 카드는 새 탭으로 YouTube를 연다
    const firstCard = section.locator('a').first();
    await expect(firstCard).toHaveAttribute('target', '_blank');
    await expect(firstCard).toHaveAttribute('rel', /noopener/);
    await expect(firstCard).toHaveAttribute('href', /youtube\.com\/watch/);
  });

  test('[videos-hidden] 추천 결과가 없으면 섹션 자체가 숨겨진다', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
    );
    await page.route('**/api/recommended-videos', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ videos: [], error: 'YOUTUBE_API_KEY가 설정되어 있지 않습니다.' }),
      })
    );

    await fillAndAnalyze(page);
    await expect(page.getByTestId('result-canvas')).toBeVisible();

    // 섹션이 나타나지 않아야 한다 (로딩 skeleton이 정리될 시간을 준 뒤 확인)
    await page.waitForTimeout(500);
    await expect(page.getByTestId('recommended-videos')).toHaveCount(0);
  });

  test('[analysis-fail-no-videos] 분석 실패 시 추천 영상 API를 호출하지 않는다', async ({ page }) => {
    let videosCalled = false;
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: '입력 자료가 너무 깁니다. 조사자료를 짧게 줄여 주세요.' }),
      })
    );
    await page.route('**/api/recommended-videos', (route) => {
      videosCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [] }) });
    });

    await fillAndAnalyze(page);
    await expect(page.getByTestId('analysis-error')).toBeVisible();
    await page.waitForTimeout(300);
    expect(videosCalled).toBe(false);
    await expect(page.getByTestId('recommended-videos')).toHaveCount(0);
  });
});

test.describe('뭐냐면 — 오프라인 데모의 추천 영상', () => {
  test('[demo-no-api] 데모 모드에서는 YouTube API를 호출하지 않고 snapshot 영상만 쓴다', async ({ page }) => {
    let videosCalled = false;
    await page.route('**/api/recommended-videos', (route) => {
      videosCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [] }) });
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/offline-demo');

    // 튜토리얼이 실제로 뜬 뒤에 Escape로 닫아야 한다 — 뜨기 전에 누르면
    // 이후 나타난 오버레이가 analyze-button 클릭을 가로막아 타임아웃이 난다.
    await expect(page.getByText('자료를 조사할 때 주의점 알아보기')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();

    await page.waitForTimeout(500);
    expect(videosCalled).toBe(false);
  });

  test('[demo-loading-tips] 데모 분석 중에도 실제 앱처럼 로딩 화면(자료조사 꿀팁)이 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/offline-demo');

    await expect(page.getByText('자료를 조사할 때 주의점 알아보기')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('analyze-button').click();

    // 결과가 채워지기 전, 로딩 화면과 자료조사 꿀팁이 잠시 보여야 한다.
    const tips = page.getByTestId('research-loading-tips');
    await expect(tips).toBeVisible();
    await expect(tips).toContainText('오늘의 자료조사 꿀팁');

    // 잠시 뒤 로딩이 끝나고 결과 캔버스가 뜬다.
    await expect(tips).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByTestId('result-canvas')).toBeVisible();
  });
});
