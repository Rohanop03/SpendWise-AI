import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  downloadReportCsv: vi.fn(),
  getAnalyticsOverview: vi.fn(),
  getBillingCycleAnalytics: vi.fn(),
  getCategoryAnalytics: vi.fn(),
  getPaymentStatusAnalytics: vi.fn(),
  getPreferences: vi.fn(),
  getRefundAnalytics: vi.fn(),
  getSpendingTrends: vi.fn(),
  getSubscriptionAnalytics: vi.fn(),
  getTopSubscriptions: vi.fn(),
  restoreSession: vi.fn(),
}));

vi.mock('../api/auth.js', () => ({
  restoreSession: mocks.restoreSession,
}));

vi.mock('../api/account.js', () => ({
  getPreferences: mocks.getPreferences,
}));

vi.mock('../api/analytics.js', () => ({
  downloadReportCsv: mocks.downloadReportCsv,
  getAnalyticsOverview: mocks.getAnalyticsOverview,
  getBillingCycleAnalytics: mocks.getBillingCycleAnalytics,
  getCategoryAnalytics: mocks.getCategoryAnalytics,
  getPaymentStatusAnalytics: mocks.getPaymentStatusAnalytics,
  getRefundAnalytics: mocks.getRefundAnalytics,
  getSpendingTrends: mocks.getSpendingTrends,
  getSubscriptionAnalytics: mocks.getSubscriptionAnalytics,
  getTopSubscriptions: mocks.getTopSubscriptions,
}));

const userFixture = {
  accountStatus: 'active',
  createdAt: '2026-10-15T00:00:00.000Z',
  displayName: 'Analytics Tester',
  email: 'analytics@example.invalid',
  id: '1',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

const overviewFixture = {
  currencySummaries: [
    {
      activeSubscriptionCount: 2,
      completedPaymentCount: 3,
      completedRefunds: '150.00',
      currencyCode: 'INR',
      estimatedMonthlyRecurring: '1000.00',
      estimatedYearlyRecurring: '12000.00',
      failedAmount: '0.00',
      failedPaymentCount: 0,
      grossPayments: '1500.00',
      netCashFlow: '1350.00',
      pendingAmount: '0.00',
      pendingPaymentCount: 0,
      refundCount: 1,
    },
  ],
  period: { endDate: null, startDate: null },
};

const trendsFixture = {
  period: { endDate: null, interval: 'monthly', startDate: null },
  trends: [
    {
      completedPaymentCount: 2,
      completedRefunds: '0.00',
      currencyCode: 'INR',
      grossPayments: '1000.00',
      netCashFlow: '1000.00',
      period: '2026-01',
      refundCount: 0,
    },
    {
      completedPaymentCount: 1,
      completedRefunds: '150.00',
      currencyCode: 'INR',
      grossPayments: '500.00',
      netCashFlow: '350.00',
      period: '2026-02',
      refundCount: 1,
    },
  ],
};

const categoriesFixture = {
  categories: [
    {
      categoryId: '1',
      categoryName: 'Entertainment',
      completedPaymentCount: 2,
      completedRefunds: '150.00',
      currencyCode: 'INR',
      grossPayments: '1000.00',
      netCashFlow: '850.00',
      percentageOfGross: 66.67,
      refundCount: 1,
    },
    {
      categoryId: '2',
      categoryName: 'Productivity',
      completedPaymentCount: 1,
      completedRefunds: '0.00',
      currencyCode: 'INR',
      grossPayments: '500.00',
      netCashFlow: '500.00',
      percentageOfGross: 33.33,
      refundCount: 0,
    },
  ],
  period: { endDate: null, startDate: null },
};

const subscriptionsFixture = {
  pagination: { limit: 50, offset: 0, totalCount: 2 },
  subscriptions: [
    {
      archivedAt: null,
      billingCycle: 'monthly',
      categoryId: '1',
      categoryName: 'Entertainment',
      completedPaymentCount: 2,
      completedRefunds: '150.00',
      currencyCode: 'INR',
      currentPrice: '649.00',
      estimatedMonthlyCost: '649.00',
      grossPayments: '1000.00',
      netCashFlow: '850.00',
      refundCount: 1,
      serviceName: 'Netflix',
      status: 'active',
      subscriptionId: '10',
    },
    {
      archivedAt: null,
      billingCycle: 'monthly',
      categoryId: '2',
      categoryName: 'Productivity',
      completedPaymentCount: 1,
      completedRefunds: '0.00',
      currencyCode: 'INR',
      currentPrice: '350.00',
      estimatedMonthlyCost: '350.00',
      grossPayments: '500.00',
      netCashFlow: '500.00',
      refundCount: 0,
      serviceName: 'Notion',
      status: 'active',
      subscriptionId: '11',
    },
  ],
};

const topRecurringFixture = {
  limit: 5,
  subscriptions: [
    {
      billingCycle: 'monthly',
      categoryName: 'Entertainment',
      currencyCode: 'INR',
      currentPrice: '649.00',
      normalizedMonthlyCost: '649.00',
      serviceName: 'Netflix',
      status: 'active',
      subscriptionId: '10',
    },
  ],
  type: 'recurring',
};

const topHistoricalFixture = {
  limit: 5,
  subscriptions: [
    {
      billingCycle: 'monthly',
      categoryName: 'Entertainment',
      completedPaymentCount: 2,
      currencyCode: 'INR',
      currentPrice: '649.00',
      grossPayments: '1000.00',
      serviceName: 'Netflix',
      status: 'active',
      subscriptionId: '10',
    },
  ],
  type: 'historical',
};

const billingCyclesFixture = {
  billingCycles: [
    {
      activeCount: 2,
      billingCycle: 'monthly',
      currencyCode: 'INR',
      estimatedMonthlyTotal: '1000.00',
      estimatedYearlyTotal: '12000.00',
      subscriptionCount: 2,
      trialCount: 0,
    },
  ],
};

const paymentStatusFixture = {
  period: { endDate: null, startDate: null },
  statuses: [
    {
      cancelled: { amount: '0.00', count: 0, label: 'Cancelled' },
      completed: { amount: '1500.00', count: 3, label: 'Realized' },
      currencyCode: 'INR',
      failed: { amount: '0.00', count: 0, label: 'Unsuccessful' },
      pending: { amount: '0.00', count: 0, label: 'Unconfirmed' },
    },
  ],
};

function renderAnalytics(initialRoute = '/analytics') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('frontend spending analytics and reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();

    mocks.restoreSession.mockResolvedValue({
      accessToken: 'access-token',
      user: userFixture,
    });
    mocks.getPreferences.mockResolvedValue({
      preferences: { preferredCurrency: 'INR' },
    });
    mocks.getAnalyticsOverview.mockResolvedValue(overviewFixture);
    mocks.getSpendingTrends.mockResolvedValue(trendsFixture);
    mocks.getCategoryAnalytics.mockResolvedValue(categoriesFixture);
    mocks.getSubscriptionAnalytics.mockResolvedValue(subscriptionsFixture);
    mocks.getTopSubscriptions.mockImplementation(async ({ type }) => {
      return type === 'recurring' ? topRecurringFixture : topHistoricalFixture;
    });
    mocks.getBillingCycleAnalytics.mockResolvedValue(billingCyclesFixture);
    mocks.getPaymentStatusAnalytics.mockResolvedValue(paymentStatusFixture);
  });

  it('renders analytics overview with financial metrics and top subscriptions', async () => {
    renderAnalytics();

    // Wait for async data loading to complete
    await waitFor(() => {
      expect(screen.getByText(/Financial Summary/i)).toBeInTheDocument();
    });

    // Check financial overview values
    expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThanOrEqual(1); // Gross
    expect(screen.getByText('₹150.00')).toBeInTheDocument(); // Refunds
    expect(screen.getByText('₹1,350.00')).toBeInTheDocument(); // Net Cash Flow

    // Check top expensive subscription
    expect(screen.getByText('Top Expensive Subscriptions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Netflix' })).toBeInTheDocument();
  });

  it('navigates to monthly trends tab and renders cash flow table', async () => {
    const user = userEvent.setup();
    renderAnalytics();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Monthly Trends' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Monthly Trends' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Monthly Cash Flow Trends/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('Feb 2026')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('₹350.00')).toBeInTheDocument();
  });

  it('navigates to category expenses tab and renders category breakdown', async () => {
    const user = userEvent.setup();
    renderAnalytics();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Category Expenses' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Category Expenses' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Category Expense Breakdown/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Entertainment')).toBeInTheDocument();
    expect(screen.getByText('Productivity')).toBeInTheDocument();
    expect(screen.getByText('66.67%')).toBeInTheDocument();
    expect(screen.getByText('33.33%')).toBeInTheDocument();
  });

  it('navigates to subscription spending tab and renders subscriptions table', async () => {
    const user = userEvent.setup();
    renderAnalytics();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Subscription Spending' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Subscription Spending' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Subscription-Wise Spending/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Netflix' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notion' })).toBeInTheDocument();
  });

  it('navigates to billing cycles & status tab and renders cycle cards', async () => {
    const user = userEvent.setup();
    renderAnalytics();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Billing Cycles & Status' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Billing Cycles & Status' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 3, name: /Billing Cycle Distribution/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText(/2 active, 0 trial/i)).toBeInTheDocument();
  });

  it('filters by date preset and triggers export CSV', async () => {
    const user = userEvent.setup();
    mocks.downloadReportCsv.mockResolvedValue(new Blob(['csv data'], { type: 'text/csv' }));

    renderAnalytics();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'This Month' })).toBeInTheDocument();
    });

    // Click 'This Month' preset
    await user.click(screen.getByRole('button', { name: 'This Month' }));

    // Expect getAnalyticsOverview to be called with date range
    await waitFor(() => {
      expect(mocks.getAnalyticsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
        }),
      );
    });

    // Click Export CSV
    const exportButton = screen.getByRole('button', { name: /Export CSV/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mocks.downloadReportCsv).toHaveBeenCalled();
    });
  });

  it('displays empty state when user has no financial records', async () => {
    mocks.getAnalyticsOverview.mockResolvedValue({ currencySummaries: [] });
    mocks.getSpendingTrends.mockResolvedValue({ trends: [] });
    mocks.getCategoryAnalytics.mockResolvedValue({ categories: [] });
    mocks.getSubscriptionAnalytics.mockResolvedValue({ subscriptions: [] });
    mocks.getTopSubscriptions.mockResolvedValue({ subscriptions: [] });
    mocks.getBillingCycleAnalytics.mockResolvedValue({ billingCycles: [] });
    mocks.getPaymentStatusAnalytics.mockResolvedValue({ statuses: [] });

    renderAnalytics();

    await waitFor(() => {
      expect(
        screen.getByText('No completed payment records found for this period.'),
      ).toBeInTheDocument();
    });
  });
});
