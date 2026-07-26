import React from 'react';
import { formatCurrency } from '../../lib/supabaseClient';

const SuperAdminBarChart = ({
  data,
  max,
  valueFormatter = (v) => String(v),
  barClassName = 'bg-blue-500/90',
  highlightClassName = 'bg-blue-700 ring-2 ring-blue-300',
  highlightIndex = null,
  emptyMessage = 'No data for this period',
}) => {
  const values = data.map((d) => Number(d.value) || 0);
  const peak = max || Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);

  if (!data.length) {
    return <p className="text-sm text-gray-500 py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-1 h-52 pt-4 border-b border-gray-200">
        {data.map((d, index) => {
          const value = Number(d.value) || 0;
          const isHighlight = highlightIndex != null && index === highlightIndex;
          return (
            <div key={`${d.label}-${index}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] text-gray-500 tabular-nums h-4">
                {value > 0 ? valueFormatter(value) : ''}
              </span>
              <div
                className={`w-full max-w-[28px] rounded-t mx-auto transition-all ${
                  isHighlight ? highlightClassName : barClassName
                }`}
                style={{ height: `${Math.max(value > 0 ? 8 : 4, (value / peak) * 100)}%` }}
                title={`${d.label}: ${valueFormatter(value)}`}
              />
              <span
                className={`text-[10px] truncate w-full text-center ${
                  isHighlight ? 'text-blue-700 font-semibold' : 'text-gray-500'
                }`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        <span>
          Period total: <span className="font-semibold text-gray-900 tabular-nums">{valueFormatter(total)}</span>
        </span>
      </div>
    </div>
  );
};

export function SuperAdminRevenueBarChart(props) {
  return <SuperAdminBarChart {...props} valueFormatter={(v) => formatCurrency(v)} barClassName="bg-blue-500/90" highlightClassName="bg-blue-700 ring-2 ring-blue-300" />;
}

export function SuperAdminGrowthBarChart(props) {
  return <SuperAdminBarChart {...props} valueFormatter={(v) => String(v)} barClassName="bg-indigo-500/90" highlightClassName="bg-indigo-700 ring-2 ring-indigo-300" />;
}

export default SuperAdminBarChart;
