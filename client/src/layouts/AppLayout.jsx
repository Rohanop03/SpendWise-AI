import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import BrandMark from '../components/BrandMark.jsx';
import NotificationBell from '../components/notifications/NotificationBell.jsx';
import { applyTheme, getPreferredTheme, persistTheme } from '../theme.js';

const authenticatedLinks = [
  ['/dashboard', 'Dashboard'],
  ['/subscriptions', 'Subscriptions'],
  ['/payments', 'Payments'],
  ['/billing', 'Billing'],
  ['/analytics', 'Analytics'],
  ['/recommendations', 'Recommendations'],
  ['/notifications', 'Notifications'],
  ['/account', 'Account'],
  ['/settings', 'Settings'],
];

function navClass({ isActive }) {
  return `sidebar-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 ${
    isActive ? 'sidebar-link-active' : ''
  }`;
}

function AppLayout() {
  const { isAuthenticated, isInitializing, logout, logoutNotice, user } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getPreferredTheme);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  const themeToggle = (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      className="theme-toggle"
      onClick={() => setTheme(nextTheme)}
      title={`Switch to ${nextTheme} mode`}
      type="button"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  if (!isInitializing && isAuthenticated) {
    return (
      <div className="min-h-screen overflow-x-hidden p-2 text-slate-100 sm:p-3 lg:p-5">
        <div className="app-workspace mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1600px] overflow-hidden rounded-[2rem]">
          <aside className="hidden w-56 shrink-0 flex-col border-r border-[#e7e7e4] bg-white/70 px-4 py-5 xl:flex">
            <Link
              className="flex items-center gap-3 rounded-2xl px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
              to="/"
            >
              <BrandMark />
              <span>
                <span className="block text-base font-black tracking-[-0.03em] text-white">
                  SpendWise AI
                </span>
                <span className="block text-[11px] text-slate-400">Financial clarity</span>
              </span>
            </Link>

            <nav aria-label="Primary navigation" className="mt-10 grid gap-1.5">
              {authenticatedLinks.map(([to, label]) => (
                <NavLink className={navClass} key={to} to={to}>
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto rounded-[1.4rem] border border-[#e7e7e4] bg-[#f7f7f5] p-3">
              <p className="truncate text-sm font-bold text-white">{user.displayName}</p>
              <button
                className="mt-3 w-full rounded-full border border-[#dededb] bg-white px-3 py-2 text-left text-xs font-bold text-slate-300 hover:border-slate-950 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[#e7e7e4] bg-[#fafaf9]/90 px-4 py-3 backdrop-blur-xl sm:px-6 xl:justify-end xl:px-8">
              <Link
                className="flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 xl:hidden"
                to="/"
              >
                <BrandMark />
                <span className="text-sm font-black tracking-tight text-white">SpendWise AI</span>
              </Link>
              <div className="flex items-center gap-2">
                {themeToggle}
                <NotificationBell />
                <details className="relative xl:hidden">
                  <summary className="cursor-pointer list-none rounded-full border border-[#dededb] bg-white px-4 py-2 text-sm font-bold text-slate-200 shadow-sm focus-visible:outline-2 focus-visible:outline-slate-950">
                    Menu
                  </summary>
                  <nav
                    aria-label="Mobile navigation"
                    className="absolute right-0 z-50 mt-3 w-72 rounded-[1.5rem] border border-[#e7e7e4] bg-white p-3 shadow-2xl"
                  >
                    <p className="truncate border-b border-[#e7e7e4] px-3 pb-3 text-xs text-slate-400">
                      {user.displayName}
                    </p>
                    <div className="mt-2 grid gap-1">
                      {authenticatedLinks.map(([to, label]) => (
                        <NavLink className={navClass} key={to} to={to}>
                          {label}
                        </NavLink>
                      ))}
                      <button
                        aria-label="Logout from mobile menu"
                        className="mt-2 rounded-full border border-[#dededb] px-4 py-2.5 text-left text-sm font-semibold text-slate-200"
                        onClick={handleLogout}
                        type="button"
                      >
                        Logout
                      </button>
                    </div>
                  </nav>
                </details>
                <p className="hidden max-w-48 truncate rounded-full border border-[#e7e7e4] bg-white px-4 py-2 text-xs font-bold text-slate-300 shadow-sm sm:block">
                  {user.displayName}
                </p>
              </div>
            </header>

            <main className="min-w-0 flex-1">
              {logoutNotice && (
                <p className="border-b border-[#e7e7e4] bg-white px-5 py-3 text-center text-sm text-slate-200">
                  {logoutNotice}
                </p>
              )}
              <Outlet />
            </main>

            <footer className="border-t border-[#e7e7e4]">
              <div className="flex flex-col gap-2 px-5 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p>SpendWise AI · Clear subscription and cash-flow records.</p>
                <p>Intelligent subscription management & financial clarity.</p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fafaf9] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-[#e7e7e4] bg-[#fafaf9]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <Link
            className="flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
            to="/"
          >
            <BrandMark />
            <span>
              <span className="block text-base font-black tracking-tight text-white">
                SpendWise AI
              </span>
              <span className="hidden text-xs text-slate-400 sm:block">Financial clarity</span>
            </span>
          </Link>
          <nav
            aria-label="Account navigation"
            className="flex items-center gap-2 text-sm font-bold"
          >
            {themeToggle}
            <Link className="rounded-full px-4 py-2 text-slate-200 hover:bg-[#f0f0ed]" to="/login">
              Login
            </Link>
            <Link className="rounded-full bg-emerald-300 px-5 py-2.5 text-slate-950" to="/register">
              Register
            </Link>
          </nav>
        </div>
      </header>
      <main>
        {logoutNotice && (
          <p className="border-b border-[#e7e7e4] bg-white px-5 py-3 text-center text-sm text-slate-200">
            {logoutNotice}
          </p>
        )}
        <Outlet />
      </main>
      <footer className="border-t border-[#e7e7e4] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>SpendWise AI · Clear subscription and cash-flow records.</p>
          <p>Intelligent subscription management & financial clarity.</p>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
