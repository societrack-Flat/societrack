import React from 'react';
import { Calendar } from 'lucide-react';
import { MONTH_LABELS } from '../../lib/superadminMetrics';

const SuperAdminPeriodFilter = ({ years, selectedYear, onYearChange, selectedMonth, onMonthChange }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Period</span>
      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="appearance-none bg-white border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by year"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <select
        value={selectedMonth}
        onChange={(e) => onMonthChange(e.target.value)}
        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Filter by month"
      >
        <option value="all">All Months</option>
        {MONTH_LABELS.map((label, index) => (
          <option key={label} value={String(index)}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SuperAdminPeriodFilter;
