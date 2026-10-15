import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for SpendWise AI.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_AUTO_START
    ? [
        {
          command: 'npm run dev:server',
          port: 5000,
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
        {
          command: 'npm run dev:client',
          port: 5173,
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
      ]
    : undefined,
});
