import { supabase } from './supabaseClient';
import { maintenanceApi } from './apiClient';
import { priorMonthsNeedingClose } from '../utils/maintenanceDue';

const closeInFlight = new Map();

function closeKey(apartmentId, year, month) {
  return `${apartmentId}:${year}-${month}`;
}

async function runRolloverOnce(apartmentId, year, month) {
  const key = closeKey(apartmentId, year, month);
  if (closeInFlight.has(key)) {
    await closeInFlight.get(key);
    return;
  }

  const job = maintenanceApi
    .rollover({
      apartment_id: apartmentId,
      close_year: year,
      close_month: month,
    })
    .finally(() => {
      closeInFlight.delete(key);
    });

  closeInFlight.set(key, job);
  await job;
}

/**
 * Close every prior month (before the selected period) that is not yet recorded as closed.
 * Uses apartment created date + maintenance history — not a hardcoded single month.
 */
export async function autoClosePriorMonths(apartmentId, targetYear, targetMonth) {
  if (!apartmentId) return;

  const [
    { data: maintenanceMonths, error: maintErr },
    { data: closedMonths, error: closedErr },
    { data: apartment, error: aptErr },
  ] = await Promise.all([
    supabase.from('maintenance').select('year, month').eq('apartment_id', apartmentId),
    supabase.from('maintenance_month_closures').select('close_year, close_month').eq('apartment_id', apartmentId),
    supabase.from('apartments').select('created_at').eq('id', apartmentId).maybeSingle(),
  ]);

  if (maintErr) throw maintErr;
  if (aptErr) throw aptErr;
  if (closedErr && closedErr.code !== '42P01') throw closedErr;

  const monthsToClose = priorMonthsNeedingClose({
    targetYear,
    targetMonth,
    maintenanceMonths,
    closedMonths,
    apartmentCreatedAt: apartment?.created_at,
  });

  for (const { year, month } of monthsToClose) {
    await runRolloverOnce(apartmentId, year, month);
  }
}
