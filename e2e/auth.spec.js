import { test, expect } from '@playwright/test';

test.describe('Authentication and SaaS Landing Flow', () => {
  test('landing page loads with professional SaaS copy and no internal stage references', async ({
    page,
  }) => {
    await page.goto('/');

    // Check page title and brand
    await expect(page).toHaveTitle(/SpendWise AI/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Verify absence of outdated stage references
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toMatch(/stage \d+/i);
    expect(bodyText).not.toMatch(/being built/i);
    expect(bodyText).not.toMatch(/coming in the next stage/i);

    // Verify key SaaS navigation links
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /create account|get started/i }).first(),
    ).toBeVisible();
  });

  test('navigates from landing to registration and completes registration flow', async ({
    page,
  }) => {
    await page.goto('/register');

    const timestamp = Date.now();
    const testEmail = `e2e.user.${timestamp}@example.invalid`;

    await page.fill('input[name="displayName"]', 'E2E Test User');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'StrongPassw0rd!2026');
    await page.fill('input[name="confirmPassword"]', 'StrongPassw0rd!2026');

    await page.click('button[type="submit"]');

    // Upon registration, app redirects to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(/dashboard|subscriptions|welcome/i).first()).toBeVisible();
  });

  test('validates mismatched passwords on registration', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="displayName"]', 'Mismatch User');
    await page.fill('input[name="email"]', 'mismatch@example.invalid');
    await page.fill('input[name="password"]', 'PasswordA123!');
    await page.fill('input[name="confirmPassword"]', 'PasswordB123!');

    await page.click('button[type="submit"]');

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    expect(page.url()).toContain('/register');
  });

  test('rejects invalid login credentials with an error message', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'nonexistent@example.invalid');
    await page.fill('input[name="password"]', 'WrongPassword123!');

    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid email or password|authentication/i)).toBeVisible();
  });
});
