import { defineConfig, devices } from '@playwright/test';

/**
 * Visual, accessibility and overflow suite. Every `/api/v1` call is answered by
 * `e2e/support/mockApi.js`, so this suite runs without PostgreSQL or the Express API.
 */
export default defineConfig({
  testDir: './e2e/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev:client',
    port: 5173,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
