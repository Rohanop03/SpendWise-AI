export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '•'
  );
}

/** Authenticated navigation, in rail order. `index` feeds the mono page index. */
export const navItems = [
  { icon: 'dashboard', index: '01', label: 'Dashboard', to: '/dashboard' },
  { icon: 'stack', index: '02', label: 'Subscriptions', short: 'Subs', to: '/subscriptions' },
  { icon: 'receipt', index: '03', label: 'Payments', to: '/payments' },
  { icon: 'calendar', index: '04', label: 'Billing', to: '/billing' },
  { icon: 'chart', index: '05', label: 'Analytics', to: '/analytics' },
  { icon: 'spark', index: '06', label: 'Recommendations', to: '/recommendations' },
  { icon: 'bell', index: '07', label: 'Notifications', to: '/notifications' },
  { icon: 'user', index: '08', label: 'Account', to: '/account' },
  { icon: 'settings', index: '09', label: 'Settings', to: '/settings' },
];

/** Items pinned to the mobile dock; the rest live in the "More" sheet. */
export const dockPaths = ['/dashboard', '/subscriptions', '/payments', '/billing'];

export function sectionFor(pathname) {
  return navItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}

export function pageIndex(pathname) {
  const section = sectionFor(pathname);
  return section ? `${section.index} / ${section.label}` : undefined;
}
