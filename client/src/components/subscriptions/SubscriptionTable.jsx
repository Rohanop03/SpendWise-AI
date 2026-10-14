import { Link } from 'react-router-dom';

import {
  calculateMonthlyEquivalent,
  formatCurrency,
  getBillingCycleLabel,
} from '../../utils/cost.js';
import SubscriptionStatusBadge from './SubscriptionStatusBadge.jsx';

export default function SubscriptionTable({ onArchiveClick, subscriptions }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-6 py-4" scope="col">
              Service & Plan
            </th>
            <th className="px-6 py-4" scope="col">
              Category
            </th>
            <th className="px-6 py-4" scope="col">
              Cost & Cycle
            </th>
            <th className="px-6 py-4" scope="col">
              Status
            </th>
            <th className="px-6 py-4" scope="col">
              Next Renewal
            </th>
            <th className="px-6 py-4 text-right" scope="col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {subscriptions.map((sub) => {
            const monthlyCost = calculateMonthlyEquivalent(sub.price, sub.billingCycle);
            const isMonthly = sub.billingCycle === 'monthly';

            return (
              <tr className="transition hover:bg-white/[0.02]" key={sub.id}>
                <td className="px-6 py-4">
                  <div className="font-semibold text-white">
                    <Link
                      className="hover:text-emerald-300 hover:underline"
                      to={`/subscriptions/${sub.id}`}
                    >
                      {sub.serviceName}
                    </Link>
                  </div>
                  {sub.planName && <div className="text-xs text-slate-400">{sub.planName}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                    {sub.categoryName || 'Uncategorized'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-white">
                    {formatCurrency(sub.price, sub.currencyCode)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {getBillingCycleLabel(sub.billingCycle)}
                    {!isMonthly && ` (~${formatCurrency(monthlyCost, sub.currencyCode)}/mo)`}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <SubscriptionStatusBadge archivedAt={sub.archivedAt} status={sub.status} />
                </td>
                <td className="px-6 py-4 text-slate-200">
                  {sub.nextRenewalDate || <span className="text-slate-500">—</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
                      to={`/subscriptions/${sub.id}/edit`}
                    >
                      Edit
                    </Link>
                    <Link
                      className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
                      to={`/subscriptions/${sub.id}`}
                    >
                      View
                    </Link>
                    {onArchiveClick && !sub.archivedAt && (
                      <button
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:border-rose-400/30 hover:text-rose-300"
                        onClick={() => onArchiveClick(sub)}
                        type="button"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
