export default function SubscriptionStatusBadge({ archivedAt, status }) {
  const statusStyles = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    paused: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    trial: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };

  const statusLabels = {
    active: 'Active',
    cancelled: 'Cancelled',
    paused: 'Paused',
    trial: 'Trial',
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
          statusStyles[status] || 'border-slate-500/30 bg-slate-500/15 text-slate-300'
        }`}
      >
        {statusLabels[status] || status}
      </span>
      {archivedAt && (
        <span className="inline-flex items-center rounded-full border border-slate-600/40 bg-slate-800/60 px-2 py-0.5 text-xs font-medium text-slate-400">
          Archived
        </span>
      )}
    </div>
  );
}
