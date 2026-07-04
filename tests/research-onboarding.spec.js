const { test, expect } = require('@playwright/test');

const TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const COMPASS_COLLAPSED_KEY = 'mnmResearchCompassCollapsed';

test.describe('뭐냐면 — 자료 조사 나침반 / 조사 시작 전 퀘스트 (5차)', () => {
  test.describe('조사 시작 전 퀘스트 — 첫 방문 튜토리얼', () => {
    // 전역 기본값(storageState)은 "이미 튜토리얼을 본 상태"이므로,
    // 첫 방문 동작 자체를 검증하는 이 describe 블록에서는 매번 진짜 첫 방문으로 되돌린다.
    test.use({ storageState: { cookies: [], origins: [] } });

    test('첫 방문 시 자동으로 뜨고, 5단계가 모두 존재한다', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('조사 시작 전 퀘스트')).toBeVisible();
      await expect(page.getByText('Step 1 / 5')).toBeVisible();
      await expect(page.getByText('Quest 1. 믿을 수 있는 자료 찾기')).toBeVisible();

      for (let step = 2; step <= 5; step++) {
        await page.getByRole('button', { name: '다음' }).click();
        await expect(page.getByText(`Step ${step} / 5`)).toBeVisible();
      }
      await expect(page.getByText('Quest 5. 뭐냐면으로 탐구 시작하기')).toBeVisible();
      await expect(page.getByRole('button', { name: '조사 시작하기' })).toBeVisible();
      await expect(page.getByRole('button', { name: '다음' })).toHaveCount(0);
    });

    test('이전 버튼으로 되돌아갈 수 있다', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: '이전' })).toHaveCount(0);
      await page.getByRole('button', { name: '다음' }).click();
      await expect(page.getByText('Step 2 / 5')).toBeVisible();
      await page.getByRole('button', { name: '이전' }).click();
      await expect(page.getByText('Step 1 / 5')).toBeVisible();
    });

    test('건너뛰기는 이번 접속에서만 닫고, 새로고침하면 다시 뜬다', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: '건너뛰기' }).click();
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);

      await page.reload();
      await expect(page.getByText('조사 시작 전 퀘스트')).toBeVisible();
    });

    test('"다시 보지 않기"는 완료로 표시되어 새로고침해도 다시 뜨지 않는다', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: '다시 보지 않기' }).click();
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);

      const seen = await page.evaluate((key) => localStorage.getItem(key), TUTORIAL_SEEN_KEY);
      expect(seen).toBe('true');

      await page.reload();
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);
    });

    test('"조사 시작하기"로 완료하면 다시 뜨지 않고, 나침반이 자동으로 펼쳐진다', async ({ page }) => {
      await page.goto('/');
      for (let i = 0; i < 4; i++) {
        await page.getByRole('button', { name: '다음' }).click();
      }
      await page.getByRole('button', { name: '조사 시작하기' }).click();
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);

      const seen = await page.evaluate((key) => localStorage.getItem(key), TUTORIAL_SEEN_KEY);
      expect(seen).toBe('true');

      await expect(page.getByText('🧭 자료 조사 나침반')).toBeVisible();

      await page.reload();
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);
    });

    test('ESC로 닫을 수 있다', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('조사 시작 전 퀘스트')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);
    });

    test('"조사 퀘스트 다시 보기"로 나침반에서 튜토리얼을 다시 열 수 있다', async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), TUTORIAL_SEEN_KEY);
      await page.goto('/');
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);

      await page.getByTestId('research-compass-toggle').click();
      await page.getByTestId('reopen-tutorial-button').click();
      await expect(page.getByText('조사 시작 전 퀘스트')).toBeVisible();
      await expect(page.getByText('Step 1 / 5')).toBeVisible();
    });
  });

  test.describe('자료 조사 나침반 — 상시 체크리스트', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), TUTORIAL_SEEN_KEY);
    });

    test('기본은 접힌 상태이며, 열면 체크리스트 5개가 모두 보인다', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('research-compass-toggle')).toBeVisible();
      await expect(page.getByText('🧭 자료 조사 나침반')).toHaveCount(0);

      await page.getByTestId('research-compass-toggle').click();
      await expect(page.getByText('🧭 자료 조사 나침반')).toBeVisible();
      await expect(page.getByText('어디에서 가져온 자료인가요?')).toBeVisible();
      await expect(page.getByText('누가 만든 자료인가요?')).toBeVisible();
      await expect(page.getByText('언제 만들어졌거나 고쳐졌나요?')).toBeVisible();
      await expect(page.getByText('자료 속 중요한 말은 무엇인가요?')).toBeVisible();
      await expect(page.getByText('내 생각을 뒷받침할 근거가 있나요?')).toBeVisible();
    });

    test('접기/펼치기 상태가 localStorage에 저장되어 새로고침 후에도 유지된다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('research-compass-toggle').click();
      await expect(page.getByText('🧭 자료 조사 나침반')).toBeVisible();

      let stored = await page.evaluate((key) => localStorage.getItem(key), COMPASS_COLLAPSED_KEY);
      expect(stored).toBe('false');

      await page.reload();
      await expect(page.getByText('🧭 자료 조사 나침반')).toBeVisible();

      await page.getByRole('button', { name: '자료 조사 나침반 접기' }).click();
      stored = await page.evaluate((key) => localStorage.getItem(key), COMPASS_COLLAPSED_KEY);
      expect(stored).toBe('true');

      await page.reload();
      await expect(page.getByTestId('research-compass-toggle')).toBeVisible();
      await expect(page.getByText('🧭 자료 조사 나침반')).toHaveCount(0);
    });

    test('ESC로 펼쳐진 나침반을 닫을 수 있다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('research-compass-toggle').click();
      await expect(page.getByText('🧭 자료 조사 나침반')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByText('🧭 자료 조사 나침반')).toHaveCount(0);
    });

    test('분석을 시작하면(랜딩 화면을 벗어나면) 나침반이 사라진다', async ({ page }) => {
      const FAKE_ANALYSIS_TEXT = `
<easy>이것은 테스트용 쉬운 설명입니다.</easy>
<summary>핵심 내용 1
핵심 내용 2</summary>
<keywords>키워드1
키워드2</keywords>
`;
      const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;
      await page.goto('/');
      await expect(page.getByTestId('research-compass-toggle')).toBeVisible();

      await page.route('**/api/chat', (route) =>
        route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
      );
      await page.getByTestId('topic-input').fill('세종대왕');
      await page
        .getByTestId('source-textarea')
        .fill('세종대왕은 조선의 4대 왕으로, 훈민정음을 만들어 백성들이 글을 쉽게 배울 수 있도록 했다.');
      await page.getByTestId('analyze-button').click();
      await expect(page.getByTestId('result-canvas')).toBeVisible();

      // 분석 이후 단계에서는 나침반(접힘 버튼/패널 모두)이 보이지 않아야 한다.
      await expect(page.getByTestId('research-compass-toggle')).toHaveCount(0);
      await expect(page.getByText('🧭 자료 조사 나침반')).toHaveCount(0);
    });
  });

  test.describe('모바일(390px) — 튜토리얼 + 나침반', () => {
    test.use({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });

    test('모바일에서도 튜토리얼이 뜨고, 완료 후 나침반이 바텀시트로 열린다', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('조사 시작 전 퀘스트')).toBeVisible();

      await page.getByRole('button', { name: '다시 보지 않기' }).click();
      await expect(page.getByText('조사 시작 전 퀘스트')).toHaveCount(0);
      await expect(page.getByText('🧭 자료 조사 나침반')).toBeVisible();
    });

    test('모바일 나침반 토글 버튼이 화면 안에 보인다(터치 가능)', async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), TUTORIAL_SEEN_KEY);
      await page.goto('/');
      const toggle = page.getByTestId('research-compass-toggle');
      await expect(toggle).toBeVisible();
      const box = await toggle.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    });
  });

  test.describe('기존 기능 회귀 확인', () => {
    test('나침반/튜토리얼 도입 후에도 조사 주제/자료 입력 및 분석 시작이 정상 동작한다', async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), TUTORIAL_SEEN_KEY);
      const FAKE_ANALYSIS_TEXT = `
<easy>이것은 테스트용 쉬운 설명입니다.</easy>
<summary>핵심 내용 1
핵심 내용 2</summary>
<keywords>키워드1
키워드2</keywords>
`;
      const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;
      await page.goto('/');
      await page.route('**/api/chat', (route) =>
        route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
      );
      await page.getByTestId('topic-input').fill('세종대왕');
      await page
        .getByTestId('source-textarea')
        .fill('세종대왕은 조선의 4대 왕으로, 훈민정음을 만들어 백성들이 글을 쉽게 배울 수 있도록 했다.');
      await page.getByTestId('analyze-button').click();
      await expect(page.getByTestId('result-canvas')).toBeVisible();
    });
  });
});
