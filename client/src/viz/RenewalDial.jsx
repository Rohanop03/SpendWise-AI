import { scaleLinear, scaleSqrt } from 'd3-scale';
import { arc } from 'd3-shape';
import dayjs from 'dayjs';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatCurrency } from '../utils/cost.js';
import { relativeDays } from '../utils/dates.js';
import { GlassTip } from './ChartFigure.jsx';

const SIZE = 320;
const CENTER = SIZE / 2;
const TRACK = 108;

/**
 * Renewal dial for the coming window (one month cycle by default). Clockwise from the top
 * = today. Each active/trial renewal is a glass bead placed on its renewal date, sized by
 * its backend monthly equivalent. Beads inside the user's reminder window (and overdue
 * dates) sink into an inset "due" groove. Arrow keys move between beads.
 */
export default function RenewalDial({ items, reminderDays = 7, windowDays = 30 }) {
  const [active, setActive] = useState(null);
  const buttons = useRef([]);
  const beads = useMemo(() => {
    const angle = scaleLinear()
      .domain([0, windowDays])
      .range([0, 2 * Math.PI])
      .clamp(true);
    const values = items.map((item) => Number(item.monthlyEquivalent ?? item.cost) || 0);
    // Sizes compare only within a currency; amounts are never mixed across currencies.
    const maxByCurrency = new Map();
    items.forEach((item, index) => {
      maxByCurrency.set(
        item.currencyCode,
        Math.max(maxByCurrency.get(item.currencyCode) || 1, values[index]),
      );
    });
    const radius = (index) =>
      scaleSqrt()
        .domain([0, maxByCurrency.get(items[index].currencyCode)])
        .range([7, 15])(values[index]);
    // Group beads by day so same-day renewals fan outward instead of overlapping.
    const perDay = new Map();
    return items.map((item, index) => {
      const day = Math.max(0, item.daysUntilRenewal);
      const stack = perDay.get(day) || 0;
      perDay.set(day, stack + 1);
      const due = item.isOverdue || item.daysUntilRenewal <= reminderDays;
      const ring = (due ? TRACK - 30 : TRACK) - stack * 22;
      const theta = angle(day) - Math.PI / 2;
      return {
        due,
        item,
        r: radius(index),
        x: CENTER + ring * Math.cos(theta),
        y: CENTER + ring * Math.sin(theta),
      };
    });
  }, [items, reminderDays, windowDays]);

  const ticks = useMemo(() => {
    const angle = scaleLinear()
      .domain([0, windowDays])
      .range([0, 2 * Math.PI]);
    const majorEvery = windowDays <= 31 ? 7 : windowDays <= 60 ? 14 : 21;
    return Array.from({ length: windowDays }, (_, day) => {
      const theta = angle(day) - Math.PI / 2;
      const major = day % majorEvery === 0;
      const inner = major ? TRACK + 20 : TRACK + 24;
      return {
        day,
        label: major
          ? dayjs()
              .add(day, 'day')
              .format(day === 0 ? '[Today]' : 'D MMM')
          : null,
        lx: CENTER + (TRACK + 38) * Math.cos(theta),
        ly: CENTER + (TRACK + 38) * Math.sin(theta),
        major,
        x1: CENTER + inner * Math.cos(theta),
        x2: CENTER + (TRACK + 28) * Math.cos(theta),
        y1: CENTER + inner * Math.sin(theta),
        y2: CENTER + (TRACK + 28) * Math.sin(theta),
      };
    });
  }, [windowDays]);

  const groove = arc()
    .innerRadius(TRACK - 42)
    .outerRadius(TRACK - 18)
    .startAngle(0)
    .endAngle((Math.min(reminderDays, windowDays) / windowDays) * 2 * Math.PI + 0.12)
    .cornerRadius(12)();

  function onKeyDown(event, index) {
    const keys = { ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = (index + keys[event.key] + beads.length) % beads.length;
    buttons.current[next]?.focus();
  }

  const current = active !== null ? beads[active] : null;
  const dueCount = beads.filter((bead) => bead.due).length;

  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">
        Renewal dial for the next {windowDays} days. {beads.length} renewals, {dueCount} within your{' '}
        {reminderDays}-day reminder window. Use the arrow keys to move between renewals.
      </figcaption>
      <div className="relative mx-auto aspect-square w-full max-w-[22rem]">
        <div aria-hidden="true" className="neu-raised absolute inset-[6%] rounded-full" />
        <div aria-hidden="true" className="neu-pressed absolute inset-[30%] rounded-full" />
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          <circle cx={CENTER} cy={CENTER} fill="none" r={TRACK} stroke="rgb(12 12 14 / 10%)" />
          <circle
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={TRACK - 30}
            stroke="rgb(12 12 14 / 6%)"
            strokeDasharray="2 4"
          />
          <g transform={`translate(${CENTER},${CENTER})`}>
            <path d={groove} fill="rgb(12 12 14 / 9%)" stroke="rgb(12 12 14 / 14%)" />
          </g>
          {ticks.map((tick) => (
            <g key={tick.day}>
              <line
                stroke={tick.major ? '#0B0B0D' : 'rgb(12 12 14 / 22%)'}
                strokeLinecap="round"
                strokeWidth={tick.major ? 1.4 : 1}
                x1={tick.x1}
                x2={tick.x2}
                y1={tick.y1}
                y2={tick.y2}
              />
              {tick.label && (
                <text
                  className="fill-(--graphite) font-mono text-[9px]"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  x={tick.lx}
                  y={tick.ly}
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {beads.map((bead, index) => {
          const { item } = bead;
          const label = `${item.serviceName}, ${formatCurrency(item.cost, item.currencyCode)}, ${
            item.isOverdue
              ? `renewal date passed ${Math.abs(item.daysUntilRenewal)} days ago`
              : `renews ${dayjs(item.renewalDate).format('D MMM')} (${relativeDays(item.daysUntilRenewal)})`
          }${bead.due ? ', inside your reminder window' : ''}`;
          return (
            <Link
              aria-label={label}
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-transform hover:scale-110 focus-visible:scale-110 ${
                bead.due ? 'pill-ink' : 'bead'
              }`}
              data-cursor="OPEN"
              key={item.subscriptionId}
              onBlur={() => setActive(null)}
              onFocus={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              style={{
                height: `${(bead.r * 2 * 100) / SIZE}%`,
                left: `${(bead.x * 100) / SIZE}%`,
                minHeight: 24,
                minWidth: 24,
                top: `${(bead.y * 100) / SIZE}%`,
                width: `${(bead.r * 2 * 100) / SIZE}%`,
              }}
              to={`/subscriptions/${item.subscriptionId}`}
            />
          );
        })}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[30%] grid place-items-center text-center"
        >
          {current ? (
            <div className="px-2">
              <p className="truncate text-sm font-bold">{current.item.serviceName}</p>
              <p className="num mt-1 text-xs">
                {formatCurrency(current.item.cost, current.item.currencyCode)}
              </p>
            </div>
          ) : (
            <div>
              <p className="display-num text-5xl">{beads.length}</p>
              <p className="eyebrow mt-1 !text-[0.6rem]">renewals · {windowDays}d</p>
            </div>
          )}
        </div>

        {current && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2"
            style={{
              left: `${Math.min(80, Math.max(20, (current.x * 100) / SIZE))}%`,
              top: `calc(${(current.y * 100) / SIZE}% + 20px)`,
            }}
          >
            <GlassTip title={current.item.serviceName}>
              <p className="num">{formatCurrency(current.item.cost, current.item.currencyCode)}</p>
              <p className="mt-1">
                {current.item.isOverdue
                  ? 'Date passed — payment unconfirmed'
                  : `${dayjs(current.item.renewalDate).format('ddd D MMM')} · ${relativeDays(current.item.daysUntilRenewal)}`}
              </p>
            </GlassTip>
          </div>
        )}
      </div>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-(--graphite)">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="pill-ink size-3 rounded-full" />
          In reminder window ({reminderDays} days) or overdue
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bead size-3 rounded-full" />
          Later this cycle
        </li>
        <li>Bead size = monthly cost within its currency</li>
      </ul>
    </figure>
  );
}
