import { supabase } from './supabaseClient';

/**
 * Apartments owned by admin (`created_by`) plus legacy rows linked only via
 * `users.apartment_id` (missing or null `created_by`), merged and deduped.
 */
export async function fetchAdminApartmentsList(userId, activeApartmentId, excludeApartmentId = null) {
  console.log('[fetchAdminApartmentsList] called with:', { userId, activeApartmentId, excludeApartmentId });
  
  // Build the base query
  let query = supabase
    .from('apartments')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });

  // Add exclude filter if provided
  if (excludeApartmentId) {
    console.log('[fetchAdminApartmentsList] adding exclude filter for:', excludeApartmentId);
    query = query.neq('id', excludeApartmentId);
  }

  const { data: byOwner, error: errOwner } = await query;
  console.log('[fetchAdminApartmentsList] byOwner result:', byOwner?.length || 0, 'items');
  
  if (errOwner) throw errOwner;

  const map = new Map((byOwner || []).map((a) => [a.id, a]));

  // Handle active apartment if it's not in the list and not excluded
  if (activeApartmentId && !map.has(activeApartmentId) && activeApartmentId !== excludeApartmentId) {
    console.log('[fetchAdminApartmentsList] fetching active apartment:', activeApartmentId);
    let activeQuery = supabase
      .from('apartments')
      .select('*')
      .eq('id', activeApartmentId);
    
    // Also exclude the deleted apartment from active query
    if (excludeApartmentId) {
      activeQuery = activeQuery.neq('id', excludeApartmentId);
    }
    
    const { data: extra, error: errExtra } = await activeQuery.maybeSingle();
    if (!errExtra && extra) {
      console.log('[fetchAdminApartmentsList] adding active apartment:', extra.id);
      map.set(extra.id, extra);
    }
  } else if (activeApartmentId && activeApartmentId === excludeApartmentId) {
    console.log('[fetchAdminApartmentsList] active apartment is the excluded one, skipping');
  }

  const result = Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  
  console.log('[fetchAdminApartmentsList] final result:', result.length, 'items');
  console.log('[fetchAdminApartmentsList] result IDs:', result.map(a => a.id));
  return result;
}
