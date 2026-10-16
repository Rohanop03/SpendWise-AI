import { Slider } from 'radix-ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getPreferences } from '../api/account.js';
import { getBillingOverview } from '../api/billing.js';
import { getApiErrorMessage } from '../api/http.js';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, EmptyState, InlineError } from '../ui/Feedback.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { PillLink } from '../ui/Pill.jsx';
import { StateDot } from '../ui/Status.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { formatCurrency, getBillingCycleLabel } from '../utils/cost.js';
import { formatDate } from '../utils/dates.js';
import RenewalDial from '../viz/RenewalDial.jsx';
import RenewalTimeline from '../viz/RenewalTimeline.jsx';

const WINDOWS = [7, 14, 30, 60, 90];

/** Neumorphic slider snapping to the same five windows the page always offered. */
function WindowSlider({ onCommit, value }) {
  const [index, setIndex] = useState(WINDOWS.indexOf(value));
  return (
    <div className="w-full min-w-[15rem] max-w-sm sm:w-72">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="field-label !mb-0" id="window-label">
          Renewal window
        </span>
        <span className="num text-sm">{WINDOWS[index]} days</span>
      </div>
      <Slider.Root
        aria-labelledby="window-label"
        className="relative flex h-10 touch-none select-none items-center"
        max={WINDOWS.length - 1}
        min={0}
        onValueChange={([next]) => setIndex(next)}
        onValueCommit={([next]) => onCommit(WINDOWS[next])}
        step={1}
        value={[index]}
      >
        <Slider.Track className="neu-pressed depth-1 relative h-3 grow rounded-full">
          <Slider.Range className="pill-ink absolute h-full rounded-full" />
        </Slider.Track>
        <Slider.Thumb
          aria-label="Renewal window"
          aria-valuetext={`${WINDOWS[index]} days`}
          className="neu-raised depth-2 block size-7 cursor-grab rounded-full active:cursor-grabbing"
        />
      </Slider.Root>
      <div
        aria-hidden="true"
        className="num mt-1 flex justify-between text-[10px] text-(--graphite)"
      >
        {WINDOWS.map((days) => (
          <span key={days}>{days}d</span>
        ))}
      </div>
    </div>
  );
}

/** Obsidian pill for one renewal in the vertical stack. */
function RenewalPill({ item }) {
  const overdueDays = Math.abs(item.daysUntilRenewal);
  const badge = item.isOverdue
    ? `Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`
    : item.daysUntilRenewal === 0
      ? 'Due Today'
      : `In ${item.daysUntilRenewal} ${item.daysUntilRenewal === 1 ? 'day' : 'days'}`;
  return (
    <li
      className="obsidian rounded-[1.6rem] p-4 sm:rounded-full sm:py-3 sm:pl-3 sm:pr-3"
      data-cursor="OPEN"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="pill-paper num grid h-12 min-w-24 shrink-0 place-items-center rounded-full px-3 text-xs font-medium">
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base">{item.serviceName}</h3>
          <p className="text-xs text-soft">
            {item.planName ? `${item.planName} · ` : ''}
            <span className="num">{formatDate(item.renewalDate, 'ddd D MMM YYYY')}</span> ·{' '}
            <span className="num">{formatCurrency(item.cost, item.currencyCode)}</span> /
            {getBillingCycleLabel(item.billingCycle).toLowerCase()}
          </p>
          {item.isOverdue && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs font-bold">
              <StateDot className="mt-0.5" kind="half" />
              <span>
                {item.overdueNotice}
                <span className="block font-normal text-soft">
                  No completed payment record exists. You may record a payment if externally
                  completed.
                </span>
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            aria-label={`View ${item.serviceName} subscription`}
            className="pill pill-on-ink pill-sm"
            to={`/subscriptions/${item.subscriptionId}`}
          >
            View
          </Link>
          <Link
            aria-label={`Record payment for ${item.serviceName}`}
            className="pill pill-paper pill-sm"
            to={`/payments/new?subscriptionId=${item.subscriptionId}`}
          >
            Record Payment
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function BillingOverviewPage() {
  const [daysWindow, setDaysWindow] = useState(30);
  const [reminderDays, setReminderDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getPreferences()
      .then((preferences) => {
        const days = (preferences?.preferences ?? preferences)?.renewalReminderDays;
        if (Number.isInteger(days)) setReminderDays(days);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    getBillingOverview({ days: daysWindow })
      .then((res) => {
        if (!isMounted) return;
        setData(res);
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
  }, [daysWindow, reloadKey]);

  const overdue = data?.overdueRenewals || [];
  const upcoming = data?.upcomingRenewals || [];
  const all = [...overdue, ...upcoming];

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        actions={
          <>
            <PillLink iconRight="arrowRight" to="/payments">
              Payment History
            </PillLink>
            <PillLink icon="plus" to="/payments/new" variant="ink">
              Record Payment
            </PillLink>
          </>
        }
        description="Upcoming renewals inside your chosen window, renewal dates that passed without a recorded payment, and estimated recurring costs by currency."
        index={pageIndex('/billing')}
        title="Billing Overview"
      />

      {error && (
        <div className="mb-6">
          <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      )}

      {loading ? (
        <Card>
          <CardSkeleton label="billing projections" lines={4} tall />
        </Card>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <section aria-labelledby="recurring-heading" className="lg:col-span-12">
            <div className="mb-4">
              <h2 className="text-xl" id="recurring-heading">
                Estimated Recurring Costs
              </h2>
              <p className="mt-1 text-sm text-(--graphite)">
                Normalized monthly estimates grouped by currency. Currencies are separated without
                conversion.
              </p>
            </div>
            {data.recurringCosts?.length ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.recurringCosts.map((cost, index) => (
                  <li key={cost.currencyCode}>
                    <Card as="article" delay={index * 0.05}>
                      <div className="flex items-center justify-between">
                        <span className="eyebrow">{cost.currencyCode}</span>
                        <span className="text-xs text-(--graphite)">
                          {cost.subscriptionCount}{' '}
                          {cost.subscriptionCount === 1 ? 'Subscription' : 'Subscriptions'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-bold text-(--graphite)">
                        Estimated Monthly Cost
                      </p>
                      <p className="display-num mt-1 text-[clamp(2.2rem,1.8rem+1.4vw,3rem)]">
                        {formatCurrency(cost.monthlyEquivalent, cost.currencyCode)}
                      </p>
                      <p className="mt-2 text-xs text-(--graphite)">
                        Calculated from active recurring plans normalized to monthly equivalent.
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-(--hairline-strong) p-6 text-center text-sm text-(--graphite)">
                No active subscriptions found to calculate recurring costs.
              </p>
            )}
          </section>

          <Card className="lg:col-span-5" delay={0.05}>
            <CardHeader
              description={`Clockwise from today. Dark beads are inside your ${reminderDays}-day reminder window or overdue.`}
              title="Renewal dial"
            />
            {all.length ? (
              <RenewalDial items={all} reminderDays={reminderDays} windowDays={daysWindow} />
            ) : (
              <p className="text-sm text-(--graphite)">Nothing to plot in this window.</p>
            )}
          </Card>

          <Card className="lg:col-span-7" delay={0.1}>
            <CardHeader
              action={<WindowSlider onCommit={setDaysWindow} value={daysWindow} />}
              description="Expected subscription renewals within the selected time window."
              title="Upcoming Renewals"
            />
            {all.length > 0 && <RenewalTimeline items={all} windowDays={daysWindow} />}
          </Card>

          {overdue.length > 0 && (
            <section aria-labelledby="overdue-heading" className="lg:col-span-12">
              <div className="mb-4 flex items-start gap-3">
                <span className="obsidian grid size-10 shrink-0 place-items-center rounded-full">
                  <StateDot kind="half" />
                </span>
                <div>
                  <h2 className="text-xl" id="overdue-heading">
                    Unconfirmed Renewal Dates ({overdue.length})
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm text-(--graphite)">
                    The scheduled renewal date for these active subscriptions has passed, but no
                    payment was recorded. SpendWise AI never assumes payment outcomes automatically.
                  </p>
                </div>
              </div>
              <ol className="space-y-3">
                {overdue.map((item) => (
                  <RenewalPill item={item} key={item.subscriptionId} />
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="stack-heading" className="lg:col-span-12">
            <h2 className="mb-4 text-xl" id="stack-heading">
              Renewal stack · next {daysWindow} days
            </h2>
            {upcoming.length ? (
              <ol className="space-y-3">
                {upcoming.map((item) => (
                  <RenewalPill item={item} key={item.subscriptionId} />
                ))}
              </ol>
            ) : (
              <Card>
                <EmptyState title="Nothing renews in this window">
                  No subscriptions are scheduled to renew within the next {daysWindow} days.
                </EmptyState>
              </Card>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
