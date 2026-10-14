import { formatCurrency } from '../../utils/cost.js';

function PaymentStatusSummary({ statuses = [] }) {
  if (!statuses || statuses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center text-slate-400">
        No payment transactions recorded for this period.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
      <div className="mb-4">
        <h3 className="text-base font-bold text-white">Payment Status Analytics</h3>
        <p className="text-xs text-slate-400">
          Distribution of payment attempts by verification state. Only completed payments count
          toward realized spend.
        </p>
      </div>

      <div className="space-y-4">
        {statuses.map((entry) => (
          <div
            key={entry.currencyCode}
            className="rounded-2xl border border-white/5 bg-slate-950/40 p-4"
          >
            <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-semibold text-slate-300">
                Currency: <span className="text-white">{entry.currencyCode}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Completed */}
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400">
                    Completed (Realized)
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {entry.completed?.count || 0}
                  </span>
                </div>
                <span className="mt-2 block text-base font-bold text-white">
                  {formatCurrency(entry.completed?.amount || 0, entry.currencyCode)}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  Confirmed historical transactions
                </span>
              </div>

              {/* Pending */}
              <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400">
                    Pending (Unconfirmed)
                  </span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    {entry.pending?.count || 0}
                  </span>
                </div>
                <span className="mt-2 block text-base font-bold text-white">
                  {formatCurrency(entry.pending?.amount || 0, entry.currencyCode)}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  Excluded from realized spending
                </span>
              </div>

              {/* Failed */}
              <div className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400">Failed (Unsuccessful)</span>
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                    {entry.failed?.count || 0}
                  </span>
                </div>
                <span className="mt-2 block text-base font-bold text-white">
                  {formatCurrency(entry.failed?.amount || 0, entry.currencyCode)}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  Excluded from realized spending
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PaymentStatusSummary;
