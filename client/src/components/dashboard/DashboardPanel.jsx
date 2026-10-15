export function DashboardPanel({ children, description, title, tone = 'light' }) {
  return (
    <section
      className={`min-w-0 rounded-3xl border border-white/10 bg-slate-900/65 p-5 shadow-xl shadow-black/10 sm:p-6 ${tone === 'dark' ? 'premium-dark' : ''}`}
    >
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function WidgetError({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4" role="alert">
      <p className="text-sm text-rose-200">{message}</p>
      <button
        className="mt-3 rounded-lg border border-rose-300/30 px-3 py-1.5 text-xs font-bold text-rose-100 hover:bg-rose-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
        onClick={onRetry}
        type="button"
      >
        Retry dashboard data
      </button>
    </div>
  );
}

export function WidgetLoading({ label }) {
  return (
    <div aria-live="polite" className="space-y-3" role="status">
      <span className="sr-only">Loading {label}</span>
      <div className="h-8 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none" />
      <div className="h-36 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
    </div>
  );
}
