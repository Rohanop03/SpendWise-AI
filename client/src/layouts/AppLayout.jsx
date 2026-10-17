import { motion, useReducedMotion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import BrandMark from '../layout/BrandMark.jsx';
import Dock from '../layout/Dock.jsx';
import Rail from '../layout/Rail.jsx';
import TopBar from '../layout/TopBar.jsx';
import Seo from '../seo/Seo.jsx';
import BlobField from '../ui/BlobField.jsx';
import { Notice } from '../ui/Feedback.jsx';
import { PillLink } from '../ui/Pill.jsx';
import { ErrorBoundary } from '../ui/SystemStates.jsx';

const publicLinks = [
  ['/', 'Home'],
  ['/how-it-works', 'How it works'],
];

/** Landing-page links; the current page is shown pressed. */
function PublicLinks({ className = '' }) {
  return (
    <ul className={`flex items-center gap-1 ${className}`}>
      {publicLinks.map(([to, label]) => (
        <li key={to}>
          <NavLink
            className={({ isActive }) =>
              `pill pill-sm !px-3.5 ${isActive ? 'neu-pressed depth-1 text-(--ink)' : 'pill-ghost text-(--graphite)'}`
            }
            end
            to={to}
          >
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

// Loaded on first use only, so dialog + search code stays off the critical path.
const CommandPalette = lazy(() => import('../layout/CommandPalette.jsx'));

function AppLayout() {
  const { isAuthenticated, isInitializing, logout, logoutNotice, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteLoaded, setPaletteLoaded] = useState(false);

  function openPalette() {
    setPaletteLoaded(true);
    setPaletteOpen(true);
  }

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteLoaded(true);
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthenticated]);

  async function handleLogout() {
    // Leave the protected route first so its redirect-to-login guard cannot race the
    // navigation; the session is then revoked exactly as before.
    navigate('/', { replace: true });
    await logout();
  }

  if (!isInitializing && isAuthenticated) {
    return (
      <div className="min-h-dvh-safe overflow-x-clip md:p-(--console-inset)">
        <BlobField />
        <Seo noindex />
        <div className="console mx-auto flex min-h-[calc(100dvh-2*var(--console-inset))] max-w-[1680px] md:rounded-(--radius-panel)">
          <Rail onLogout={handleLogout} user={user} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar onOpenPalette={openPalette} />
            <main
              className="min-w-0 flex-1 px-4 pb-[calc(var(--dock-height)+2.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-8"
              id="main"
              tabIndex={-1}
            >
              {logoutNotice && (
                <div className="mb-6">
                  <Notice>{logoutNotice}</Notice>
                </div>
              )}
              <ErrorBoundary resetKey={location.pathname}>
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  initial={reduce ? false : { opacity: 0, scale: 0.995, y: 10 }}
                  key={location.pathname}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Outlet />
                </motion.div>
              </ErrorBoundary>
            </main>
          </div>
        </div>
        <Dock onLogout={handleLogout} user={user} />
        {paletteLoaded && (
          <Suspense fallback={null}>
            <CommandPalette onOpenChange={setPaletteOpen} open={paletteOpen} />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh-safe overflow-x-clip">
      <BlobField />
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-10">
          <Link className="shrink-0 rounded-2xl" to="/">
            <BrandMark subtitle="Smart subscription manager" />
          </Link>
          <nav aria-label="Site" className="hidden md:block">
            <PublicLinks />
          </nav>
          <nav aria-label="Account navigation" className="flex items-center gap-1.5 sm:gap-2">
            <Link className="pill pill-ghost !px-3 sm:!px-4" to="/login">
              Login
            </Link>
            <PillLink className="!px-4 sm:!px-5" to="/register" variant="ink">
              Get started
            </PillLink>
          </nav>
        </div>
        {/* Phones: page links on their own row so the header never overflows. */}
        <nav aria-label="Site" className="border-t border-(--hairline) px-4 py-2 md:hidden">
          <PublicLinks className="justify-center" />
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {logoutNotice && (
          <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-8">
            <Notice>{logoutNotice}</Notice>
          </div>
        )}
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t border-(--hairline)">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-(--graphite) sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>SpendWise AI · Subscription tracking and explainable cost optimisation.</p>
          <p>A DBMS lab project by Sayak Mondal, Rohan Chaudhary and Arush James.</p>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
