import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import {
  explainRecommendation,
  generateRecommendations,
  getRecommendationSummary,
  getRecommendations,
  updateRecommendation,
} from '../api/recommendations.js';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, EmptyState, Notice } from '../ui/Feedback.jsx';
import { Field, Input, Select } from '../ui/Field.jsx';
import Icon from '../ui/Icon.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { Pill } from '../ui/Pill.jsx';
import { RecommendationStatusChip } from '../ui/Status.jsx';
import { Card, ChromeSheen } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';
import { formatCurrency } from '../utils/cost.js';
import { formatDate } from '../utils/dates.js';

const statusNames = { Dismissed: 'dismissed', Pending: 'pending', Reviewed: 'reviewed' };

function RecommendationCard({ explanation, item, onExplain, onStatus }) {
  return (
    <motion.li
      animate={{ opacity: 1, scale: 1 }}
      className="obsidian rounded-(--radius-card) p-5 sm:p-7"
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
      initial={{ opacity: 0, scale: 0.98 }}
      layout
    >
      <ChromeSheen />
      <article>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow !text-(--on-ink-soft)">{item.rule.replaceAll('_', ' ')}</p>
            <h2 className="mt-2 text-xl sm:text-2xl">{item.title}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <RecommendationStatusChip onInk status={item.status} />
            <span className="rounded-full border border-white/25 px-2.5 py-1 text-xs font-bold leading-none">
              {item.priority} priority
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-3 text-sm leading-6">
            <p>
              <strong>Why this was suggested:</strong>{' '}
              <span className="text-soft">{item.recommendationText}</span>
            </p>
            <p>
              <strong>Suggested action:</strong>{' '}
              <span className="text-soft">{item.suggestedAction}</span>
            </p>
            <p className="num text-xs text-soft">
              Evaluated {formatDate(item.evaluatedAt || item.generatedDate, 'D MMM YYYY')}
            </p>
          </div>
          {Number(item.potentialSavings) > 0 ? (
            <div className="lg:text-right">
              <p aria-hidden="true" className="display-num text-[clamp(2.4rem,2rem+1.5vw,3.4rem)]">
                {formatCurrency(item.potentialSavings, item.currencyCode)}
              </p>
              <p className="mt-1 text-sm font-bold">
                Up to {formatCurrency(item.potentialSavings, item.currencyCode)} per month
                (estimate)
              </p>
            </div>
          ) : (
            <p className="text-sm text-soft lg:text-right">
              No savings estimate — this is a review prompt.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {item.subscription && (
            <Link
              className="pill pill-on-ink pill-sm"
              to={`/subscriptions/${item.subscription.id}`}
            >
              {item.subscription.serviceName} ·{' '}
              {formatCurrency(item.subscription.cost, item.subscription.currencyCode)}/
              {item.subscription.billingCycle}
            </Link>
          )}
        </div>

        {explanation && (
          <p className="mt-5 rounded-2xl bg-white/8 p-4 text-sm leading-6">
            <span className="font-bold">Explanation ({explanation.source}):</span>{' '}
            <span className="text-soft">{explanation.explanation}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          {item.status === 'Pending' && (
            <>
              <Pill
                icon="check"
                onClick={() => onStatus(item, 'Reviewed')}
                size="sm"
                variant="paper"
              >
                Mark reviewed
              </Pill>
              <Pill
                icon="close"
                onClick={() => onStatus(item, 'Dismissed')}
                size="sm"
                variant="onInk"
              >
                Dismiss
              </Pill>
            </>
          )}
          <Pill icon="spark" onClick={() => onExplain(item.id)} size="sm" variant="onInk">
            Explain this
          </Pill>
        </div>
      </article>
    </motion.li>
  );
}

export default function RecommendationsPage() {
  const { notify } = useToast();
  const [filters, setFilters] = useState({ currencyCode: '', status: 'Pending' });
  const [result, setResult] = useState({ pagination: null, recommendations: [] });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState('');
  const [explanations, setExplanations] = useState({});

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getRecommendationSummary());
    } catch {
      setSummary(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(
        await getRecommendations({
          ...filters,
          currencyCode: filters.currencyCode || undefined,
          limit: 50,
        }),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    Promise.resolve().then(loadSummary);
  }, [loadSummary]);

  async function analyze() {
    setGenerating(true);
    setNotice('');
    try {
      const generated = await generateRecommendations();
      setNotice(
        `${generated.generatedCount} current recommendation${generated.generatedCount === 1 ? '' : 's'} evaluated. Hypothetical savings are not guaranteed.`,
      );
      await Promise.all([load(), loadSummary()]);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setGenerating(false);
    }
  }

  // Optimistic: the card leaves the filtered list at once; it returns if the server refuses.
  async function changeStatus(item, status) {
    const previous = result;
    setResult((current) => ({
      ...current,
      recommendations: current.recommendations.filter((rec) => rec.id !== item.id),
    }));
    try {
      await updateRecommendation(item.id, status);
      notify(`Recommendation marked ${statusNames[status]}.`, { description: item.title });
      loadSummary();
    } catch (requestError) {
      setResult(previous);
      setError(getApiErrorMessage(requestError));
    }
  }

  async function explain(id) {
    try {
      const response = await explainRecommendation(id);
      setExplanations((current) => ({ ...current, [id]: response }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        actions={
          <Pill disabled={generating} icon="spark" onClick={analyze} variant="ink">
            {generating ? 'Analyzing…' : 'Analyze my subscriptions'}
          </Pill>
        }
        description="Explainable rules review your stored subscriptions and completed payment history. SpendWise never cancels a service or guarantees savings."
        index={pageIndex('/recommendations')}
        title="Recommendation Center"
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7" look="obsidian">
          <p className="eyebrow !text-(--on-ink-soft)">
            Total potential savings · active recommendations
          </p>
          {summary?.potentialMonthlySavings?.length ? (
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              {summary.potentialMonthlySavings.map((item) => (
                <p
                  className="display-num text-[clamp(2.6rem,2rem+2vw,3.8rem)]"
                  key={item.currencyCode}
                >
                  {formatCurrency(item.amount, item.currencyCode)}
                  <span className="ml-2 font-sans text-sm font-bold">/ month</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-lg font-bold">No savings estimates right now.</p>
          )}
          <p className="mt-3 text-xs leading-5 text-soft">
            Hypothetical and deduplicated by subscription. Not guaranteed or realized savings.
          </p>
        </Card>
        <Card className="lg:col-span-5" delay={0.05} look="glass">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              {(id) => (
                <Select
                  id={id}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, status: event.target.value }))
                  }
                  value={filters.status}
                >
                  <option value="Pending">Pending</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Dismissed">Dismissed</option>
                  <option value="all">All</option>
                </Select>
              )}
            </Field>
            <Field hint="Leave empty for all" label="Currency">
              {(id, describedBy) => (
                <Input
                  aria-describedby={describedBy}
                  className="uppercase"
                  id={id}
                  maxLength="3"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      currencyCode: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="All"
                  value={filters.currencyCode}
                />
              )}
            </Field>
          </div>
          {summary && (
            <p className="mt-4 text-xs text-(--graphite)">
              {summary.pendingCount} pending · {summary.highPriorityCount} high priority
            </p>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Notice onDismiss={() => setNotice('')}>{notice}</Notice>
        {error && (
          <div
            className="obsidian flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <p className="flex items-start gap-2 text-sm font-bold">
              <Icon className="mt-0.5 size-5 shrink-0" name="alert" />
              {error}
            </p>
            <Pill icon="refresh" onClick={load} size="sm" variant="paper">
              Retry
            </Pill>
          </div>
        )}
      </div>

      <div className="mt-6">
        {loading && !result.recommendations.length ? (
          <Card>
            <CardSkeleton label="recommendations" lines={3} />
          </Card>
        ) : result.recommendations.length === 0 ? (
          <Card>
            <EmptyState
              action={
                filters.status === 'Pending' && (
                  <Pill disabled={generating} icon="spark" onClick={analyze} variant="ink">
                    Run an analysis
                  </Pill>
                )
              }
              title={`No ${filters.status} recommendations`}
              titleAs="h2"
            >
              Analyze your current records or choose another status to revisit recommendation
              history.
            </EmptyState>
          </Card>
        ) : (
          <LayoutGroup>
            <ul
              aria-busy={loading}
              className={`grid gap-5 transition-opacity ${loading ? 'opacity-60' : ''}`}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {result.recommendations.map((item) => (
                  <RecommendationCard
                    explanation={explanations[item.id]}
                    item={item}
                    key={item.id}
                    onExplain={explain}
                    onStatus={changeStatus}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        )}
      </div>
    </div>
  );
}
