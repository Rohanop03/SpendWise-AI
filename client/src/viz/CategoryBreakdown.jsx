import { arc, pie } from 'd3-shape';
import { useMemo, useState } from 'react';

import { patternFor } from '../ui/patterns.js';
import { PatternSwatch } from '../ui/SvgDefs.jsx';
import { formatCurrency } from '../utils/cost.js';
import { GlassTip } from './ChartFigure.jsx';

/**
 * Category spend for one currency. ≤ 6 categories → pattern-filled donut (2px surface
 * gaps, no hue); more → horizontal bars. The legend list beside it carries the exact
 * values and doubles as the accessible data equivalent.
 */
export default function CategoryBreakdown({ currency, rows, showLegend = true }) {
  const [focused, setFocused] = useState(null);
  // Backend order is kept so each category keeps the same pattern in every view.
  const sorted = rows;
  const asDonut = sorted.length > 0 && sorted.length <= 6;
  const total = sorted.reduce((sum, row) => sum + Math.max(0, Number(row.grossPayments) || 0), 0);

  return (
    <figure className="@container min-w-0">
      <figcaption className="mb-4 text-sm leading-6 text-(--graphite)">
        {currency} · gross completed spending by category, with refunds and net shown separately
      </figcaption>
      <div
        className={`grid items-center gap-6 ${asDonut && showLegend ? '@xl:grid-cols-[minmax(0,13rem)_1fr]' : ''}`}
      >
        {asDonut ? (
          <Donut
            currency={currency}
            focused={focused}
            onFocus={setFocused}
            rows={sorted}
            total={total}
          />
        ) : (
          <Bars currency={currency} rows={sorted} />
        )}
        {showLegend && (
          <ul
            aria-label={`${currency} category values`}
            className="grid min-w-0 gap-1 @md:grid-cols-2 @xl:grid-cols-1"
          >
            {sorted.map((row, index) => (
              <li
                className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                  focused === index ? 'bg-white/70' : ''
                }`}
                key={row.categoryId}
                onMouseEnter={() => setFocused(index)}
                onMouseLeave={() => setFocused(null)}
              >
                <PatternSwatch className="mt-0.5 size-4" index={index} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-bold">{row.categoryName}</span>
                    <span className="num text-sm">
                      {formatCurrency(row.grossPayments, currency)}
                    </span>
                  </div>
                  <span className="block text-xs leading-5 text-(--graphite)">
                    Gross {formatCurrency(row.grossPayments, currency)} · Refunds{' '}
                    {formatCurrency(row.completedRefunds, currency)} · Net{' '}
                    {formatCurrency(row.netCashFlow, currency)} · {row.percentageOfGross}% of gross
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </figure>
  );
}

function Donut({ currency, focused, onFocus, rows, total }) {
  const size = 208;
  const radius = size / 2;
  const arcs = useMemo(() => {
    const layout = pie()
      .sort(null)
      .value((row) => Math.max(0, Number(row.grossPayments) || 0))
      .padAngle(0.02);
    return layout(rows);
  }, [rows]);
  const shape = arc()
    .innerRadius(radius * 0.62)
    .outerRadius(radius - 4)
    .cornerRadius(4);
  const grown = arc()
    .innerRadius(radius * 0.6)
    .outerRadius(radius)
    .cornerRadius(4);
  const active = focused !== null ? rows[focused] : null;

  return (
    <div className="relative mx-auto w-full max-w-[13rem]">
      <svg
        className="h-auto w-full overflow-visible"
        role="presentation"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle className="fill-(--surface-lo)" cx={radius} cy={radius} r={radius * 0.6} />
        <g transform={`translate(${radius},${radius})`}>
          {total > 0 &&
            arcs.map((segment, index) => (
              <path
                d={(focused === index ? grown : shape)(segment)}
                fill={patternFor(index).fill}
                key={segment.data.categoryId}
                onMouseEnter={() => onFocus(index)}
                onMouseLeave={() => onFocus(null)}
                stroke="#EFEFF2"
                strokeWidth="2"
                style={{ transition: 'd 200ms ease' }}
              />
            ))}
        </g>
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid place-items-center text-center"
      >
        <div className="max-w-[60%]">
          <p className="eyebrow !text-[0.6rem]">{active ? active.categoryName : 'Total gross'}</p>
          <p className="num mt-1 text-sm font-medium leading-tight">
            {formatCurrency(active ? active.grossPayments : total, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Bars({ currency, rows }) {
  const [tip, setTip] = useState(null);
  const max = Math.max(...rows.map((row) => Math.max(0, Number(row.grossPayments) || 0)), 1);
  return (
    <div aria-hidden="true" className="relative space-y-2.5">
      {rows.map((row, index) => {
        const width = (Math.max(0, Number(row.grossPayments) || 0) / max) * 100;
        return (
          <div
            className="grid grid-cols-[6.5rem_1fr] items-center gap-3"
            key={row.categoryId}
            onMouseEnter={() => setTip(index)}
            onMouseLeave={() => setTip(null)}
          >
            <span className="truncate text-xs font-bold">{row.categoryName.slice(0, 18)}</span>
            <svg className="h-4 w-full" preserveAspectRatio="none" viewBox="0 0 100 10">
              <rect className="fill-(--surface-lo)" height="10" rx="2" width="100" />
              <rect
                fill={patternFor(index).fill}
                height="10"
                rx="2"
                stroke="#0B0B0D"
                strokeWidth="0.4"
                width={Math.max(width, 1)}
              />
            </svg>
          </div>
        );
      })}
      {tip !== null && (
        <div className="absolute right-0 top-0">
          <GlassTip title={rows[tip].categoryName}>
            <span className="num">{formatCurrency(rows[tip].grossPayments, currency)}</span>
          </GlassTip>
        </div>
      )}
    </div>
  );
}
