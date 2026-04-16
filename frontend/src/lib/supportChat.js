import { supabase } from './supabaseClient';

/** Merge message lists by id, sorted by created_at */
export function mergeMessagesById(existing, incoming) {
  const map = new Map((existing || []).map((m) => [m.id, m]));
  for (const m of incoming || []) {
    if (m?.id) map.set(m.id, m);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function markSupportThreadRead(threadId) {
  if (!threadId) return;
  const { error } = await supabase.rpc('mark_support_thread_read', { p_thread_id: threadId });
  if (error) throw error;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('support-inbox-changed'));
  }
}
