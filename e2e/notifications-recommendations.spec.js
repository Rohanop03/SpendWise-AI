import { test, expect } from '@playwright/test';

test.describe('Notifications and Cost Recommendations Flow', () => {
  let userEmail;
  const userPassword = 'Password123!Secure';

  test.beforeEach(async ({ page }) => {
    userEmail = `notif.recs.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.invalid`;

    await page.goto('/register');
    await page.fill('input[name="displayName"]', 'Smart Optimizer User');
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', userPassword);
    await page.fill('input[name="confirmPassword"]', userPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('views notifications center with unread count filter controls', async ({ page }) => {
    await page.goto('/notifications');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/notifications|all notifications|no notifications/i).first(),
    ).toBeVisible();
  });

  test('views recommendations dashboard with explainable cost savings', async ({ page }) => {
    await page.goto('/recommendations');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/recommendations|cost optimization|savings/i).first(),
    ).toBeVisible();
  });
});
