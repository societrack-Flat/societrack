import React, { useMemo } from 'react';
import { formatCurrency } from '../lib/supabaseClient';

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#64748b', '#ec4899'];

/** Simple donut for expense category breakdown */
export default function ExpenseDonutChart({ entries = [] }) {
  const { segments, total } = useMemo(() => {
    const list = (entries || []).filter(([, v]) => Number(v) > 0);
    const sum = list.reduce((s, [, v]) => s + Number(v), 0) || 1;
    let angle = -Math.PI / 2;
    const segs = list.map(([name, val], i) => {
      const frac = Number(val) / sum;
      const a0 = angle;
      const a1 = angle + frac * 2 * Math.PI;
      angle = a1;
      return { name, val: Number(val), a0, a1, color: COLORS[i % COLORS.length] };
    });
    return { segments: segs, total: sum };
  }, [entries]);

  const cx = 100;
  const cy = 100;
  const rOuter = 72;
  const rInner = 44;

  const arcPath = (a0, a1) => {
    const x0 = cx + rOuter * Math.cos(a0);
    const y0 = cy + rOuter * Math.sin(a0);
    const x1 = cx + rOuter * Math.cos(a1);
    const y1 = cy + rOuter * Math.sin(a1);
    const xi0 = cx + rInner * Math.cos(a1);
    const yi0 = cy + rInner * Math.sin(a1);
    const xi1 = cx + rInner * Math.cos(a0);
    const yi1 = cy + rInner * Math.sin(a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return [
      `M ${x0} ${y0}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
      `L ${xi0} ${yi0}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ');
  };

  if (segments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/90 p-4 min-h-[200px] flex items-center justify-center text-sm text-gray-400">
        No expense data for this period
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Expense breakdown</h3>
      <p className="text-xs text-gray-500 mb-3">By category (selected period)</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
          {segments.map((s, i) => (
            <path key={`${s.name}-${i}`} d={arcPath(s.a0, s.a1)} fill={s.color} stroke="#fff" strokeWidth="1">
              <title>{`${s.name}: ${formatCurrency(s.val)}`}</title>
            </path>
          ))}
        </svg>
        <ul className="flex-1 space-y-2 text-xs w-full max-h-48 overflow-y-auto">
          {segments.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="truncate text-gray-700">{s.name}</span>
              </span>
              <span className="text-gray-900 font-medium shrink-0">{formatCurrency(s.val)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-2 pt-2 border-t border-gray-100 font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
