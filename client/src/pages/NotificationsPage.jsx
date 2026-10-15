import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyNotificationStateChanged,
} from '../api/notifications.js';

const pageSize = 10;

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all');
  const requestSequence = useRef(0);
  const [state, setState] = useState({
    error: '',
    loading: true,
    notifications: [],
    page: 1,
    pages: 0,
  });

  const load = useCallback(
    async (page = 1) => {
      const requestId = ++requestSequence.current;
      setState((current) => ({ ...current, error: '', loading: true }));
      try {
        const result = await getNotifications({
          limit: pageSize,
          page,
          unreadOnly: filter === 'unread',
        });
        if (requestId !== requestSequence.current) return;
        setState({
          error: '',
          loading: false,
          notifications: result.notifications,
          page: result.pagination.page,
          pages: result.pagination.pages,
        });
      } catch (error) {
        if (requestId !== requestSequence.current) return;
        setState((current) => ({ ...current, error: getApiErrorMessage(error), loading: false }));
      }
    },
    [filter],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(notification) {
    if (notification.isRead) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }));
      notifyNotificationStateChanged();
      if (filter === 'unread') await load(state.page);
    } catch (error) {
      setState((current) => ({ ...current, error: getApiErrorMessage(error) }));
    }
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      notifyNotificationStateChanged();
      await load(1);
    } catch (error) {
      setState((current) => ({ ...current, error: getApiErrorMessage(error) }));
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            Reminder history
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
            Notification Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Renewal and trial reminders generated from your saved preferences.
          </p>
        </div>
        <button
          className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-emerald-300/50"
          onClick={markAllRead}
          type="button"
        >
          Mark all as read
        </button>
      </div>

      <div className="mt-7 flex gap-2" role="group" aria-label="Notification filter">
        {['all', 'unread'].map((value) => (
          <button
            aria-pressed={filter === value}
            className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? 'bg-emerald-300 text-slate-950' : 'bg-white/5 text-slate-300'}`}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {value === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {state.error && (
        <div
          className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100"
          role="alert"
        >
          <p>{state.error}</p>
          <button
            className="mt-2 font-bold underline"
            onClick={() => load(state.page)}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
      {state.loading ? (
        <p className="mt-8 text-sm text-slate-300" role="status">
          Loading notifications…
        </p>
      ) : state.notifications.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-400">
          No reminders yet. We&apos;ll display upcoming subscription reminders here when
          they&apos;re due.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {state.notifications.map((notification) => (
            <article
              className={`rounded-2xl border p-5 ${notification.isRead ? 'border-white/10 bg-white/[0.035]' : 'border-emerald-300/25 bg-emerald-300/[0.07]'}`}
              key={notification.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {!notification.isRead && (
                      <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-xs font-black text-slate-950">
                        Unread
                      </span>
                    )}
                    <h2 className="font-bold text-white">{notification.title}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{notification.message}</p>
                  <time
                    className="mt-2 block text-xs text-slate-500"
                    dateTime={notification.createdAt}
                  >
                    {new Date(notification.createdAt).toLocaleString()}
                  </time>
                </div>
                {!notification.isRead && (
                  <button
                    className="shrink-0 text-sm font-bold text-emerald-300"
                    onClick={() => markRead(notification)}
                    type="button"
                  >
                    Mark as read
                  </button>
                )}
              </div>
              {notification.subscriptionId && (
                <Link
                  className="mt-4 inline-flex text-sm font-bold text-emerald-300"
                  to={`/subscriptions/${notification.subscriptionId}`}
                >
                  View subscription →
                </Link>
              )}
            </article>
          ))}
        </div>
      )}

      {state.pages > 1 && (
        <nav aria-label="Notification pages" className="mt-6 flex items-center justify-between">
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-40"
            disabled={state.page <= 1}
            onClick={() => load(state.page - 1)}
            type="button"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {state.page} of {state.pages}
          </span>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-40"
            disabled={state.page >= state.pages}
            onClick={() => load(state.page + 1)}
            type="button"
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
