const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',

  // 주 사용 환경은 1920×1080 데스크톱/교실 PC — 기본 viewport를 이 기준으로 고정한다.
  // 모바일은 보조 환경이므로 필요한 테스트 파일에서 test.use()로 개별 오버라이드한다.
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1920, height: 1080 },
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium-desktop-1920',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
