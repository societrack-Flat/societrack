import React, { useMemo } from 'react';
import { formatCurrency } from '../lib/supabaseClient';

const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short' });
};

const W = 560;
const H = 200;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;

export default function MonthlyIncomeExpenseChart({ items = [] }) {
  const { maxValue, lines, points } = useMemo(() => {
    const max = items.reduce((m, it) => Math.max(m, Number(it.income || 0), Number(it.expense || 0)), 0) || 1;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const n = items.length;
    const xAt = (i) => (n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1));

    const toPoints = (key) =>
      items.map((it, i) => {
        const v = Number(it[key] || 0);
        const ratio = v / max;
        const x = xAt(i);
        const y = PAD_T + innerH * (1 - ratio);
        return { x, y, v, month: it.month };
      });

    const incomePts = toPoints('income');
    const expensePts = toPoints('expense');

    const linePath = (pts) =>
      pts.length === 0 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    return {
      maxValue: max,
      lines: {
        incomeD: linePath(incomePts),
        expenseD: linePath(expensePts),
      },
      points: { incomePts, expensePts },
    };
  }, [items]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200/90 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Monthly trend</h3>
          <p className="text-xs text-gray-500">Line chart — income vs expenses</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 rounded bg-lime-500" />
            Income
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 rounded bg-rose-500" />
            Expenses
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">No data for selected period</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly income and expenses">
            {/* Horizontal grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = PAD_T + (H - PAD_T - PAD_B) * (1 - t);
              return (
                <line
                  key={t}
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}
            {/* Vertical grid at each month */}
            {items.map((it, i) => {
              const n = items.length;
              const innerW = W - PAD_L - PAD_R;
              const x = n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1);
              return (
                <line
                  key={`vgrid-${it.month}`}
                  x1={x}
                  y1={PAD_T}
                  x2={x}
                  y2={H - PAD_B}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
              );
            })}
            <path
              d={lines.incomeD}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={lines.expenseD}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.incomePts.map((p, i) => (
              <circle key={`i-${p.month}-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#22c55e" strokeWidth="2">
                <title>{`Income ${monthLabel(p.month)}: ${formatCurrency(p.v)}`}</title>
              </circle>
            ))}
            {points.expensePts.map((p, i) => (
              <circle key={`e-${p.month}-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#f43f5e" strokeWidth="2">
                <title>{`Expenses ${monthLabel(p.month)}: ${formatCurrency(p.v)}`}</title>
              </circle>
            ))}
            {items.map((it, i) => {
              const n = items.length;
              const innerW = W - PAD_L - PAD_R;
              const x = n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1);
              return (
                <text
                  key={it.month}
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  fill="#6b7280"
                  style={{ fontSize: '10px' }}
                >
                  {monthLabel(it.month)}
                </text>
              );
            })}
          </svg>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Peak: {formatCurrency(maxValue)}</span>
            <span className="hidden sm:inline">Dots show monthly values</span>
          </div>
        </>
      )}
    </div>
  );
}
