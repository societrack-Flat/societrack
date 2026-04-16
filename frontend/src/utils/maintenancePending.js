/** Same formula as Maintenance tab “due” per flat. */
export function dueFromFlat(flat) {
  return (
    Number(flat?.monthly_maintenance ?? 0) +
    Number(flat?.pending_maintenance ?? 0) +
    Number(flat?.other_maintenance ?? 0)
  );
}

/**
 * Mirrors `Maintenance.jsx` combined rows for one calendar month:
 * pending total includes DB rows + synthetic pending when no row exists.
 */
export function pendingTotalForMonth(flats, maintenanceRows, month, year) {
  const rowsForMonth = (maintenanceRows || []).filter((m) => m.month === month && m.year === year);
  const existingMap = new Map(rowsForMonth.map((m) => [m.flat_id, m]));
  let sum = 0;
  for (const flat of flats || []) {
    const existing = existingMap.get(flat.id);
    const baseDue = dueFromFlat(flat);
    if (existing) {
      const raw = Number(existing.amount ?? 0);
      const amount =
        existing.status === 'pending' && (raw === 0 || Number.isNaN(raw)) ? baseDue : raw;
      if (existing.status === 'pending') sum += Number(amount || 0);
    } else if (baseDue > 0) {
      sum += baseDue;
    }
  }
  return sum;
}

/**
 * Dashboard “Pending maintenance” card: aligned with Maintenance tab logic.
 * - month / all: current calendar month (same view as Maintenance default).
 * - custom: sum of per-month pending for each month in the selected range.
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
