import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  archiveSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  createSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  getCategories: vi.fn(),
  getPreferences: vi.fn(),
  getServices: vi.fn(),
  getSubscription: vi.fn(),
  getSubscriptionHistory: vi.fn(),
  getSubscriptionPayments: vi.fn(),
  getSubscriptions: vi.fn(),
  markSubscriptionUsed: vi.fn(),
  restoreSession: vi.fn(),
  restoreSubscription: vi.fn(),
  updateSubscription: vi.fn(),
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

vi.mock('../api/payments.js', () => ({
  getSubscriptionPayments: mocks.getSubscriptionPayments,
}));

vi.mock('../api/subscriptions.js', () => ({
  archiveSubscription: mocks.archiveSubscription,
  cancelSubscription: mocks.cancelSubscription,
  createSubscription: mocks.createSubscription,
  deleteSubscription: mocks.deleteSubscription,
  getSubscription: mocks.getSubscription,
  getSubscriptionHistory: mocks.getSubscriptionHistory,
  getSubscriptions: mocks.getSubscriptions,
  markSubscriptionUsed: mocks.markSubscriptionUsed,
  restoreSubscription: mocks.restoreSubscription,
  updateSubscription: mocks.updateSubscription,
}));

const userFixture = {
  accountStatus: 'active',
  createdAt: '2026-10-15T00:00:00.000Z',
  name: 'Test Account',
  email: 'test@example.invalid',
  id: '1',
  updatedAt: '2026-10-15T00:00:00.000Z',
};

const categoriesFixture = [
  { description: 'Movies and streaming', id: '1', name: 'Entertainment' },
  { description: 'Productivity and work', id: '2', name: 'Productivity' },
];

const servicesFixture = [
  { categoryName: 'Entertainment', defaultCategoryId: '1', id: '1', name: 'Netflix' },
  { categoryName: 'Productivity', defaultCategoryId: '2', id: '2', name: 'Notion' },
];

const sampleSubscription = {
  archivedAt: null,
  billingCycle: 'Monthly',
  cancelledAt: null,
  categoryId: '1',
  categoryName: 'Entertainment',
  cost: 22.99,
  createdAt: '2026-10-15T00:00:00.000Z',
  currencyCode: 'USD',
  daysSinceLastUse: null,
  id: '101',
  lastUsedDate: null,
  notes: '4K family plan',
  planName: 'Premium 4K',
  renewalDate: '2026-11-15',
  serviceName: 'Netflix',
  startDate: '2026-10-15',
  status: 'Active',
  updatedAt: '2026-10-15T00:00:00.000Z',
  userId: '1',
};

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('frontend subscription management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreSession.mockResolvedValue({ accessToken: 'test-token', user: userFixture });
    mocks.getCategories.mockResolvedValue(categoriesFixture);
    mocks.getServices.mockResolvedValue(servicesFixture);
    mocks.getPreferences.mockResolvedValue({ preferredCurrency: 'USD' });
    mocks.getSubscription.mockResolvedValue(sampleSubscription);
    mocks.getSubscriptionHistory.mockResolvedValue([]);
    mocks.getSubscriptionPayments.mockResolvedValue({ items: [] });
  });

  it('renders subscriptions page with table, cards, and KPI statistics', async () => {
    mocks.getSubscriptions.mockResolvedValue({
      items: [sampleSubscription],
      pagination: { limit: 10, page: 1, totalCount: 1, totalPages: 1 },
    });

    renderApp('/subscriptions');

    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'My Subscriptions' })).toBeInTheDocument();
    // Table view (default on wide screens): one row with the service link.
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Netflix' })).toHaveAttribute(
      'href',
      '/subscriptions/101',
    );
    expect(screen.getByText('Est. Monthly Cost')).toBeInTheDocument();
    expect(screen.getAllByText('$22.99')).toHaveLength(2); // in KPI and table

    // Card view shows the same subscription as a card.
    await user.click(screen.getByRole('button', { name: 'Card view' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Netflix' })).toBeInTheDocument();
    expect(screen.getAllByText('$22.99')).toHaveLength(2); // in KPI and card
  });

  it('filters subscriptions and switches to archived tab', async () => {
    const user = userEvent.setup();
    mocks.getSubscriptions.mockResolvedValue({
      items: [sampleSubscription],
      pagination: { limit: 10, page: 1, totalCount: 1, totalPages: 1 },
    });

    renderApp('/subscriptions');
    await screen.findByRole('heading', { name: 'My Subscriptions' });

    // Switch to Archived tab
    mocks.getSubscriptions.mockResolvedValue({
      items: [],
      pagination: { limit: 10, page: 1, totalCount: 0, totalPages: 1 },
    });

    const archivedTab = screen.getByRole('button', { name: 'Archived' });
    await user.click(archivedTab);

    expect(mocks.getSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ archived: 'true' }),
    );
    expect(await screen.findByText('No archived subscriptions')).toBeInTheDocument();
  });

  it('renders empty state when no subscriptions are found', async () => {
    mocks.getSubscriptions.mockResolvedValue({
      items: [],
      pagination: { limit: 10, page: 1, totalCount: 0, totalPages: 1 },
    });

    renderApp('/subscriptions');

    expect(await screen.findByText('No subscriptions tracked yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add your first subscription/i })).toBeInTheDocument();
  });

  it('submits a new catalog subscription on /subscriptions/new', async () => {
    const user = userEvent.setup();
    mocks.createSubscription.mockResolvedValue({
      ...sampleSubscription,
      id: '102',
    });

    renderApp('/subscriptions/new');

    expect(
      await screen.findByRole('heading', { name: 'Add New Subscription' }),
    ).toBeInTheDocument();

    await user.type(await screen.findByLabelText('Plan / Tier (Optional)'), 'Family 4K');
    await user.type(screen.getByLabelText('Cost'), '19.99');
    await user.type(screen.getByLabelText('Renewal Date'), '2026-11-20');

    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    await waitFor(() => {
      expect(mocks.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          billingCycle: 'Monthly',
          categoryId: '1',
          cost: 19.99,
          currencyCode: 'USD',
          planName: 'Family 4K',
          renewalDate: '2026-11-20',
          serviceName: 'Netflix',
        }),
      );
      expect(mocks.createSubscription).toHaveBeenCalledWith(
        expect.not.objectContaining({ status: expect.anything() }),
      );
    });
  });

  it('submits a new custom service subscription', async () => {
    const user = userEvent.setup();
    mocks.createSubscription.mockResolvedValue({
      ...sampleSubscription,
      id: '103',
      serviceName: 'Campus Recreation Gym',
    });

    renderApp('/subscriptions/new');

    expect(
      await screen.findByRole('heading', { name: 'Add New Subscription' }),
    ).toBeInTheDocument();

    // Toggle to custom service mode
    await user.click(await screen.findByRole('button', { name: 'Custom Service' }));

    await user.type(screen.getByLabelText('Custom Service Name'), 'Campus Recreation Gym');
    await user.type(screen.getByLabelText('Cost'), '50.00');
    await user.type(screen.getByLabelText('Renewal Date'), '2026-12-01');

    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    await waitFor(() => {
      expect(mocks.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          cost: 50,
          serviceName: 'Campus Recreation Gym',
        }),
      );
    });
  });

  it('renders subscription details, cancels with a final payment, and archives', async () => {
    const user = userEvent.setup();
    mocks.getSubscription.mockResolvedValue(sampleSubscription);
    mocks.cancelSubscription.mockResolvedValue({
      payment: { amount: '22.99', currencyCode: 'USD', id: '9', paymentDate: '2026-10-16' },
      subscription: {
        ...sampleSubscription,
        cancelledAt: '2026-10-16T00:00:00Z',
        status: 'Cancelled',
      },
    });
    mocks.archiveSubscription.mockResolvedValue({
      ...sampleSubscription,
      archivedAt: '2026-10-15T02:00:00.000Z',
    });

    renderApp('/subscriptions/101');

    expect(await screen.findByRole('heading', { name: 'Netflix' })).toBeInTheDocument();
    expect(screen.getByText('4K family plan')).toBeInTheDocument();

    // Cancel with a final payment: one API call, one transaction on the server.
    await user.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    await user.click(screen.getByLabelText('Record a final payment'));
    await user.type(screen.getByLabelText('Amount (USD)'), '22.99');
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }));

    await waitFor(() => {
      expect(mocks.cancelSubscription).toHaveBeenCalledWith(
        '101',
        expect.objectContaining({ amount: '22.99' }),
      );
    });
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();

    // Open archive modal
    const archiveBtn = screen.getByRole('button', { name: 'Archive' });
    await user.click(archiveBtn);

    expect(screen.getByRole('heading', { name: 'Archive Netflix?' })).toBeInTheDocument();

    // Confirm archive
    const confirmArchiveBtn = screen.getByRole('button', { name: 'Archive Subscription' });
    await user.click(confirmArchiveBtn);

    await waitFor(() => {
      expect(mocks.archiveSubscription).toHaveBeenCalledWith('101');
    });
  });

  it('renders edit subscription page, modifies cost, and saves', async () => {
    const user = userEvent.setup();
    mocks.getSubscription.mockResolvedValue(sampleSubscription);
    mocks.updateSubscription.mockResolvedValue({
      ...sampleSubscription,
      cost: 24.99,
    });

    renderApp('/subscriptions/101/edit');

    expect(await screen.findByRole('heading', { name: 'Edit Subscription' })).toBeInTheDocument();

    const priceInput = await screen.findByLabelText('Cost');
    expect(priceInput).toHaveValue(22.99);

    await user.clear(priceInput);
    await user.type(priceInput, '24.99');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mocks.updateSubscription).toHaveBeenCalledWith(
        '101',
        expect.objectContaining({
          cost: 24.99,
          serviceName: 'Netflix',
          status: 'Active',
        }),
      );
    });
  });

  it('deletes a subscription after confirmation', async () => {
    const user = userEvent.setup();
    mocks.deleteSubscription.mockResolvedValue();
    mocks.getSubscriptions.mockResolvedValue({
      items: [],
      pagination: { limit: 10, page: 1, totalCount: 0, totalPages: 1 },
    });

    renderApp('/subscriptions/101');
    await screen.findByRole('heading', { name: 'Netflix' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(mocks.deleteSubscription).toHaveBeenCalledWith('101'));
    expect(await screen.findByRole('heading', { name: 'My Subscriptions' })).toBeInTheDocument();
  });

  it('marks a subscription as used today', async () => {
    const user = userEvent.setup();
    mocks.markSubscriptionUsed.mockResolvedValue({
      ...sampleSubscription,
      daysSinceLastUse: 0,
      lastUsedDate: '2026-10-16',
    });

    renderApp('/subscriptions/101');
    await screen.findByRole('heading', { name: 'Netflix' });
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark as used today' }));

    await waitFor(() => expect(mocks.markSubscriptionUsed).toHaveBeenCalledWith('101'));
    expect(await screen.findByText('today')).toBeInTheDocument();
  });
});
