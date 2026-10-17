import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({ getApiHealth: vi.fn(), restoreSession: vi.fn() }));

vi.mock('../api/auth.js', () => ({ restoreSession: mocks.restoreSession }));
vi.mock('../api/health.js', () => ({ getApiHealth: mocks.getApiHealth }));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('public pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreSession.mockRejectedValue(new Error('No session'));
    mocks.getApiHealth.mockResolvedValue({ database: { status: 'up' }, status: 'ok' });
  });

  it('opens Home by default with the landing content and a primary call to action', async () => {
    renderAt('/');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Stop paying for subscriptions you forgot about',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Get started/ })[0]).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getByRole('heading', { name: 'Frequently asked' })).toBeInTheDocument();
  });

  it('navigates from Home to How it works through the header', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByRole('heading', { level: 1 });
    const site = screen.getAllByRole('navigation', { name: 'Site' })[0];
    await user.click(within(site).getByRole('link', { name: 'How it works' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'From scattered charges to one clear picture',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Renewal dates that update themselves' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All-or-nothing actions' })).toBeInTheDocument();
    // Plain language only: no textbook database terms on this page.
    expect(document.body.textContent).not.toMatch(/normali[sz]|3NF|BCNF/i);
  });
});
