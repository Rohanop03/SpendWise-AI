import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  getAnalyticsOverview: vi.fn(),
  getBillingCycleAnalytics: vi.fn(),
  getCategoryAnalytics: vi.fn(),
  getPaymentStatusAnalytics: vi.fn(),
  getPreferences: vi.fn(),
  getRefundAnalytics: vi.fn(),
  getSpendingTrends: vi.fn(),
  getTopSubscriptions: vi.fn(),
  getUpcomingRenewals: vi.fn(),
  restoreSession: vi.fn(),
}));

vi.mock('recharts', async () => {
  const React = await import('react');
  const container = ({ children }) => React.createElement('div', null, children);
  const primitive = () => React.createElement('span', { 'aria-hidden': true });
  return {
    Area: primitive,
    Bar: primitive,
    BarChart: container,
    CartesianGrid: primitive,
    ComposedChart: container,
    Legend: primitive,
    Line: primitive,
    ResponsiveContainer: container,
    Tooltip: primitive,
    XAxis: primitive,
    YAxis: primitive,
  };
});

vi.mock('../api/auth.js', () => ({ restoreSession: mocks.restoreSession }));
vi.mock('../api/account.js', () => ({ getPreferences: mocks.getPreferences }));
vi.mock('../api/analytics.js', () => ({
  getAnalyticsOverview: mocks.getAnalyticsOverview,
  getBillingCycleAnalytics: mocks.getBillingCycleAnalytics,
  getCategoryAnalytics: mocks.getCategoryAnalytics,
  getPaymentStatusAnalytics: mocks.getPaymentStatusAnalytics,
  getRefundAnalytics: mocks.getRefundAnalytics,
  getSpendingTrends: mocks.getSpendingTrends,
  getTopSubscriptions: mocks.getTopSubscriptions,
}));
vi.mock('../api/billing.js', () => ({ getUpcomingRenewals: mocks.getUpcomingRenewals }));

const userFixture = {
  accountStatus: 'active',
  displayName: 'Dashboard Tester',
  email: 'dashboard@example.invalid',
  id: '1',
};

const inrSummary = {
  activeSubscriptionCount: 2,
  completedPaymentCount: 3,
  completedRefunds: '1750.00',
  currencyCode: 'INR',
  estimatedMonthlyRecurring: '649.00',
  estimatedYearlyRecurring: '7788.00',
  grossPayments: '1500.00',
  netCashFlow: '-250.00',
};

const usdSummary = {
  ...inrSummary,
  activeSubscriptionCount: 1,
  completedRefunds: '5.00',
  currencyCode: 'USD',
  estimatedMonthlyRecurring: '12.00',
  grossPayments: '20.00',
  netCashFlow: '15.00',
};

function resolveDashboardFixtures() {
  mocks.getPreferences.mockResolvedValue({ preferences: { preferredCurrency: 'INR' } });
  mocks.getAnalyticsOverview.mockResolvedValue({ currencySummaries: [inrSummary, usdSummary] });
  mocks.getSpendingTrends.mockResolvedValue({
    trends: [
      {
        completedPaymentCount: 1,
        completedRefunds: '1750.00',
        currencyCode: 'INR',
        grossPayments: '1500.00',
        netCashFlow: '-250.00',
        period: '2026-09',
        refundCount: 1,
      },
    ],
  });
  mocks.getCategoryAnalytics.mockResolvedValue({
    categories: [
      {
        categoryId: '1',
        categoryName: 'Entertainment',
        completedRefunds: '1750.00',
        currencyCode: 'INR',
        grossPayments: '1500.00',
        netCashFlow: '-250.00',
        percentageOfGross: 100,
      },
    ],
  });
  mocks.getTopSubscriptions.mockResolvedValue({
    subscriptions: [
      {
        currencyCode: 'INR',
        grossPayments: '1500.00',
        serviceName: 'Netflix Premium Family Plan',
        subscriptionId: '10',
      },
    ],
  });
  mocks.getBillingCycleAnalytics.mockResolvedValue({
    billingCycles: [
      {
        billingCycle: 'monthly',
        currencyCode: 'INR',
        estimatedMonthlyTotal: '649.00',
        subscriptionCount: 2,
      },
    ],
  });
  mocks.getPaymentStatusAnalytics.mockResolvedValue({
    statuses: [
      {
        completed: { amount: '1500.00', count: 3 },
        currencyCode: 'INR',
        failed: { amount: '200.00', count: 1 },
        pending: { amount: '300.00', count: 2 },
      },
    ],
  });
  mocks.getRefundAnalytics.mockResolvedValue({
    summaries: [
      {
        currencyCode: 'INR',
        fullyRefundedCount: 1,
        partiallyRefundedCount: 1,
        refundedPaymentCount: 2,
        totalRefundAmount: '1750.00',
      },
    ],
  });
  mocks.getUpcomingRenewals.mockResolvedValue({
    items: [
      {
        billingCycle: 'monthly',
        currencyCode: 'INR',
        daysUntilRenewal: 5,
        isOverdue: false,
        nextRenewalDate: '2026-10-20',
        price: '649.00',
        serviceName: 'Netflix Premium Family Plan',
        status: 'active',
        subscriptionId: '10',
      },
    ],
  });
}

function renderDashboard(route = '/dashboard?currency=INR&period=all_time') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Stage 8 dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreSession.mockResolvedValue({ accessToken: 'access-token', user: userFixture });
    resolveDashboardFixtures();
  });

  it('protects the dashboard route', async () => {
    mocks.restoreSession.mockRejectedValue(new Error('No session'));
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('renders PostgreSQL-backed financial values and preserves negative cash flow', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect((await screen.findAllByText('₹1,500.00')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('-₹250.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Negative cash flow retained')).toBeInTheDocument();
    expect(screen.getAllByText('₹649.00').length).toBeGreaterThan(0);
  });

  it('renders trend, category, ranking, status, refund, and renewal alternatives', async () => {
    renderDashboard();
    expect(await screen.findByText('Sep 26')).toBeInTheDocument();
    expect(screen.getByText('Entertainment')).toBeInTheDocument();
    expect(screen.getAllByText('Netflix Premium Family Plan').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('2 refunded payments')).toBeInTheDocument();
    expect(screen.getByText('Expected in 5 days')).toBeInTheDocument();
  });

  it('keeps gross category shares separate from negative net values', async () => {
    renderDashboard();
    expect(await screen.findByText(/100% of gross/)).toBeInTheDocument();
    expect(screen.getAllByText(/Net -₹250.00/).length).toBeGreaterThan(0);
  });

  it('updates API requests when currency changes', async () => {
    const user = userEvent.setup();
    renderDashboard();
    const currency = await screen.findByLabelText('Display currency');
    await screen.findByRole('option', { name: 'USD' });
    await user.selectOptions(currency, 'USD');
    await waitFor(() =>
      expect(mocks.getSpendingTrends).toHaveBeenLastCalledWith(
        expect.objectContaining({ currencyCode: 'USD' }),
        expect.any(Object),
      ),
    );
  });

  it('updates all historical requests from one date preset', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'This Month' }));
    await waitFor(() =>
      expect(mocks.getCategoryAnalytics).toHaveBeenLastCalledWith(
        expect.objectContaining({ endDate: expect.any(String), startDate: expect.any(String) }),
        expect.any(Object),
      ),
    );
  });

  it('shows a truthful empty state for a new user', async () => {
    mocks.getAnalyticsOverview.mockResolvedValue({ currencySummaries: [] });
    mocks.getSpendingTrends.mockResolvedValue({ trends: [] });
    mocks.getCategoryAnalytics.mockResolvedValue({ categories: [] });
    mocks.getTopSubscriptions.mockResolvedValue({ subscriptions: [] });
    mocks.getBillingCycleAnalytics.mockResolvedValue({ billingCycles: [] });
    mocks.getPaymentStatusAnalytics.mockResolvedValue({ statuses: [] });
    mocks.getRefundAnalytics.mockResolvedValue({ summaries: [] });
    mocks.getUpcomingRenewals.mockResolvedValue({ items: [] });
    renderDashboard();
    expect(
      await screen.findByRole('heading', { name: 'Build your subscription picture' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never invents transactions/i)).toBeInTheDocument();
  });

  it('shows loading state while dashboard requests are pending', async () => {
    const pending = new Promise(() => {});
    mocks.getAnalyticsOverview.mockReturnValue(pending);
    renderDashboard();
    expect(await screen.findByText('Loading financial overview')).toBeInTheDocument();
  });

  it('keeps successful widgets visible after a partial API failure', async () => {
    mocks.getSpendingTrends.mockRejectedValue(new Error('Trend service unavailable'));
    renderDashboard();
    expect((await screen.findAllByText('₹1,500.00')).length).toBeGreaterThan(0);
    expect(await screen.findByText(/1 dashboard section could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByText('This dashboard section could not be loaded.')).toBeInTheDocument();
  });

  it('includes responsive navigation without page-level horizontal overflow', async () => {
    const { container } = renderDashboard();
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('overflow-x-hidden');
  });
});
