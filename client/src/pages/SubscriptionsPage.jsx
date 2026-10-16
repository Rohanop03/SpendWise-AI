import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

import { getCategories } from '../api/catalog.js';
import { getApiErrorMessage } from '../api/http.js';
import { archiveSubscription, getSubscriptions } from '../api/subscriptions.js';
import {
  SubscriptionCard,
  SubscriptionTable,
} from '../components/subscriptions/SubscriptionViews.jsx';
import { pageIndex } from '../layout/nav.js';
import { ConfirmDialog } from '../ui/Dialog.jsx';
import { CardSkeleton, EmptyState, InlineError, Skeleton } from '../ui/Feedback.jsx';
import { Field, Select } from '../ui/Field.jsx';
import Icon from '../ui/Icon.jsx';
import { useMediaQuery } from '../ui/motion.js';
import { PageHeader } from '../ui/Page.jsx';
import { IconButton, Pill, PillLink } from '../ui/Pill.jsx';
import Segmented from '../ui/Segmented.jsx';
import { Card } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';
import { calculateMonthlyEquivalent, formatCurrency } from '../utils/cost.js';

const initialFilters = {
  billingCycle: '',
  categoryId: '',
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  status: '',
};

function queryFor(activeTab, filters, pagination) {
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
  return params;
}

export default function SubscriptionsPage() {
  const { notify } = useToast();
  const phone = useMediaQuery('(max-width: 767px)');
  const [view, setView] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
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
  const [filters, setFilters] = useState(initialFilters);
  const [reloadKey, setReloadKey] = useState(0);
  const currentView = view || (phone ? 'cards' : 'table');

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let isMounted = true;
    getSubscriptions(queryFor(activeTab, filters, pagination))
      .then((data) => {
        if (!isMounted) return;
        setSubscriptions(data.items);
        setPagination(data.pagination);
        setError('');
      })
      .catch((err) => {
        if (isMounted) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- page/limit are the pagination inputs
  }, [activeTab, filters, pagination.page, pagination.limit, reloadKey]);

  function handleFilterChange(key, value) {
    setLoading(true);
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handleSort(field) {
    setLoading(true);
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
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
      notify(`${archiveTarget.serviceName} archived.`, {
        description: 'Find it under Archived; it can be restored any time.',
      });
      setArchiveTarget(null);
      const data = await getSubscriptions(queryFor(activeTab, filters, pagination));
      setSubscriptions(data.items);
      setPagination(data.pagination);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      notify('Could not archive the subscription.', { description: message, tone: 'error' });
    } finally {
      setIsArchiving(false);
    }
  }

  const isFiltered = Boolean(
    filters.search || filters.status || filters.categoryId || filters.billingCycle,
  );

  // Estimated monthly cost of the visible active/trial plans, kept per currency (never mixed).
  const monthlyByCurrency = subscriptions
    .filter((sub) => sub.status === 'active' || sub.status === 'trial')
    .reduce((totals, sub) => {
      totals[sub.currencyCode] =
        (totals[sub.currencyCode] || 0) + calculateMonthlyEquivalent(sub.price, sub.billingCycle);
      return totals;
    }, {});
  const currencyTotals = Object.entries(monthlyByCurrency);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        actions={
          <PillLink icon="plus" to="/subscriptions/new" variant="ink">
            Add Subscription
          </PillLink>
        }
        description="Track recurring services, manage renewal timelines, and monitor monthly spending."
        index={pageIndex('/subscriptions')}
        title="My Subscriptions"
      />

      {activeTab === 'active' && loading && (
        // Same footprint as the KPI row below, so the filters don't jump when data lands.
        <div aria-hidden="true" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div className="neu-raised h-[10.5rem] rounded-(--radius-card) p-6" key={index}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-4 h-12 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && subscriptions.length > 0 && activeTab === 'active' && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="min-h-[10.5rem]" delay={0} look="obsidian">
            <p className="text-sm font-bold text-soft">Active Subscriptions</p>
            <p className="display-num mt-2 text-5xl">{pagination.totalCount}</p>
            <p className="mt-2 text-xs text-soft">Not archived, any status</p>
          </Card>
          <Card className="min-h-[10.5rem]" delay={0.05}>
            <p className="text-sm font-bold text-(--graphite)">Est. Monthly Cost</p>
            {currencyTotals.map(([code, total]) => (
              <p className="display-num mt-2 text-4xl" key={code}>
                {formatCurrency(total, code)}
              </p>
            ))}
            <p className="mt-2 text-xs text-(--graphite)">Across visible active plans</p>
          </Card>
          <Card className="min-h-[10.5rem]" delay={0.1}>
            <p className="text-sm font-bold text-(--graphite)">Est. Annualized Run Rate</p>
            {currencyTotals.map(([code, total]) => (
              <p className="display-num mt-2 text-4xl" key={code}>
                {formatCurrency(total * 12, code)}
              </p>
            ))}
            <p className="mt-2 text-xs text-(--graphite)">12-month projection</p>
          </Card>
        </div>
      )}

      <Card className="mb-6" look="glass" padded={false}>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              label="Subscription list"
              labelHidden
              onChange={handleTabChange}
              options={[
                { label: 'Active Subscriptions', value: 'active' },
                { label: 'Archived', value: 'archived' },
              ]}
              value={activeTab}
            />
            <div className="flex items-center gap-2">
              <span className="eyebrow hidden sm:inline">View</span>
              <IconButton
                aria-pressed={currentView === 'table'}
                icon="list"
                label="Table view"
                onClick={() => setView('table')}
              />
              <IconButton
                aria-pressed={currentView === 'cards'}
                icon="grid"
                label="Card view"
                onClick={() => setView('cards')}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="well flex items-center gap-2 !py-0">
              <Icon className="size-4 shrink-0 text-(--graphite)" name="search" />
              <input
                aria-label="Search subscriptions"
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
                name="search"
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search service or plan…"
                value={filters.search}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field className="min-w-44" label="Category">
                {(id) => (
                  <Select
                    aria-label="Filter by category"
                    id={id}
                    name="categoryId"
                    onChange={(e) => handleFilterChange('categoryId', e.target.value)}
                    value={filters.categoryId}
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field className="min-w-40" label="Sort by">
                {(id) => (
                  <Select
                    aria-label="Sort subscriptions"
                    id={id}
                    name="sortBy"
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    value={filters.sortBy}
                  >
                    <option value="createdAt">Date Added</option>
                    <option value="nextRenewalDate">Renewal Date</option>
                    <option value="price">Price</option>
                    <option value="serviceName">Name</option>
                    <option value="startDate">Start Date</option>
                  </Select>
                )}
              </Field>
              <IconButton
                icon={filters.sortOrder === 'asc' ? 'arrowUpRight' : 'chevronDown'}
                label={`Sort order ${filters.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                onClick={() =>
                  handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Segmented
              label="Status"
              onChange={(value) => handleFilterChange('status', value)}
              options={[
                { label: 'All', value: '' },
                { label: 'Active', value: 'active' },
                { label: 'Trial', value: 'trial' },
                { label: 'Paused', value: 'paused' },
                { label: 'Cancelled', value: 'cancelled' },
              ]}
              size="sm"
              value={filters.status}
            />
            <Segmented
              label="Billing cycle"
              onChange={(value) => handleFilterChange('billingCycle', value)}
              options={[
                { label: 'All', value: '' },
                { label: 'Monthly', value: 'monthly' },
                { label: 'Quarterly', value: 'quarterly' },
                { label: 'Yearly', value: 'yearly' },
              ]}
              size="sm"
              value={filters.billingCycle}
            />
          </div>

          {isFiltered && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-(--graphite)">Active filters applied</span>
              <Pill icon="undo" onClick={handleResetFilters} size="sm" variant="ghost">
                Reset filters
              </Pill>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="mb-6">
          <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      )}

      <div aria-live="polite">
        {loading ? (
          <Card>
            <CardSkeleton label="subscriptions" lines={4} />
          </Card>
        ) : subscriptions.length === 0 ? (
          <Card>
            {isFiltered ? (
              <EmptyState
                action={
                  <Pill icon="undo" onClick={handleResetFilters}>
                    Clear filters
                  </Pill>
                }
                title="No matching subscriptions"
              >
                Try adjusting or clearing your search filters to find what you are looking for.
              </EmptyState>
            ) : activeTab === 'archived' ? (
              <EmptyState title="No archived subscriptions">
                Archived subscriptions will appear here. Archiving lets you hide inactive
                subscriptions without losing your records.
              </EmptyState>
            ) : (
              <EmptyState
                action={
                  <PillLink icon="plus" to="/subscriptions/new" variant="ink">
                    Add your first subscription
                  </PillLink>
                }
                title="No subscriptions tracked yet"
              >
                Start tracking your recurring services, renewal dates, and monthly costs in one
                place.
              </EmptyState>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            {currentView === 'table' ? (
              <SubscriptionTable
                onArchiveClick={setArchiveTarget}
                onSort={handleSort}
                sortBy={filters.sortBy}
                sortOrder={filters.sortOrder}
                subscriptions={subscriptions}
              />
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {subscriptions.map((sub) => (
                    <li key={sub.id}>
                      <SubscriptionCard onArchiveClick={setArchiveTarget} subscription={sub} />
                    </li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            {pagination.totalPages > 1 && (
              <nav
                aria-label="Subscription pages"
                className="flex flex-col items-center justify-between gap-4 sm:flex-row"
              >
                <p className="text-sm text-(--graphite)">
                  Showing page <strong className="text-(--ink)">{pagination.page}</strong> of{' '}
                  <strong className="text-(--ink)">{pagination.totalPages}</strong> (
                  {pagination.totalCount} total)
                </p>
                <div className="flex items-center gap-2">
                  <Pill
                    disabled={pagination.page <= 1}
                    icon="chevronLeft"
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    size="sm"
                  >
                    Previous
                  </Pill>
                  <Pill
                    disabled={pagination.page >= pagination.totalPages}
                    iconRight="chevronRight"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(pagination.totalPages, prev.page + 1),
                      }))
                    }
                    size="sm"
                  >
                    Next
                  </Pill>
                </div>
              </nav>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        busy={isArchiving}
        busyLabel="Archiving…"
        confirmLabel="Archive Subscription"
        description={
          archiveTarget
            ? `${archiveTarget.serviceName} moves to your archived list. It stops counting toward recurring costs and renewal reminders. Its payment history is kept, and you can restore it at any time.`
            : ''
        }
        onConfirm={handleConfirmArchive}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        open={Boolean(archiveTarget)}
        title={archiveTarget ? `Archive ${archiveTarget.serviceName}?` : 'Archive subscription?'}
      />
    </div>
  );
}
