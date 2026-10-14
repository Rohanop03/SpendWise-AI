import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';

function BillingCycleDistribution({ billingCycles = [] }) {
  if (!billingCycles || billingCycles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center text-slate-400">
        No active billing cycles to display.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
      <div className="mb-4">
        <h3 className="text-base font-bold text-white">Billing Cycle Distribution</h3>
        <p className="text-xs text-slate-400">
          Breakdown of active and trial recurring subscriptions by billing interval
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {billingCycles.map((cycle) => (
          <div
            key={`${cycle.billingCycle}-${cycle.currencyCode}`}
            className="rounded-2xl border border-white/5 bg-slate-950/40 p-4"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <span className="text-sm font-bold text-white">
                {getBillingCycleLabel(cycle.billingCycle)}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                {cycle.currencyCode}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Subscriptions:</span>
                <span className="font-semibold text-white">
                  {cycle.subscriptionCount}{' '}
                  <span className="text-slate-500 font-normal">
                    ({cycle.activeCount} active, {cycle.trialCount} trial)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Monthly Cost:</span>
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(cycle.estimatedMonthlyTotal, cycle.currencyCode)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Annualized Cost:</span>
                <span className="font-semibold text-sky-400">
                  {formatCurrency(cycle.estimatedYearlyTotal, cycle.currencyCode)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BillingCycleDistribution;
