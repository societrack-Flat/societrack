/** January–December for maintenance period (value 1–12). */
export const CALENDAR_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString('en-IN', { month: 'long' }),
}));

/** Years around current (for maintenance year select). */
export function getMaintenanceYearOptions() {
  const y = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => {
    const year = y - 2 + i;
    return { value: String(year), label: String(year) };
  });
}

/**
 * YYYY-MM options for maintenance month selects: past 24 months through next 6.
 */
export function getMaintenanceMonthOptions() {
  const now = new Date();
  const out = [];
  for (let i = -24; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    out.push({ value: ym, label });
  }
  return out;
}
