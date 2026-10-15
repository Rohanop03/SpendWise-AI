import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import BrandMark from '../components/BrandMark.jsx';
import NotificationBell from '../components/notifications/NotificationBell.jsx';

const authenticatedLinks = [
  ['/dashboard', 'Dashboard'],
  ['/subscriptions', 'Subscriptions'],
  ['/payments', 'Payments'],
  ['/billing', 'Billing'],
  ['/analytics', 'Analytics'],
  ['/notifications', 'Notifications'],
  ['/account', 'Account'],
  ['/settings', 'Settings'],
];

function navClass({ isActive }) {
  return `rounded-full px-3 py-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
    isActive ? 'bg-emerald-300 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;
}

function AppLayout() {
  const { isAuthenticated, isInitializing, logout, logoutNotice, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            className="flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            to="/"
          >
            <BrandMark />
            <span>
              <span className="block text-base font-bold tracking-tight text-white">
                SpendWise AI
              </span>
              <span className="hidden text-xs text-slate-400 sm:block">Financial clarity</span>
            </span>
          </Link>

          {!isInitializing && isAuthenticated ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <nav
                aria-label="Primary navigation"
                className="hidden items-center gap-1 text-xs font-semibold xl:flex"
              >
                {authenticatedLinks.map(([to, label]) => (
                  <NavLink className={navClass} key={to} to={to}>
                    {label}
                  </NavLink>
                ))}
                <button
                  className="ml-1 rounded-full border border-white/15 px-4 py-2 text-slate-200 hover:border-emerald-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  onClick={handleLogout}
                  type="button"
                >
                  Logout
                </button>
              </nav>

              <details className="relative xl:hidden">
                <summary className="cursor-pointer list-none rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-300">
                  Menu
                </summary>
                <nav
                  aria-label="Mobile navigation"
                  className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-2xl"
                >
                  <p className="truncate border-b border-white/10 px-3 pb-3 text-xs text-slate-400">
                    {user.displayName}
                  </p>
                  <div className="mt-2 grid gap-1">
                    {authenticatedLinks.map(([to, label]) => (
                      <NavLink
                        className={({ isActive }) =>
                          `rounded-xl px-3 py-2.5 text-sm font-semibold ${
                            isActive
                              ? 'bg-emerald-300 text-slate-950'
                              : 'text-slate-200 hover:bg-white/5'
                          }`
                        }
                        key={to}
                        to={to}
                      >
                        {label}
                      </NavLink>
                    ))}
                    <button
                      aria-label="Logout from mobile menu"
                      className="mt-2 rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm font-semibold text-slate-200"
                      onClick={handleLogout}
                      type="button"
                    >
                      Logout
                    </button>
                  </div>
                </nav>
              </details>
            </div>
          ) : (
            <nav
              aria-label="Account navigation"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Link className="rounded-full px-3 py-2 text-slate-200 hover:text-white" to="/login">
                Login
              </Link>
              <Link className="rounded-full bg-emerald-300 px-4 py-2 text-slate-950" to="/register">
                Register
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main>
        {logoutNotice && (
          <p className="border-b border-white/10 bg-slate-900 px-5 py-3 text-center text-sm text-slate-200">
            {logoutNotice}
          </p>
        )}
        <Outlet />
      </main>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>SpendWise AI · Clear subscription and cash-flow records.</p>
          <p>Stage 9: renewal reminders & notifications</p>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
