import { Link, Outlet } from 'react-router-dom';

import BrandMark from '../components/BrandMark.jsx';

function AppLayout() {
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
              <span className="block text-xs text-slate-400">Stage 2 foundation</span>
            </span>
          </Link>
          <a
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            href="/#planned-capabilities"
          >
            View roadmap
          </a>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>SpendWise AI · Smart subscription management, built one stage at a time.</p>
          <p>Current status: full-stack foundation</p>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
