import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  archiveSubscription: vi.fn(),
  createSubscription: vi.fn(),
  getCategories: vi.fn(),
  getPreferences: vi.fn(),
  getServices: vi.fn(),
  getSubscription: vi.fn(),
  getSubscriptions: vi.fn(),
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

vi.mock('../api/subscriptions.js', () => ({
  archiveSubscription: mocks.archiveSubscription,
  createSubscription: mocks.createSubscription,
  getSubscription: mocks.getSubscription,
  getSubscriptions: mocks.getSubscriptions,
  restoreSubscription: mocks.restoreSubscription,
  updateSubscription: mocks.updateSubscription,
}));

const userFixture = {
  accountStatus: 'active',
  createdAt: '2026-10-15T00:00:00.000Z',
  displayName: 'Test Account',
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
  billingCycle: 'monthly',
  cancelledAt: null,
  categoryId: '1',
  categoryName: 'Entertainment',
  createdAt: '2026-10-15T00:00:00.000Z',
  currencyCode: 'USD',
  customServiceName: null,
  id: '101',
  nextRenewalDate: '2026-11-15',
  notes: '4K family plan',
  planName: 'Premium 4K',
  price: 22.99,
  serviceId: '1',
  serviceName: 'Netflix',
  serviceWebsiteUrl: 'https://www.netflix.com',
  startDate: '2026-10-15',
  status: 'active',
  trialEndDate: null,
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
  });

  it('renders subscriptions page with table, cards, and KPI statistics', async () => {
    mocks.getSubscriptions.mockResolvedValue({
      items: [sampleSubscription],
      pagination: { limit: 10, page: 1, totalCount: 1, totalPages: 1 },
    });

    renderApp('/subscriptions');

    expect(await screen.findByRole('heading', { name: 'My Subscriptions' })).toBeInTheDocument();
    expect(await screen.findAllByText('Netflix')).toHaveLength(2); // once in table, once in mobile card
    expect(screen.getByText('Est. Monthly Cost')).toBeInTheDocument();
    expect(screen.getAllByText('$22.99')).toHaveLength(3); // in KPI, table, and mobile card
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

    await user.type(screen.getByLabelText('Plan / Tier (Optional)'), 'Family 4K');
    await user.type(screen.getByLabelText('Price'), '19.99');
    await user.type(screen.getByLabelText('Next Renewal'), '2026-11-20');

    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    await waitFor(() => {
      expect(mocks.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          billingCycle: 'monthly',
          categoryId: '1',
          currencyCode: 'USD',
          nextRenewalDate: '2026-11-20',
          planName: 'Family 4K',
          price: 19.99,
          serviceId: '1',
          status: 'active',
        }),
      );
    });
  });

  it('submits a new custom service subscription', async () => {
    const user = userEvent.setup();
    mocks.createSubscription.mockResolvedValue({
      ...sampleSubscription,
      customServiceName: 'Campus Recreation Gym',
      id: '103',
      serviceId: null,
      serviceName: 'Campus Recreation Gym',
    });

    renderApp('/subscriptions/new');

    expect(
      await screen.findByRole('heading', { name: 'Add New Subscription' }),
    ).toBeInTheDocument();

    // Toggle to custom service mode
    await user.click(screen.getByRole('button', { name: 'Custom Service' }));

    await user.type(screen.getByLabelText('Custom Service Name'), 'Campus Recreation Gym');
    await user.type(screen.getByLabelText('Price'), '50.00');
    await user.type(screen.getByLabelText('Next Renewal'), '2026-12-01');

    await user.click(screen.getByRole('button', { name: 'Create Subscription' }));

    await waitFor(() => {
      expect(mocks.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          customServiceName: 'Campus Recreation Gym',
          price: 50,
        }),
      );
    });
  });

  it('renders subscription details, pauses status, and handles archival flow', async () => {
    const user = userEvent.setup();
    mocks.getSubscription.mockResolvedValue(sampleSubscription);
    mocks.updateSubscription.mockResolvedValue({
      ...sampleSubscription,
      status: 'paused',
    });
    mocks.archiveSubscription.mockResolvedValue({
      ...sampleSubscription,
      archivedAt: '2026-10-15T02:00:00.000Z',
    });

    renderApp('/subscriptions/101');

    expect(await screen.findByRole('heading', { name: 'Netflix' })).toBeInTheDocument();
    expect(screen.getByText('4K family plan')).toBeInTheDocument();

    // Pause subscription
    const pauseBtn = screen.getByRole('button', { name: 'Pause' });
    await user.click(pauseBtn);

    await waitFor(() => {
      expect(mocks.updateSubscription).toHaveBeenCalledWith('101', { status: 'paused' });
    });

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

  it('renders edit subscription page, modifies price, and saves', async () => {
    const user = userEvent.setup();
    mocks.getSubscription.mockResolvedValue(sampleSubscription);
    mocks.updateSubscription.mockResolvedValue({
      ...sampleSubscription,
      price: 24.99,
    });

    renderApp('/subscriptions/101/edit');

    expect(await screen.findByRole('heading', { name: 'Edit Subscription' })).toBeInTheDocument();

    const priceInput = screen.getByLabelText('Price');
    expect(priceInput).toHaveValue(22.99);

    await user.clear(priceInput);
    await user.type(priceInput, '24.99');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mocks.updateSubscription).toHaveBeenCalledWith(
        '101',
        expect.objectContaining({
          price: 24.99,
        }),
      );
    });
  });
});
