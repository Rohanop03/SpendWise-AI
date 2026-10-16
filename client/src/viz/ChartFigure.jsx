import { useId, useState } from 'react';

import Icon from '../ui/Icon.jsx';

/**
 * Every chart lives in a <figure> with a <figcaption> and an exact-value table twin.
 * The table stays in the DOM (visually hidden) and "Show data" reveals it, so values are
 * never tooltip-only.
 */
export default function ChartFigure({ caption, children, className = '', table, toolbar }) {
  const [showData, setShowData] = useState(false);
  const tableId = useId();
  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-sm leading-6 text-(--graphite)">{caption}</figcaption>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {table && (
            <button
              aria-controls={tableId}
              aria-expanded={showData}
              className="pill neu-press pill-sm"
              onClick={() => setShowData((value) => !value)}
              type="button"
            >
              <Icon className="size-4" name={showData ? 'chart' : 'list'} />
              {showData ? 'Hide data' : 'Show data'}
            </button>
          )}
        </div>
      </div>
      {children}
      {table && (
        <div
          className={showData ? 'neu-pressed depth-1 scroll-x mt-4 rounded-2xl' : 'sr-only'}
          id={tableId}
        >
          {table}
        </div>
      )}
    </figure>
  );
}

/** Glass tooltip body shared by Recharts and the D3 visuals. */
export function GlassTip({ children, title }) {
  return (
    <div className="glass glass-solid pointer-events-none min-w-40 rounded-2xl px-3.5 py-3 text-xs shadow-xl">
      {title && <p className="mb-1.5 text-sm font-bold">{title}</p>}
      {children}
    </div>
  );
}
