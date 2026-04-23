import { supabase } from './supabaseClient';
import { upsertMaintenanceFromIncomeReceipt } from './upsertMaintenanceFromIncome';

/**
 * After inserting a Maintenance income row, apply to either the selected month (maintenance table) or old balance on the flat.
 */
export async function applyMaintenanceIncomeAfterInsert({
  apartmentId,
  flatId,
  amount,
  target,
  maintenanceYear,
  maintenanceMonth,
  paymentDate,
  paymentMode,
}) {
  const amt = Number(amount);
  if (!apartmentId || !flatId || !Number.isFinite(amt) || amt <= 0) return;
  if (target !== 'arrears' && target !== 'current') return;

  if (target === 'arrears') {
    const { data: flat, error } = await supabase.from('flats').select('pending_maintenance').eq('id', flatId).maybeSingle();
    if (error) throw error;
    const p = Math.max(0, Number(flat?.pending_maintenance ?? 0));
    const pay = Math.min(amt, p);
    if (pay > 0) {
      const { error: u } = await supabase
        .from('flats')
        .update({ pending_maintenance: Math.round((p - pay) * 100) / 100 })
        .eq('id', flatId);
      if (u) throw u;
    }
    if (amt > p + 0.0001) {
      // Surplus: keep cash recorded; optionally would apply to current month in a future version
    }
    return;
  }

  const y = Number(maintenanceYear);
  const m = Number(maintenanceMonth);
  if (!y || !m) {
    const err = new Error('Maintenance month is required for current-month payment');
    err.code = 'NEED_MONTH';
    throw err;
  }

  await upsertMaintenanceFromIncomeReceipt({
    apartmentId,
    flatId,
    maintenanceYear: y,
    maintenanceMonth: m,
    amount: amt,
    paymentDate,
    paymentMode,
  });
}
