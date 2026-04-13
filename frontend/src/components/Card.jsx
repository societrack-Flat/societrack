import React from 'react';

const Card = ({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'blue',
  trend,
  trendValue,
  onClick,
  className = '',
  children,
}) => {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   border: 'border-blue-100' },
    green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  border: 'border-green-100' },
    red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',      border: 'border-red-100' },
    yellow: { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600',  border: 'border-amber-100' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', border: 'border-orange-100' },
    gray:   { bg: 'bg-slate-50',  icon: 'bg-slate-100 text-slate-600',  border: 'border-slate-100' },
  };

  const c = colors[color] || colors.blue;

  if (children) {
    return (
      <div
        className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border ${c.border} p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {subValue && <p className="mt-1 text-xs text-gray-400">{subValue}</p>}
          {trend && (
            <div className={`mt-2 flex items-center text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${c.icon}`}>
            <Icon size={22} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
