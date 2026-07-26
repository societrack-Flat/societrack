import {
  buildMaintenanceRowView,
  totalOutstanding,
} from './maintenanceDue';

export { dueFromFlat, totalOutstanding } from './maintenanceDue';

/**
 * Mirrors Maintenance tab combined rows for one calendar month.
 */
export function pendingTotalForMonth(flats, maintenanceRows, month, year) {
  const rowsForMonth = (maintenanceRows || []).filter((m) => m.month === month && m.year === year);
  const existingMap = new Map(rowsForMonth.map((m) => [m.flat_id, m]));
  let sum = 0;

  for (const flat of flats || []) {
    const existing = existingMap.get(flat.id);
    const view = buildMaintenanceRowView(flat, existing);
    if (view.status === 'pending') sum += view.total;
  }

  return sum;
}

/**
 * Dashboard “Pending maintenance” card: aligned with Maintenance tab logic.
 */
export function pendingTotalForDashboardPeriod(flats, maintenanceRows, timeRange, customFrom, customTo) {
  const now = new Date();
  const curM = now.getMonth() + 1;
  const curY = now.getFullYear();

  if (timeRange === 'month' || timeRange === 'all') {
    return pendingTotalForMonth(flats, maintenanceRows, curM, curY);
  }

  if (timeRange === 'custom' && customFrom && customTo) {
    let total = 0;
    const start = new Date(`${customFrom.slice(0, 7)}-01`);
    const end = new Date(`${customTo.slice(0, 7)}-01`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return pendingTotalForMonth(flats, maintenanceRows, curM, curY);
    }
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      total += pendingTotalForMonth(flats, maintenanceRows, d.getMonth() + 1, d.getFullYear());
    }
    return total;
  }

  return pendingTotalForMonth(flats, maintenanceRows, curM, curY);
}
