import React, { useMemo } from 'react';
import { formatCurrency } from '../lib/supabaseClient';

const monthLabel = (ym) => {
  // ym: YYYY-MM
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short' });
};

export default function MonthlyIncomeExpenseChart({ items = [] }) {
  const { maxValue, bars } = useMemo(() => {
    const max = items.reduce((m, it) => Math.max(m, Number(it.income || 0), Number(it.expense || 0)), 0) || 1;
    const rows = items.map((it) => {
      const income = Number(it.income || 0);
      const expense = Number(it.expense || 0);
      return {
        key: it.month,
        label: monthLabel(it.month),
        income,
        expense,
        incomePct: income / max,
        expensePct: expense / max,
      };
    });
    return { maxValue: max, bars: rows };
  }, [items]);

  const CHART_HEIGHT = 180; // px
  const barHeightPx = (ratio) => Math.max(2, Math.round((ratio || 0) * CHART_HEIGHT));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Monthly Income vs Expenses</h3>
          <p className="text-sm text-gray-500">Comparison by month</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-lime-400" />
            Income
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-red-500" />
            Expenses
          </div>
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No data for selected period</div>
      ) : (
        <>
          <div className="flex items-end gap-3" style={{ height: CHART_HEIGHT }}>
            {bars.map((b) => (
              <div key={b.key} className="flex-1 flex flex-col items-center justify-end gap-2 min-w-0">
                <div className="w-full flex items-end justify-center gap-1.5" style={{ height: CHART_HEIGHT }}>
                  <div
                    className="w-2.5 sm:w-3.5 rounded-t bg-lime-400/95"
                    style={{ height: `${barHeightPx(b.incomePct)}px` }}
                    title={`Income: ${formatCurrency(b.income)}`}
                  />
                  <div
                    className="w-2.5 sm:w-3.5 rounded-t bg-red-500"
                    style={{ height: `${barHeightPx(b.expensePct)}px` }}
                    title={`Expenses: ${formatCurrency(b.expense)}`}
                  />
                </div>
                <div className="text-[11px] text-gray-500 truncate w-full text-center">{b.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-gray-500 flex items-center justify-between">
            <span>Max: {formatCurrency(maxValue)}</span>
            <span className="hidden sm:inline">Hover bars for amounts</span>
          </div>
        </>
      )}
    </div>
  );
}

