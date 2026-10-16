import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getUnreadNotificationCount } from '../api/notifications.js';
import Icon from '../ui/Icon.jsx';

/** Bell link with unread count; refreshes on focus, visibility and local changes. */
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
      className="pill neu-press relative size-11 !p-0"
      to="/notifications"
    >
      <Icon name="bell" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="pill-ink num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-medium"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
