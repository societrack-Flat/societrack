import { supabase } from './supabaseClient';

/**
 * When recording flat-wise Maintenance income, upsert `maintenance` for that flat/month/year
 * (same as bulk collection) so Maintenance tab + dashboard stats stay in sync.
 */
export async function upsertMaintenanceFromIncomeReceipt({
  apartmentId,
  flatId,
  maintenanceYear,
  maintenanceMonth,
  amount,
  paymentDate,
  paymentMode,
}) {
  if (!apartmentId || !flatId) return;
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return;

  const monthNum = Number(maintenanceMonth);
  const yearNum = Number(maintenanceYear);
  if (!monthNum || !yearNum) return;

  const maintenancePayload = {
    apartment_id: apartmentId,
    flat_id: flatId,
    month: monthNum,
    year: yearNum,
    amount: amt,
    paid_amount: amt,
    status: 'paid',
    paid_date: paymentDate,
    payment_mode: paymentMode || 'cash',
  };

  const { data: existing, error: findErr } = await supabase
    .from('maintenance')
    .select('id')
    .eq('apartment_id', apartmentId)
    .eq('flat_id', flatId)
    .eq('month', monthNum)
    .eq('year', yearNum)
    .maybeSingle();

  if (findErr) throw findErr;

  if (existing?.id) {
    const { error } = await supabase.from('maintenance').update(maintenancePayload).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('maintenance').insert(maintenancePayload);
    if (error) throw error;
  }
}
