import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  BillingCycles,
  FinancialSummary,
  NextRenewal,
  PaymentStatus,
  RefundSummary,
  TopSubscriptions,
  UpcomingList,
  WidgetBody,
} from '../components/dashboard/DashboardWidgets.jsx';
import { pageIndex } from '../layout/nav.js';
import { EmptyState, InlineError } from '../ui/Feedback.jsx';
import { Field, Input, Select } from '../ui/Field.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { PillLink, TextLink } from '../ui/Pill.jsx';
import Segmented from '../ui/Segmented.jsx';
import { RecommendationStatusChip } from '../ui/Status.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { groupByCurrency } from '../utils/chartFormatters.js';
import { formatCurrency } from '../utils/cost.js';
import { DASHBOARD_PERIODS, getPresetRange, normalizePreset } from '../utils/dashboardFilters.js';
import CashFlowChart from '../viz/CashFlowChart.jsx';
import CategoryBreakdown from '../viz/CategoryBreakdown.jsx';
import RenewalDial from '../viz/RenewalDial.jsx';
import RenewalTimeline from '../viz/RenewalTimeline.jsx';

const quickLinks = [
  ['/subscriptions', 'Manage subscriptions', 'stack'],
  ['/payments/new', 'Record payment', 'receipt'],
  ['/billing', 'Review billing schedule', 'calendar'],
  ['/analytics', 'Open detailed analytics', 'chart'],
  ['/notifications', 'Review notifications', 'bell'],
  ['/recommendations', 'Review cost recommendations', 'spark'],
];

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preset = normalizePreset(searchParams.get('period'));
  const currencyParameter = searchParams.get('currency');
  const currencyCode = currencyParameter === 'ALL' ? '' : currencyParameter || '';
  const presetRange = useMemo(() => getPresetRange(preset), [preset]);
  const startDate =
    preset === 'custom' ? searchParams.get('startDate') || '' : presetRange.startDate;
  const endDate = preset === 'custom' ? searchParams.get('endDate') || '' : presetRange.endDate;

  const updateSearch = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // First load is one request; preferences arrive with it. When the URL names no currency the
  // preferred one becomes the filter, which is at most one more request.
  const { currencyOptions, failedCount, isLoading, preferences, recommendations, retry, widgets } =
    useDashboardData({ currencyCode, endDate, startDate });
  const needsCurrency = useRef(!searchParams.has('currency'));
  useEffect(() => {
    if (!preferences || !needsCurrency.current) return;
    needsCurrency.current = false;
    if (preferences.preferredCurrency) updateSearch({ currency: preferences.preferredCurrency });
  }, [preferences, updateSearch]);
  const reminderDays = Number.isInteger(preferences?.renewalReminderDays)
    ? preferences.renewalReminderDays
    : 7;
  const recs = {
    error: widgets.overview.error ? 'Optimization insights could not be loaded.' : '',
    loading: !recommendations && !widgets.overview.error,
    previews: recommendations?.previews || [],
    reload: retry,
    summary: recommendations?.summary || null,
  };

  const summaries = widgets.overview.data?.currencySummaries || [];
  const hasSubscriptions = summaries.some((summary) => summary.activeSubscriptionCount > 0);
  const hasHistoricalActivity = summaries.some(
    (summary) =>
      Number(summary.grossPayments) !== 0 ||
      Number(summary.completedRefunds) !== 0 ||
      summary.completedPaymentCount > 0,
  );
  const showNewUserState =
    !isLoading &&
    !widgets.overview.error &&
    !hasSubscriptions &&
    !hasHistoricalActivity;

  const renewals = (widgets.renewals.data?.items || []).filter(
    (item) => !currencyCode || item.currencyCode === currencyCode,
  );

  function selectPreset(nextPreset) {
    const updates = { endDate: '', period: nextPreset, startDate: '' };
    if (nextPreset === 'custom') {
      updates.startDate = startDate;
      updates.endDate = endDate;
    }
    updateSearch(updates);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        actions={
          <PillLink icon="receipt" to="/payments/new">
            Record payment
          </PillLink>
        }
        description="Recurring commitments, renewals that are coming up, and realised cash flow — all from your own records."
        index={pageIndex('/dashboard')}
        title="Dashboard"
      />

      <Card className="mb-6" look="glass" padded={false}>
        <section
          aria-label="Dashboard filters"
          className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-end xl:justify-between"
        >
          <Segmented
            label="Reporting period"
            onChange={selectPreset}
            options={DASHBOARD_PERIODS.map((period) => ({ label: period.label, value: period.id }))}
            size="sm"
            value={preset}
          />
          <div className="flex flex-wrap items-end gap-3">
            {preset === 'custom' && (
              <>
                <Field className="w-40" label="Start date">
                  {(id) => (
                    <Input
                      id={id}
                      max={endDate || undefined}
                      onChange={(event) =>
                        updateSearch({ endDate, period: 'custom', startDate: event.target.value })
                      }
                      type="date"
                      value={startDate}
                    />
                  )}
                </Field>
                <Field className="w-40" label="End date">
                  {(id) => (
                    <Input
                      id={id}
                      min={startDate || undefined}
                      onChange={(event) =>
                        updateSearch({ endDate: event.target.value, period: 'custom', startDate })
                      }
                      type="date"
                      value={endDate}
                    />
                  )}
                </Field>
              </>
            )}
            <Field className="min-w-48" label="Display currency">
              {(id) => (
                <Select
                  id={id}
                  onChange={(event) => updateSearch({ currency: event.target.value || 'ALL' })}
                  value={currencyCode}
                >
                  <option value="">Separate all currencies</option>
                  {currencyOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </section>
        <p className="border-t border-(--hairline) px-4 py-3 text-xs leading-5 text-(--graphite) sm:px-5">
          Historical payments and refunds follow this period. Recurring estimates and renewal dates
          describe current subscription state.
        </p>
      </Card>

      {failedCount > 0 && (
        <div className="mb-6">
          <InlineError
            message={`${failedCount} dashboard ${failedCount === 1 ? 'section' : 'sections'} could not be loaded. Available financial data is still shown below.`}
            onRetry={retry}
            retryLabel="Retry failed sections"
          />
        </div>
      )}

      {showNewUserState ? (
        <Card>
          <EmptyState
            action={
              <PillLink icon="plus" to="/subscriptions/new" variant="ink">
                Add your first subscription
              </PillLink>
            }
            title="Build your subscription picture"
            titleAs="h2"
          >
            Add your first subscription to see current recurring commitments and renewal dates.
            Spending charts remain empty until you explicitly record completed payments—SpendWise
            never invents transactions.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          <Card className="min-h-[18rem] lg:col-span-4" delay={0} look="obsidian">
            <NextRenewal currencyCode={currencyCode} widget={widgets.renewals} />
          </Card>

          <Card className="lg:col-span-8" delay={0.05}>
            <FinancialSummary
              currencyCode={currencyCode}
              onRetry={retry}
              savings={recs.summary?.potentialMonthlySavings || []}
              widget={widgets.overview}
            />
          </Card>

          <Card className="lg:col-span-5" delay={0.1}>
            <CardHeader
              description={`Next 30 days, clockwise from today. Dark beads fall inside your ${reminderDays}-day reminder window.`}
              title="Renewal dial"
            />
            <WidgetBody
              empty={!renewals.length}
              emptyText="No Active subscriptions renew within the next 30 days."
              label="renewal dial"
              onRetry={retry}
              widget={widgets.renewals}
            >
              <RenewalDial items={renewals} reminderDays={reminderDays} windowDays={30} />
            </WidgetBody>
          </Card>

          <Card className="lg:col-span-7" delay={0.15}>
            <CardHeader
              action={<TextLink to="/billing">Open full billing schedule</TextLink>}
              description="Expected obligations within 30 days, plus overdue dates whose payment outcome is unconfirmed."
              title="Upcoming renewals"
            />
            {widgets.renewals.loading || widgets.renewals.error ? (
              <WidgetBody label="upcoming renewals" onRetry={retry} widget={widgets.renewals} />
            ) : (
              <div className="space-y-5">
                {renewals.length > 0 && <RenewalTimeline items={renewals} windowDays={30} />}
                <UpcomingList items={renewals} />
              </div>
            )}
          </Card>

          <Card className="lg:col-span-7" delay={0.1}>
            <CardHeader
              description="Completed payments and completed refunds by reporting month."
              title="Monthly cash flow"
            />
            <WidgetBody
              empty={!widgets.trends.data?.trends?.length}
              emptyText="No completed payments or refunds were recorded for this period."
              label="monthly cash flow"
              onRetry={retry}
              widget={widgets.trends}
            >
              <div className="space-y-8">
                {Object.entries(groupByCurrency(widgets.trends.data?.trends || [])).map(
                  ([currency, rows]) => (
                    <CashFlowChart currency={currency} key={currency} rows={rows} />
                  ),
                )}
              </div>
            </WidgetBody>
          </Card>

          <Card className="lg:col-span-5" delay={0.15}>
            <CardHeader
              description="Gross completed spending is shown separately from refunds and potentially negative net cash flow."
              title="Spending by category"
            />
            <WidgetBody
              empty={!widgets.categories.data?.categories?.length}
              emptyText="No category spending was recorded for this period."
              label="category spending"
              onRetry={retry}
              widget={widgets.categories}
            >
              <div className="space-y-8">
                {Object.entries(groupByCurrency(widgets.categories.data?.categories || [])).map(
                  ([currency, rows]) => (
                    <CategoryBreakdown currency={currency} key={currency} rows={rows} />
                  ),
                )}
              </div>
            </WidgetBody>
          </Card>

          <Card className="lg:col-span-12" delay={0.1} look="raised">
            <CardHeader
              action={<TextLink to="/recommendations">Open Recommendation Center</TextLink>}
              description="Current deterministic cost-review opportunities. Savings are hypothetical, never guaranteed."
              title="Cost optimization"
            />
            {recs.loading ? (
              <WidgetBody label="optimization insights" widget={{ loading: true }} />
            ) : recs.error ? (
              <InlineError
                message={recs.error}
                onRetry={recs.reload}
                retryLabel="Retry dashboard data"
              />
            ) : (
              <div className="space-y-5">
                <dl className="flex flex-wrap gap-x-10 gap-y-3">
                  <div>
                    <dt className="text-xs font-bold text-(--graphite)">Active</dt>
                    <dd className="display-num text-4xl">{recs.summary.pendingCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-(--graphite)">High priority</dt>
                    <dd className="display-num text-4xl">{recs.summary.highPriorityCount}</dd>
                  </div>
                  {recs.summary.potentialMonthlySavings.map((item) => (
                    <div key={item.currencyCode}>
                      <dt className="text-xs font-bold text-(--graphite)">Up to, per month</dt>
                      <dd className="display-num text-4xl">
                        {formatCurrency(item.amount, item.currencyCode)}
                        <span className="sr-only"> hypothetical</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {recs.previews.length ? (
                  <ul className="grid gap-4 md:grid-cols-3">
                    {recs.previews.map((item, index) => (
                      <li key={item.id}>
                        <Card
                          animateIn={false}
                          as="article"
                          className="h-full"
                          delay={index * 0.05}
                          look="obsidian"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <RecommendationStatusChip onInk status={item.status} />
                            <span className="eyebrow !text-(--on-ink-soft)">
                              {item.priority} priority
                            </span>
                          </div>
                          <h3 className="mt-4 text-lg">{item.title}</h3>
                          {Number(item.potentialSavings) > 0 && (
                            <p className="num mt-2 text-sm text-soft">
                              Up to {formatCurrency(item.potentialSavings, item.currencyCode)} /
                              month
                            </p>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-(--graphite)">
                    No active recommendations. Run an analysis from the Recommendation Center any
                    time.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card className="lg:col-span-6" delay={0.05}>
            <CardHeader
              description="Backend-ranked historical gross completed payments for the selected period."
              title="Top subscriptions by historical spend"
            />
            <TopSubscriptions
              currencyCode={currencyCode}
              onRetry={retry}
              widget={widgets.topSubscriptions}
            />
          </Card>

          <Card className="lg:col-span-6" delay={0.1}>
            <CardHeader
              description="Current Active commitments, normalized by the backend to monthly equivalents."
              title="Billing cycle commitments"
            />
            <BillingCycles onRetry={retry} widget={widgets.billingCycles} />
          </Card>

          <Card className="lg:col-span-7" delay={0.05}>
            <CardHeader
              description="Pending and failed attempts are explicitly excluded from realized expenditure."
              title="Payment status"
            />
            <PaymentStatus onRetry={retry} widget={widgets.paymentStatus} />
          </Card>

          <Card className="lg:col-span-5" delay={0.1}>
            <CardHeader
              description="Completed refund records recognized on their recorded refund dates."
              title="Refund summary"
            />
            <RefundSummary onRetry={retry} widget={widgets.refunds} />
          </Card>

          <Card className="lg:col-span-12" delay={0.05} look="pressed">
            <CardHeader
              description="Move from insight to accurate record keeping."
              title="Quick actions"
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quickLinks.map(([to, label, icon]) => (
                <PillLink
                  className="!justify-start !whitespace-normal text-left"
                  icon={icon}
                  iconRight="arrowRight"
                  key={to}
                  to={to}
                >
                  <span className="flex-1 text-left">{label}</span>
                </PillLink>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
