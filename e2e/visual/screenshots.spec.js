import { test } from '@playwright/test';

import { installMockApi } from '../support/mockApi.js';
import { routes } from '../support/routes.js';

/**
 * Captures full-page screenshots of every route at 390 / 768 / 1440 px.
 * Run with SHOT_DIR=docs/revamp/before or docs/revamp/after:
 *   SHOT_DIR=docs/revamp/after npx playwright test -c playwright.visual.config.js screenshots
 */
const outputDir = process.env.SHOT_DIR;
const widths = [390, 768, 1440];

test.skip(!outputDir, 'Set SHOT_DIR to capture screenshots.');

for (const route of routes) {
  for (const width of widths) {
    test(`screenshot ${route.name} @ ${width}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ height: 900, width });
      await installMockApi(page, { authenticated: !route.public });
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      await page.screenshot({
        fullPage: true,
        path: `${outputDir}/${route.name}-${width}.png`,
      });
    });
  }
}
