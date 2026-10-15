import { formatCurrency } from '../../utils/cost.js';
import { WidgetError, WidgetLoading } from './DashboardPanel.jsx';

const metrics = [
  ['Gross spending', 'grossPayments', 'Completed payments in period', 'text-white'],
  ['Completed refunds', 'completedRefunds', 'Recognized on refund date', 'text-amber-300'],
  ['Net cash flow', 'netCashFlow', 'Gross minus completed refunds', 'text-emerald-300'],
  [
    'Estimated monthly recurring',
    'estimatedMonthlyRecurring',
    'Current active and trial terms',
    'text-cyan-300',
  ],
];

export default function FinancialSummaryCards({ currencyCode, widget, onRetry }) {
  if (widget.loading) return <WidgetLoading label="financial overview" />;
  if (widget.error) return <WidgetError message={widget.error} onRetry={onRetry} />;

  const summaries = (widget.data?.currencySummaries || []).filter(
    (summary) => !currencyCode || summary.currencyCode === currencyCode,
  );
  if (!summaries.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/40 p-7 text-center">
        <h2 className="font-bold text-white">No financial activity for this selection</h2>
        <p className="mt-2 text-sm text-slate-400">
          Add a subscription to track current commitments or record a completed payment to build
          spending history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => (
        <section
          aria-label={`${summary.currencyCode} financial summary`}
          key={summary.currencyCode}
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              {summary.currencyCode} financial summary
            </h2>
            <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
              {summary.activeSubscriptionCount} active subscriptions
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(([label, field, help, color]) => {
              const negative = field === 'netCashFlow' && Number(summary[field]) < 0;
              return (
                <article
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
                  key={field}
                >
                  <p className="text-sm font-semibold text-slate-400">{label}</p>
                  <p
                    className={`mt-2 break-words text-2xl font-black ${negative ? 'text-rose-300' : color}`}
                  >
                    {formatCurrency(summary[field], summary.currencyCode)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{help}</p>
                  {field === 'netCashFlow' && negative && (
                    <span className="mt-2 inline-block rounded-full bg-rose-400/10 px-2 py-1 text-xs font-bold text-rose-300">
                      Negative cash flow retained
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
