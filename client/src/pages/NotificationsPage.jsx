import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyNotificationStateChanged,
} from '../api/notifications.js';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, EmptyState } from '../ui/Feedback.jsx';
import Icon from '../ui/Icon.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { Pill } from '../ui/Pill.jsx';
import Segmented from '../ui/Segmented.jsx';
import { StateDot } from '../ui/Status.jsx';
import { Card } from '../ui/Surface.jsx';
import { formatDate } from '../utils/dates.js';

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
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        actions={
          <Pill icon="check" onClick={markAllRead}>
            Mark all as read
          </Pill>
        }
        description="Renewal and trial reminders generated from your saved preferences."
        index={pageIndex('/notifications')}
        title="Notification Center"
      />

      <Segmented
        className="mb-6"
        label="Notification filter"
        labelHidden
        onChange={setFilter}
        options={[
          { label: 'All', value: 'all' },
          { label: 'Unread', value: 'unread' },
        ]}
        value={filter}
      />

      {state.error && (
        <div
          className="obsidian mb-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="flex items-start gap-2 text-sm font-bold">
            <Icon className="mt-0.5 size-5 shrink-0" name="alert" />
            {state.error}
          </p>
          <Pill icon="refresh" onClick={() => load(state.page)} size="sm" variant="paper">
            Retry
          </Pill>
        </div>
      )}

      {state.loading ? (
        <Card>
          <CardSkeleton label="notifications" lines={3} />
        </Card>
      ) : state.notifications.length === 0 ? (
        <Card>
          <EmptyState title="All caught up">
            No reminders yet. We&apos;ll display upcoming subscription reminders here when
            they&apos;re due.
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {state.notifications.map((notification) => (
              <motion.li
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-[1.4rem] p-5 ${notification.isRead ? 'neu-pressed depth-1' : 'neu-raised'}`}
                initial={{ opacity: 0, y: 8 }}
                key={notification.id}
                layout
              >
                <article className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.isRead && (
                        <span className="pill-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold leading-none">
                          <StateDot className="size-2" kind="solid" />
                          Unread
                        </span>
                      )}
                      <h2 className={`text-base ${notification.isRead ? 'font-normal' : ''}`}>
                        {notification.title}
                      </h2>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-(--graphite)">
                      {notification.message}
                    </p>
                    <time
                      className="num mt-2 block text-xs text-(--graphite)"
                      dateTime={notification.createdAt}
                    >
                      {formatDate(notification.createdAt, 'D MMM YYYY, HH:mm')}
                    </time>
                    {notification.subscriptionId && (
                      <Link
                        className="mt-3 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
                        to={`/subscriptions/${notification.subscriptionId}`}
                      >
                        View subscription →
                      </Link>
                    )}
                  </div>
                  {!notification.isRead && (
                    <Pill
                      className="shrink-0"
                      icon="check"
                      onClick={() => markRead(notification)}
                      size="sm"
                    >
                      Mark as read
                    </Pill>
                  )}
                </article>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {state.pages > 1 && (
        <nav aria-label="Notification pages" className="mt-6 flex items-center justify-between">
          <Pill
            disabled={state.page <= 1}
            icon="chevronLeft"
            onClick={() => load(state.page - 1)}
            size="sm"
          >
            Previous
          </Pill>
          <span className="text-sm text-(--graphite)">
            Page {state.page} of {state.pages}
          </span>
          <Pill
            disabled={state.page >= state.pages}
            iconRight="chevronRight"
            onClick={() => load(state.page + 1)}
            size="sm"
          >
            Next
          </Pill>
        </nav>
      )}
    </div>
  );
}
