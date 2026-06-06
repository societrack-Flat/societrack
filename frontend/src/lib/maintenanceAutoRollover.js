import { supabase } from './supabaseClient';
import { maintenanceApi } from './apiClient';

function monthIndex(year, month) {
  return year * 12 + month;
}

/**
 * Move unpaid maintenance from months before the selected period into flats.pending_maintenance.
 * Idempotent: after rollover, no rows remain for those months.
 */
export async function autoClosePriorMonths(apartmentId, targetYear, targetMonth) {
  if (!apartmentId) return;

  const target = monthIndex(targetYear, targetMonth);

  const { data, error } = await supabase
    .from('maintenance')
    .select('year, month')
    .eq('apartment_id', apartmentId);

  if (error) throw error;

  const seen = new Set();
  const prior = [];
  for (const row of data || []) {
    const y = Number(row.year);
    const m = Number(row.month);
    if (!y || !m) continue;
    const key = `${y}-${m}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (monthIndex(y, m) < target) {
      prior.push({ year: y, month: m });
    }
  }

  prior.sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month));

  for (const { year, month } of prior) {
    await maintenanceApi.rollover({
      apartment_id: apartmentId,
      close_year: year,
      close_month: month,
    });
  }
}
