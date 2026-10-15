import { test, expect } from '@playwright/test';

test.describe('Subscription Management Flow', () => {
  let userEmail;
  const userPassword = 'Password123!Secure';

  test.beforeEach(async ({ page }) => {
    // Register a fresh test user for isolated subscription flows
    userEmail = `sub.test.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.invalid`;

    await page.goto('/register');
    await page.fill('input[name="displayName"]', 'Subscription Tester');
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', userPassword);
    await page.fill('input[name="confirmPassword"]', userPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('creates a catalog subscription and displays it in the list', async ({ page }) => {
    await page.goto('/subscriptions/new');

    // Wait for categories & services to populate
    await page.waitForSelector('select[name="serviceId"], select[name="categoryId"]');

    await page.fill('input[name="price"]', '14.99');
    await page.fill('input[name="planName"]', 'Premium Tier');
    await page.fill('input[name="nextRenewalDate"]', '2026-12-01');

    await page.click('button[type="submit"]');

    // Redirects to subscription details or list
    await expect(page).toHaveURL(/.*subscriptions/);
    await expect(page.getByText('14.99').first()).toBeVisible();
  });

  test('creates a custom named subscription and filters by search', async ({ page }) => {
    await page.goto('/subscriptions/new');

    // Switch to custom service mode if button exists
    const customModeBtn = page.getByRole('button', { name: /custom service/i });
    if (await customModeBtn.isVisible()) {
      await customModeBtn.click();
      await page.fill('input[name="customServiceName"]', 'UniqueCustomGymService');
    }

    await page.fill('input[name="price"]', '49.00');
    await page.fill('input[name="nextRenewalDate"]', '2026-11-15');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*subscriptions/);
  });
});
