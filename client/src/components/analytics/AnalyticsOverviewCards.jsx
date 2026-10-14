import { formatCurrency } from '../../utils/cost.js';

function AnalyticsOverviewCards({ summaries = [] }) {
  if (!summaries || summaries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-8 text-center text-slate-400">
        No completed payment records found for this period.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {summaries.map((summary) => {
        const netCashFlowNum = Number(summary.netCashFlow);
        const isNegativeNet = netCashFlowNum < 0;

        return (
          <div
            key={summary.currencyCode}
            className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur"
          >
            <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                  {summary.currencyCode}
                </span>
                Financial Summary ({summary.currencyCode})
              </span>
              <span className="text-xs text-slate-400">
                {summary.activeSubscriptionCount} active{' '}
                {summary.activeSubscriptionCount === 1 ? 'subscription' : 'subscriptions'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <span className="block text-xs font-medium text-slate-400">Gross Payments</span>
                <span className="mt-1 block text-lg font-bold text-white sm:text-xl">
                  {formatCurrency(summary.grossPayments, summary.currencyCode)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {summary.completedPaymentCount} completed
                </span>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <span className="block text-xs font-medium text-slate-400">Completed Refunds</span>
                <span className="mt-1 block text-lg font-bold text-amber-400 sm:text-xl">
                  {formatCurrency(summary.completedRefunds, summary.currencyCode)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {summary.refundCount} {summary.refundCount === 1 ? 'refund' : 'refunds'}
                </span>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <span className="block text-xs font-medium text-slate-400">Net Cash Flow</span>
                <span
                  className={`mt-1 block text-lg font-bold sm:text-xl ${
                    isNegativeNet ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(summary.netCashFlow, summary.currencyCode)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">Gross minus refunds</span>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <span className="block text-xs font-medium text-slate-400">Est. Monthly Cost</span>
                <span className="mt-1 block text-lg font-bold text-sky-400 sm:text-xl">
                  {formatCurrency(summary.estimatedMonthlyRecurring, summary.currencyCode)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">Active projection</span>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <span className="block text-xs font-medium text-slate-400">Est. Yearly Cost</span>
                <span className="mt-1 block text-lg font-bold text-indigo-400 sm:text-xl">
                  {formatCurrency(summary.estimatedYearlyRecurring, summary.currencyCode)}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">Annual projection</span>
              </div>
            </div>

            {(summary.pendingPaymentCount > 0 || summary.failedPaymentCount > 0) && (
              <div className="mt-4 flex flex-wrap gap-4 border-t border-white/5 pt-3 text-xs">
                {summary.pendingPaymentCount > 0 && (
                  <span className="text-amber-300">
                    Pending (Unconfirmed):{' '}
                    <strong>
                      {summary.pendingPaymentCount} (
                      {formatCurrency(summary.pendingAmount, summary.currencyCode)})
                    </strong>
                  </span>
                )}
                {summary.failedPaymentCount > 0 && (
                  <span className="text-rose-400">
                    Failed / Unsuccessful:{' '}
                    <strong>
                      {summary.failedPaymentCount} (
                      {formatCurrency(summary.failedAmount, summary.currencyCode)})
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AnalyticsOverviewCards;
