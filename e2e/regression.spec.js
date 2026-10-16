import { expect, test } from '@playwright/test';

import { installMockApi } from './support/mockApi.js';

/**
 * Revamp regression suite (REVAMP-PLAN.md §3 is the contract).
 *
 * Walks the core journey — sign up / log in, add, edit, record a payment, view renewals
 * and recommendations, change a recommendation status, archive, log out — and asserts
 * every write request keeps its method, path and payload field names.
 *
 * Real backend (default): needs `npm run dev` with a migrated + seeded database.
 * Fixture API: `E2E_MOCK=1 npx playwright test e2e/regression.spec.js` (no database).
 */
const MOCK = process.env.E2E_MOCK === '1';

const allowedKeys = {
  'PATCH /recommendations/:id': ['status'],
  'PATCH /subscriptions/:id': [
    'billingCycle',
    'categoryId',
    'currencyCode',
    'customServiceName',
    'nextRenewalDate',
    'notes',
    'planName',
    'price',
    'serviceId',
    'startDate',
    'status',
    'trialEndDate',
  ],
  'POST /auth/login': ['email', 'password'],
  'POST /auth/logout': [],
  'POST /auth/refresh': [],
  'POST /auth/register': ['displayName', 'email', 'password'],
  'POST /recommendations/generate': [],
  'POST /subscriptions': [
    'billingCycle',
    'categoryId',
    'currencyCode',
    'customServiceName',
    'nextRenewalDate',
    'notes',
    'planName',
    'price',
    'serviceId',
    'startDate',
    'status',
    'trialEndDate',
  ],
  'POST /subscriptions/:id/archive': [],
  'POST /subscriptions/:id/payments': [
    'amount',
    'billingPeriodEnd',
    'billingPeriodStart',
    'currencyCode',
    'notes',
    'paymentDate',
    'paymentStatus',
  ],
};

function normalise(pathname) {
  return pathname.replace(/^.*\/api\/v1/, '').replace(/\/\d+(?=\/|$)/g, '/:id');
}

function isoInDays(days) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 10);
}

test('core journey keeps the API contract', async ({ page }) => {
  test.setTimeout(120000);
  const writes = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.includes('/api/v1/') || ['GET', 'OPTIONS'].includes(request.method())) return;
    let body;
    try {
      body = request.postDataJSON() || {};
    } catch {
      body = {};
    }
    writes.push({ body, key: `${request.method()} ${normalise(url.pathname)}` });
  });

  if (MOCK) await installMockApi(page, { authenticated: false });

  // 1. Sign up a throwaway user (real) or log in to the fixture account (mock).
  const email = `revamp.${Date.now()}@example.invalid`;
  const password = 'Revamp-Regression-2026!';
  if (MOCK) {
    await page.goto('/login');
    await page.getByLabel('Email').fill('reviewer@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  } else {
    await page.goto('/register');
    await page.getByLabel('Display name').fill('Revamp Regression');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  // 2. Add a custom subscription.
  await page.goto('/subscriptions/new');
  await page.getByRole('button', { name: 'Custom Service' }).click();
  await page.getByLabel('Custom Service Name').fill('Revamp Regression Service');
  await page.getByLabel('Price').fill('249.50');
  await page.getByLabel('Next Renewal').fill(isoInDays(5));
  await page.getByRole('button', { name: 'Create Subscription' }).click();
  await expect(page).toHaveURL(/\/subscriptions\/\d+$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Revamp Regression Service' }),
  ).toBeVisible();

  // 3. Edit it.
  await page.getByRole('link', { name: 'Edit Details' }).click();
  await page.getByLabel('Price').fill('299');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page).toHaveURL(/\/subscriptions\/\d+$/);

  // 4. Record a payment from the subscription.
  await page.getByRole('link', { name: 'Record Payment' }).click();
  await expect(page.getByLabel(/Amount Paid/)).not.toHaveValue('');
  await page.getByRole('button', { name: 'Record Payment', exact: true }).click();
  await expect(page).toHaveURL(/\/payments\/\d+$/);
  await expect(
    page.getByText(/Subscription renewal date \(as stored by the backend\)/i),
  ).toBeVisible();

  // 5. Renewals (billing) and reminders.
  await page.goto('/billing');
  await expect(page.getByRole('heading', { level: 1, name: 'Billing Overview' })).toBeVisible();
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { level: 1, name: 'Notification Center' })).toBeVisible();

  // 6. Recommendations: analyse, then change a status when one exists.
  await page.goto('/recommendations');
  await page.getByRole('button', { name: 'Analyze my subscriptions' }).click();
  await expect(page.getByText(/recommendations? evaluated/)).toBeVisible();
  const dismiss = page.getByRole('button', { name: 'Dismiss' }).first();
  if (await dismiss.isVisible()) await dismiss.click();

  // 7. Archive the subscription (soft delete) with the confirmation dialog.
  await page.goto('/subscriptions');
  await page.getByRole('link', { name: 'Revamp Regression Service' }).first().click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Archive Subscription' }).click();
  await expect(page.getByRole('button', { name: 'Restore Subscription' })).toBeVisible();

  // 8. Log out.
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('You have been securely logged out.')).toBeVisible();

  // Contract: every write hit a known endpoint with only the documented field names.
  for (const write of writes) {
    expect(Object.keys(allowedKeys), `unexpected endpoint ${write.key}`).toContain(write.key);
    for (const field of Object.keys(write.body)) {
      expect(allowedKeys[write.key], `${write.key} sent unexpected field "${field}"`).toContain(
        field,
      );
    }
  }
  const keys = writes.map((write) => write.key);
  for (const required of [
    'POST /subscriptions',
    'PATCH /subscriptions/:id',
    'POST /subscriptions/:id/payments',
    'POST /recommendations/generate',
    'POST /subscriptions/:id/archive',
    'POST /auth/logout',
  ]) {
    expect(keys).toContain(required);
  }
  const created = writes.find((write) => write.key === 'POST /subscriptions');
  expect(created.body).toMatchObject({
    billingCycle: 'monthly',
    customServiceName: 'Revamp Regression Service',
    price: 249.5,
    status: 'active',
  });
  expect(created.body).not.toHaveProperty('serviceId');
  const payment = writes.find((write) => write.key === 'POST /subscriptions/:id/payments');
  expect(payment.body.amount).toMatch(/^\d+\.\d{2}$/);
  expect(payment.body.paymentStatus).toBe('completed');
});
