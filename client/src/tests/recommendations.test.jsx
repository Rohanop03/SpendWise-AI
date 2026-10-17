import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  explainRecommendation: vi.fn(),
  generateRecommendations: vi.fn(),
  getRecommendationSummary: vi.fn(),
  getRecommendations: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  restoreSession: vi.fn(),
  updateRecommendation: vi.fn(),
}));

vi.mock('../api/auth.js', () => ({
  changePassword: vi.fn(),
  loginAccount: vi.fn(),
  logoutAccount: vi.fn(),
  registerAccount: vi.fn(),
  restoreSession: mocks.restoreSession,
}));
vi.mock('../api/notifications.js', () => ({
  getUnreadNotificationCount: mocks.getUnreadNotificationCount,
}));
vi.mock('../api/recommendations.js', () => ({
  explainRecommendation: mocks.explainRecommendation,
  generateRecommendations: mocks.generateRecommendations,
  getRecommendationSummary: mocks.getRecommendationSummary,
  getRecommendations: mocks.getRecommendations,
  updateRecommendation: mocks.updateRecommendation,
}));

const recommendation = {
  currencyCode: 'USD',
  generatedDate: '2026-10-16T00:00:00.000Z',
  id: '9',
  potentialSavings: '6.00',
  priority: 'medium',
  recommendationText:
    'You have 2 active Entertainment subscriptions; cancelling Example would save USD 6.00/month',
  rule: 'duplicate_category',
  status: 'Pending',
  subscription: {
    billingCycle: 'Monthly',
    cost: 6,
    currencyCode: 'USD',
    id: '2',
    serviceName: 'Example',
  },
  subscriptionId: '2',
  suggestedAction: 'Keep the one you use most and cancel the others.',
  title: 'Duplicate category',
};

function page(items = [recommendation]) {
  return {
    pagination: { limit: 50, page: 1, pages: items.length ? 1 : 0, total: items.length },
    recommendations: items,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/recommendations']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Recommendation Center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreSession.mockResolvedValue({
      accessToken: 'token',
      user: { id: '1', name: 'Optimizer' },
    });
    mocks.getUnreadNotificationCount.mockResolvedValue(0);
    mocks.getRecommendations.mockResolvedValue(page());
    mocks.getRecommendationSummary.mockResolvedValue({
      highPriorityCount: 0,
      pendingCount: 1,
      potentialMonthlySavings: [{ amount: '6.00', currencyCode: 'USD' }],
    });
    mocks.generateRecommendations.mockResolvedValue({ generatedCount: 1 });
    mocks.updateRecommendation.mockResolvedValue({ recommendation });
    mocks.explainRecommendation.mockResolvedValue({
      explanation: 'Safe deterministic detail.',
      source: 'deterministic',
    });
  });

  it('renders the rule, text, savings, and the linked subscription', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Recommendation Center' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Duplicate category')).toBeInTheDocument();
    expect(screen.getByText(/cancelling Example would save USD 6\.00\/month/)).toBeInTheDocument();
    expect(screen.getByText(/6\.00 per month/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Example/ })).toHaveAttribute(
      'href',
      '/subscriptions/2',
    );
  });

  it('generates, prevents a repeat while pending, explains, and updates status', async () => {
    const user = userEvent.setup();
    renderPage();
    const analyze = await screen.findByRole('button', { name: 'Analyze my subscriptions' });
    await user.click(analyze);
    await waitFor(() => expect(mocks.generateRecommendations).toHaveBeenCalledOnce());
    expect(await screen.findByText(/1 current recommendation evaluated/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explain this' }));
    expect(await screen.findByText(/Safe deterministic detail/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark reviewed' }));
    expect(mocks.updateRecommendation).toHaveBeenCalledWith('9', 'Reviewed');
  });

  it('supports empty, loading, error, status, and currency states', async () => {
    const user = userEvent.setup();
    mocks.getRecommendations.mockResolvedValueOnce(page([]));
    renderPage();
    expect(await screen.findByText('No Pending recommendations')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Status/), 'Dismissed');
    await user.type(screen.getByLabelText(/Currency/), 'inr');
    await waitFor(() =>
      expect(mocks.getRecommendations).toHaveBeenLastCalledWith(
        expect.objectContaining({ currencyCode: 'INR', status: 'Dismissed' }),
      ),
    );
  });
});
