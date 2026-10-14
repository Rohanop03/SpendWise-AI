import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getBillingOverview } from '../api/billing.js';
import { getApiErrorMessage } from '../api/http.js';
import RecurringCostCard from '../components/billing/RecurringCostCard.jsx';
import UpcomingRenewalCard from '../components/billing/UpcomingRenewalCard.jsx';

export default function BillingOverviewPage() {
  const [daysWindow, setDaysWindow] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    getBillingOverview({ days: daysWindow })
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        setError('');
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [daysWindow]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Billing Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor estimated recurring costs by currency, track upcoming renewals, and review
            unconfirmed renewal dates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
            to="/payments"
          >
            Payment History &rarr;
          </Link>
          <Link
            className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-300"
            to="/payments/new"
          >
            + Record Payment
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-12 rounded-2xl border border-white/10 bg-slate-900/40 p-12 text-center text-sm text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent mb-3" />
          <p>Calculating billing projections...</p>
        </div>
      ) : data ? (
        <div className="mt-8 space-y-10">
          {/* Section 1: Recurring Costs Grouped by Currency */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Estimated Recurring Costs</h2>
                <p className="text-xs text-slate-400">
                  Normalized monthly estimates grouped by currency. Currencies are separated without
                  conversion.
                </p>
              </div>
            </div>

            {data.recurringCosts && data.recurringCosts.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.recurringCosts.map((cost) => (
                  <RecurringCostCard cost={cost} key={cost.currencyCode} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/30 p-8 text-center text-xs text-slate-500">
                No active subscriptions found to calculate recurring costs.
              </div>
            )}
          </div>

          {/* Section 2: Overdue Renewals (if any) */}
          {data.overdueRenewals && data.overdueRenewals.length > 0 && (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-950/20 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300">
                  ⚠️
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Unconfirmed Renewal Dates ({data.overdueRenewals.length})
                  </h2>
                  <p className="mt-1 text-xs text-rose-300/80">
                    The scheduled renewal date for these active subscriptions has passed, but no
                    payment was recorded. SpendWise AI never assumes payment outcomes automatically.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.overdueRenewals.map((item) => (
                  <UpcomingRenewalCard item={item} key={item.subscriptionId} />
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Upcoming Renewals */}
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Upcoming Renewals</h2>
                <p className="text-xs text-slate-400">
                  Expected subscription renewals within the selected time window.
                </p>
              </div>

              {/* Time Window Selector */}
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 p-1 text-xs">
                {[7, 14, 30, 60, 90].map((days) => (
                  <button
                    className={`rounded-lg px-3 py-1 font-semibold transition ${
                      daysWindow === days
                        ? 'bg-emerald-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    key={days}
                    onClick={() => setDaysWindow(days)}
                    type="button"
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              {data.upcomingRenewals && data.upcomingRenewals.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.upcomingRenewals.map((item) => (
                    <UpcomingRenewalCard item={item} key={item.subscriptionId} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-8 text-center text-xs text-slate-500">
                  No subscriptions are scheduled to renew within the next {daysWindow} days.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
