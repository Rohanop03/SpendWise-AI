import { Link } from 'react-router-dom';

import { CardSkeleton, InlineError } from '../../ui/Feedback.jsx';
import { Kpi } from '../../ui/Page.jsx';
import { PillLink, TextLink } from '../../ui/Pill.jsx';
import { StateDot } from '../../ui/Status.jsx';
import { patternFor } from '../../ui/patterns.js';
import { PatternSwatch } from '../../ui/SvgDefs.jsx';
import { groupByCurrency } from '../../utils/chartFormatters.js';
import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';
import { formatDate, relativeDays } from '../../utils/dates.js';

/** Shared loading / error / empty switch for a dashboard widget. */
export function WidgetBody({ children, empty, emptyText, label, onRetry, widget }) {
  if (widget.loading) return <CardSkeleton label={label} />;
  if (widget.error)
    return (
      <InlineError message={widget.error} onRetry={onRetry} retryLabel="Retry dashboard data" />
    );
  if (empty) {
    return (
      <p className="rounded-2xl border border-dashed border-(--hairline-strong) p-5 text-sm text-(--graphite)">
        {emptyText}
      </p>
    );
  }
  return children;
}

/** KPI block per currency: recurring commitments, count, savings, and period cash flow. */
export function FinancialSummary({ currencyCode, onRetry, savings, widget }) {
  if (widget.loading) return <CardSkeleton label="financial overview" lines={1} />;
  if (widget.error)
    return (
      <InlineError message={widget.error} onRetry={onRetry} retryLabel="Retry dashboard data" />
    );

  const summaries = (widget.data?.currencySummaries || []).filter(
    (summary) => !currencyCode || summary.currencyCode === currencyCode,
  );
  if (!summaries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-(--hairline-strong) p-6 text-center">
        <h2 className="text-lg">No financial activity for this selection</h2>
        <p className="mt-2 text-sm text-(--graphite)">
          Add a subscription to track current commitments or record a completed payment to build
          spending history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {summaries.map((summary) => {
        const saving = savings.find((item) => item.currencyCode === summary.currencyCode);
        const negative = Number(summary.netCashFlow) < 0;
        return (
          <section
            aria-label={`${summary.currencyCode} financial summary`}
            key={summary.currencyCode}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="eyebrow">{summary.currencyCode} financial summary</h2>
              <span className="neu-pressed depth-1 rounded-full px-3 py-1 text-xs font-bold">
                {summary.activeSubscriptionCount} active subscriptions
              </span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 xs:grid-cols-2 2xl:grid-cols-4">
              <Kpi
                caption="Current active and trial terms"
                currency={summary.currencyCode}
                label="Estimated monthly recurring"
                value={summary.estimatedMonthlyRecurring}
              />
              <Kpi
                caption="Monthly × 12, from the backend"
                currency={summary.currencyCode}
                label="Yearly recurring"
                value={summary.estimatedYearlyRecurring}
              />
              <Kpi
                caption="Active and trial, not archived"
                format="count"
                label="Active subscriptions"
                value={summary.activeSubscriptionCount}
              />
              {saving ? (
                <Kpi
                  caption="Hypothetical, from active recommendations"
                  currency={summary.currencyCode}
                  label="Potential savings / month"
                  value={saving.amount}
                />
              ) : (
                <div>
                  <p className="text-sm font-bold text-(--graphite)">Potential savings / month</p>
                  <p className="display-num mt-2 text-[clamp(1.7rem,1.3rem+1.1vw,2.35rem)]">—</p>
                  <p className="mt-2 text-xs leading-5 text-(--graphite)">
                    No active savings opportunities
                  </p>
                </div>
              )}
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['Gross spending', summary.grossPayments, 'Completed payments in period'],
                ['Completed refunds', summary.completedRefunds, 'Recognized on refund date'],
                ['Net cash flow', summary.netCashFlow, 'Gross minus completed refunds'],
              ].map(([label, value, help]) => (
                <div className="neu-pressed depth-1 rounded-2xl p-4" key={label}>
                  <dt className="text-xs font-bold text-(--graphite)">{label}</dt>
                  <dd className="num mt-1.5 break-words text-lg font-medium">
                    {formatCurrency(value, summary.currencyCode)}
                  </dd>
                  <dd className="mt-1 text-xs text-(--graphite)">{help}</dd>
                  {label === 'Net cash flow' && negative && (
                    <dd className="mt-2 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-(--ink) px-2 py-0.5 text-xs font-bold">
                      <StateDot kind="cross" />
                      Negative cash flow retained
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

/** Obsidian focal card: the next renewal, with overdue count. */
export function NextRenewal({ currencyCode, widget }) {
  const items = (widget.data?.items || []).filter(
    (item) => !currencyCode || item.currencyCode === currencyCode,
  );
  const next = items.find((item) => !item.isOverdue);
  const overdue = items.filter((item) => item.isOverdue).length;

  if (widget.loading) return <CardSkeleton label="next renewal" lines={1} />;
  if (widget.error) return <p className="text-sm text-soft">Renewal data could not be loaded.</p>;

  return (
    <div className="flex h-full flex-col">
      <p className="eyebrow !text-(--on-ink-soft)">Next renewal</p>
      {next ? (
        <>
          <p className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">{next.serviceName}</p>
          <p className="display-num mt-3 text-[clamp(2.6rem,2rem+2vw,3.6rem)]">
            {next.daysUntilRenewal === 0
              ? 'Today'
              : `${next.daysUntilRenewal} ${next.daysUntilRenewal === 1 ? 'day' : 'days'}`}
          </p>
          <p className="mt-2 text-sm text-soft">
            Renews {relativeDays(next.daysUntilRenewal)} ·{' '}
            {formatDate(next.nextRenewalDate, 'ddd D MMM')} ·{' '}
            <span className="num">{formatCurrency(next.price, next.currencyCode)}</span>
          </p>
        </>
      ) : (
        <p className="mt-4 text-lg font-bold">Nothing renews in the next 30 days.</p>
      )}
      {overdue > 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm font-bold">
          <StateDot kind="half" />
          {overdue} renewal {overdue === 1 ? 'date has' : 'dates have'} passed without a recorded
          payment
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {next && (
          <PillLink
            icon="receipt"
            size="sm"
            to={`/payments/new?subscriptionId=${next.subscriptionId}`}
            variant="paper"
          >
            Record this payment
          </PillLink>
        )}
        <PillLink size="sm" to="/billing" variant="onInk">
          Billing schedule
        </PillLink>
      </div>
    </div>
  );
}

/** Compact upcoming list (first five) under the timeline. */
export function UpcomingList({ items }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-(--hairline-strong) p-5 text-sm text-(--graphite)">
        <p>No active or trial subscriptions renew within the next 30 days.</p>
        <TextLink className="mt-3" to="/subscriptions/new">
          Add a subscription
        </TextLink>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-(--hairline)">
      {items.slice(0, 5).map((item) => (
        <li
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
          data-cursor="OPEN"
          key={item.subscriptionId}
        >
          <div className="min-w-0">
            <Link
              className="block truncate font-bold hover:underline"
              to={`/subscriptions/${item.subscriptionId}`}
            >
              {item.serviceName}
            </Link>
            <p className="text-xs text-(--graphite)">
              {getBillingCycleLabel(item.billingCycle)} · {item.status} ·{' '}
              <time dateTime={item.nextRenewalDate}>{item.nextRenewalDate}</time>
            </p>
          </div>
          <div className="text-right">
            <p className="num text-sm">{formatCurrency(item.price, item.currencyCode)}</p>
            <p className={`text-xs ${item.isOverdue ? 'font-bold' : 'text-(--graphite)'}`}>
              {item.isOverdue
                ? `Date passed by ${Math.abs(item.daysUntilRenewal)} days — unconfirmed`
                : item.daysUntilRenewal === 0
                  ? 'Expected today'
                  : `Expected in ${item.daysUntilRenewal} days`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ranked historical spend with pattern bars (one currency only). */
export function TopSubscriptions({ currencyCode, onRetry, widget }) {
  const rows = widget.data?.subscriptions || [];
  if (!currencyCode) {
    return (
      <p className="neu-pressed depth-1 rounded-2xl p-5 text-sm leading-6">
        Select one currency to compare subscription rankings without mixing monetary units.
      </p>
    );
  }
  const max = Math.max(...rows.map((row) => Number(row.grossPayments) || 0), 1);
  return (
    <WidgetBody
      empty={!rows.length}
      emptyText="No completed subscription payments are available for this selection."
      label="top subscriptions"
      onRetry={onRetry}
      widget={widget}
    >
      <ol className="space-y-3">
        {rows.map((row, index) => (
          <li
            className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-3"
            key={row.subscriptionId}
          >
            <span className="num grid size-7 place-items-center rounded-full border border-(--hairline-strong) text-xs">
              {index + 1}
            </span>
            <div className="min-w-0">
              <Link
                className="block truncate text-sm font-bold hover:underline"
                title={row.serviceName}
                to={`/subscriptions/${row.subscriptionId}`}
              >
                {row.serviceName}
              </Link>
              <svg
                aria-hidden="true"
                className="mt-1.5 h-2 w-full"
                preserveAspectRatio="none"
                viewBox="0 0 100 4"
              >
                <rect className="fill-(--surface-lo)" height="4" rx="2" width="100" />
                <rect
                  fill="#0B0B0D"
                  height="4"
                  rx="2"
                  width={Math.max(2, ((Number(row.grossPayments) || 0) / max) * 100)}
                />
              </svg>
            </div>
            <span className="num text-sm">
              {formatCurrency(row.grossPayments, row.currencyCode)}
            </span>
          </li>
        ))}
      </ol>
    </WidgetBody>
  );
}

/** Billing-cycle commitments as pattern bars (backend monthly equivalents). */
export function BillingCycles({ onRetry, widget }) {
  const cycles = widget.data?.billingCycles || [];
  return (
    <WidgetBody
      empty={!cycles.length}
      emptyText="No current active or trial subscription commitments were found."
      label="billing cycle commitments"
      onRetry={onRetry}
      widget={widget}
    >
      <div className="space-y-6">
        {Object.entries(groupByCurrency(cycles)).map(([currency, rows]) => {
          const max = Math.max(...rows.map((row) => Number(row.estimatedMonthlyTotal) || 0), 1);
          return (
            <div key={currency}>
              <h3 className="eyebrow mb-3">{currency}</h3>
              <ul className="space-y-3">
                {rows.map((row, index) => (
                  <li key={row.billingCycle}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-bold">
                        <PatternSwatch index={index} />
                        {getBillingCycleLabel(row.billingCycle)}
                      </span>
                      <span className="text-xs text-(--graphite)">
                        {row.subscriptionCount} subscriptions ·{' '}
                        <span className="num">
                          {formatCurrency(row.estimatedMonthlyTotal, currency)}
                        </span>
                        /month
                      </span>
                    </div>
                    <svg
                      aria-hidden="true"
                      className="mt-2 h-3 w-full"
                      preserveAspectRatio="none"
                      viewBox="0 0 100 6"
                    >
                      <rect className="fill-(--surface-lo)" height="6" rx="3" width="100" />
                      <rect
                        fill={patternFor(index).fill}
                        height="6"
                        rx="3"
                        stroke="#0B0B0D"
                        strokeWidth="0.3"
                        width={Math.max(2, ((Number(row.estimatedMonthlyTotal) || 0) / max) * 100)}
                      />
                    </svg>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </WidgetBody>
  );
}

const paymentStates = [
  ['completed', 'Completed', 'Realized spending', 'solid'],
  ['pending', 'Pending', 'Unconfirmed, not realized', 'half'],
  ['failed', 'Failed', 'Unsuccessful, not realized', 'cross'],
];

export function PaymentStatus({ onRetry, widget }) {
  const entries = widget.data?.statuses || [];
  return (
    <WidgetBody
      empty={!entries.length}
      emptyText="No payment attempts were recorded for this period."
      label="payment status"
      onRetry={onRetry}
      widget={widget}
    >
      <div className="space-y-5">
        {entries.map((entry) => (
          <section aria-label={`${entry.currencyCode} payment statuses`} key={entry.currencyCode}>
            <h3 className="eyebrow mb-2">{entry.currencyCode}</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {paymentStates.map(([key, label, help, dot]) => (
                <div
                  className={`rounded-2xl p-3 ${key === 'completed' ? 'neu-raised depth-1' : 'neu-pressed depth-1'}`}
                  key={key}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <StateDot kind={dot} />
                      {label}
                    </span>
                    <span
                      aria-label={`${entry[key]?.count || 0} ${label.toLowerCase()} payments`}
                      className="num text-sm"
                    >
                      {entry[key]?.count || 0}
                    </span>
                  </div>
                  <p className="num mt-2 text-sm">
                    {formatCurrency(entry[key]?.amount || '0.00', entry.currencyCode)}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-(--graphite)">{help}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
        <TextLink to="/payments">Review payment history</TextLink>
      </div>
    </WidgetBody>
  );
}

export function RefundSummary({ onRetry, widget }) {
  const summaries = widget.data?.summaries || [];
  return (
    <WidgetBody
      empty={!summaries.length}
      emptyText="No completed refunds were recorded for this period."
      label="refund summary"
      onRetry={onRetry}
      widget={widget}
    >
      <div className="space-y-3">
        {summaries.map((summary) => (
          <div className="neu-pressed depth-1 rounded-2xl p-4" key={summary.currencyCode}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{summary.currencyCode}</p>
                <p className="num mt-1 text-xl">
                  {formatCurrency(summary.totalRefundAmount, summary.currencyCode)}
                </p>
              </div>
              <span className="rounded-full border border-(--hairline-strong) px-3 py-1 text-xs font-bold">
                {summary.refundedPaymentCount} refunded payments
              </span>
            </div>
            <p className="mt-2 text-xs text-(--graphite)">
              {summary.partiallyRefundedCount} partial · {summary.fullyRefundedCount} full
            </p>
          </div>
        ))}
        <p className="text-xs leading-5 text-(--graphite)">
          These are manually recorded refund events, not confirmation from a bank or payment
          provider.
        </p>
        <TextLink to="/payments">View payments and refunds</TextLink>
      </div>
    </WidgetBody>
  );
}
