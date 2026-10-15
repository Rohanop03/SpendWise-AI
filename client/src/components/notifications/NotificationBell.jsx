import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getUnreadNotificationCount } from '../../api/notifications.js';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    getUnreadNotificationCount()
      .then(setCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('spendwise:notifications-changed', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('spendwise:notifications-changed', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return (
    <Link
      aria-label={count ? `Notifications, ${count} unread` : 'Notifications, none unread'}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-200 hover:border-emerald-300/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
      to="/notifications"
    >
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M15 18H9m9-2H6l1.4-1.8V10a4.6 4.6 0 0 1 9.2 0v4.2L18 16Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-400 px-1 text-center text-[11px] font-black leading-5 text-slate-950">
          <span className="sr-only">Unread notifications: </span>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
