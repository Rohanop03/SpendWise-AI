/**
 * Deterministic API fixtures for the visual / accessibility / overflow suite.
 *
 * These responses mirror the real `/api/v1` response shapes so the frontend can be
 * rendered without PostgreSQL. They exist only in test tooling; the application itself
 * never ships or displays fixture data. Real-backend behaviour is covered by
 * `e2e/regression.spec.js` and the other specs in this folder.
 */

const DAY = 24 * 60 * 60 * 1000;

function isoDate(offsetDays = 0, from = new Date()) {
  const date = new Date(from.getTime() + offsetDays * DAY);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthKey(offsetMonths) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export const fixtureUser = {
  accountStatus: 'active',
  createdAt: '2026-01-04T09:00:00.000Z',
  displayName: 'Demo Reviewer',
  email: 'reviewer@example.invalid',
  id: '1',
  updatedAt: '2026-01-04T09:00:00.000Z',
};

const categories = [
  { description: 'Streaming and media', id: '1', name: 'Entertainment' },
  { description: 'Work tools', id: '2', name: 'Productivity' },
  { description: 'Music and audio', id: '3', name: 'Music' },
  { description: 'Storage and hosting', id: '4', name: 'Cloud' },
  { description: 'Health and fitness', id: '5', name: 'Fitness' },
  { description: 'News and reading', id: '6', name: 'News' },
];

const services = [
  { categoryName: 'Entertainment', defaultCategoryId: '1', id: '1', name: 'Netflix' },
  { categoryName: 'Music', defaultCategoryId: '3', id: '2', name: 'Spotify' },
  { categoryName: 'Productivity', defaultCategoryId: '2', id: '3', name: 'Notion' },
  { categoryName: 'Cloud', defaultCategoryId: '4', id: '4', name: 'Google One' },
  { categoryName: 'Entertainment', defaultCategoryId: '1', id: '5', name: 'Disney+ Hotstar' },
];

function subscription(overrides) {
  return {
    archivedAt: null,
    cancelledAt: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    customServiceName: null,
    notes: null,
    planName: null,
    serviceWebsiteUrl: null,
    startDate: '2026-02-01',
    status: 'active',
    trialEndDate: null,
    updatedAt: '2026-02-01T10:00:00.000Z',
    userId: '1',
    ...overrides,
  };
}

function buildSubscriptions() {
  return [
    subscription({
      billingCycle: 'monthly',
      categoryId: '1',
      categoryName: 'Entertainment',
      currencyCode: 'INR',
      id: '11',
      nextRenewalDate: isoDate(2),
      notes: 'Shared with family.',
      planName: 'Premium 4K',
      price: '649.00',
      serviceId: '1',
      serviceName: 'Netflix',
    }),
    subscription({
      billingCycle: 'monthly',
      categoryId: '3',
      categoryName: 'Music',
      currencyCode: 'INR',
      id: '12',
      nextRenewalDate: isoDate(6),
      planName: 'Individual',
      price: '119.00',
      serviceId: '2',
      serviceName: 'Spotify',
    }),
    subscription({
      billingCycle: 'yearly',
      categoryId: '4',
      categoryName: 'Cloud',
      currencyCode: 'INR',
      id: '13',
      nextRenewalDate: isoDate(19),
      planName: '200 GB',
      price: '1300.00',
      serviceId: '4',
      serviceName: 'Google One',
    }),
    subscription({
      billingCycle: 'quarterly',
      categoryId: '1',
      categoryName: 'Entertainment',
      currencyCode: 'INR',
      id: '14',
      nextRenewalDate: isoDate(11),
      planName: 'Super',
      price: '299.00',
      serviceId: '5',
      serviceName: 'Disney+ Hotstar',
    }),
    subscription({
      billingCycle: 'monthly',
      categoryId: '5',
      categoryName: 'Fitness',
      currencyCode: 'INR',
      customServiceName: 'Campus Gym',
      id: '15',
      nextRenewalDate: isoDate(25),
      price: '900.00',
      serviceId: null,
      serviceName: 'Campus Gym',
    }),
    subscription({
      billingCycle: 'monthly',
      categoryId: '2',
      categoryName: 'Productivity',
      currencyCode: 'USD',
      id: '16',
      nextRenewalDate: isoDate(9),
      planName: 'Plus',
      price: '10.00',
      serviceId: '3',
      serviceName: 'Notion',
      status: 'trial',
      trialEndDate: isoDate(9),
    }),
    subscription({
      billingCycle: 'monthly',
      cancelledAt: '2026-08-02T10:00:00.000Z',
      categoryId: '6',
      categoryName: 'News',
      currencyCode: 'INR',
      customServiceName: 'Daily Paper Digital',
      id: '17',
      nextRenewalDate: null,
      price: '199.00',
      serviceId: null,
      serviceName: 'Daily Paper Digital',
      status: 'cancelled',
    }),
  ];
}

function buildPayments(subscriptions) {
  const rows = [];
  let id = 300;
  const paid = subscriptions.filter(
    (item) => item.currencyCode === 'INR' && item.status !== 'trial',
  );
  for (let back = 0; back < 6; back += 1) {
    for (const item of paid) {
      if (item.billingCycle === 'yearly' && back !== 4) continue;
      if (item.billingCycle === 'quarterly' && back % 3 !== 1) continue;
      if (item.status === 'cancelled' && back < 3) continue;
      id += 1;
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth() - back, 3 + (id % 20));
      const paymentDate = isoDate(0, date);
      const refunded = id === 305 ? '119.00' : '0.00';
      rows.push({
        amount: item.price,
        billingPeriodEnd: null,
        billingPeriodStart: null,
        categoryName: item.categoryName,
        createdAt: `${paymentDate}T10:00:00.000Z`,
        currencyCode: item.currencyCode,
        customServiceName: item.customServiceName,
        id: String(id),
        netAmount: (Number(item.price) - Number(refunded)).toFixed(2),
        notes: null,
        paymentDate,
        paymentStatus: id === 309 ? 'pending' : 'completed',
        planName: item.planName,
        refundCount: refunded === '0.00' ? 0 : 1,
        remainingRefundable: (Number(item.price) - Number(refunded)).toFixed(2),
        serviceName: item.serviceName,
        subscriptionId: item.id,
        totalRefunded: refunded,
      });
    }
  }
  return rows.sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));
}

function upcomingItems(subscriptions, days) {
  return subscriptions
    .filter((item) => ['active', 'trial'].includes(item.status) && item.nextRenewalDate)
    .map((item) => {
      const diff = Math.round(
        (new Date(`${item.nextRenewalDate}T00:00:00`) - new Date(`${isoDate(0)}T00:00:00`)) / DAY,
      );
      const divisor = { monthly: 1, quarterly: 3, yearly: 12 }[item.billingCycle];
      return {
        billingCycle: item.billingCycle,
        categoryName: item.categoryName,
        currencyCode: item.currencyCode,
        customServiceName: item.customServiceName,
        daysUntilRenewal: diff,
        isOverdue: diff < 0,
        monthlyEquivalent: (Number(item.price) / divisor).toFixed(2),
        nextRenewalDate: item.nextRenewalDate,
        overdueNotice: diff < 0 ? 'Renewal date passed — payment status unconfirmed' : null,
        planName: item.planName,
        price: item.price,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        status: item.status,
        subscriptionId: item.id,
        trialEndDate: item.trialEndDate,
      };
    })
    .filter((item) => item.isOverdue || item.daysUntilRenewal <= days)
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
}

const recommendations = [
  {
    confidence: 'high',
    createdAt: '2026-10-10T08:00:00.000Z',
    currencyCode: 'INR',
    estimatedSavings: '299.00',
    evaluatedAt: '2026-10-10T08:00:00.000Z',
    evidence: {
      limitation: 'Overlap is inferred from category only; content libraries differ.',
      savingsSubscriptionId: '14',
    },
    explanation:
      'Two current Entertainment streaming subscriptions renew within the same month and serve the same category.',
    id: '41',
    priority: 'high',
    savingsPeriod: 'monthly',
    status: 'active',
    subscriptions: [
      {
        billingCycle: 'monthly',
        currencyCode: 'INR',
        id: '11',
        price: '649.00',
        serviceName: 'Netflix',
      },
      {
        billingCycle: 'quarterly',
        currencyCode: 'INR',
        id: '14',
        price: '299.00',
        serviceName: 'Disney+ Hotstar',
      },
    ],
    suggestedAction: 'Review whether both streaming services are still used.',
    title: 'Potential streaming overlap',
    type: 'potential_overlap',
  },
  {
    confidence: 'medium',
    createdAt: '2026-10-10T08:00:00.000Z',
    currencyCode: 'INR',
    estimatedSavings: '900.00',
    evaluatedAt: '2026-10-10T08:00:00.000Z',
    evidence: {
      limitation: 'Usage is not tracked; this is cost-based only.',
      savingsSubscriptionId: '15',
    },
    explanation: 'Campus Gym is your highest recurring monthly cost in INR.',
    id: '42',
    priority: 'medium',
    savingsPeriod: 'monthly',
    status: 'active',
    subscriptions: [
      {
        billingCycle: 'monthly',
        currencyCode: 'INR',
        id: '15',
        price: '900.00',
        serviceName: 'Campus Gym',
      },
    ],
    suggestedAction: 'Confirm the membership is still worth its monthly cost.',
    title: 'High recurring cost',
    type: 'high_recurring_cost',
  },
  {
    confidence: 'high',
    createdAt: '2026-10-10T08:00:00.000Z',
    currencyCode: 'USD',
    estimatedSavings: null,
    evaluatedAt: '2026-10-10T08:00:00.000Z',
    evidence: { limitation: null },
    explanation: 'The Notion trial ends soon and will convert to a paid plan.',
    id: '43',
    priority: 'low',
    savingsPeriod: null,
    status: 'active',
    subscriptions: [
      {
        billingCycle: 'monthly',
        currencyCode: 'USD',
        id: '16',
        price: '10.00',
        serviceName: 'Notion',
      },
    ],
    suggestedAction: 'Decide before the trial end date.',
    title: 'Trial ending soon',
    type: 'trial_review',
  },
];

function trends() {
  const rows = [];
  const values = [2068, 1767, 2367, 1767, 3067, 1767, 2068, 2367, 1767, 2068, 2367, 1948];
  for (let i = 11; i >= 0; i -= 1) {
    const gross = values[11 - i];
    const refunds = i === 3 ? 119 : 0;
    rows.push({
      completedPaymentCount: 4,
      completedRefunds: refunds.toFixed(2),
      currencyCode: 'INR',
      grossPayments: gross.toFixed(2),
      netCashFlow: (gross - refunds).toFixed(2),
      period: monthKey(-i),
      refundCount: refunds ? 1 : 0,
    });
  }
  return rows;
}

function corsHeaders(route) {
  const origin = route.request().headers().origin || 'http://localhost:5173';
  return {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Authorization, Content-Type, X-Requested-With, Accept',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-origin': origin,
  };
}

function json(route, body, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: corsHeaders(route),
    status,
  });
}

/**
 * Installs route handlers for every `/api/v1` endpoint used by the client.
 * @param {import('@playwright/test').Page} page
 * @param {{ authenticated?: boolean, empty?: boolean, onRequest?: (info: object) => void }} options
 */
export async function installMockApi(
  page,
  { authenticated = true, empty = false, onRequest } = {},
) {
  const state = {
    authenticated,
    subscriptions: empty ? [] : buildSubscriptions(),
  };
  state.payments = empty ? [] : buildPayments(state.subscriptions);
  let nextId = 900;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '');
    const method = request.method();
    let body;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    onRequest?.({ body, method, path, query: Object.fromEntries(url.searchParams) });

    if (method === 'OPTIONS') return route.fulfill({ headers: corsHeaders(route), status: 204 });

    // Auth
    if (path === '/health') return json(route, { status: 'ok' });
    if (path === '/auth/refresh') {
      return state.authenticated
        ? json(route, { accessToken: 'fixture-token', user: fixtureUser })
        : json(route, { code: 'UNAUTHORIZED', message: 'Session expired.' }, 401);
    }
    if (path === '/auth/login') {
      if (body?.password === 'wrong-password-fixture') {
        return json(route, { message: 'Invalid email or password.' }, 401);
      }
      state.authenticated = true;
      return json(route, { accessToken: 'fixture-token', user: fixtureUser });
    }
    if (path === '/auth/register') {
      state.authenticated = true;
      return json(route, { accessToken: 'fixture-token', user: { ...fixtureUser, ...body } }, 201);
    }
    if (path === '/auth/logout') {
      state.authenticated = false;
      return json(route, { message: 'Logged out.' });
    }
    if (path === '/auth/change-password') return json(route, { message: 'Password changed.' });

    // Account
    if (path === '/users/me' && method === 'PATCH') {
      return json(route, { user: { ...fixtureUser, ...body } });
    }
    if (path === '/users/me/preferences') {
      const preferences = {
        notificationsEnabled: true,
        preferredCurrency: 'INR',
        renewalReminderDays: 3,
        renewalRemindersEnabled: true,
        timezone: 'Asia/Kolkata',
        trialReminderDays: 2,
        trialRemindersEnabled: true,
        ...(method === 'PATCH' ? body : {}),
      };
      return json(route, { preferences });
    }

    // Catalog
    if (path === '/categories') return json(route, { categories });
    if (path === '/services') return json(route, { services });

    // Subscriptions
    const subMatch = path.match(/^\/subscriptions\/(\d+)(\/[a-z]+)?$/);
    if (path === '/subscriptions' && method === 'GET') {
      const archived = url.searchParams.get('archived');
      let items = state.subscriptions.filter((item) =>
        archived === 'true' ? item.archivedAt : archived === 'all' ? true : !item.archivedAt,
      );
      const search = url.searchParams.get('search')?.toLowerCase();
      if (search) items = items.filter((item) => item.serviceName.toLowerCase().includes(search));
      for (const key of ['status', 'categoryId', 'billingCycle']) {
        const value = url.searchParams.get(key);
        if (value) items = items.filter((item) => String(item[key]) === value);
      }
      const limit = Number(url.searchParams.get('limit') || 10);
      const pageNumber = Number(url.searchParams.get('page') || 1);
      return json(route, {
        items: items.slice((pageNumber - 1) * limit, pageNumber * limit),
        pagination: {
          limit,
          page: pageNumber,
          totalCount: items.length,
          totalPages: Math.max(1, Math.ceil(items.length / limit)),
        },
      });
    }
    if (path === '/subscriptions' && method === 'POST') {
      const category = categories.find((item) => item.id === String(body.categoryId));
      const service = services.find((item) => item.id === String(body.serviceId));
      const created = subscription({
        ...body,
        categoryName: category?.name,
        id: String((nextId += 1)),
        price: Number(body.price).toFixed(2),
        serviceName: service?.name || body.customServiceName,
      });
      state.subscriptions.unshift(created);
      return json(route, { subscription: created }, 201);
    }
    if (subMatch) {
      const [, id, action] = subMatch;
      const target = state.subscriptions.find((item) => item.id === id);
      if (!target) return json(route, { message: 'Subscription not found.' }, 404);
      if (!action && method === 'GET') return json(route, { subscription: target });
      if (!action && method === 'PATCH') {
        Object.assign(target, body);
        return json(route, { subscription: target });
      }
      if (action === '/archive') {
        target.archivedAt = new Date().toISOString();
        return json(route, { subscription: target });
      }
      if (action === '/restore') {
        target.archivedAt = null;
        return json(route, { subscription: target });
      }
      if (action === '/payments' && method === 'POST') {
        const created = {
          ...body,
          id: String((nextId += 1)),
          netAmount: body.amount,
          refundCount: 0,
          refunds: [],
          remainingRefundable: body.amount,
          serviceName: target.serviceName,
          subscriptionId: id,
          totalRefunded: '0.00',
        };
        state.payments.unshift(created);
        return json(route, { payment: created }, 201);
      }
    }

    // Payments
    if (path === '/payments') {
      let items = state.payments;
      const subscriptionId = url.searchParams.get('subscriptionId');
      if (subscriptionId) items = items.filter((item) => item.subscriptionId === subscriptionId);
      const limit = Number(url.searchParams.get('limit') || 10);
      const pageNumber = Number(url.searchParams.get('page') || 1);
      return json(route, {
        items: items.slice((pageNumber - 1) * limit, pageNumber * limit),
        pagination: {
          limit,
          page: pageNumber,
          totalCount: items.length,
          totalPages: Math.max(1, Math.ceil(items.length / limit)),
        },
      });
    }
    const paymentMatch = path.match(/^\/payments\/(\d+)$/);
    if (paymentMatch) {
      const target = state.payments.find((item) => item.id === paymentMatch[1]);
      if (!target) return json(route, { message: 'Payment not found.' }, 404);
      if (method === 'PATCH') Object.assign(target, body);
      return json(route, {
        payment: {
          ...target,
          refunds:
            target.totalRefunded !== '0.00'
              ? [
                  {
                    amount: target.totalRefunded,
                    id: '501',
                    reason: 'Billed twice in one cycle.',
                    refundDate: target.paymentDate,
                    refundStatus: 'completed',
                  },
                ]
              : [],
        },
      });
    }
    if (/^\/payments\/\d+\/refunds$/.test(path)) {
      return json(
        route,
        { refund: { amount: body?.amount, id: '777', refundDate: body?.refundDate } },
        201,
      );
    }

    // Billing
    if (path === '/billing/upcoming') {
      const days = Number(url.searchParams.get('days') || 30);
      const items = upcomingItems(state.subscriptions, days);
      return json(route, { daysWindow: days, items, total: items.length });
    }
    if (path === '/billing/overview') {
      const days = Number(url.searchParams.get('days') || 30);
      const items = upcomingItems(state.subscriptions, days);
      const live = state.subscriptions.filter((item) => ['active', 'trial'].includes(item.status));
      const byCurrency = {};
      for (const item of live) {
        const divisor = { monthly: 1, quarterly: 3, yearly: 12 }[item.billingCycle];
        byCurrency[item.currencyCode] ??= {
          currencyCode: item.currencyCode,
          monthlyEquivalent: 0,
          subscriptionCount: 0,
        };
        byCurrency[item.currencyCode].monthlyEquivalent += Number(item.price) / divisor;
        byCurrency[item.currencyCode].subscriptionCount += 1;
      }
      return json(route, {
        overdueRenewals: items.filter((item) => item.isOverdue),
        recurringCosts: Object.values(byCurrency).map((row) => ({
          ...row,
          monthlyEquivalent: row.monthlyEquivalent.toFixed(2),
        })),
        stats: { daysWindow: days },
        upcomingRenewals: items.filter((item) => !item.isOverdue),
      });
    }

    // Notifications
    if (path === '/notifications/unread-count') return json(route, { count: empty ? 0 : 2 });
    if (path === '/notifications') {
      const notifications = empty
        ? []
        : [
            {
              createdAt: `${isoDate(-1)}T08:00:00.000Z`,
              id: '61',
              isRead: false,
              message: `Your Netflix subscription is scheduled to renew on ${isoDate(2)}.`,
              subscriptionId: '11',
              targetEventDate: isoDate(2),
              title: 'Netflix renewal approaching',
              type: 'renewal',
            },
            {
              createdAt: `${isoDate(-2)}T08:00:00.000Z`,
              id: '62',
              isRead: false,
              message: `Your Notion trial ends on ${isoDate(9)}.`,
              subscriptionId: '16',
              targetEventDate: isoDate(9),
              title: 'Notion trial ending',
              type: 'trial_expiration',
            },
            {
              createdAt: `${isoDate(-12)}T08:00:00.000Z`,
              id: '63',
              isRead: true,
              message: 'Your Spotify subscription renewed.',
              subscriptionId: '12',
              targetEventDate: isoDate(-10),
              title: 'Spotify renewal approaching',
              type: 'renewal',
            },
          ];
      const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
      const list = unreadOnly ? notifications.filter((item) => !item.isRead) : notifications;
      return json(route, {
        notifications: list,
        pagination: { limit: 10, page: 1, pages: list.length ? 1 : 0, total: list.length },
      });
    }
    if (/^\/notifications\/(\d+\/read|read-all)$/.test(path)) {
      return json(route, {
        notification: { id: path.split('/')[2], isRead: true },
        updatedCount: 2,
      });
    }

    // Recommendations
    if (path === '/recommendations/summary') {
      return json(route, {
        activeCount: empty ? 0 : 3,
        highPriorityCount: empty ? 0 : 1,
        hypotheticalMonthlySavings: empty ? [] : [{ amount: '1199.00', currencyCode: 'INR' }],
      });
    }
    if (path === '/recommendations/generate') {
      return json(route, { generatedCount: empty ? 0 : 3 });
    }
    if (path === '/recommendations' && method === 'GET') {
      const status = url.searchParams.get('status') || 'active';
      const list = empty ? [] : recommendations.filter((item) => item.status === status);
      return json(route, {
        pagination: { limit: 50, page: 1, pages: list.length ? 1 : 0, total: list.length },
        recommendations: list,
      });
    }
    const recMatch = path.match(/^\/recommendations\/(\d+)(\/explain)?$/);
    if (recMatch) {
      const target = recommendations.find((item) => item.id === recMatch[1]);
      if (recMatch[2]) {
        return json(route, { explanation: target?.explanation, source: 'deterministic' });
      }
      if (method === 'PATCH' && target) target.status = body.status;
      return json(route, { recommendation: target });
    }

    // Analytics
    const inrOverview = {
      activeSubscriptionCount: 5,
      completedPaymentCount: 24,
      completedRefunds: '119.00',
      currencyCode: 'INR',
      estimatedMonthlyRecurring: '1876.00',
      estimatedYearlyRecurring: '22512.00',
      failedAmount: '0.00',
      failedPaymentCount: 0,
      grossPayments: '25376.00',
      netCashFlow: '25257.00',
      pendingAmount: '119.00',
      pendingPaymentCount: 1,
      refundCount: 1,
    };
    if (path === '/analytics/overview') {
      return json(route, { currencySummaries: empty ? [] : [inrOverview] });
    }
    if (path === '/analytics/trends') return json(route, { trends: empty ? [] : trends() });
    if (path === '/analytics/categories') {
      return json(route, {
        categories: empty
          ? []
          : [
              ['1', 'Entertainment', 9480, 37.36],
              ['5', 'Fitness', 5400, 21.28],
              ['3', 'Music', 714, 2.81],
              ['4', 'Cloud', 1300, 5.12],
              ['6', 'News', 597, 2.35],
            ].map(([categoryId, categoryName, gross, pct]) => ({
              categoryId,
              categoryName,
              completedPaymentCount: 6,
              completedRefunds: categoryId === '3' ? '119.00' : '0.00',
              currencyCode: 'INR',
              grossPayments: gross.toFixed(2),
              netCashFlow: (gross - (categoryId === '3' ? 119 : 0)).toFixed(2),
              percentageOfGross: pct,
              refundCount: categoryId === '3' ? 1 : 0,
            })),
      });
    }
    if (path === '/analytics/subscriptions') {
      return json(route, {
        pagination: { limit: 50, offset: 0, totalCount: empty ? 0 : 5 },
        subscriptions: empty
          ? []
          : state.subscriptions
              .filter((item) => item.currencyCode === 'INR')
              .map((item, index) => ({
                archivedAt: null,
                billingCycle: item.billingCycle,
                categoryId: item.categoryId,
                categoryName: item.categoryName,
                completedPaymentCount: 6 - index,
                completedRefunds: '0.00',
                currencyCode: item.currencyCode,
                currentPrice: item.price,
                grossPayments: (Number(item.price) * (6 - index)).toFixed(2),
                netCashFlow: (Number(item.price) * (6 - index)).toFixed(2),
                serviceName: item.serviceName,
                status: item.status,
                subscriptionId: item.id,
              })),
      });
    }
    if (path === '/analytics/top-subscriptions') {
      const type = url.searchParams.get('type');
      return json(route, {
        subscriptions: empty
          ? []
          : state.subscriptions
              .filter((item) => item.currencyCode === 'INR' && item.status === 'active')
              .slice(0, 5)
              .map((item, index) => ({
                billingCycle: item.billingCycle,
                categoryName: item.categoryName,
                completedPaymentCount: 6 - index,
                currencyCode: item.currencyCode,
                currentPrice: item.price,
                grossPayments: (Number(item.price) * (6 - index)).toFixed(2),
                normalizedMonthlyCost: item.price,
                serviceName: item.serviceName,
                subscriptionId: item.id,
                type,
              })),
      });
    }
    if (path === '/analytics/billing-cycles') {
      return json(route, {
        billingCycles: empty
          ? []
          : [
              ['monthly', 3, 1668],
              ['quarterly', 1, 99.67],
              ['yearly', 1, 108.33],
            ].map(([billingCycle, count, monthly]) => ({
              activeCount: count,
              billingCycle,
              currencyCode: 'INR',
              estimatedMonthlyTotal: monthly.toFixed(2),
              estimatedYearlyTotal: (monthly * 12).toFixed(2),
              subscriptionCount: count,
              trialCount: 0,
            })),
      });
    }
    if (path === '/analytics/payment-status') {
      return json(route, {
        statuses: empty
          ? []
          : [
              {
                completed: { amount: '25376.00', count: 24 },
                currencyCode: 'INR',
                failed: { amount: '0.00', count: 0 },
                pending: { amount: '119.00', count: 1 },
              },
            ],
      });
    }
    if (path === '/analytics/refunds') {
      return json(route, {
        summaries: empty
          ? []
          : [
              {
                currencyCode: 'INR',
                fullyRefundedCount: 1,
                partiallyRefundedCount: 0,
                refundedPaymentCount: 1,
                totalRefundAmount: '119.00',
              },
            ],
      });
    }
    if (path === '/analytics/report/export') {
      return route.fulfill({ body: 'section,value\n', contentType: 'text/csv', status: 200 });
    }

    return json(route, { message: `Unmocked endpoint ${method} ${path}` }, 404);
  });

  return state;
}
