export default function PaymentFilters({ filters, onChange, onReset, subscriptions = [] }) {
  function handleChange(field, value) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Subscription filter */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            htmlFor="sub-filter"
          >
            Subscription
          </label>
          <select
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-400 focus:outline-none"
            id="sub-filter"
            onChange={(e) => handleChange('subscriptionId', e.target.value)}
            value={filters.subscriptionId || ''}
          >
            <option value="">All Subscriptions</option>
            {subscriptions.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.serviceName || sub.customServiceName}
                {sub.planName ? ` (${sub.planName})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            htmlFor="status-filter"
          >
            Status
          </label>
          <select
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-400 focus:outline-none"
            id="status-filter"
            onChange={(e) => handleChange('status', e.target.value)}
            value={filters.status || ''}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Currency filter */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            htmlFor="currency-filter"
          >
            Currency
          </label>
          <select
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-400 focus:outline-none"
            id="currency-filter"
            onChange={(e) => handleChange('currencyCode', e.target.value)}
            value={filters.currencyCode || ''}
          >
            <option value="">All Currencies</option>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD ($)</option>
            <option value="AUD">AUD ($)</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            htmlFor="start-date-filter"
          >
            From Date
          </label>
          <input
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-400 focus:outline-none"
            id="start-date-filter"
            onChange={(e) => handleChange('startDate', e.target.value)}
            type="date"
            value={filters.startDate || ''}
          ></input>
        </div>

        {/* Date To */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            htmlFor="end-date-filter"
          >
            To Date
          </label>
          <input
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-400 focus:outline-none"
            id="end-date-filter"
            onChange={(e) => handleChange('endDate', e.target.value)}
            type="date"
            value={filters.endDate || ''}
          ></input>
        </div>

        {/* Sort */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            htmlFor="sort-filter"
          >
            Sort By
          </label>
          <select
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-400 focus:outline-none"
            id="sort-filter"
            onChange={(e) => {
              const [by, order] = e.target.value.split(':');
              onChange({ ...filters, sortBy: by, sortOrder: order });
            }}
            value={`${filters.sortBy || 'paymentDate'}:${filters.sortOrder || 'desc'}`}
          >
            <option value="paymentDate:desc">Date (Newest First)</option>
            <option value="paymentDate:asc">Date (Oldest First)</option>
            <option value="amount:desc">Amount (Highest First)</option>
            <option value="amount:asc">Amount (Lowest First)</option>
            <option value="createdAt:desc">Created (Newest First)</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          className="text-xs font-medium text-slate-400 transition hover:text-white"
          onClick={onReset}
          type="button"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
