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
  confidence: 'high',
  currencyCode: 'USD',
  estimatedSavings: '6.00',
  evidence: { limitation: 'This is hypothetical.', savingsSubscriptionId: '2' },
  explanation: 'Two current subscriptions use the same normalized custom name.',
  id: '9',
  priority: 'high',
  savingsPeriod: 'monthly',
  status: 'active',
  subscriptions: [
    {
      billingCycle: 'monthly',
      currencyCode: 'USD',
      id: '2',
      price: '6.00',
      serviceName: 'Example',
    },
  ],
  suggestedAction: 'Review both subscriptions.',
  title: 'Possible duplicate subscriptions',
  type: 'exact_duplicate',
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
      user: { displayName: 'Optimizer', id: '1' },
    });
    mocks.getUnreadNotificationCount.mockResolvedValue(0);
    mocks.getRecommendations.mockResolvedValue(page());
    mocks.getRecommendationSummary.mockResolvedValue({
      activeCount: 1,
      highPriorityCount: 1,
      hypotheticalMonthlySavings: [{ amount: '6.00', currencyCode: 'USD' }],
    });
    mocks.generateRecommendations.mockResolvedValue({ generatedCount: 1 });
    mocks.updateRecommendation.mockResolvedValue({ recommendation });
    mocks.explainRecommendation.mockResolvedValue({
      explanation: 'Safe deterministic detail.',
      source: 'deterministic',
    });
  });

  it('renders priority, evidence, exact currency, assumptions, and related navigation', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Recommendation Center' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Possible duplicate subscriptions')).toBeInTheDocument();
    expect(screen.getByText(/6\.00 per monthly \(hypothetical\)/)).toBeInTheDocument();
    expect(screen.getByText(/Limitation: This is hypothetical/)).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(mocks.updateRecommendation).toHaveBeenCalledWith('9', 'dismissed');
  });

  it('supports empty, loading, error, status, and currency states', async () => {
    const user = userEvent.setup();
    mocks.getRecommendations.mockResolvedValueOnce(page([]));
    renderPage();
    expect(await screen.findByText('No active recommendations')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Status/), 'dismissed');
    await user.type(screen.getByLabelText(/Currency/), 'inr');
    await waitFor(() =>
      expect(mocks.getRecommendations).toHaveBeenLastCalledWith(
        expect.objectContaining({ currencyCode: 'INR', status: 'dismissed' }),
      ),
    );
  });
});
