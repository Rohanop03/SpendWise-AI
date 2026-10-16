import { useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../../ui/Feedback.jsx';
import Icon from '../../ui/Icon.jsx';
import Segmented from '../../ui/Segmented.jsx';
import { StateDot, SubscriptionStatusChip, Tag } from '../../ui/Status.jsx';
import { Card, CardHeader } from '../../ui/Surface.jsx';
import { patternFor } from '../../ui/patterns.js';
import { PatternSwatch } from '../../ui/SvgDefs.jsx';
import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';

function Empty({ children }) {
  return (
    <Card>
      <EmptyState title="Nothing recorded yet">{children}</EmptyState>
    </Card>
  );
}

export function OverviewCards({ summaries }) {
  if (!summaries.length) return <Empty>No completed payment records found for this period.</Empty>;
  return (
    <div className="space-y-6">
      {summaries.map((summary, index) => {
        const negative = Number(summary.netCashFlow) < 0;
        return (
          <Card delay={index * 0.05} key={summary.currencyCode}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-(--hairline) pb-3">
              <h2 className="text-lg">Financial Summary ({summary.currencyCode})</h2>
              <span className="text-xs text-(--graphite)">
                {summary.activeSubscriptionCount} active{' '}
                {summary.activeSubscriptionCount === 1 ? 'subscription' : 'subscriptions'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {[
                [
                  'Gross Payments',
                  summary.grossPayments,
                  `${summary.completedPaymentCount} completed`,
                  'raised',
                ],
                [
                  'Completed Refunds',
                  summary.completedRefunds,
                  `${summary.refundCount} ${summary.refundCount === 1 ? 'refund' : 'refunds'}`,
                  'pressed',
                ],
                [
                  'Net Cash Flow',
                  summary.netCashFlow,
                  negative ? 'Deficit · gross minus refunds' : 'Gross minus refunds',
                  'obsidian',
                ],
                [
                  'Est. Monthly Cost',
                  summary.estimatedMonthlyRecurring,
                  'Active projection',
                  'pressed',
                ],
                [
                  'Est. Yearly Cost',
                  summary.estimatedYearlyRecurring,
                  'Annual projection',
                  'pressed',
                ],
              ].map(([label, value, help, look]) => (
                <div
                  className={`rounded-2xl p-4 ${look === 'obsidian' ? 'obsidian' : look === 'raised' ? 'neu-raised depth-1' : 'neu-pressed depth-1'}`}
                  key={label}
                >
                  <dt
                    className={`text-xs font-bold ${look === 'obsidian' ? 'text-soft' : 'text-(--graphite)'}`}
                  >
                    {label}
                  </dt>
                  <dd className="num mt-1.5 break-words text-lg">
                    {formatCurrency(value, summary.currencyCode)}
                  </dd>
                  <dd
                    className={`mt-0.5 text-xs ${look === 'obsidian' ? 'text-soft' : 'text-(--graphite)'}`}
                  >
                    {help}
                  </dd>
                </div>
              ))}
            </dl>
            {(summary.pendingPaymentCount > 0 || summary.failedPaymentCount > 0) && (
              <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-(--hairline) pt-3 text-xs">
                {summary.pendingPaymentCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <StateDot kind="half" /> Pending (Unconfirmed):{' '}
                    <strong className="num">
                      {summary.pendingPaymentCount} (
                      {formatCurrency(summary.pendingAmount, summary.currencyCode)})
                    </strong>
                  </span>
                )}
                {summary.failedPaymentCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <StateDot kind="cross" /> Failed / Unsuccessful:{' '}
                    <strong className="num">
                      {summary.failedPaymentCount} (
                      {formatCurrency(summary.failedAmount, summary.currencyCode)})
                    </strong>
                  </span>
                )}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function TopSubscriptionsCard({
  historicalSubscriptions = [],
  recurringSubscriptions = [],
}) {
  const [tab, setTab] = useState('recurring');
  const list = tab === 'recurring' ? recurringSubscriptions : historicalSubscriptions;
  return (
    <Card delay={0.05}>
      <CardHeader
        action={
          <Segmented
            label="Ranking"
            labelHidden
            onChange={setTab}
            options={[
              { label: 'Recurring Cost', value: 'recurring' },
              { label: 'Historical Total', value: 'historical' },
            ]}
            size="sm"
            value={tab}
          />
        }
        as="h3"
        description={
          tab === 'recurring'
            ? 'Ranked by normalized monthly recurring equivalent (Active & Trial)'
            : 'Ranked by total historical gross payments recorded in period'
        }
        title="Top Expensive Subscriptions"
      />
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--hairline-strong) p-5 text-center text-sm text-(--graphite)">
          No subscription rankings available.
        </p>
      ) : (
        <ol className="divide-y divide-(--hairline)">
          {list.map((sub, index) => (
            <li className="flex items-center justify-between gap-3 py-3" key={sub.subscriptionId}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="num grid size-7 shrink-0 place-items-center rounded-full border border-(--hairline-strong) text-xs">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <Link
                    className="block truncate text-sm font-bold hover:underline"
                    to={`/subscriptions/${sub.subscriptionId}`}
                  >
                    {sub.serviceName}
                  </Link>
                  <p className="text-xs text-(--graphite)">
                    {sub.categoryName} · {getBillingCycleLabel(sub.billingCycle)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {tab === 'recurring' ? (
                  <>
                    <p className="num text-sm">
                      {formatCurrency(sub.normalizedMonthlyCost, sub.currencyCode)}
                      <span className="text-xs text-(--graphite)">/mo</span>
                    </p>
                    <p className="num text-[11px] text-(--graphite)">
                      Plan: {formatCurrency(sub.currentPrice, sub.currencyCode)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="num text-sm">
                      {formatCurrency(sub.grossPayments, sub.currencyCode)}
                    </p>
                    <p className="text-[11px] text-(--graphite)">
                      {sub.completedPaymentCount} payments
                    </p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function PaymentStatusSummary({ statuses }) {
  if (!statuses.length) return <Empty>No payment transactions recorded for this period.</Empty>;
  return (
    <Card delay={0.1}>
      <CardHeader
        as="h3"
        description="Distribution of payment attempts by verification state. Only completed payments count toward realized spend."
        title="Payment Status Analytics"
      />
      <div className="space-y-4">
        {statuses.map((entry) => (
          <section aria-label={`${entry.currencyCode} payment statuses`} key={entry.currencyCode}>
            <p className="eyebrow mb-2">Currency: {entry.currencyCode}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['completed', 'Completed (Realized)', 'Confirmed historical transactions', 'solid'],
                ['pending', 'Pending (Unconfirmed)', 'Excluded from realized spending', 'half'],
                ['failed', 'Failed (Unsuccessful)', 'Excluded from realized spending', 'cross'],
              ].map(([key, label, help, dot]) => (
                <div
                  className={`rounded-2xl p-3 ${key === 'completed' ? 'neu-raised depth-1' : 'neu-pressed depth-1'}`}
                  key={key}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <StateDot kind={dot} /> {label}
                    </span>
                    <span className="num text-xs">{entry[key]?.count || 0}</span>
                  </div>
                  <p className="num mt-2">
                    {formatCurrency(entry[key]?.amount || 0, entry.currencyCode)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-(--graphite)">{help}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function periodLabel(period) {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }
  return period;
}

export function MonthlyTrendTable({ trends }) {
  return (
    <div className="neu-raised scroll-x rounded-(--radius-card)">
      <table className="data-table">
        <caption className="sr-only">Monthly cash flow table</caption>
        <thead>
          <tr>
            <th className="sticky-col" scope="col">
              Period
            </th>
            <th scope="col">Currency</th>
            <th className="!text-right" scope="col">
              Gross Payments
            </th>
            <th className="!text-right" scope="col">
              Completed Refunds
            </th>
            <th className="!text-right" scope="col">
              Net Cash Flow
            </th>
            <th className="!text-center" scope="col">
              Completed Payments
            </th>
            <th className="!text-center" scope="col">
              Refunds
            </th>
          </tr>
        </thead>
        <tbody>
          {trends.map((row) => {
            const negative = Number(row.netCashFlow) < 0;
            return (
              <tr key={`${row.period}-${row.currencyCode}`}>
                <th className="sticky-col whitespace-nowrap text-left font-bold" scope="row">
                  {periodLabel(row.period)}
                  <span className="num ml-2 text-xs font-normal text-(--graphite)">
                    ({row.period})
                  </span>
                </th>
                <td className="text-xs">{row.currencyCode}</td>
                <td className="num text-right">
                  {formatCurrency(row.grossPayments, row.currencyCode)}
                </td>
                <td className="num text-right">
                  {formatCurrency(row.completedRefunds, row.currencyCode)}
                </td>
                <td className="num text-right">
                  <span className={negative ? 'font-medium' : ''}>
                    {formatCurrency(row.netCashFlow, row.currencyCode)}
                  </span>
                  {negative && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-(--ink) px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase">
                      <StateDot kind="cross" /> Deficit
                    </span>
                  )}
                </td>
                <td className="num text-center text-xs">{row.completedPaymentCount}</td>
                <td className="num text-center text-xs">{row.refundCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CategoryTable({ categories }) {
  // Pattern index is the row's position within its currency, matching the donut.
  const seen = {};
  const patternIndex = categories.map((cat) => {
    seen[cat.currencyCode] = (seen[cat.currencyCode] ?? -1) + 1;
    return seen[cat.currencyCode];
  });
  return (
    <div className="neu-raised scroll-x rounded-(--radius-card)">
      <table className="data-table">
        <caption className="sr-only">Category spending table</caption>
        <thead>
          <tr>
            <th className="sticky-col" scope="col">
              Category
            </th>
            <th scope="col">Currency</th>
            <th className="!text-right" scope="col">
              Gross Payments
            </th>
            <th className="!text-right" scope="col">
              Refunds
            </th>
            <th className="!text-right" scope="col">
              Net Cash Flow
            </th>
            <th className="!text-center" scope="col">
              Payments
            </th>
            <th className="!text-right" scope="col">
              % of Spending
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, index) => (
            <tr key={`${cat.categoryId}-${cat.currencyCode}`}>
              <th className="sticky-col text-left" scope="row">
                <span className="flex items-center gap-2 font-bold">
                  <PatternSwatch index={patternIndex[index]} />
                  {cat.categoryName}
                </span>
              </th>
              <td className="text-xs">{cat.currencyCode}</td>
              <td className="num text-right">
                {formatCurrency(cat.grossPayments, cat.currencyCode)}
              </td>
              <td className="num text-right">
                {formatCurrency(cat.completedRefunds, cat.currencyCode)}
              </td>
              <td className="num text-right">
                {formatCurrency(cat.netCashFlow, cat.currencyCode)}
              </td>
              <td className="num text-center text-xs">{cat.completedPaymentCount}</td>
              <td className="text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  <svg
                    aria-hidden="true"
                    className="h-2 w-16"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 4"
                  >
                    <rect className="fill-(--surface-lo)" height="4" rx="2" width="100" />
                    <rect
                      fill="#0B0B0D"
                      height="4"
                      rx="2"
                      width={Math.min(100, Math.max(0, cat.percentageOfGross))}
                    />
                  </svg>
                  <span className="num text-xs">{cat.percentageOfGross}%</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sortColumns = [
  ['serviceName', 'Service / Plan', 'left'],
  [null, 'Category', 'left'],
  [null, 'Status', 'left'],
  [null, 'Cycle', 'left'],
  ['currentPrice', 'Current Price', 'right'],
  ['grossPayments', 'Gross Payments', 'right'],
  [null, 'Refunds', 'right'],
  ['netCashFlow', 'Net Cash Flow', 'right'],
  ['completedPaymentCount', 'Payments', 'center'],
];

export function SubscriptionSpendingTable({ onSort, sortBy, sortOrder, subscriptions }) {
  if (!subscriptions.length)
    return <Empty>No subscription spending recorded for this period.</Empty>;
  return (
    <div className="neu-raised scroll-x rounded-(--radius-card)">
      <table className="data-table">
        <caption className="sr-only">Subscription-wise spending, sortable</caption>
        <thead>
          <tr>
            {sortColumns.map(([field, label, align], index) => {
              const active = field && sortBy === field;
              return (
                <th
                  aria-sort={
                    active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={`${index === 0 ? 'sticky-col' : ''} ${align === 'right' ? '!text-right' : align === 'center' ? '!text-center' : ''}`}
                  key={label}
                  scope="col"
                >
                  {field ? (
                    <button
                      className="inline-flex items-center gap-1 uppercase hover:text-(--ink)"
                      onClick={() => onSort(field)}
                      type="button"
                    >
                      {label}
                      <Icon
                        className={`size-3.5 ${active ? '' : 'opacity-30'} ${active && sortOrder === 'asc' ? 'rotate-180' : ''}`}
                        name="chevronDown"
                      />
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.subscriptionId}>
              <td className="sticky-col">
                <Link
                  className="font-bold hover:underline"
                  to={`/subscriptions/${sub.subscriptionId}`}
                >
                  {sub.serviceName}
                </Link>
                {sub.archivedAt && <Tag className="ml-2">Archived</Tag>}
              </td>
              <td className="text-xs">{sub.categoryName}</td>
              <td>
                <SubscriptionStatusChip status={sub.status} />
              </td>
              <td className="text-xs">{getBillingCycleLabel(sub.billingCycle)}</td>
              <td className="num text-right text-xs">
                {formatCurrency(sub.currentPrice, sub.currencyCode)}
              </td>
              <td className="num text-right">
                {formatCurrency(sub.grossPayments, sub.currencyCode)}
              </td>
              <td className="num text-right">
                {formatCurrency(sub.completedRefunds, sub.currencyCode)}
              </td>
              <td className="num text-right">
                {formatCurrency(sub.netCashFlow, sub.currencyCode)}
              </td>
              <td className="num text-center text-xs">{sub.completedPaymentCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BillingCycleDistribution({ billingCycles }) {
  if (!billingCycles.length) return <Empty>No active billing cycles to display.</Empty>;
  const max = Math.max(
    ...billingCycles.map((cycle) => Number(cycle.estimatedMonthlyTotal) || 0),
    1,
  );
  return (
    <Card>
      <CardHeader
        as="h3"
        description="Breakdown of active and trial recurring subscriptions by billing interval"
        title="Billing Cycle Distribution"
      />
      <ul className="grid gap-4 sm:grid-cols-3">
        {billingCycles.map((cycle, index) => (
          <li
            className="neu-pressed depth-1 rounded-2xl p-4"
            key={`${cycle.billingCycle}-${cycle.currencyCode}`}
          >
            <div className="flex items-center justify-between border-b border-(--hairline) pb-2.5">
              <span className="flex items-center gap-2 text-sm font-bold">
                <PatternSwatch index={index} />
                {getBillingCycleLabel(cycle.billingCycle)}
              </span>
              <Tag>{cycle.currencyCode}</Tag>
            </div>
            <svg
              aria-hidden="true"
              className="mt-3 h-2.5 w-full"
              preserveAspectRatio="none"
              viewBox="0 0 100 5"
            >
              <rect className="fill-(--surface)" height="5" rx="2.5" width="100" />
              <rect
                fill={patternFor(index).fill}
                height="5"
                rx="2.5"
                stroke="#0B0B0D"
                strokeWidth="0.3"
                width={Math.max(2, ((Number(cycle.estimatedMonthlyTotal) || 0) / max) * 100)}
              />
            </svg>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-(--graphite)">Subscriptions:</dt>
                <dd className="font-bold">
                  {cycle.subscriptionCount}{' '}
                  <span className="font-normal text-(--graphite)">
                    ({cycle.activeCount} active, {cycle.trialCount} trial)
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-(--graphite)">Monthly Cost:</dt>
                <dd className="num">
                  {formatCurrency(cycle.estimatedMonthlyTotal, cycle.currencyCode)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-(--graphite)">Annualized Cost:</dt>
                <dd className="num">
                  {formatCurrency(cycle.estimatedYearlyTotal, cycle.currencyCode)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </Card>
  );
}
