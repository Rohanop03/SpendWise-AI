import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import Segmented from '../ui/Segmented.jsx';
import { formatCompactCurrency, formatMonth, toChartNumber } from '../utils/chartFormatters.js';
import { formatCurrency } from '../utils/cost.js';
import ChartFigure, { GlassTip } from './ChartFigure.jsx';
import { rollUpYearly } from './rollup.js';

function periodLabel(period) {
  return /^\d{4}$/.test(period) ? period : formatMonth(period);
}

function CashTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <GlassTip title={periodLabel(row.period)}>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
        <dt>Gross</dt>
        <dd className="num text-right">{formatCurrency(row.grossPayments, row.currencyCode)}</dd>
        <dt>Refunds</dt>
        <dd className="num text-right">{formatCurrency(row.completedRefunds, row.currencyCode)}</dd>
        <dt className="font-bold">Net</dt>
        <dd className="num text-right font-bold">
          {formatCurrency(row.netCashFlow, row.currencyCode)}
        </dd>
      </dl>
    </GlassTip>
  );
}

/**
 * Hairline area chart of realised cash flow for one currency: gross as a soft area, net
 * as the ink line, refunds as a thin grey line. Month/Year toggle rolls up client-side.
 */
export default function CashFlowChart({ currency, rows, withTable = true }) {
  const [interval, setGranularity] = useState('month');
  const data = useMemo(() => {
    const source = interval === 'year' ? rollUpYearly(rows) : rows;
    return source.map((row) => ({
      ...row,
      grossValue: toChartNumber(row.grossPayments),
      netValue: toChartNumber(row.netCashFlow),
      refundValue: toChartNumber(row.completedRefunds),
    }));
  }, [interval, rows]);
  const narrow = data.length > 8;

  return (
    <ChartFigure
      caption={`${currency} · completed payments and completed refunds by ${interval === 'year' ? 'year' : 'month'}`}
      table={
        withTable && (
          <table className="data-table">
            <caption className="sr-only">{currency} cash flow by period</caption>
            <thead>
              <tr>
                <th scope="col">{interval === 'year' ? 'Year' : 'Month'}</th>
                <th className="!text-right" scope="col">
                  Gross
                </th>
                <th className="!text-right" scope="col">
                  Refunds
                </th>
                <th className="!text-right" scope="col">
                  Net
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.period}>
                  <th className="text-left font-bold" scope="row">
                    {periodLabel(row.period)}
                  </th>
                  <td className="num text-right">{formatCurrency(row.grossPayments, currency)}</td>
                  <td className="num text-right">
                    {formatCurrency(row.completedRefunds, currency)}
                  </td>
                  <td className="num text-right">{formatCurrency(row.netCashFlow, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
      toolbar={
        <Segmented
          label={`${currency} cash flow interval`}
          labelHidden
          onChange={setGranularity}
          options={[
            { label: 'Month', value: 'month' },
            { label: 'Year', value: 'year' },
          ]}
          size="sm"
          value={interval}
        />
      }
    >
      <div aria-hidden="true" className="chart-root h-64 w-full min-w-0 sm:h-72">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            accessibilityLayer={false}
            data={data}
            // Room on the right so the last period label is not clipped.
            margin={{ bottom: 0, left: 0, right: 24, top: 8 }}
          >
            <defs>
              <linearGradient id={`gross-fill-${currency}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0B0B0D" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#0B0B0D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgb(12 12 14 / 7%)" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="period"
              interval={narrow ? 'preserveStartEnd' : 0}
              minTickGap={18}
              tickFormatter={periodLabel}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickCount={4}
              tickFormatter={(value) => formatCompactCurrency(value, currency)}
              tickLine={false}
              width={64}
            />
            <Tooltip
              content={<CashTip />}
              cursor={{ stroke: '#0B0B0D', strokeOpacity: 0.25, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              activeDot={{ fill: '#FCFCFD', r: 4, stroke: '#0B0B0D', strokeWidth: 1.25 }}
              animationDuration={400}
              dataKey="grossValue"
              dot={false}
              fill={`url(#gross-fill-${currency})`}
              name="Gross payments"
              stroke="#46464D"
              strokeWidth={1.25}
              type="monotone"
            />
            <Line
              animationDuration={400}
              dataKey="refundValue"
              dot={false}
              name="Completed refunds"
              stroke="#9A9AA3"
              strokeDasharray="4 3"
              strokeWidth={1.25}
              type="monotone"
            />
            <Line
              activeDot={{ fill: '#0B0B0D', r: 4, stroke: '#FCFCFD', strokeWidth: 2 }}
              animationDuration={400}
              dataKey="netValue"
              dot={{ fill: '#0B0B0D', r: 2, strokeWidth: 0 }}
              name="Net cash flow"
              stroke="#0B0B0D"
              strokeWidth={1.5}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-(--graphite)">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 rounded bg-(--ink)" />
          Net cash flow
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-5 rounded-sm border-t-[1.5px] border-(--graphite) bg-black/10"
          />
          Gross payments
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="w-5 border-t-[1.5px] border-dashed border-(--chrome-3)"
          />
          Completed refunds
        </li>
      </ul>
    </ChartFigure>
  );
}
