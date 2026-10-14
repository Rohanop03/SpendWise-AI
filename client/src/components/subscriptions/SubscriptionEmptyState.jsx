import { Link } from 'react-router-dom';

export default function SubscriptionEmptyState({ isFiltered, isArchived, onResetFilters }) {
  if (isFiltered) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
          🔍
        </div>
        <h3 className="mt-4 text-base font-bold text-white">No matching subscriptions</h3>
        <p className="mt-1 text-sm text-slate-400">
          Try adjusting or clearing your search filters to find what you are looking for.
        </p>
        {onResetFilters && (
          <div className="mt-5">
            <button
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
              onClick={onResetFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isArchived) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
          📦
        </div>
        <h3 className="mt-4 text-base font-bold text-white">No archived subscriptions</h3>
        <p className="mt-1 text-sm text-slate-400">
          Archived subscriptions will appear here. Archiving lets you hide inactive subscriptions
          without losing your records.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
        ✨
      </div>
      <h3 className="mt-4 text-base font-bold text-white">No subscriptions tracked yet</h3>
      <p className="mt-1 text-sm text-slate-400">
        Start tracking your recurring services, renewal dates, and monthly costs in one place.
      </p>
      <div className="mt-6">
        <Link
          className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
          to="/subscriptions/new"
        >
          <span>+</span>
          <span>Add your first subscription</span>
        </Link>
      </div>
    </div>
  );
}
