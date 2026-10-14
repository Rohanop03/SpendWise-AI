import { Link, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import BrandMark from '../components/BrandMark.jsx';

function AppLayout() {
  const { isAuthenticated, isInitializing, logout, logoutNotice, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <Link
            className="flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            to="/"
          >
            <BrandMark />
            <span>
              <span className="block text-base font-bold tracking-tight text-white">
                SpendWise AI
              </span>
              <span className="block text-xs text-slate-400">Secure account foundation</span>
            </span>
          </Link>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            {!isInitializing && isAuthenticated ? (
              <>
                <span className="hidden text-slate-400 sm:inline">{user.displayName}</span>
                <Link
                  className="rounded-full px-3 py-2 text-slate-200 hover:text-white"
                  to="/subscriptions"
                >
                  Subscriptions
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-slate-200 hover:text-white"
                  to="/payments"
                >
                  Payments
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-slate-200 hover:text-white"
                  to="/billing"
                >
                  Billing
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-slate-200 hover:text-white"
                  to="/analytics"
                >
                  Analytics
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-slate-200 hover:text-white"
                  to="/account"
                >
                  Account
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-slate-200 hover:text-white"
                  to="/settings"
                >
                  Settings
                </Link>
                <button
                  className="rounded-full border border-white/15 px-4 py-2 text-slate-200 hover:border-emerald-300/50"
                  onClick={handleLogout}
                  type="button"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  className="rounded-full px-3 py-2 text-slate-200 hover:text-white"
                  to="/login"
                >
                  Login
                </Link>
                <Link
                  className="rounded-full bg-emerald-300 px-4 py-2 text-slate-950"
                  to="/register"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
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
          <p>SpendWise AI · Smart subscription management, built one stage at a time.</p>
          <p>Current status: payment tracking & billing management</p>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
