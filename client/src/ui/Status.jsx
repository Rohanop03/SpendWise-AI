/*
 * Status chips without colour. Each state differs by fill, border, weight, a glyph and
 * its text label, so nothing relies on hue or shadow alone.
 */

const subscriptionLabels = {
  active: 'Active',
  cancelled: 'Cancelled',
  paused: 'Paused',
  trial: 'Trial',
};

export function SubscriptionStatusChip({ archivedAt, status }) {
  const label = subscriptionLabels[status] || status;
  const style = {
    active: 'pill-ink',
    cancelled: 'border-[1.5px] border-(--ink) text-(--ink)',
    paused: 'neu-pressed depth-1 text-(--ink)',
    trial: 'border-[1.5px] border-dashed border-(--ink) text-(--ink)',
  }[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold leading-none ${
          style || 'border border-(--hairline-strong)'
        }`}
      >
        <span className={status === 'cancelled' ? 'struck' : undefined}>{label}</span>
      </span>
      {archivedAt && (
        <span className="inline-flex items-center rounded-full border border-dashed border-(--graphite) px-2.5 py-1 text-xs font-bold leading-none text-(--graphite)">
          Archived
        </span>
      )}
    </span>
  );
}

const paymentStatus = {
  cancelled: { dot: 'outline', label: 'Cancelled' },
  completed: { dot: 'solid', label: 'Completed' },
  failed: { dot: 'cross', label: 'Failed' },
  pending: { dot: 'half', label: 'Pending' },
};

/** A small dot glyph: solid / half / outline / dashed / cross. */
export function StateDot({ kind = 'solid', className = '' }) {
  return (
    <svg aria-hidden="true" className={`size-3 shrink-0 ${className}`} viewBox="0 0 12 12">
      {kind === 'solid' && <circle cx="6" cy="6" fill="currentColor" r="5" />}
      {kind === 'half' && (
        <>
          <circle cx="6" cy="6" fill="none" r="4.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 1.4a4.6 4.6 0 0 1 0 9.2Z" fill="currentColor" />
        </>
      )}
      {kind === 'outline' && (
        <circle cx="6" cy="6" fill="none" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      )}
      {kind === 'dashed' && (
        <circle
          cx="6"
          cy="6"
          fill="none"
          r="4.6"
          stroke="currentColor"
          strokeDasharray="2 1.6"
          strokeWidth="1.4"
        />
      )}
      {kind === 'cross' && (
        <path d="M2.5 2.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.6" />
      )}
    </svg>
  );
}

export function PaymentStatusChip({ status }) {
  const meta = paymentStatus[(status || '').toLowerCase()] || { dot: 'outline', label: status };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--hairline-strong) bg-(--surface-hi) px-2.5 py-1 text-xs font-bold leading-none">
      <StateDot kind={meta.dot} />
      {meta.label}
    </span>
  );
}

const recommendationStatus = {
  active: { dot: 'solid', label: 'Active' },
  dismissed: { dot: 'outline', label: 'Dismissed' },
  inactive: { dot: 'dashed', label: 'No longer applicable' },
  resolved: { dot: 'half', label: 'Addressed' },
};

export function RecommendationStatusChip({ onInk = false, status }) {
  const meta = recommendationStatus[status] || { dot: 'outline', label: status };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold leading-none ${
        onInk ? 'border border-white/25' : 'border border-(--hairline-strong)'
      }`}
    >
      <StateDot kind={meta.dot} />
      {meta.label}
    </span>
  );
}

export function Tag({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-(--hairline-strong) px-2.5 py-1 text-xs font-bold leading-none ${className}`}
    >
      {children}
    </span>
  );
}
