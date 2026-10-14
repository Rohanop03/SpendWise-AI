import { Link } from 'react-router-dom';

import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';

function SubscriptionSpendingTable({
  onSort,
  sortBy = 'grossPayments',
  sortOrder = 'desc',
  subscriptions = [],
}) {
  if (!subscriptions || subscriptions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center text-slate-400">
        No subscription spending recorded for this period.
      </div>
    );
  }

  function renderSortIcon(column) {
    if (sortBy !== column) {
      return (
        <svg
          className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg
        className="h-3 w-3 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg
        className="h-3 w-3 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur">
      <table className="w-full text-left text-sm text-slate-200">
        <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-3.5">
              <button
                type="button"
                onClick={() => onSort && onSort('serviceName')}
                className="group inline-flex items-center gap-1 hover:text-white"
              >
                Service / Plan
                {renderSortIcon('serviceName')}
              </button>
            </th>
            <th className="px-5 py-3.5">Category</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5">Cycle</th>
            <th className="px-5 py-3.5 text-right">
              <button
                type="button"
                onClick={() => onSort && onSort('currentPrice')}
                className="group inline-flex items-center gap-1 hover:text-white"
              >
                Current Price
                {renderSortIcon('currentPrice')}
              </button>
            </th>
            <th className="px-5 py-3.5 text-right">
              <button
                type="button"
                onClick={() => onSort && onSort('grossPayments')}
                className="group inline-flex items-center gap-1 hover:text-white"
              >
                Gross Payments
                {renderSortIcon('grossPayments')}
              </button>
            </th>
            <th className="px-5 py-3.5 text-right">Refunds</th>
            <th className="px-5 py-3.5 text-right">
              <button
                type="button"
                onClick={() => onSort && onSort('netCashFlow')}
                className="group inline-flex items-center gap-1 hover:text-white"
              >
                Net Cash Flow
                {renderSortIcon('netCashFlow')}
              </button>
            </th>
            <th className="px-5 py-3.5 text-center">
              <button
                type="button"
                onClick={() => onSort && onSort('completedPaymentCount')}
                className="group inline-flex items-center gap-1 hover:text-white"
              >
                Payments
                {renderSortIcon('completedPaymentCount')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {subscriptions.map((sub) => {
            const netNum = Number(sub.netCashFlow);
            const isNegative = netNum < 0;

            return (
              <tr key={sub.subscriptionId} className="hover:bg-slate-800/40">
                <td className="px-5 py-4">
                  <Link
                    to={`/subscriptions/${sub.subscriptionId}`}
                    className="font-semibold text-white hover:text-emerald-400"
                  >
                    {sub.serviceName}
                  </Link>
                  {sub.archivedAt && (
                    <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      Archived
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-xs text-slate-400">{sub.categoryName}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                      sub.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : sub.status === 'trial'
                          ? 'bg-sky-500/15 text-sky-400'
                          : sub.status === 'paused'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {sub.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-slate-400">
                  {getBillingCycleLabel(sub.billingCycle)}
                </td>
                <td className="px-5 py-4 text-right text-xs font-medium text-slate-300">
                  {formatCurrency(sub.currentPrice, sub.currencyCode)}
                </td>
                <td className="px-5 py-4 text-right font-medium text-white">
                  {formatCurrency(sub.grossPayments, sub.currencyCode)}
                </td>
                <td className="px-5 py-4 text-right font-medium text-amber-400">
                  {formatCurrency(sub.completedRefunds, sub.currencyCode)}
                </td>
                <td
                  className={`px-5 py-4 text-right font-semibold ${
                    isNegative ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(sub.netCashFlow, sub.currencyCode)}
                </td>
                <td className="px-5 py-4 text-center text-xs text-slate-400">
                  {sub.completedPaymentCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default SubscriptionSpendingTable;
