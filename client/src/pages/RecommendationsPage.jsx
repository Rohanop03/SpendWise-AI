import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  explainRecommendation,
  generateRecommendations,
  getRecommendations,
  updateRecommendation,
} from '../api/recommendations.js';
import { getApiErrorMessage } from '../api/http.js';
import { formatCurrency } from '../utils/cost.js';

const priorityStyles = {
  high: 'bg-rose-400/15 text-rose-200',
  low: 'bg-slate-400/15 text-slate-300',
  medium: 'bg-amber-400/15 text-amber-200',
};

export default function RecommendationsPage() {
  const [filters, setFilters] = useState({ currencyCode: '', status: 'active' });
  const [result, setResult] = useState({ pagination: null, recommendations: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState('');
  const [explanations, setExplanations] = useState({});

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

  async function analyze() {
    setGenerating(true);
    setNotice('');
    try {
      const generated = await generateRecommendations();
      setNotice(
        `${generated.generatedCount} current recommendation${generated.generatedCount === 1 ? '' : 's'} evaluated. Hypothetical savings are not guaranteed.`,
      );
      await load();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setGenerating(false);
    }
  }

  async function changeStatus(id, status) {
    try {
      await updateRecommendation(id, status);
      await load();
    } catch (requestError) {
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            Cost optimization
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Recommendation Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Explainable rules review your stored subscriptions and completed payment history.
            SpendWise never cancels a service or guarantees savings.
          </p>
        </div>
        <button
          className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-60"
          disabled={generating}
          onClick={analyze}
          type="button"
        >
          {generating ? 'Analyzing…' : 'Analyze my subscriptions'}
        </button>
      </header>

      <div className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <label className="text-sm text-slate-300">
          Status{' '}
          <select
            className="ml-2 rounded-lg bg-slate-950 px-3 py-2"
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
            value={filters.status}
          >
            <option value="active">Active</option>
            <option value="dismissed">Dismissed</option>
            <option value="resolved">Addressed</option>
            <option value="inactive">No longer applicable</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Currency{' '}
          <input
            className="ml-2 w-24 rounded-lg bg-slate-950 px-3 py-2 uppercase"
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
        </label>
      </div>

      {notice && (
        <p
          className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <div
          className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100"
          role="alert"
        >
          <p>{error}</p>
          <button className="mt-2 font-bold underline" onClick={load} type="button">
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p className="mt-10 text-center text-slate-300" role="status">
          Loading recommendations…
        </p>
      ) : result.recommendations.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-white/15 p-10 text-center">
          <h2 className="text-xl font-bold text-white">No {filters.status} recommendations</h2>
          <p className="mt-2 text-sm text-slate-400">
            Analyze your current records or choose another status to revisit recommendation history.
          </p>
        </section>
      ) : (
        <div className="mt-7 grid gap-5">
          {result.recommendations.map((item) => (
            <article
              className="rounded-3xl border border-white/10 bg-slate-900/65 p-6"
              key={item.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {item.type.replaceAll('_', ' ')}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-white">{item.title}</h2>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${priorityStyles[item.priority]}`}
                  >
                    {item.priority} priority
                  </span>
                  <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-bold text-sky-200">
                    {item.confidence} confidence
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{item.explanation}</p>
              {item.estimatedSavings && (
                <p className="mt-3 font-bold text-emerald-200">
                  Up to {formatCurrency(item.estimatedSavings, item.currencyCode)} per{' '}
                  {item.savingsPeriod} (hypothetical)
                </p>
              )}
              <p className="mt-3 text-sm text-slate-400">
                <span className="font-bold text-slate-300">Suggested action:</span>{' '}
                {item.suggestedAction}
              </p>
              {item.evidence?.limitation && (
                <p className="mt-2 text-xs text-slate-500">
                  Limitation: {item.evidence.limitation}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.subscriptions.map((subscription) => (
                  <Link
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:text-emerald-200"
                    key={subscription.id}
                    to={`/subscriptions/${subscription.id}`}
                  >
                    {subscription.serviceName} ·{' '}
                    {formatCurrency(subscription.price, subscription.currencyCode)}/
                    {subscription.billingCycle}
                  </Link>
                ))}
              </div>
              {explanations[item.id] && (
                <p className="mt-4 rounded-xl bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                  <span className="font-bold text-white">
                    Explanation ({explanations[item.id].source}):
                  </span>{' '}
                  {explanations[item.id].explanation}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                {item.status === 'active' && (
                  <>
                    <button
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold"
                      onClick={() => changeStatus(item.id, 'dismissed')}
                      type="button"
                    >
                      Dismiss
                    </button>
                    <button
                      className="rounded-lg border border-emerald-300/30 px-3 py-2 text-xs font-bold text-emerald-200"
                      onClick={() => changeStatus(item.id, 'resolved')}
                      type="button"
                    >
                      Mark addressed
                    </button>
                  </>
                )}
                <button
                  className="rounded-lg border border-sky-300/25 px-3 py-2 text-xs font-bold text-sky-200"
                  onClick={() => explain(item.id)}
                  type="button"
                >
                  Explain this
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
