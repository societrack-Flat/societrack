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
