export default function SubscriptionFilters({
  activeTab,
  categories,
  filters,
  onFilterChange,
  onResetFilters,
  onTabChange,
}) {
  return (
    <div className="space-y-4">
      {/* Active vs Archived Tab Bar */}
      <div className="flex border-b border-white/10">
        <button
          className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === 'active'
              ? 'border-emerald-400 text-emerald-300'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
          onClick={() => onTabChange('active')}
          type="button"
        >
          Active Subscriptions
        </button>
        <button
          className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === 'archived'
              ? 'border-emerald-400 text-emerald-300'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
          onClick={() => onTabChange('archived')}
          type="button"
        >
          Archived
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {/* Search */}
        <div className="lg:col-span-2">
          <input
            aria-label="Search subscriptions"
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400"
            name="search"
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Search service or plan…"
            value={filters.search}
          />
        </div>

        {/* Status */}
        <div>
          <select
            aria-label="Filter by status"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-400"
            name="status"
            onChange={(e) => onFilterChange('status', e.target.value)}
            value={filters.status}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <select
            aria-label="Filter by category"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-400"
            name="categoryId"
            onChange={(e) => onFilterChange('categoryId', e.target.value)}
            value={filters.categoryId}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Billing Cycle */}
        <div>
          <select
            aria-label="Filter by billing cycle"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-400"
            name="billingCycle"
            onChange={(e) => onFilterChange('billingCycle', e.target.value)}
            value={filters.billingCycle}
          >
            <option value="">All Cycles</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* Sort & Order */}
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Sort subscriptions"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-400"
            name="sortBy"
            onChange={(e) => onFilterChange('sortBy', e.target.value)}
            value={filters.sortBy}
          >
            <option value="createdAt">Date Added</option>
            <option value="nextRenewalDate">Renewal Date</option>
            <option value="price">Price</option>
            <option value="serviceName">Name</option>
            <option value="startDate">Start Date</option>
          </select>
          <button
            aria-label={`Sort order ${filters.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={() =>
              onFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
            }
            title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            type="button"
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Reset button if active filters exist */}
      {(filters.search || filters.status || filters.categoryId || filters.billingCycle) && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Active filters applied</span>
          <button
            className="text-emerald-400 hover:text-emerald-300 hover:underline"
            onClick={onResetFilters}
            type="button"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
