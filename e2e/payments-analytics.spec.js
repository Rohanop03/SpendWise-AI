import { test, expect } from '@playwright/test';

test.describe('Payments and Spending Analytics Flow', () => {
  let userEmail;
  const userPassword = 'Password123!Secure';

  test.beforeEach(async ({ page }) => {
    userEmail = `pay.analytics.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.invalid`;

    await page.goto('/register');
    await page.fill('input[name="displayName"]', 'Analytics Tester');
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', userPassword);
    await page.fill('input[name="confirmPassword"]', userPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('views billing and payments navigation and empty states', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('/payments');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('navigates to analytics dashboard and views reporting sections', async ({ page }) => {
    await page.goto('/analytics');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/overview|spending|cash flow|trends|breakdown/i).first(),
    ).toBeVisible();
  });
});
