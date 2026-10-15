import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getRecommendationSummary, getRecommendations } from '../../api/recommendations.js';
import { formatCurrency } from '../../utils/cost.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

export default function OptimizationWidget() {
  const [state, setState] = useState({ error: '', loading: true, previews: [], summary: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, error: '', loading: true }));
    try {
      const [summary, list] = await Promise.all([
        getRecommendationSummary(),
        getRecommendations({ limit: 2, status: 'active' }),
      ]);
      setState({ error: '', loading: false, previews: list.recommendations, summary });
    } catch {
      setState({
        error: 'Optimization insights could not be loaded.',
        loading: false,
        previews: [],
        summary: null,
      });
    }
  }, []);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);
  return (
    <DashboardPanel
      description="Current deterministic cost-review opportunities."
      title="Cost optimization"
      tone="dark"
    >
      {state.loading ? (
        <WidgetLoading label="optimization insights" />
      ) : state.error ? (
        <WidgetError message={state.error} onRetry={load} />
      ) : (
        <div>
          <div className="flex gap-6">
            <p>
              <span className="block text-2xl font-black text-white">
                {state.summary.activeCount}
              </span>
              <span className="text-xs text-slate-400">Active</span>
            </p>
            <p>
              <span className="block text-2xl font-black text-white">
                {state.summary.highPriorityCount}
              </span>
              <span className="text-xs text-slate-400">High priority</span>
            </p>
          </div>
          {state.summary.hypotheticalMonthlySavings.map((item) => (
            <p className="mt-3 text-sm font-bold text-emerald-200" key={item.currencyCode}>
              Up to {formatCurrency(item.amount, item.currencyCode)}/month hypothetical
            </p>
          ))}
          <ul className="mt-4 space-y-2">
            {state.previews.map((item) => (
              <li className="text-sm text-slate-300" key={item.id}>
                {item.title}
              </li>
            ))}
          </ul>
          <Link
            className="mt-5 inline-block text-sm font-bold text-emerald-300"
            to="/recommendations"
          >
            Open Recommendation Center →
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
}
