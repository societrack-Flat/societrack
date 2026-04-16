import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * Bell badge: unread support messages for admin (per apartment) or superadmin (platform-wide).
 */
export function useSupportUnread() {
  const { userProfile, apartment, saManagedApartmentId } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const role = userProfile?.role;
    if (!userProfile?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      if (role === 'super_admin') {
        if (saManagedApartmentId) {
          const { data, error } = await supabase.rpc('support_unread_count_admin', {
            p_apartment_id: saManagedApartmentId,
          });
          if (error) throw error;
          setUnreadCount(Number(data) || 0);
          return;
        }
        const { data, error } = await supabase.rpc('support_unread_count_superadmin');
        if (error) throw error;
        setUnreadCount(Number(data) || 0);
        return;
      }

      if (role === 'admin' && apartment?.id) {
        const { data, error } = await supabase.rpc('support_unread_count_admin', {
          p_apartment_id: apartment.id,
        });
        if (error) throw error;
        setUnreadCount(Number(data) || 0);
        return;
      }

      setUnreadCount(0);
    } catch (e) {
      console.warn('[useSupportUnread]', e);
      setUnreadCount(0);
    }
  }, [userProfile?.id, userProfile?.role, apartment?.id, saManagedApartmentId]);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 12000);
    const onRefresh = () => fetchCount();
    window.addEventListener('support-inbox-changed', onRefresh);
    return () => {
      clearInterval(id);
      window.removeEventListener('support-inbox-changed', onRefresh);
    };
  }, [fetchCount]);

  return { unreadCount, refreshUnread: fetchCount };
}
