import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Single source of truth for which society/apartment admin data applies to:
 * matches the TopBar selector (AuthContext + users.apartment_id).
 * If the profile has no apartment yet but the user manages multiple, picks the first and persists silently.
 */
export function useAdminActiveApartment() {
  const { apartment, profileLoaded, adminApartments, setActiveApartment } = useAuth();
  const activeApartmentId = apartment?.id ?? '';

  useEffect(() => {
    if (!profileLoaded || apartment?.id || !adminApartments?.length) return;
    setActiveApartment(adminApartments[0].id, { silent: true });
  }, [profileLoaded, apartment?.id, adminApartments, setActiveApartment]);

  return activeApartmentId;
}
