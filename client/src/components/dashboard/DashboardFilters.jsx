import { DASHBOARD_PERIODS } from '../../utils/dashboardFilters.js';

export default function DashboardFilters({
  currencyCode,
  currencyOptions,
  endDate,
  onCurrencyChange,
  onCustomDatesChange,
  onPresetChange,
  preset,
  startDate,
}) {
  return (
    <section
      aria-label="Dashboard filters"
      className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Reporting period
          </legend>
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_PERIODS.map((period) => (
              <button
                aria-pressed={preset === period.id}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
                  preset === period.id
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                key={period.id}
                onClick={() => onPresetChange(period.id)}
                type="button"
              >
                {period.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Display currency
          <select
            className="mt-2 block min-w-40 rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white focus:border-emerald-300 focus:outline-none"
            onChange={(event) => onCurrencyChange(event.target.value)}
            value={currencyCode}
          >
            <option value="">Separate all currencies</option>
            {currencyOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preset === 'custom' && (
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:max-w-xl">
          <label className="text-sm font-semibold text-slate-300">
            Start date
            <input
              className="form-input"
              max={endDate || undefined}
              onChange={(event) => onCustomDatesChange(event.target.value, endDate)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="text-sm font-semibold text-slate-300">
            End date
            <input
              className="form-input"
              min={startDate || undefined}
              onChange={(event) => onCustomDatesChange(startDate, event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Historical payments and refunds follow this period. Recurring estimates and renewal dates
        describe current subscription state.
      </p>
    </section>
  );
}
