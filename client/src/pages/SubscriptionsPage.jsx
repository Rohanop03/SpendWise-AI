import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getCategories } from '../api/catalog.js';
import { getApiErrorMessage } from '../api/http.js';
import { archiveSubscription, getSubscriptions } from '../api/subscriptions.js';
import ConfirmArchiveModal from '../components/subscriptions/ConfirmArchiveModal.jsx';
import SubscriptionCard from '../components/subscriptions/SubscriptionCard.jsx';
import SubscriptionEmptyState from '../components/subscriptions/SubscriptionEmptyState.jsx';
import SubscriptionFilters from '../components/subscriptions/SubscriptionFilters.jsx';
import SubscriptionTable from '../components/subscriptions/SubscriptionTable.jsx';
import { calculateMonthlyEquivalent, formatCurrency } from '../utils/cost.js';

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archived'
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [pagination, setPagination] = useState({
    limit: 10,
    page: 1,
    totalCount: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const initialFilters = {
    billingCycle: '',
    categoryId: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    status: '',
  };
  const [filters, setFilters] = useState(initialFilters);

  // Load categories once
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Fetch subscriptions when tab, filters, or page change
  useEffect(() => {
    let isMounted = true;

    const params = {
      archived: activeTab === 'archived' ? 'true' : 'false',
      limit: pagination.limit,
      page: pagination.page,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.billingCycle) params.billingCycle = filters.billingCycle;

    getSubscriptions(params)
      .then((data) => {
        if (!isMounted) return;
        setSubscriptions(data.items);
        setPagination(data.pagination);
        setError('');
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, filters, pagination.page, pagination.limit]);

  function handleFilterChange(key, value) {
    setLoading(true);
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handleResetFilters() {
    setLoading(true);
    setFilters(initialFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handleTabChange(tab) {
    setLoading(true);
    setActiveTab(tab);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  async function handleConfirmArchive() {
    if (!archiveTarget) return;
    setIsArchiving(true);
    try {
      await archiveSubscription(archiveTarget.id);
      setArchiveTarget(null);
      // Reload subscriptions
      const params = {
        archived: activeTab === 'archived' ? 'true' : 'false',
        limit: pagination.limit,
        page: pagination.page,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.billingCycle) params.billingCycle = filters.billingCycle;

      const data = await getSubscriptions(params);
      setSubscriptions(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsArchiving(false);
    }
  }

  const isFiltered = Boolean(
    filters.search || filters.status || filters.categoryId || filters.billingCycle,
  );

  // Compute total monthly equivalent spend on current page/view
  const totalMonthlySpend = subscriptions
    .filter((sub) => sub.status === 'active' || sub.status === 'trial')
    .reduce((sum, sub) => sum + calculateMonthlyEquivalent(sub.price, sub.billingCycle), 0);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
            Subscription Management
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
            My Subscriptions
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track recurring services, manage renewal timelines, and monitor monthly spending.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
            to="/subscriptions/new"
          >
            <span>+</span>
            <span>Add Subscription</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Banner (when subscriptions exist) */}
      {!loading && subscriptions.length > 0 && activeTab === 'active' && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Subscriptions
            </span>
            <div className="mt-2 text-2xl font-black text-white">{pagination.totalCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Est. Monthly Cost
            </span>
            <div className="mt-2 text-2xl font-black text-emerald-300">
              {formatCurrency(totalMonthlySpend)}
            </div>
            <span className="text-xs text-slate-400">Across visible active plans</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Est. Annualized Run Rate
            </span>
            <div className="mt-2 text-2xl font-black text-white">
              {formatCurrency(totalMonthlySpend * 12)}
            </div>
            <span className="text-xs text-slate-400">12-month projection</span>
          </div>
        </div>
      )}

      {/* Filters & Tabs */}
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <SubscriptionFilters
          activeTab={activeTab}
          categories={categories}
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onTabChange={handleTabChange}
        />
      </div>

      {/* Error Notice */}
      {error && (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Subscriptions List / Table */}
      <div className="mt-6">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading subscriptions…</div>
        ) : subscriptions.length === 0 ? (
          <SubscriptionEmptyState
            isArchived={activeTab === 'archived'}
            isFiltered={isFiltered}
            onResetFilters={handleResetFilters}
          />
        ) : (
          <div className="space-y-6">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <SubscriptionTable
                onArchiveClick={(sub) => setArchiveTarget(sub)}
                subscriptions={subscriptions}
              />
            </div>

            {/* Mobile Card Grid View */}
            <div className="grid gap-4 sm:grid-cols-2 md:hidden">
              {subscriptions.map((sub) => (
                <SubscriptionCard key={sub.id} subscription={sub} />
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-4 sm:flex-row">
                <p className="text-xs text-slate-400">
                  Showing page <strong className="text-white">{pagination.page}</strong> of{' '}
                  <strong className="text-white">{pagination.totalPages}</strong> (
                  {pagination.totalCount} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(pagination.totalPages, prev.page + 1),
                      }))
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archive Modal */}
      <ConfirmArchiveModal
        isOpen={Boolean(archiveTarget)}
        isSubmitting={isArchiving}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleConfirmArchive}
        subscription={archiveTarget}
      />
    </section>
  );
}
