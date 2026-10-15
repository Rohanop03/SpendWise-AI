import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import ApiStatus from '../components/ApiStatus.jsx';

const coreHighlights = [
  {
    description:
      'Organize active, trial, and custom services with normalized billing cycles, renewal dates, and status lifecycle tracking.',
    eyebrow: 'Subscription Management',
    title: 'Centralized Tracking',
  },
  {
    description:
      'Explore interactive monthly cash-flow trends, category distributions, and export comprehensive CSV reports with zero floating-point drift.',
    eyebrow: 'Analytics & Reporting',
    title: 'Visual Spending Clarity',
  },
  {
    description:
      'Log manual payments, audit historical transactions, and record partial or full refunds with concurrency-safe balance validation.',
    eyebrow: 'Payment Ledger',
    title: 'Payments & Refunds',
  },
  {
    description:
      'Stay ahead of upcoming renewals and trial endings with customizable lead-time preferences and a centralized notification center.',
    eyebrow: 'Proactive Alerts',
    title: 'Renewal Reminders',
  },
  {
    description:
      'Uncover potential duplicate services, price outliers, and spending concentrations using transparent, explainable rule-based evaluation.',
    eyebrow: 'Cost Optimization',
    title: 'Actionable Insights',
  },
  {
    description:
      'Keep your financial records confidential with strict per-user data isolation, secure session rotation, and separate multi-currency ledgers.',
    eyebrow: 'Security & Integrity',
    title: 'Strict User Isolation',
  },
];

const featureList = [
  {
    description: 'Track catalog and custom services, price terms, and renewal cycles in one place.',
    title: 'Subscription management',
  },
  {
    description: 'Interactive cash-flow charts, monthly trends, and currency-isolated breakdowns.',
    title: 'Spending analytics and dashboard',
  },
  {
    description: 'Log realized payment events and manage refunds with concurrency-safe balances.',
    title: 'Payment and refund tracking',
  },
  {
    description: 'Receive proactive alerts before upcoming renewal dates or trial expirations.',
    title: 'Renewal reminders and notifications',
  },
  {
    description:
      'Surface actionable savings from deterministic rules grounded in your stored data.',
    title: 'Explainable cost optimization',
  },
];

function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_22%,rgba(52,211,153,0.16),transparent_30%),radial-gradient(circle_at_82%_28%,rgba(34,211,238,0.13),transparent_27%),linear-gradient(to_bottom,#07111f,#020617)]" />
        <div className="mx-auto grid min-h-[670px] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-28">
          <div>
            <div className="mb-8">
              <ApiStatus />
            </div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
              A clearer view of recurring costs
            </p>
            <h1 className="max-w-4xl text-5xl font-black tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Smart subscription tracking, built for better decisions.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              SpendWise AI organizes your recurring subscriptions, tracks payment history, clarifies
              multi-currency cash flow, and delivers explainable cost-optimization insights grounded
              in your actual data.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link
                    className="rounded-full bg-emerald-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-400/10 transition hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    to="/dashboard"
                  >
                    Go to Dashboard
                  </Link>
                  <Link
                    className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    to="/subscriptions"
                  >
                    Manage Subscriptions
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    className="rounded-full bg-emerald-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-400/10 transition hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    to="/register"
                  >
                    Get Started
                  </Link>
                  <Link
                    className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    to="/login"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5 text-xs font-semibold">
              <span className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Normalized Recurring Costs
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Multi-Currency Clarity
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Timely Renewal Alerts
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Deterministic Recommendations
              </span>
            </div>
          </div>

          <aside className="relative rounded-[2rem] border border-white/10 bg-white/[0.055] p-7 shadow-2xl shadow-black/30 backdrop-blur sm:p-9">
            <div className="absolute -right-6 -top-6 size-24 rounded-full bg-emerald-300/15 blur-2xl" />
            <p className="text-sm font-semibold text-emerald-300">All-in-one financial oversight</p>
            <h2 className="mt-3 text-2xl font-bold text-white">
              Everything you need to master your recurring expenses.
            </h2>
            <div className="mt-7 space-y-4">
              {featureList.map((item, index) => (
                <div className="flex gap-4" key={item.title}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-sm font-bold text-emerald-200">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-300">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 border-t border-white/10 pt-6 text-sm leading-6 text-slate-400">
              Sign in to open your protected dashboard. All calculations and recommendations are
              grounded in your stored records.
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-slate-100 text-slate-950" id="capabilities">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
              Platform capabilities
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Track what you pay and understand where it goes
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              From individual subscription lifecycles to multi-currency cash-flow analysis,
              SpendWise AI provides clear, transparent financial controls without guesswork.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {coreHighlights.map((capability) => (
              <article
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md"
                key={capability.title}
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  {capability.eyebrow}
                </p>
                <h3 className="mt-5 text-xl font-bold text-slate-950">{capability.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{capability.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
