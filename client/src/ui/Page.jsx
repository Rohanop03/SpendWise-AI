import { formatCurrency } from '../utils/cost.js';
import { useCountUp } from './motion.js';

/**
 * Page header: small mono index (e.g. "02 / Subscriptions"), the single <h1>, an optional
 * description and trailing actions.
 */
export function PageHeader({ actions, children, description, index, title }) {
  return (
    <header className="mb-6 flex flex-col gap-5 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {index && <p className="eyebrow mb-3">{index}</p>}
        <h1 className="text-[clamp(2rem,1.4rem+2.6vw,3.25rem)] leading-[1.05]">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-(--graphite)">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/** Page container inside the console. */
export function PageBody({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-[1400px] ${className}`}>{children}</div>;
}

/** Monospace money with tabular numerals. */
export function Money({ amount, className = '', currency, prefix = '' }) {
  return (
    <span className={`num ${className}`}>
      {prefix}
      {formatCurrency(amount, currency)}
    </span>
  );
}

/** KPI tile. The thin display numeral counts up to the real value, then rests on it. */
export function Kpi({ caption, className = '', currency, format = 'money', label, value }) {
  const numeric = Number(value);
  const animated = useCountUp(Number.isFinite(numeric) ? numeric : 0);
  const done = Math.abs(animated - numeric) < 1e-9;
  const shown = !Number.isFinite(numeric)
    ? '—'
    : format === 'money'
      ? formatCurrency(done ? value : animated, currency)
      : String(Math.round(animated));
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-sm font-bold text-(--graphite) [.obsidian_&]:text-(--on-ink-soft)">
        {label}
      </p>
      <p className="mt-2 break-words">
        <span className="display-num whitespace-nowrap text-[clamp(1.7rem,1.3rem+1.1vw,2.35rem)]">
          {shown}
        </span>
      </p>
      {caption && (
        <p className="mt-2 text-xs leading-5 text-(--graphite) [.obsidian_&]:text-(--on-ink-soft)">
          {caption}
        </p>
      )}
    </div>
  );
}
