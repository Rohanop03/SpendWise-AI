import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { getPayments } from '../api/payments.js';
import { getSubscriptions } from '../api/subscriptions.js';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, EmptyState, InlineError } from '../ui/Feedback.jsx';
import { Field, Input, Select } from '../ui/Field.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { Pill, PillLink } from '../ui/Pill.jsx';
import { PaymentStatusChip } from '../ui/Status.jsx';
import { Card } from '../ui/Surface.jsx';
import { formatCurrency } from '../utils/cost.js';
import { formatDate, monthLabel } from '../utils/dates.js';

const initialFilters = {
  currencyCode: '',
  endDate: '',
  sortBy: 'paymentDate',
  sortOrder: 'desc',
  startDate: '',
  status: '',
  subscriptionId: '',
};

const toCents = (value) => Math.round(Number(value || 0) * 100);

/** Group the current page by payment month; totals are completed net amounts per currency. */
function groupByMonth(payments) {
  const groups = new Map();
  for (const payment of payments) {
    const key = (payment.paymentDate || '').slice(0, 7);
    const group = groups.get(key) || { items: [], key, totals: {} };
    group.items.push(payment);
    if (payment.paymentStatus === 'completed') {
      group.totals[payment.currencyCode] =
        (group.totals[payment.currencyCode] || 0) + toCents(payment.netAmount);
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

function PaymentRow({ payment }) {
  const name = payment.serviceName || payment.customServiceName;
  const hasRefund = Number(payment.totalRefunded) > 0;
  return (
    <li
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-(--surface-hi) sm:px-5 lg:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1.4fr)_7.5rem_minmax(0,1fr)_auto]"
      data-cursor="OPEN"
    >
      <div className="min-w-0">
        <Link className="block truncate font-bold hover:underline" to={`/payments/${payment.id}`}>
          {name}
        </Link>
        {payment.planName && (
          <p className="truncate text-xs text-(--graphite)">{payment.planName}</p>
        )}
      </div>
      <time
        className="num order-3 text-xs text-(--graphite) lg:order-none lg:text-sm lg:text-(--ink)"
        dateTime={payment.paymentDate}
      >
        {formatDate(payment.paymentDate, 'D MMM')}
      </time>
      <p className="order-5 col-span-2 text-xs text-(--graphite) lg:order-none lg:col-span-1">
        {payment.billingPeriodStart && payment.billingPeriodEnd ? (
          <span className="num">
            {formatDate(payment.billingPeriodStart, 'D MMM')} →{' '}
            {formatDate(payment.billingPeriodEnd, 'D MMM YY')}
          </span>
        ) : (
          <span>No billing period</span>
        )}
      </p>
      <div className="order-4 justify-self-end lg:order-none lg:justify-self-start">
        <PaymentStatusChip status={payment.paymentStatus} />
      </div>
      <div className="order-2 text-right lg:order-none">
        <p className="num">{formatCurrency(payment.amount, payment.currencyCode)}</p>
        {hasRefund && (
          <p className="num text-xs text-(--graphite)">
            −{formatCurrency(payment.totalRefunded, payment.currencyCode)} refunded · net{' '}
            {formatCurrency(payment.netAmount, payment.currencyCode)}
          </p>
        )}
      </div>
      <PillLink
        aria-label={`View ${name} payment from ${payment.paymentDate}`}
        className="order-6 col-span-2 lg:order-none lg:col-span-1"
        size="sm"
        to={`/payments/${payment.id}`}
      >
        Details
      </PillLink>
    </li>
  );
}

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
  const [filters, setFilters] = useState(initialFilters);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getSubscriptions({ archived: 'false', limit: 100 })
      .then((data) => setSubscriptions(data.items || []))
      .catch(() => setSubscriptions([]));
  }, []);

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
        if (isMounted) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [filters, pagination.limit, pagination.page, reloadKey]);

  function change(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  const groups = useMemo(() => groupByMonth(payments), [payments]);
  const completedCount = payments.filter((p) => p.paymentStatus === 'completed').length;
  const pendingCount = payments.filter((p) => p.paymentStatus === 'pending').length;
  const refundedCount = payments.filter((p) => Number(p.totalRefunded) > 0).length;

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        actions={
          <PillLink icon="plus" to="/payments/new" variant="ink">
            Record Payment
          </PillLink>
        }
        description="Track historical subscription payments, view billing periods, and record manual refunds."
        index={pageIndex('/payments')}
        title="Payment History"
      />

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Total Records', pagination.totalCount, 'All pages', 'obsidian'],
          ['Completed (page)', completedCount, 'Realized payments', 'raised'],
          ['Pending (page)', pendingCount, 'Not yet confirmed', 'raised'],
          ['Refunded (page)', refundedCount, 'With a refund recorded', 'raised'],
        ].map(([label, value, help, look], index) => (
          <Card as="div" delay={index * 0.04} key={label} look={look}>
            <dt
              className={`text-sm font-bold ${look === 'obsidian' ? 'text-soft' : 'text-(--graphite)'}`}
            >
              {label}
            </dt>
            <dd className="display-num mt-2 text-5xl">{value}</dd>
            <dd
              className={`mt-1 text-xs ${look === 'obsidian' ? 'text-soft' : 'text-(--graphite)'}`}
            >
              {help}
            </dd>
          </Card>
        ))}
      </dl>

      <Card className="mb-6" look="glass">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field className="lg:col-span-2" label="Subscription">
            {(id) => (
              <Select
                id={id}
                onChange={(e) => change('subscriptionId', e.target.value)}
                value={filters.subscriptionId}
              >
                <option value="">All Subscriptions</option>
                {subscriptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.serviceName || sub.customServiceName}
                    {sub.planName ? ` (${sub.planName})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select
                id={id}
                onChange={(e) => change('status', e.target.value)}
                value={filters.status}
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            )}
          </Field>
          <Field label="Currency">
            {(id) => (
              <Select
                id={id}
                onChange={(e) => change('currencyCode', e.target.value)}
                value={filters.currencyCode}
              >
                <option value="">All Currencies</option>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </Select>
            )}
          </Field>
          <Field label="From Date">
            {(id) => (
              <Input
                id={id}
                onChange={(e) => change('startDate', e.target.value)}
                type="date"
                value={filters.startDate}
              />
            )}
          </Field>
          <Field label="To Date">
            {(id) => (
              <Input
                id={id}
                onChange={(e) => change('endDate', e.target.value)}
                type="date"
                value={filters.endDate}
              />
            )}
          </Field>
          <Field className="lg:col-span-2" label="Sort By">
            {(id) => (
              <Select
                id={id}
                onChange={(e) => {
                  const [by, order] = e.target.value.split(':');
                  setFilters((current) => ({ ...current, sortBy: by, sortOrder: order }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                value={`${filters.sortBy}:${filters.sortOrder}`}
              >
                <option value="paymentDate:desc">Date (Newest First)</option>
                <option value="paymentDate:asc">Date (Oldest First)</option>
                <option value="amount:desc">Amount (Highest First)</option>
                <option value="amount:asc">Amount (Lowest First)</option>
                <option value="createdAt:desc">Created (Newest First)</option>
              </Select>
            )}
          </Field>
          <div className="flex items-end lg:col-span-4 lg:justify-end">
            <Pill
              icon="undo"
              onClick={() => {
                setFilters(initialFilters);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              size="sm"
              variant="ghost"
            >
              Reset Filters
            </Pill>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-6">
          <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      )}

      {loading ? (
        <Card>
          <CardSkeleton label="payment records" lines={4} />
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            action={
              <PillLink icon="plus" to="/payments/new" variant="ink">
                Record your first payment
              </PillLink>
            }
            title="No payments found"
          >
            No payment entries match the selected filters, or you have not recorded any payments
            yet. SpendWise only shows payments you record.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group, index) => (
            <Card
              as="section"
              aria-labelledby={`month-${group.key}`}
              delay={index * 0.04}
              key={group.key}
              padded={false}
            >
              <header className="sticky top-[4.5rem] z-10 flex flex-wrap items-baseline justify-between gap-2 rounded-t-(--radius-card) border-b border-(--hairline) bg-[rgb(239_239_242/96%)] px-4 py-3 sm:px-5 md:top-[calc(var(--console-inset)+5.25rem)]">
                <h2 className="text-lg" id={`month-${group.key}`}>
                  {monthLabel(`${group.key}-01`)}
                </h2>
                <p className="text-xs text-(--graphite)">
                  {group.items.length} {group.items.length === 1 ? 'payment' : 'payments'} ·
                  completed net{' '}
                  {Object.entries(group.totals).length
                    ? Object.entries(group.totals).map(([code, cents], position) => (
                        <span className="num font-medium text-(--ink)" key={code}>
                          {position > 0 && ' + '}
                          {formatCurrency(cents / 100, code)}
                        </span>
                      ))
                    : '—'}
                </p>
              </header>
              <ul className="divide-y divide-(--hairline)">
                {group.items.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </ul>
            </Card>
          ))}

          {pagination.totalPages > 1 && (
            <nav
              aria-label="Payment pages"
              className="flex flex-col items-center justify-between gap-4 text-sm sm:flex-row"
            >
              <span className="text-(--graphite)">
                Showing Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount}{' '}
                records)
              </span>
              <div className="flex gap-2">
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
                      page: Math.min(prev.totalPages, prev.page + 1),
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
  );
}
