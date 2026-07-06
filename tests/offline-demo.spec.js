const { test, expect } = require('@playwright/test');

test.describe('뭐냐면 — 오프라인 데모', () => {
  test('[demo-language-api-notice] 언어 선택을 조작하면 온라인 실행 안내 팝업을 보여준다', async ({ page }) => {
    await page.goto('/offline-demo');

    await page.locator('select').first().selectOption('en');

    const modal = page.getByTestId('demo-api-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('이 기능은 api를 사용하므로 온라인 프로그램 실행이 필요합니다.');
    await expect(page.getByTestId('demo-online-run-button')).toHaveText('온라인 프로그램 실행');
    await expect(page.getByTestId('demo-online-run-button')).toHaveAttribute('href', /https:\/\/mnm-kappa\.vercel\.app\//);
  });
});
