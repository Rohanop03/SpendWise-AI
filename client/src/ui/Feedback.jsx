import Icon from './Icon.jsx';
import { Pill } from './Pill.jsx';

/** Skeleton block shaped like the final content (pressed shimmer). */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Loading placeholder for a card. Keeps an sr-only "Loading …" status label. */
export function CardSkeleton({ label, lines = 2, tall = false }) {
  return (
    <div aria-live="polite" className="space-y-3" role="status">
      <span className="sr-only">Loading {label}</span>
      <Skeleton className="h-6 w-2/5" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton className="h-4 w-full" key={index} />
      ))}
      <Skeleton className={tall ? 'h-48' : 'h-20'} />
    </div>
  );
}

/** Inline section error: obsidian, icon, label, and a retry pill. */
export function InlineError({ message, onRetry, retryLabel = 'Retry' }) {
  return (
    <div
      className="obsidian flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <p className="flex items-start gap-2 text-sm font-bold leading-6">
        <Icon className="mt-0.5 size-5 shrink-0" name="alert" />
        <span>{message}</span>
      </p>
      {onRetry && (
        <Pill icon="refresh" onClick={onRetry} size="sm" variant="paper">
          {retryLabel}
        </Pill>
      )}
    </div>
  );
}

/** The pressed "slot" illustration: an empty recess waiting for a raised card. */
export function SlotIllustration({ className = 'h-24 w-40' }) {
  return (
    <div aria-hidden="true" className={`relative ${className}`}>
      <div className="neu-pressed absolute inset-0 rounded-[1.4rem]" />
      <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-(--hairline-strong)" />
      <div className="neu-raised depth-2 absolute -right-3 -top-3 grid size-9 place-items-center rounded-full">
        <Icon className="size-4" name="plus" />
      </div>
    </div>
  );
}

/** A designed empty state: slot illustration, heading, explanation, one action. */
export function EmptyState({ action, children, title, titleAs: Heading = 'h3' }) {
  return (
    <div className="flex flex-col items-center rounded-(--radius-card) border border-dashed border-(--hairline-strong) px-6 py-10 text-center sm:py-12">
      <SlotIllustration />
      <Heading className="mt-7 text-lg sm:text-xl">{title}</Heading>
      {children && (
        <div className="mt-2 max-w-md text-sm leading-6 text-(--graphite)">{children}</div>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Polite status line for notices that previously used coloured banners. */
export function Notice({ children, onDismiss }) {
  if (!children) return null;
  return (
    <div
      className="neu-pressed depth-1 flex items-start justify-between gap-3 rounded-2xl p-4 text-sm font-bold leading-6"
      role="status"
    >
      <span className="flex items-start gap-2">
        <Icon className="mt-0.5 size-5 shrink-0" name="check" />
        <span>{children}</span>
      </span>
      {onDismiss && (
        <button
          aria-label="Dismiss message"
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5"
          onClick={onDismiss}
          type="button"
        >
          <Icon className="size-4" name="close" />
        </button>
      )}
    </div>
  );
}
