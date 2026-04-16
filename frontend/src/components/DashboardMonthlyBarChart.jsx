import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../lib/supabaseClient';

const W = 560;
const H = 220;
const PAD_L = 44;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 34;

const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short' });
};

/**
 * Grouped bar chart: income (green) + expenses (red) per month.
 * Includes horizontal + vertical grid lines — this is what the client meant by “lines” on the bar chart.
 */
export default function DashboardMonthlyBarChart({
  items = [],
  incomeColor = '#22c55e',
  expenseColor = '#ef4444',
}) {
  const { maxValue, bars, yBase } = useMemo(() => {
    const max = items.reduce((m, it) => Math.max(m, Number(it.income || 0), Number(it.expense || 0)), 0) || 1;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const n = items.length;
    const gap = n > 0 ? Math.min(10, innerW / (n * 5)) : 0;
    const groupW = n > 0 ? (innerW - gap * (n - 1)) / n : 0;
    const barW = Math.max(5, (groupW - 6) / 2);
    const base = PAD_T + innerH;

    const list = items.map((it, i) => {
      const x0 = PAD_L + i * (groupW + gap);
      const inc = Number(it.income || 0);
      const exp = Number(it.expense || 0);
      const hInc = innerH * (inc / max);
      const hExp = innerH * (exp / max);
      return {
        ym: it.month,
        xInc: x0,
        xExp: x0 + barW + 4,
        hInc,
        hExp,
        w: barW,
        inc,
        exp,
        cx: x0 + groupW / 2,
      };
    });

    return { maxValue: max, bars: list, yBase: base };
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/90 p-4 min-h-[200px] flex items-center justify-center text-sm text-gray-400">
        No data for selected period
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Monthly Income vs Expenses</h3>
          <p className="text-xs text-gray-500">Bar chart with grid lines — green = income, red = expenses</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: incomeColor }} />
            Income
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: expenseColor }} />
            Expenses
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly income and expenses bar chart">
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + (H - PAD_T - PAD_B) * (1 - t);
          return (
            <line
              key={`h-${t}`}
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          );
        })}

        {/* Vertical grid lines at each month */}
        {bars.map((b, i) => (
          <line
            key={`v-${b.ym}-${i}`}
            x1={b.cx}
            y1={PAD_T}
            x2={b.cx}
            y2={yBase}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
        ))}

        {/* Bars — animated grow from baseline */}
        {bars.map((b, i) => (
          <g key={`bars-${b.ym}-${i}`}>
            <motion.rect
              x={b.xInc}
              width={b.w}
              rx={2}
              fill={incomeColor}
              initial={{ height: 0, y: yBase }}
              animate={{ height: b.hInc, y: yBase - b.hInc }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 }}
            >
              <title>{`Income ${monthLabel(b.ym)}: ${formatCurrency(b.inc)}`}</title>
            </motion.rect>
            <motion.rect
              x={b.xExp}
              width={b.w}
              rx={2}
              fill={expenseColor}
              initial={{ height: 0, y: yBase }}
              animate={{ height: b.hExp, y: yBase - b.hExp }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 + 0.05 }}
            >
              <title>{`Expenses ${monthLabel(b.ym)}: ${formatCurrency(b.exp)}`}</title>
            </motion.rect>
          </g>
        ))}

        {/* Month labels */}
        {bars.map((b, i) => (
          <text
            key={`lbl-${b.ym}`}
            x={b.cx}
            y={H - 10}
            textAnchor="middle"
            fill="#6b7280"
            style={{ fontSize: '10px' }}
          >
            {monthLabel(b.ym)}
          </text>
        ))}
      </svg>

      <div className="mt-2 text-[11px] text-gray-500">
        <span>Scale max: {formatCurrency(maxValue)}</span>
      </div>
    </div>
  );
}
