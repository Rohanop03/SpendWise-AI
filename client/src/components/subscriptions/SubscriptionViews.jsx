import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import Icon from '../../ui/Icon.jsx';
import { PillLink } from '../../ui/Pill.jsx';
import { SubscriptionStatusChip, Tag } from '../../ui/Status.jsx';
import {
  calculateMonthlyEquivalent,
  formatCurrency,
  getBillingCycleLabel,
} from '../../utils/cost.js';
import { daysUntil, formatDate, relativeDays } from '../../utils/dates.js';

/** Renewal date + "in N days" (only for live subscriptions). */
export function RenewalCell({ subscription }) {
  if (!subscription.nextRenewalDate) return <span className="text-(--graphite)">—</span>;
  const days = daysUntil(subscription.nextRenewalDate);
  const live = ['active', 'trial'].includes(subscription.status) && !subscription.archivedAt;
  return (
    <span className="block">
      <time className="num text-sm" dateTime={subscription.nextRenewalDate}>
        {formatDate(subscription.nextRenewalDate)}
      </time>
      {live && days !== null && (
        <span className={`block text-xs ${days <= 3 ? 'font-bold' : 'text-(--graphite)'}`}>
          {days < 0 ? `passed ${Math.abs(days)} days ago` : relativeDays(days)}
        </span>
      )}
    </span>
  );
}

const sortable = {
  nextRenewalDate: 'nextRenewalDate',
  price: 'price',
  service: 'serviceName',
};

/**
 * TanStack table over the current server page. Sorting and pagination stay server-side
 * (same `sortBy` / `sortOrder` / `page` query params as before).
 */
export function SubscriptionTable({ onArchiveClick, onSort, sortBy, sortOrder, subscriptions }) {
  const columns = useMemo(
    () => [
      {
        cell: ({ row }) => {
          const sub = row.original;
          const cancelled = sub.status === 'cancelled';
          return (
            <div className="min-w-[10rem]">
              <Link
                className={`font-bold hover:underline ${cancelled ? 'struck' : ''}`}
                to={`/subscriptions/${sub.id}`}
              >
                {sub.serviceName}
              </Link>
              {sub.planName && <div className="text-xs text-(--graphite)">{sub.planName}</div>}
            </div>
          );
        },
        header: 'Service & plan',
        id: 'service',
      },
      {
        cell: ({ row }) => <Tag>{row.original.categoryName || 'Uncategorized'}</Tag>,
        header: 'Category',
        id: 'category',
      },
      {
        cell: ({ row }) => {
          const sub = row.original;
          return (
            <div className="whitespace-nowrap text-right">
              <div className="num">{formatCurrency(sub.price, sub.currencyCode)}</div>
              {sub.billingCycle !== 'monthly' && (
                <div className="num text-xs text-(--graphite)">
                  ~
                  {formatCurrency(
                    calculateMonthlyEquivalent(sub.price, sub.billingCycle),
                    sub.currencyCode,
                  )}
                  /mo
                </div>
              )}
            </div>
          );
        },
        header: 'Cost',
        id: 'price',
      },
      {
        cell: ({ row }) => getBillingCycleLabel(row.original.billingCycle),
        header: 'Cycle',
        id: 'cycle',
      },
      {
        cell: ({ row }) => <RenewalCell subscription={row.original} />,
        header: 'Next renewal',
        id: 'nextRenewalDate',
      },
      {
        cell: ({ row }) => (
          <SubscriptionStatusChip
            archivedAt={row.original.archivedAt}
            status={row.original.status}
          />
        ),
        header: 'Status',
        id: 'status',
      },
      {
        cell: ({ row }) => {
          const sub = row.original;
          return (
            <div className="flex justify-end gap-1.5">
              <PillLink
                aria-label={`Edit ${sub.serviceName}`}
                size="sm"
                to={`/subscriptions/${sub.id}/edit`}
              >
                Edit
              </PillLink>
              <PillLink
                aria-label={`View ${sub.serviceName}`}
                size="sm"
                to={`/subscriptions/${sub.id}`}
                variant="ink"
              >
                View
              </PillLink>
              {onArchiveClick && !sub.archivedAt && (
                <button
                  aria-label={`Archive ${sub.serviceName}`}
                  className="pill pill-ghost pill-sm"
                  onClick={() => onArchiveClick(sub)}
                  type="button"
                >
                  Archive
                </button>
              )}
            </div>
          );
        },
        header: () => <span className="sr-only">Actions</span>,
        id: 'actions',
      },
    ],
    [onArchiveClick],
  );

  // TanStack returns fresh helper functions each render; the compiler skips memoising here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: subscriptions,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <div className="neu-raised scroll-x rounded-(--radius-card)">
      <table className="data-table">
        <caption className="sr-only">Subscriptions, current page</caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header, index) => {
                const field = sortable[header.column.id];
                const active = field && field === sortBy;
                return (
                  <th
                    aria-sort={
                      active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={`${index === 0 ? 'sticky-col' : ''} ${header.column.id === 'price' ? '!text-right' : ''}`}
                    key={header.id}
                    scope="col"
                  >
                    {field ? (
                      <button
                        className="inline-flex items-center gap-1 uppercase hover:text-(--ink)"
                        onClick={() => onSort(field)}
                        type="button"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <Icon
                          className={`size-3.5 transition-transform ${active ? '' : 'opacity-30'} ${
                            active && sortOrder === 'asc' ? 'rotate-180' : ''
                          }`}
                          name="chevronDown"
                        />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {table.getRowModel().rows.map((row) => (
              <motion.tr
                animate={{ opacity: 1 }}
                className={row.original.status === 'cancelled' ? 'opacity-70' : ''}
                data-cursor="OPEN"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key={row.id}
                transition={{ duration: 0.25 }}
              >
                {row.getVisibleCells().map((cell, index) => (
                  <td className={index === 0 ? 'sticky-col' : ''} key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

/** Raised card per subscription; cancelled ones are flattened and faded with a struck name. */
export function SubscriptionCard({ onArchiveClick, subscription }) {
  const cancelled = subscription.status === 'cancelled';
  const monthly = calculateMonthlyEquivalent(subscription.price, subscription.billingCycle);
  return (
    <motion.article
      animate={{ opacity: cancelled ? 0.72 : 1, y: 0 }}
      className={`flex h-full flex-col rounded-(--radius-card) p-5 ${cancelled ? 'neu-pressed' : 'neu-raised'}`}
      exit={{ opacity: 0, scale: 0.97 }}
      initial={{ opacity: 0, y: 10 }}
      layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`truncate text-lg ${cancelled ? 'struck' : ''}`}>
            {subscription.serviceName}
          </h2>
          {subscription.planName && (
            <p className="text-xs text-(--graphite)">{subscription.planName}</p>
          )}
        </div>
        <SubscriptionStatusChip archivedAt={subscription.archivedAt} status={subscription.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Tag>{subscription.categoryName || 'Uncategorized'}</Tag>
        <span>{getBillingCycleLabel(subscription.billingCycle)}</span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-(--hairline) pt-4">
        <div>
          <p className="num text-xl">
            {formatCurrency(subscription.price, subscription.currencyCode)}
          </p>
          {subscription.billingCycle !== 'monthly' && (
            <p className="num text-xs text-(--graphite)">
              ~{formatCurrency(monthly, subscription.currencyCode)}/mo
            </p>
          )}
        </div>
        <div className="text-right text-xs">
          <p className="text-(--graphite)">Next renewal</p>
          <RenewalCell subscription={subscription} />
        </div>
      </div>
      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-5">
        {onArchiveClick && !subscription.archivedAt && (
          <button
            aria-label={`Archive ${subscription.serviceName}`}
            className="pill pill-ghost pill-sm"
            onClick={() => onArchiveClick(subscription)}
            type="button"
          >
            Archive
          </button>
        )}
        <PillLink
          aria-label={`Edit ${subscription.serviceName}`}
          size="sm"
          to={`/subscriptions/${subscription.id}/edit`}
        >
          Edit
        </PillLink>
        <PillLink
          aria-label={`View details: ${subscription.serviceName}`}
          size="sm"
          to={`/subscriptions/${subscription.id}`}
          variant="ink"
        >
          View details
        </PillLink>
      </div>
    </motion.article>
  );
}
