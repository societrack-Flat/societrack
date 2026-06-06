import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../lib/supabaseClient';
import { isNativeApp } from '../lib/nativeApp';

const W = 560;
const H = 220;
const PAD_L = 56;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 34;

const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short' });
};

/** Round max up so Y-axis ticks are readable (1 / 2 / 2.5 / 5 × 10^n). */
function niceCeilMax(raw) {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const frac = raw / base;
  let nice = 10;
  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}

function formatAxisInr(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: n >= 100000 ? 'compact' : 'standard',
  }).format(n);
}

/**
 * Grouped bar chart: income (green) + expenses (red) per month.
 * Includes horizontal + vertical grid lines — this is what the client meant by “lines” on the bar chart.
 */
export default function DashboardMonthlyBarChart({
  items = [],
  incomeColor = '#22c55e',
  expenseColor = '#ef4444',
  /** Match dashboard chat column height (flex parent should set lg:h-[420px]) */
  fillHeight = false,
}) {
  const useStaticBars = isNativeApp();

  const { maxValue, bars, yBase } = useMemo(() => {
    const rawMax = items.reduce((m, it) => Math.max(m, Number(it.income || 0), Number(it.expense || 0)), 0) || 0;
    const max = niceCeilMax(rawMax);
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
      const hInc = max > 0 ? innerH * (inc / max) : 0;
      const hExp = max > 0 ? innerH * (exp / max) : 0;
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

  const cardShell = fillHeight
    ? 'bg-white rounded-xl border border-gray-200/90 p-4 shadow-sm flex flex-col h-full min-h-0 overflow-hidden'
    : 'bg-white rounded-xl border border-gray-200/90 p-4 shadow-sm';

  if (items.length === 0) {
    return (
      <div
        className={`${cardShell} flex text-sm text-gray-400 ${
          fillHeight ? 'flex-1 min-h-[240px] items-center justify-center' : 'min-h-[200px] items-center justify-center'
        }`}
      >
        No data for selected period
      </div>
    );
  }

  return (
    <div className={cardShell}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 shrink-0">
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

      {/* fillHeight: chart flex-1 fills space between header and footer; footer at bottom — no white band below Y-axis line */}
      <div
        className={
          fillHeight ? 'flex-1 min-h-0 w-full relative flex flex-col' : 'flex flex-col'
        }
      >
        <div className={fillHeight && !useStaticBars ? 'flex-1 min-h-0 w-full relative' : 'w-full'}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className={`w-full block ${fillHeight && !useStaticBars ? 'absolute inset-0 h-full max-h-none' : 'h-auto min-h-[200px]'}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Monthly income and expenses bar chart"
          >
        {/* Horizontal grid lines + Y-axis amount labels (dynamic from maxValue) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + (H - PAD_T - PAD_B) * (1 - t);
          const tickAmt = maxValue * t;
          return (
            <g key={`h-${t}`}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={y + 4}
                textAnchor="end"
                fill="#6b7280"
                style={{ fontSize: '9px' }}
              >
                {formatAxisInr(tickAmt)}
              </text>
            </g>
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

        {/* Bars — static on Android WebView (framer-motion SVG rects often fail to render) */}
        {bars.map((b, i) => (
          <g key={`bars-${b.ym}-${i}`}>
            {useStaticBars ? (
              <>
                <rect
                  x={b.xInc}
                  y={yBase - b.hInc}
                  width={b.w}
                  height={b.hInc}
                  rx={2}
                  fill={incomeColor}
                >
                  <title>{`Income ${monthLabel(b.ym)}: ${formatCurrency(b.inc)}`}</title>
                </rect>
                <rect
                  x={b.xExp}
                  y={yBase - b.hExp}
                  width={b.w}
                  height={b.hExp}
                  rx={2}
                  fill={expenseColor}
                >
                  <title>{`Expenses ${monthLabel(b.ym)}: ${formatCurrency(b.exp)}`}</title>
                </rect>
              </>
            ) : (
              <>
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
              </>
            )}
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
        </div>

        <div className={`text-[11px] text-gray-500 shrink-0 ${fillHeight ? 'mt-2 pt-0' : 'mt-2'}`}>
          <span>
            Y-axis: 0 – {formatCurrency(maxValue)} (scales with data)
          </span>
        </div>
      </div>
    </div>
  );
}
