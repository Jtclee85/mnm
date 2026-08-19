const { test, expect } = require('@playwright/test');

const RESEARCH_TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const APP_TUTORIAL_SEEN_KEY = 'mnmAppUsageTutorialSeen';

const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>세종대왕은 백성을 위해 훈민정음을 만든 조선의 왕입니다.</understanding_sentence>
<easy>세종대왕은 백성이 글을 쉽게 배우도록 훈민정음을 만들었어요.</easy>
<understanding_reading>자료에서 만든 까닭과 결과를 차례로 살펴보세요.</understanding_reading>
<understanding_vocabulary>훈민정음: 백성을 가르치는 바른 소리</understanding_vocabulary>
<inquiry_questions>[사실 확인형] 훈민정음은 왜 만들었을까요?</inquiry_questions>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

const LAPTOP_VIEWPORTS = [
  { name: 'windows-120-percent', width: 1600, height: 900 },
  { name: 'windows-125-percent', width: 1536, height: 864 },
];

async function preparePage(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.addInitScript(({ researchKey, appKey }) => {
    localStorage.setItem(researchKey, 'true');
    localStorage.setItem(appKey, 'true');
  }, { researchKey: RESEARCH_TUTORIAL_SEEN_KEY, appKey: APP_TUTORIAL_SEEN_KEY });
  await page.route('**/api/chat', route => route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: FAKE_SSE_BODY,
  }));
  await page.route('**/api/recommended-videos', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ videos: [] }),
  }));
  await page.goto('/');
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

for (const viewport of LAPTOP_VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}×${viewport.height})`, () => {
    test('첫 화면은 입력 카드가 위, 보조 패널 두 개가 아래에 안정적으로 배치된다', async ({ page }) => {
      await preparePage(page, viewport);

      const compact = page.getByTestId('landing-compact');
      const leftPanel = page.getByTestId('left-panel');
      const auxiliary = page.getByTestId('landing-compact-aux');
      await expect(compact).toBeVisible();

      const [formBox, auxBox] = await Promise.all([
        leftPanel.boundingBox(),
        auxiliary.boundingBox(),
      ]);
      expect(formBox).not.toBeNull();
      expect(auxBox).not.toBeNull();
      expect(formBox.y + formBox.height).toBeLessThanOrEqual(auxBox.y + 2);
      expect(formBox.width).toBeGreaterThan(700);

      const auxiliaryCards = auxiliary.locator(':scope > *');
      await expect(auxiliaryCards).toHaveCount(2);
      const first = await auxiliaryCards.nth(0).boundingBox();
      const second = await auxiliaryCards.nth(1).boundingBox();
      expect(first.x + first.width).toBeLessThanOrEqual(second.x);
      await expectNoHorizontalOverflow(page);
    });

    test('분석 후 좌우 패널과 네 개 모드 탭이 겹치거나 잘리지 않는다', async ({ page }) => {
      await preparePage(page, viewport);
      await page.getByTestId('topic-input').fill('세종대왕');
      await page.getByTestId('source-textarea').fill(
        '세종대왕은 조선의 네 번째 왕으로 백성이 쉽게 글을 익힐 수 있도록 훈민정음을 만들었습니다.'
      );
      await page.getByTestId('analyze-button').click();
      const resultCanvas = page.getByTestId('result-canvas');
      await expect(resultCanvas).toBeVisible();
      // 진입 애니메이션이 끝난 최종 레이아웃을 측정한다. 고정 wait 대신 실제
      // computed transform이 사라질 때까지 기다려 느린 노트북에서도 안정적이다.
      await expect.poll(() => resultCanvas.evaluate(el => getComputedStyle(el).transform)).toBe('none');

      const left = await page.getByTestId('left-panel').boundingBox();
      const result = await resultCanvas.boundingBox();
      expect(left).not.toBeNull();
      expect(result).not.toBeNull();
      expect(Math.abs(left.y - result.y)).toBeLessThanOrEqual(2);
      expect(left.x + left.width).toBeLessThanOrEqual(result.x);
      expect(result.x + result.width).toBeLessThanOrEqual(viewport.width);

      for (const mode of ['understand', 'inquiry', 'presentation', 'writing']) {
        const tab = page.getByTestId(`mode-tab-${mode}`);
        await expect(tab).toBeVisible();
        const tabBox = await tab.boundingBox();
        expect(tabBox.x).toBeGreaterThanOrEqual(result.x);
        expect(tabBox.x + tabBox.width).toBeLessThanOrEqual(result.x + result.width + 1);
      }
      await expectNoHorizontalOverflow(page);
    });
  });
}
