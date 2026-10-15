import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  restoreSession: vi.fn(),
}));

vi.mock('../api/auth.js', () => ({
  changePassword: vi.fn(),
  loginAccount: vi.fn(),
  logoutAccount: vi.fn(),
  registerAccount: vi.fn(),
  restoreSession: mocks.restoreSession,
}));

vi.mock('../api/notifications.js', async () => ({
  getNotifications: mocks.getNotifications,
  getUnreadNotificationCount: mocks.getUnreadNotificationCount,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
  markNotificationRead: mocks.markNotificationRead,
  notifyNotificationStateChanged: () =>
    window.dispatchEvent(new Event('spendwise:notifications-changed')),
}));

const notification = {
  createdAt: '2026-11-17T12:00:00.000Z',
  id: '8',
  isRead: false,
  message: 'Your Example subscription is scheduled to renew on November 20, 2026.',
  readAt: null,
  subscriptionId: '4',
  targetEventDate: '2026-11-20',
  title: 'Example renewal approaching',
  type: 'renewal',
};

function page(items = [notification]) {
  return {
    notifications: items,
    pagination: { limit: 10, page: 1, pages: items.length ? 1 : 0, total: items.length },
  };
}

function renderApp(path = '/notifications') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('notification center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restoreSession.mockResolvedValue({
      accessToken: 'access-token',
      user: { displayName: 'Notify User', id: '1' },
    });
    mocks.getUnreadNotificationCount.mockResolvedValue(1);
    mocks.getNotifications.mockResolvedValue(page());
    mocks.markNotificationRead.mockResolvedValue({
      ...notification,
      isRead: true,
      readAt: '2026-11-17T12:05:00.000Z',
    });
    mocks.markAllNotificationsRead.mockResolvedValue({ updatedCount: 1 });
  });

  it('renders unread reminders, a bell count, and a subscription link', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Notification Center' })).toBeInTheDocument();
    expect(await screen.findByText('Example renewal approaching')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Notifications, 1 unread/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View subscription →' })).toHaveAttribute(
      'href',
      '/subscriptions/4',
    );
  });

  it('marks a notification and all notifications as read', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole('button', { name: 'Mark as read' }));
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('8');
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));
    expect(mocks.markAllNotificationsRead).toHaveBeenCalledOnce();
    await waitFor(() => expect(mocks.getNotifications).toHaveBeenCalledTimes(2));
  });

  it('supports unread filtering and an empty state', async () => {
    const user = userEvent.setup();
    mocks.getNotifications.mockResolvedValue(page([]));
    renderApp();
    expect(await screen.findByText(/No reminders yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unread' }));
    await waitFor(() =>
      expect(mocks.getNotifications).toHaveBeenLastCalledWith({
        limit: 10,
        page: 1,
        unreadOnly: true,
      }),
    );
  });

  it('shows an API error and retries', async () => {
    const user = userEvent.setup();
    mocks.getNotifications
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(page());
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An unexpected connection error occurred.',
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Example renewal approaching')).toBeInTheDocument();
  });

  it('keeps the route protected for logged-out users', async () => {
    mocks.restoreSession.mockRejectedValue(new Error('No session'));
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(mocks.getNotifications).not.toHaveBeenCalled();
  });
});
