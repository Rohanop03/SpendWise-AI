import { Link } from 'react-router-dom';

import { formatCurrency } from '../../utils/cost.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

const statuses = [
  [
    'completed',
    'Completed',
    'Realized spending',
    'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  ],
  [
    'pending',
    'Pending',
    'Unconfirmed, not realized',
    'border-amber-400/20 bg-amber-400/10 text-amber-200',
  ],
  [
    'failed',
    'Failed',
    'Unsuccessful, not realized',
    'border-rose-400/20 bg-rose-400/10 text-rose-200',
  ],
];

export default function PaymentStatusWidget({ widget, onRetry }) {
  const entries = widget.data?.statuses || [];
  return (
    <DashboardPanel
      description="Pending and failed attempts are explicitly excluded from realized expenditure."
      title="Payment status"
    >
      {widget.loading ? (
        <WidgetLoading label="payment status" />
      ) : widget.error ? (
        <WidgetError message={widget.error} onRetry={onRetry} />
      ) : !entries.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          No payment attempts were recorded for this period.
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <section aria-label={`${entry.currencyCode} payment statuses`} key={entry.currencyCode}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                {entry.currencyCode}
              </h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {statuses.map(([key, label, help, color]) => (
                  <div className={`rounded-xl border p-3 ${color}`} key={key}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{label}</span>
                      <span
                        aria-label={`${entry[key]?.count || 0} ${label.toLowerCase()} payments`}
                        className="text-sm font-black"
                      >
                        {entry[key]?.count || 0}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-white">
                      {formatCurrency(entry[key]?.amount || '0.00', entry.currencyCode)}
                    </p>
                    <p className="mt-1 text-[11px] opacity-80">{help}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <Link
            className="inline-flex text-sm font-bold text-emerald-300 hover:text-emerald-200"
            to="/payments"
          >
            Review payment history →
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
}
