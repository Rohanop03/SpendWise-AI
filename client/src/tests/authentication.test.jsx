import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  loginAccount: vi.fn(),
  logoutAccount: vi.fn(),
  registerAccount: vi.fn(),
  restoreSession: vi.fn(),
  updatePreferences: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../api/auth.js', () => ({
  changePassword: vi.fn(),
  loginAccount: mocks.loginAccount,
  logoutAccount: mocks.logoutAccount,
  registerAccount: mocks.registerAccount,
  restoreSession: mocks.restoreSession,
}));

vi.mock('../api/account.js', () => ({
  getPreferences: mocks.getPreferences,
  updatePreferences: mocks.updatePreferences,
  updateProfile: mocks.updateProfile,
}));

const userFixture = {
  accountStatus: 'active',
  createdAt: '2026-10-15T00:00:00.000Z',
  displayName: 'Test Account',
  email: 'test@example.invalid',
  id: '1',
  updatedAt: '2026-10-15T00:00:00.000Z',
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

describe('frontend authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreSession.mockRejectedValue(new Error('No session'));
    mocks.getPreferences.mockResolvedValue({ preferences: { preferredCurrency: 'USD' } });
  });

  it('renders login and toggles password visibility', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('validates matching registration passwords before submitting', async () => {
    const user = userEvent.setup();
    renderApp('/register');

    await screen.findByRole('heading', { name: 'Create your account' });
    await user.type(screen.getByLabelText('Display name'), 'Example User');
    await user.type(screen.getByLabelText('Email'), 'example@example.invalid');
    await user.type(screen.getByLabelText('Password'), 'one secure passphrase');
    await user.type(screen.getByLabelText('Confirm password'), 'a different passphrase');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated protected route to login', async () => {
    renderApp('/account');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('restores a valid cookie session and renders the protected profile', async () => {
    mocks.restoreSession.mockResolvedValue({ accessToken: 'access-token', user: userFixture });
    renderApp('/account');

    expect(await screen.findByRole('heading', { name: 'Account profile' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.invalid')).toBeDisabled();
  });

  it('navigates to the dashboard after successful login', async () => {
    const user = userEvent.setup();
    mocks.loginAccount.mockResolvedValue({ accessToken: 'access-token', user: userFixture });
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Welcome back' });
    await user.type(screen.getByLabelText('Email'), userFixture.email);
    await user.type(screen.getByLabelText('Password'), 'secure passphrase');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  });

  it('shows a safe login error message', async () => {
    const user = userEvent.setup();
    mocks.loginAccount.mockRejectedValue(new Error('network'));
    renderApp('/login');

    await screen.findByRole('heading', { name: 'Welcome back' });
    await user.type(screen.getByLabelText('Email'), userFixture.email);
    await user.type(screen.getByLabelText('Password'), 'incorrect passphrase');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('An unexpected connection error occurred.')).toBeInTheDocument();
  });

  it('clears authentication state after logout', async () => {
    const user = userEvent.setup();
    mocks.restoreSession.mockResolvedValue({ accessToken: 'access-token', user: userFixture });
    mocks.logoutAccount.mockResolvedValue({ message: 'Logged out.' });
    renderApp('/account');

    await screen.findByRole('heading', { name: 'Account profile' });
    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(await screen.findByText('You have been securely logged out.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });

  it('updates the authenticated profile UI', async () => {
    const user = userEvent.setup();
    mocks.restoreSession.mockResolvedValue({ accessToken: 'access-token', user: userFixture });
    mocks.updateProfile.mockResolvedValue({ ...userFixture, displayName: 'Updated Name' });
    renderApp('/account');

    const displayName = await screen.findByDisplayValue('Test Account');
    await user.clear(displayName);
    await user.type(displayName, 'Updated Name');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Updated Name' }),
    );
    expect(screen.getByText('Profile updated.')).toBeInTheDocument();
  });
});
