const { test, expect } = require('@playwright/test');

test.describe('뭐냐면 — 오프라인 데모', () => {
  test('[demo-language-api-notice] 언어 선택을 조작하면 온라인 실행 안내 팝업을 보여준다', async ({ page }) => {
    await page.goto('/offline-demo');
    await page.keyboard.press('Escape');

    await page.locator('select').first().selectOption('en');

    const modal = page.getByTestId('demo-api-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('이 기능은 api를 사용하므로 온라인 프로그램 실행이 필요합니다.');
    await expect(page.getByTestId('demo-online-run-button')).toHaveText('온라인 프로그램 실행');
    await expect(page.getByTestId('demo-online-run-button')).toHaveAttribute('href', /https:\/\/mnm-kappa\.vercel\.app\//);
  });

  test('[demo-starts-on-input-screen] 첫 화면에서 시작하고 분석 버튼을 누르면 snapshot 결과로 전환한다', async ({ page }) => {
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) apiRequests.push(request.url());
    });

    await page.goto('/offline-demo');

    await expect(page.getByText('자료를 조사할 때 주의점 알아보기')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('topic-input')).toHaveValue('강화 고인돌');
    await expect(page.getByTestId('source-textarea')).not.toHaveValue('');
    await expect(page.getByText('자료 조사 나침반')).toBeVisible();
    await expect(page.getByTestId('result-canvas')).toHaveCount(0);
    await expect(page.getByTestId('chatbot-toggle-button')).toBeVisible();

    await page.getByTestId('chatbot-toggle-button').click({ force: true });
    await expect(page.getByTestId('chatbot-popup')).toContainText('탁자식 고인돌과 바둑판식 고인돌은 어떻게 다를까요?');
    await page.getByLabel('닫기').click();

    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.getByTestId('mode-tab-presentation')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('조사 원본자료')).toBeVisible();
    await expect(page.getByText('쉬운설명')).toBeVisible();
    await expect(page.getByTestId('share-artifact-button')).toBeVisible();
    expect(apiRequests).toEqual([]);
  });
});
