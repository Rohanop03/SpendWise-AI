import { Link } from 'react-router-dom';

import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';

export default function UpcomingRenewalCard({ item }) {
  const {
    billingCycle,
    currencyCode,
    daysUntilRenewal,
    isOverdue,
    nextRenewalDate,
    overdueNotice,
    planName,
    price,
    serviceName,
    subscriptionId,
  } = item;

  let badgeColor = 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400';
  let badgeText = `In ${daysUntilRenewal} ${daysUntilRenewal === 1 ? 'day' : 'days'}`;

  if (isOverdue) {
    const overdueDays = Math.abs(daysUntilRenewal);
    badgeColor = 'border-rose-500/30 bg-rose-500/15 text-rose-300';
    badgeText = `Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`;
  } else if (daysUntilRenewal === 0) {
    badgeColor = 'border-amber-500/30 bg-amber-500/15 text-amber-300';
    badgeText = 'Due Today';
  } else if (daysUntilRenewal <= 7) {
    badgeColor = 'border-amber-500/25 bg-amber-500/10 text-amber-300';
  }

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition ${
        isOverdue
          ? 'border-rose-500/30 bg-rose-950/15'
          : 'border-white/10 bg-slate-900/60 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">{serviceName}</h3>
          {planName && <p className="text-xs text-slate-400">{planName}</p>}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}
        >
          {badgeText}
        </span>
      </div>

      {isOverdue && overdueNotice && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <span className="font-semibold">{overdueNotice}</span>
          <p className="mt-0.5 text-[11px] text-rose-400">
            No completed payment record exists. You may record a payment if externally completed.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-xs">
        <div>
          <span className="text-slate-500">Scheduled Date</span>
          <p className="font-medium text-slate-200">{nextRenewalDate}</p>
        </div>
        <div>
          <span className="text-slate-500">Recurring Rate</span>
          <p className="font-medium text-white">
            {formatCurrency(price, currencyCode)}{' '}
            <span className="text-[11px] font-normal text-slate-400">
              /{getBillingCycleLabel(billingCycle).toLowerCase()}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <Link
          className="text-xs text-slate-400 transition hover:text-white"
          to={`/subscriptions/${subscriptionId}`}
        >
          View Subscription &rarr;
        </Link>
        <Link
          className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-300"
          to={`/payments/new?subscriptionId=${subscriptionId}`}
        >
          Record Payment
        </Link>
      </div>
    </div>
  );
}
