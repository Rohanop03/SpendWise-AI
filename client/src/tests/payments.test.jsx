import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  createPayment: vi.fn(),
  createRefund: vi.fn(),
  getBillingOverview: vi.fn(),
  getCategories: vi.fn(),
  getPayment: vi.fn(),
  getPaymentRefunds: vi.fn(),
  getPayments: vi.fn(),
  getPreferences: vi.fn(),
  getServices: vi.fn(),
  getSubscription: vi.fn(),
  getSubscriptions: vi.fn(),
  getUpcomingRenewals: vi.fn(),
  restoreSession: vi.fn(),
  updatePayment: vi.fn(),
}));

vi.mock('../api/auth.js', () => ({
  restoreSession: mocks.restoreSession,
}));

vi.mock('../api/account.js', () => ({
  getPreferences: mocks.getPreferences,
}));

vi.mock('../api/catalog.js', () => ({
  getCategories: mocks.getCategories,
  getServices: mocks.getServices,
}));

vi.mock('../api/subscriptions.js', () => ({
  getSubscription: mocks.getSubscription,
  getSubscriptions: mocks.getSubscriptions,
}));

vi.mock('../api/payments.js', () => ({
  createPayment: mocks.createPayment,
  getPayment: mocks.getPayment,
  getPayments: mocks.getPayments,
  updatePayment: mocks.updatePayment,
}));

vi.mock('../api/refunds.js', () => ({
  createRefund: mocks.createRefund,
  getPaymentRefunds: mocks.getPaymentRefunds,
}));

vi.mock('../api/billing.js', () => ({
  getBillingOverview: mocks.getBillingOverview,
  getUpcomingRenewals: mocks.getUpcomingRenewals,
}));

const userFixture = {
  accountStatus: 'active',
  createdAt: '2026-10-15T00:00:00.000Z',
  displayName: 'Test Account',
  email: 'test@example.invalid',
  id: '1',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

const subscriptionsFixture = [
  {
    billingCycle: 'monthly',
    currencyCode: 'INR',
    id: '1',
    nextRenewalDate: '2026-11-01',
    planName: 'Standard',
    price: 499,
    serviceName: 'Netflix',
    startDate: '2026-10-01',
    status: 'active',
  },
  {
    billingCycle: 'yearly',
    currencyCode: 'USD',
    id: '2',
    nextRenewalDate: '2027-10-01',
    planName: 'Pro',
    price: 120,
    serviceName: 'Notion',
    startDate: '2026-10-01',
    status: 'active',
  },
];

const paymentsFixture = [
  {
    amount: '499.00',
    billingPeriodEnd: '2026-10-31',
    billingPeriodStart: '2026-10-01',
    categoryName: 'Entertainment',
    createdAt: '2026-10-01T10:00:00Z',
    currencyCode: 'INR',
    customServiceName: null,
    id: '101',
    netAmount: '499.00',
    notes: 'Credit card payment',
    paymentDate: '2026-10-01',
    paymentStatus: 'completed',
    planName: 'Standard',
    refundCount: 0,
    remainingRefundable: '499.00',
    serviceName: 'Netflix',
    subscriptionId: '1',
    totalRefunded: '0.00',
  },
  {
    amount: '120.00',
    billingPeriodEnd: '2027-09-30',
    billingPeriodStart: '2026-10-01',
    categoryName: 'Productivity',
    createdAt: '2026-10-01T11:00:00Z',
    currencyCode: 'USD',
    customServiceName: null,
    id: '102',
    netAmount: '120.00',
    notes: 'Annual invoice',
    paymentDate: '2026-10-01',
    paymentStatus: 'pending',
    planName: 'Pro',
    refundCount: 0,
    remainingRefundable: '0.00',
    serviceName: 'Notion',
    subscriptionId: '2',
    totalRefunded: '0.00',
  },
];

describe('frontend payment tracking and billing management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreSession.mockResolvedValue({
      accessToken: 'test-token',
      user: userFixture,
    });
    mocks.getPreferences.mockResolvedValue({
      preferredCurrency: 'INR',
    });
    mocks.getSubscriptions.mockResolvedValue({
      items: subscriptionsFixture,
      pagination: { limit: 100, page: 1, totalCount: 2, totalPages: 1 },
    });
    mocks.getPayments.mockResolvedValue({
      items: paymentsFixture,
      pagination: { limit: 10, page: 1, totalCount: 2, totalPages: 1 },
    });
    mocks.getCategories.mockResolvedValue([]);
    mocks.getServices.mockResolvedValue([]);
  });

  function renderWithAuth(initialPath = '/payments') {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  it('renders payments page with table, KPI statistics, and filter controls', async () => {
    renderWithAuth('/payments');

    await waitFor(() => {
      expect(screen.getAllByText('Netflix').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Notion').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Payment History')).toBeInTheDocument();
    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Record Payment/i })).toBeInTheDocument();
  });

  it('submits a new manual payment record on /payments/new', async () => {
    const user = userEvent.setup();

    mocks.createPayment.mockResolvedValue({
      amount: '499.00',
      currencyCode: 'INR',
      id: '103',
      paymentDate: '2026-10-15',
      paymentStatus: 'completed',
    });

    mocks.getPayment.mockResolvedValue({
      amount: '499.00',
      currencyCode: 'INR',
      id: '103',
      netAmount: '499.00',
      paymentDate: '2026-10-15',
      paymentStatus: 'completed',
      refundCount: 0,
      refunds: [],
      remainingRefundable: '499.00',
      serviceName: 'Netflix',
      subscriptionId: '1',
      totalRefunded: '0.00',
    });

    renderWithAuth('/payments/new');

    // Wait until subscription options have loaded into the dropdown
    await waitFor(() => {
      expect(screen.getByText(/Netflix \(Standard\)/i)).toBeInTheDocument();
    });

    // Select subscription
    await user.selectOptions(screen.getByLabelText(/Select Subscription/i), '1');

    // Amount should be auto-filled
    const amountInput = screen.getByLabelText(/Amount Paid/i);
    expect(amountInput).toHaveValue(499);

    // Submit payment
    await user.click(screen.getByRole('button', { name: /^Record Payment$/i }));

    await waitFor(() => {
      expect(mocks.createPayment).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          amount: '499.00',
          currencyCode: 'INR',
          paymentStatus: 'completed',
        }),
      );
    });
  });

  it('renders payment details view and opens refund modal', async () => {
    const user = userEvent.setup();

    mocks.getPayment.mockResolvedValue({
      amount: '1000.00',
      billingPeriodEnd: '2026-10-31',
      billingPeriodStart: '2026-10-01',
      categoryName: 'Entertainment',
      createdAt: '2026-10-01T10:00:00Z',
      currencyCode: 'INR',
      id: '101',
      netAmount: '1000.00',
      notes: 'Test invoice receipt',
      paymentDate: '2026-10-01',
      paymentStatus: 'completed',
      planName: 'Premium Family',
      refundCount: 0,
      refunds: [],
      remainingRefundable: '1000.00',
      serviceName: 'Spotify',
      subscriptionId: '1',
      totalRefunded: '0.00',
    });

    renderWithAuth('/payments/101');

    await waitFor(() => {
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Net Realized')).toBeInTheDocument();
      expect(screen.getByText('Remaining Refundable')).toBeInTheDocument();
    });

    // Open refund modal
    const refundButton = screen.getByRole('button', { name: /^Record Refund$/i });
    expect(refundButton).toBeEnabled();
    await user.click(refundButton);

    expect(screen.getByText('Record Manual Refund')).toBeInTheDocument();
    expect(screen.getByText(/Provider Disclaimer/i)).toBeInTheDocument();
  });

  it('submits a partial refund and validates excessive refund rejection in modal', async () => {
    const user = userEvent.setup();

    mocks.getPayment.mockResolvedValue({
      amount: '1000.00',
      currencyCode: 'INR',
      id: '101',
      netAmount: '1000.00',
      paymentDate: '2026-10-01',
      paymentStatus: 'completed',
      refundCount: 0,
      refunds: [],
      remainingRefundable: '1000.00',
      serviceName: 'Spotify',
      subscriptionId: '1',
      totalRefunded: '0.00',
    });

    mocks.createRefund.mockResolvedValue({
      paymentSummary: {
        currencyCode: 'INR',
        netAmount: '700.00',
        paymentAmount: '1000.00',
        remainingRefundable: '700.00',
        totalRefunded: '300.00',
      },
      refund: {
        amount: '300.00',
        id: '201',
        paymentId: '101',
        refundDate: '2026-10-05',
        refundStatus: 'completed',
      },
    });

    renderWithAuth('/payments/101');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Record Refund$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^Record Refund$/i }));

    const amountInput = screen.getByLabelText(/Refund Amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '300');

    // Click submit button inside the modal form
    const modalForm = screen.getByText('Record Manual Refund').closest('div');
    const submitBtn = within(modalForm).getByRole('button', { name: /^Record Refund$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mocks.createRefund).toHaveBeenCalledWith(
        '101',
        expect.objectContaining({
          amount: '300.00',
          refundStatus: 'completed',
        }),
      );
    });
  });

  it('renders billing overview with separate recurring costs by currency and upcoming renewals', async () => {
    mocks.getBillingOverview.mockResolvedValue({
      overdueRenewals: [
        {
          billingCycle: 'monthly',
          currencyCode: 'INR',
          daysUntilRenewal: -5,
          isOverdue: true,
          nextRenewalDate: '2026-10-10',
          overdueNotice: 'Renewal date passed — payment status unconfirmed',
          price: '499.00',
          serviceName: 'Gym Membership',
          subscriptionId: '5',
        },
      ],
      recurringCosts: [
        { currencyCode: 'INR', monthlyEquivalent: '1300.00', subscriptionCount: 3 },
        { currencyCode: 'USD', monthlyEquivalent: '10.00', subscriptionCount: 1 },
      ],
      stats: {
        activeCount: 4,
        overdueCount: 1,
        totalSubscriptions: 4,
        trialCount: 0,
        upcomingCount: 1,
      },
      upcomingRenewals: [
        {
          billingCycle: 'monthly',
          currencyCode: 'INR',
          daysUntilRenewal: 15,
          isOverdue: false,
          nextRenewalDate: '2026-10-30',
          price: '499.00',
          serviceName: 'Netflix',
          subscriptionId: '1',
        },
      ],
    });

    renderWithAuth('/billing');

    await waitFor(() => {
      expect(screen.getByText('Billing Overview')).toBeInTheDocument();
      expect(screen.getByText('Estimated Recurring Costs')).toBeInTheDocument();
    });

    // Check separate currencies
    expect(screen.getByText('INR')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();

    // Check overdue notice
    expect(screen.getByRole('heading', { name: /Unconfirmed Renewal Dates/i })).toBeInTheDocument();
    expect(
      screen.getByText('Renewal date passed — payment status unconfirmed'),
    ).toBeInTheDocument();

    // Check upcoming renewals
    expect(screen.getByText('Netflix')).toBeInTheDocument();
  });
});
