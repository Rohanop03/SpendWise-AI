import { Link } from 'react-router-dom';

import { formatCurrency } from '../../utils/cost.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

export default function RefundSummary({ widget, onRetry }) {
  const summaries = widget.data?.summaries || [];
  return (
    <DashboardPanel
      description="Completed refund records recognized on their recorded refund dates."
      title="Refund summary"
    >
      {widget.loading ? (
        <WidgetLoading label="refund summary" />
      ) : widget.error ? (
        <WidgetError message={widget.error} onRetry={onRetry} />
      ) : !summaries.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          No completed refunds were recorded for this period.
        </p>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <div className="rounded-2xl bg-slate-950/45 p-4" key={summary.currencyCode}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {summary.currencyCode}
                  </p>
                  <p className="mt-1 text-2xl font-black text-amber-300">
                    {formatCurrency(summary.totalRefundAmount, summary.currencyCode)}
                  </p>
                </div>
                <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                  {summary.refundedPaymentCount} refunded payments
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {summary.partiallyRefundedCount} partial · {summary.fullyRefundedCount} full
              </p>
            </div>
          ))}
          <p className="text-xs leading-5 text-slate-500">
            These are manually recorded refund events, not confirmation from a bank or payment
            provider.
          </p>
          <Link
            className="inline-flex text-sm font-bold text-emerald-300 hover:text-emerald-200"
            to="/payments"
          >
            View payments and refunds →
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
}
