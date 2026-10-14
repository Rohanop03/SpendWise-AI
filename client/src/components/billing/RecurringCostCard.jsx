import { formatCurrency } from '../../utils/cost.js';

export default function RecurringCostCard({ cost }) {
  const { currencyCode, monthlyEquivalent, subscriptionCount } = cost;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
          {currencyCode}
        </span>
        <span className="text-xs text-slate-400">
          {subscriptionCount} {subscriptionCount === 1 ? 'Subscription' : 'Subscriptions'}
        </span>
      </div>

      <div className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Estimated Monthly Cost
        </span>
        <div className="mt-1 text-3xl font-extrabold tracking-tight text-white">
          {formatCurrency(monthlyEquivalent, currencyCode)}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Calculated from active recurring plans normalized to monthly equivalent.
      </p>
    </div>
  );
}
