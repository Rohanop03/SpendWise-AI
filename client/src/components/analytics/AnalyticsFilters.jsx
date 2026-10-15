import { useState } from 'react';

import { DASHBOARD_PERIODS, getPresetRange } from '../../utils/dashboardFilters.js';

function AnalyticsFilters({
  availableCurrencies = [],
  currencyCode = '',
  endDate = '',
  onCurrencyChange,
  onDateChange,
  onExportCsv,
  startDate = '',
}) {
  const [selectedPreset, setSelectedPreset] = useState('all_time');

  function handlePresetChange(preset) {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      onDateChange(range.startDate, range.endDate);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Period:
          </span>
          {DASHBOARD_PERIODS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetChange(preset.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selectedPreset === preset.id
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Currency & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="analytics-currency" className="text-xs font-medium text-slate-400">
              Currency:
            </label>
            <select
              id="analytics-currency"
              value={currencyCode}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs font-medium text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Currencies</option>
              {availableCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Export CSV button */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Pickers */}
      {selectedPreset === 'custom' && (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/5 pt-4 text-xs">
          <div className="flex items-center gap-2">
            <label htmlFor="start-date" className="font-medium text-slate-400">
              Start Date:
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="end-date" className="font-medium text-slate-400">
              End Date:
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsFilters;
