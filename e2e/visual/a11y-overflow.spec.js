import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { installMockApi } from '../support/mockApi.js';
import { routes } from '../support/routes.js';

/**
 * For every route: no axe violations (WCAG 2.2 AA tags), no console errors, and no
 * page-level horizontal overflow at each breakpoint from the revamp brief.
 */
const breakpoints = [
  [360, 780],
  [390, 844],
  [414, 896],
  [844, 390], // landscape phone
  [768, 1024],
  [834, 1112],
  [1024, 768],
  [1024, 1366],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];

const IGNORED_CONSOLE = [/You have Reduced Motion enabled/i, /Download the React DevTools/i];

for (const route of routes) {
  test(`axe + console: ${route.name}`, async ({ page }) => {
    const errors = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !IGNORED_CONSOLE.some((pattern) => pattern.test(message.text()))
      ) {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ height: 900, width: 1280 });
    await installMockApi(page, { authenticated: !route.public });
    await page.goto(route.path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const violations = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    }));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`no horizontal overflow: ${route.name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installMockApi(page, { authenticated: !route.public });
    for (const [width, height] of breakpoints) {
      await page.setViewportSize({ height, width });
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `${route.path} overflows by ${overflow}px at ${width}×${height}`,
      ).toBeLessThanOrEqual(0);
    }
  });
}

test('empty account shows designed empty states, not sample data', async ({ page }) => {
  await installMockApi(page, { empty: true });
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Build your subscription picture' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add your first subscription' })).toBeVisible();
  await page.goto('/subscriptions');
  await expect(page.getByText('No subscriptions tracked yet')).toBeVisible();
});

// `overflow-x: clip` on the app root hides page-level overflow, so also check that no
// visible content is pushed past the viewport edge (outside intentional scrollers).
for (const route of routes) {
  test(`nothing clipped at phone widths: ${route.name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installMockApi(page, { authenticated: !route.public });
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ height: 800, width });
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      const clipped = await page.evaluate(() => {
        const items = [];
        for (const el of document.querySelectorAll('a, button, input, select, h1, h2, h3, p')) {
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height || el.closest('[aria-hidden="true"]')) continue;
          let parent = el.parentElement;
          let inScroller = false;
          while (parent) {
            const style = getComputedStyle(parent);
            if (
              ['auto', 'scroll'].includes(style.overflowX) &&
              parent.scrollWidth > parent.clientWidth
            ) {
              inScroller = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!inScroller && (rect.right > window.innerWidth + 1 || rect.left < -1)) {
            items.push(`${el.tagName} "${(el.textContent || '').trim().slice(0, 30)}"`);
          }
        }
        return items;
      });
      expect(clipped, `${route.path} at ${width}px`).toEqual([]);
    }
  });
}
