import dayjs from 'dayjs';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import Segmented from '../ui/Segmented.jsx';
import { formatCurrency } from '../utils/cost.js';
import { relativeDays } from '../utils/dates.js';
import { useElementWidth } from './useElementWidth.js';

const PILL_PX = 136;
const LANE_PX = 46;

/**
 * Gantt-style renewal track. Obsidian pills sit on their renewal date; overlapping pills
 * drop into new lanes. Day / Week / Month changes the visible span and tick granularity.
 * Arrow keys move between pills.
 */
export default function RenewalTimeline({ items, windowDays = 30 }) {
  const [scale, setScale] = useState('week');
  const [trackRef, trackWidth] = useElementWidth(720);
  const pills = useRef([]);
  const span = scale === 'day' ? Math.min(7, windowDays) : windowDays;
  const width = Math.max(trackWidth, scale === 'day' ? 560 : 640);

  const placed = useMemo(() => {
    const visible = items
      .filter((item) => item.isOverdue || item.daysUntilRenewal <= span)
      .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
    const laneEnds = [];
    return visible.map((item) => {
      const day = Math.max(0, item.daysUntilRenewal);
      const x = (day / span) * (width - PILL_PX);
      let lane = laneEnds.findIndex((end) => end <= x);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = x + PILL_PX + 6;
      return { item, lane, x };
    });
  }, [items, span, width]);

  const lanes = Math.max(1, ...placed.map((entry) => entry.lane + 1));
  const hidden = items.length - placed.length;

  const ticks = useMemo(() => {
    const result = [];
    for (let day = 0; day <= span; day += 1) {
      const date = dayjs().add(day, 'day');
      const show =
        scale === 'day' ||
        (scale === 'week' && day % 7 === 0) ||
        (scale === 'month' && (day === 0 || date.date() === 1));
      if (show) {
        result.push({
          day,
          label:
            day === 0
              ? 'Today'
              : scale === 'month'
                ? date.format('MMM')
                : scale === 'day'
                  ? date.format('ddd D')
                  : date.format('D MMM'),
          x: (day / span) * (width - PILL_PX),
        });
      }
    }
    return result;
  }, [scale, span, width]);

  function onKeyDown(event, index) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    pills.current[(index + step + placed.length) % placed.length]?.focus();
  }

  return (
    <figure className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-sm leading-6 text-(--graphite)">
          Upcoming renewals on a {span}-day track. Use the arrow keys to move between them.
        </figcaption>
        <Segmented
          label="Timeline scale"
          labelHidden
          onChange={setScale}
          options={[
            { label: 'Day', value: 'day' },
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
          ]}
          size="sm"
          value={scale}
        />
      </div>
      <div className="neu-pressed depth-1 scroll-x rounded-[1.4rem]" ref={trackRef}>
        <div className="relative px-3 pb-3 pt-9" style={{ width }}>
          <div aria-hidden="true" className="absolute inset-x-3 top-0 h-full">
            {ticks.map((tick) => (
              <div className="absolute top-0 h-full" key={tick.day} style={{ left: tick.x }}>
                <span className="num absolute left-1 top-2.5 whitespace-nowrap text-[10px] text-(--graphite)">
                  {tick.label}
                </span>
                <span className="absolute bottom-2 top-8 border-l border-(--hairline-strong)" />
              </div>
            ))}
          </div>
          <ol className="relative" style={{ height: lanes * LANE_PX }}>
            {placed.map(({ item, lane, x }, index) => (
              <li
                className="absolute"
                key={item.subscriptionId}
                style={{ left: x, top: lane * LANE_PX, width: PILL_PX }}
              >
                <Link
                  className="pill-ink flex h-10 items-center gap-2 rounded-full pl-1.5 pr-3 text-(--paper)"
                  data-cursor="OPEN"
                  onKeyDown={(event) => onKeyDown(event, index)}
                  ref={(node) => {
                    pills.current[index] = node;
                  }}
                  to={`/subscriptions/${item.subscriptionId}`}
                >
                  <span
                    aria-hidden="true"
                    className="num grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-white/12 px-1 text-[10px]"
                  >
                    {item.isOverdue ? '!' : `${item.daysUntilRenewal}d`}
                  </span>
                  <span className="min-w-0 truncate text-xs font-bold">{item.serviceName}</span>
                  <span className="sr-only">
                    , {formatCurrency(item.cost, item.currencyCode)},{' '}
                    {item.isOverdue
                      ? 'renewal date passed, payment unconfirmed'
                      : `renews ${dayjs(item.renewalDate).format('D MMM')}, ${relativeDays(item.daysUntilRenewal)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {!placed.length && (
            <p className="py-2 text-sm text-(--graphite)">
              Nothing renews in the next {span} days.
            </p>
          )}
        </div>
      </div>
      {hidden > 0 && (
        <p className="mt-2 text-xs text-(--graphite)">
          {hidden} more {hidden === 1 ? 'renewal' : 'renewals'} beyond this {span}-day view — switch
          to Week or Month.
        </p>
      )}
    </figure>
  );
}
