import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { getPayments } from '../api/payments.js';
import { getSubscriptions } from '../api/subscriptions.js';
import PaymentCard from '../components/payments/PaymentCard.jsx';
import PaymentFilters from '../components/payments/PaymentFilters.jsx';
import PaymentTable from '../components/payments/PaymentTable.jsx';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [pagination, setPagination] = useState({
    limit: 10,
    page: 1,
    totalCount: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const initialFilters = {
    currencyCode: '',
    endDate: '',
    sortBy: 'paymentDate',
    sortOrder: 'desc',
    startDate: '',
    status: '',
    subscriptionId: '',
  };
  const [filters, setFilters] = useState(initialFilters);

  // Load subscriptions for filter dropdown
  useEffect(() => {
    getSubscriptions({ archived: 'false', limit: 100 })
      .then((data) => setSubscriptions(data.items || []))
      .catch((err) => console.error('Failed to load subscriptions for filter:', err));
  }, []);

  // Fetch payments on filters or pagination change
  useEffect(() => {
    let isMounted = true;

    const params = {
      limit: pagination.limit,
      page: pagination.page,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    if (filters.subscriptionId) params.subscriptionId = filters.subscriptionId;
    if (filters.status) params.paymentStatus = filters.status;
    if (filters.currencyCode) params.currencyCode = filters.currencyCode;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    getPayments(params)
      .then((data) => {
        if (!isMounted) return;
        setPayments(data.items || []);
        if (data.pagination) setPagination(data.pagination);
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
  }, [filters, pagination.limit, pagination.page]);

  // Aggregate KPI summary for currently listed/returned payments
  const completedCount = payments.filter((p) => p.paymentStatus === 'completed').length;
  const pendingCount = payments.filter((p) => p.paymentStatus === 'pending').length;
  const refundedCount = payments.filter((p) => Number(p.totalRefunded) > 0).length;

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      {/* Header and Call to Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Payment History</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track historical subscription payments, view billing periods, and record manual refunds.
          </p>
        </div>
        <Link
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
          to="/payments/new"
        >
          <span className="text-lg leading-none">+</span>
          Record Payment
        </Link>
      </div>

      {/* KPI Overview Cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Records
          </span>
          <p className="mt-2 text-2xl font-bold text-white">{pagination.totalCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Completed (page)
          </span>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{completedCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pending (page)
          </span>
          <p className="mt-2 text-2xl font-bold text-amber-300">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Refunded (page)
          </span>
          <p className="mt-2 text-2xl font-bold text-rose-400">{refundedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-8">
        <PaymentFilters
          filters={filters}
          onChange={(newFilters) => {
            setFilters(newFilters);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          onReset={() => {
            setFilters(initialFilters);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          subscriptions={subscriptions}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Payment Table / Cards */}
      <div className="mt-6">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-12 text-center text-sm text-slate-400">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent mb-3" />
            <p>Loading payment records...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/30 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-2xl">
              💳
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">No payments found</h3>
            <p className="mt-1 text-sm text-slate-400">
              No payment entries match the selected filters, or you have not recorded any payments
              yet.
            </p>
            <div className="mt-6">
              <Link
                className="inline-flex rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-300"
                to="/payments/new"
              >
                Record Your First Payment
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <PaymentTable payments={payments} />
            </div>

            {/* Mobile Card View */}
            <div className="space-y-4 md:hidden">
              {payments.map((payment) => (
                <PaymentCard key={payment.id} payment={payment} />
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-slate-400">
                <span>
                  Showing Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount}{' '}
                  records)
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-40"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(prev.totalPages, prev.page + 1),
                      }))
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
