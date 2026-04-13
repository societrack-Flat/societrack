import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase, getPublicSiteUrl } from '../lib/supabaseClient';
// Temporarily disable API imports to test
// import { authApi, apartmentApi } from '../lib/apiClient';

const AuthContext = createContext(null);
const PROFILE_CACHE_KEY = 'societrack_profile_cache_v1';
const APARTMENT_CACHE_KEY = 'societrack_apartment_cache_v1';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [apartment, setApartment] = useState(null);
  const [adminApartments, setAdminApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isResident, setIsResident] = useState(false);
  const [residentApartmentId, setResidentApartmentId] = useState(null);
  const [residentFlatId, setResidentFlatId] = useState(null);
  const [residentFlatNumber, setResidentFlatNumber] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  /** Set when profile bootstrap fails or times out (works without localStorage / incognito). */
  const [bootstrapError, setBootstrapError] = useState(null);

  // Tracks the user id already loaded so onAuthStateChange SIGNED_IN events
  // for the same user (token refresh, URL hash processing) don't re-trigger
  // a full profile reload and flash the loading screen.
  const loadedUserIdRef = useRef(null);
  /** Prevents concurrent loadUserProfile(userId) for the same user (initAuth + SIGNED_IN race). */
  const profileLoadLockRef = useRef(null);

  const readCachedProfile = (userId) => {
    try {
      const rawProfile = localStorage.getItem(PROFILE_CACHE_KEY);
      const rawApt = localStorage.getItem(APARTMENT_CACHE_KEY);
      const cachedProfile = rawProfile ? JSON.parse(rawProfile) : null;
      const cachedApt = rawApt ? JSON.parse(rawApt) : null;
      if (cachedProfile?.id === userId) {
        return { profile: cachedProfile, apartment: cachedApt || null };
      }
    } catch {
      // ignore cache parse issues
    }
    return { profile: null, apartment: null };
  };

  const writeCachedProfile = (profile, apt) => {
    try {
      if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      if (apt !== undefined) localStorage.setItem(APARTMENT_CACHE_KEY, JSON.stringify(apt));
    } catch {
      // ignore quota/serialization errors
    }
  };

  const clearCachedApartmentList = () => {
    try {
      localStorage.removeItem('societrack_admin_apartments_cache');
    } catch {
      // ignore cache errors
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      let authUserId = null;
      try {
        console.log('[AuthContext] initAuth starting...');
        
        // Supabase session first (persisted JWT). If we checked `resident_session` before
        // this, a stale viewer login would skip getSession() entirely and admins would look
        // "logged out" on every refresh even though their token is still valid.
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AuthContext] getSession result:', { hasSession: !!session, userId: session?.user?.id });
        
        if (session?.user && isMounted) {
          try {
            if (localStorage.getItem('resident_session')) {
              localStorage.removeItem('resident_session');
            }
          } catch {
            /* ignore */
          }
          setIsResident(false);
          authUserId = session.user.id;
          setUser(session.user);
          console.log('[AuthContext] user set:', session.user.id);
          
          // Immediately hydrate UI from cache to avoid blank/infinite loading on hard reloads.
          const cached = readCachedProfile(authUserId);
          if (cached.profile) {
            console.log('[AuthContext] using cached profile:', cached.profile);
            setUserProfile(cached.profile);
            setApartment(cached.apartment);
            setIsSuperAdmin(cached.profile.role === 'super_admin');
            setProfileLoaded(true);
            loadedUserIdRef.current = authUserId;
          }

          // Hard cap for first load (incognito has no cache): never spin forever if Supabase hangs.
          const BOOTSTRAP_MS = 20000;
          const profilePromise = loadUserProfile(authUserId)
            .then(() => 'ok')
            .catch(() => 'fail');
          const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve('timeout'), BOOTSTRAP_MS);
          });
          const outcome = await Promise.race([profilePromise, timeoutPromise]);
          console.log('[AuthContext] profile load outcome:', outcome);
          
          if (outcome === 'timeout' && isMounted) {
            // Try to use cached data if available before showing error
            const cached = readCachedProfile(authUserId);
            if (cached.profile) {
              setBootstrapError({
                kind: 'timeout',
                message: 'Slow connection detected. Using cached data. Some features may be limited.',
              });
            } else {
              setBootstrapError({
                kind: 'timeout',
                message: 'Could not load your account in time. Check your internet connection or Supabase project status.',
              });
            }
            setProfileLoaded(true);
          }
          loadedUserIdRef.current = authUserId;
        } else {
          console.log('[AuthContext] no session found, checking resident session...');
          const residentSession = localStorage.getItem('resident_session');
          const superadminSession = localStorage.getItem('superadmin_session');
          
          if (superadminSession) {
            console.log('[AuthContext] superadmin session found');
            const superadminUser = JSON.parse(localStorage.getItem('superadmin_user') || '{}');
            setUser(superadminUser);
            setUserProfile({
              id: 'superadmin',
              email: 'superadmin@societrack.com',
              role: 'super_admin',
              name: 'Super Admin'
            });
            setIsSuperAdmin(true);
            setProfileLoaded(true);
            setLoading(false);
            return;
          }
          
          if (residentSession) {
            console.log('[AuthContext] resident session found');
            const parsed = JSON.parse(residentSession);

            if (isMounted) {
              console.log('[AuthContext] setting resident session');
              setIsResident(true);
              setResidentApartmentId(parsed.apartment_id);
              setResidentFlatId(null); // Common login
              setResidentFlatNumber(null); // Common login
              setApartment({ id: parsed.apartment_id, name: parsed.apartment_name });
              setProfileLoaded(true);
              setLoading(false);
              return;
            }
          }
          
          if (isMounted) {
            console.log('[AuthContext] no session found, setting loading false');
            setLoading(false);
            setProfileLoaded(true);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Auth init error:', error);
        if (isMounted && authUserId) {
          const cached = readCachedProfile(authUserId);
          if (cached.profile) {
            setUserProfile(cached.profile);
            setApartment(cached.apartment);
            setProfileLoaded(true);
            loadedUserIdRef.current = authUserId;
          }
        }
      } finally {
        console.log('[AuthContext] initAuth completed, setting loading false');
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        // If this is the same user already loaded (e.g. token refresh, URL hash processing,
        // or duplicate SIGNED_IN after initAuth), skip the reload to avoid blanking the page.
        if (loadedUserIdRef.current === session.user.id) {
          setLoading(false);
          return;
        }

        setUser(session.user);
        await loadUserProfile(session.user.id);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Just update the user object silently — no profile reload needed
        setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        loadedUserIdRef.current = null;
        profileLoadLockRef.current = null;
        setUser(null);
        setUserProfile(null);
        setApartment(null);
        setBootstrapError(null);
        setProfileLoaded(true);
        setLoading(false);
      }
    });

    // Safety timeout — only clears the global loading flag.
    const timeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 8000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const loadUserProfile = async (userId) => {
    console.log('[loadUserProfile] called with:', userId);

    profileLoadLockRef.current = userId;

    const previousLoadedId = loadedUserIdRef.current;
    loadedUserIdRef.current = userId;

    try {
      setBootstrapError(null);

      if (previousLoadedId !== userId) {
        const snap = readCachedProfile(userId);
        if (!snap.profile) {
          console.log('[loadUserProfile] setting profileLoaded to false (no cache)');
          setProfileLoaded(false);
        } else {
          console.log('[loadUserProfile] using cache first, skipping DB query');
          setUserProfile(snap.profile);
          setApartment(snap.apartment);
          setIsSuperAdmin(snap.profile.role === 'super_admin');
          setProfileLoaded(true);
          // Still try to fetch from DB in background but don't wait
          fetchProfileInBackground(userId);
          return;
        }
      }

      console.log('[loadUserProfile] fetching from database...');
      
      // Use only direct Supabase for now
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('[loadUserProfile] DB result:', { profile, profileError });

      if (profileError) {
        console.error('[loadUserProfile] profileError:', profileError);
        throw profileError;
      }

      if (!profile) {
        // Auth user exists but no app row yet (new signup / OAuth before completeSetup). Not a fatal error.
        console.warn('[loadUserProfile] No public.users row yet for:', userId);
        setUserProfile(null);
        setApartment(null);
        setAdminApartments([]);
        setIsSuperAdmin(false);
        setBootstrapError(null);
        setProfileLoaded(true);
        loadedUserIdRef.current = userId;
        return;
      }

      console.log('[loadUserProfile] profile found, setting state:', profile);
      setUserProfile(profile);

      // Load admin apartments
      try {
        const { data: apartments, error } = await supabase
          .from('apartments')
          .select('*')
          .eq('created_by', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.log('[loadUserProfile] Error loading apartments:', error);
          setAdminApartments([]);
        } else {
          console.log('[loadUserProfile] Loaded apartments:', apartments);
          setAdminApartments(apartments || []);
        }
      } catch (err) {
        console.log('[loadUserProfile] Apartment loading failed:', err);
        setAdminApartments([]);
      }

      // Resolve active society for admin UIs (TopBar, dashboard queries). Must match users.apartment_id.
      let activeApartment = null;
      if (profile.apartment_id) {
        try {
          const { data: aptRow, error: aptErr } = await supabase
            .from('apartments')
            .select('*')
            .eq('id', profile.apartment_id)
            .maybeSingle();
          if (!aptErr) activeApartment = aptRow || null;
        } catch (aptFetchErr) {
          console.warn('[loadUserProfile] active apartment row failed:', aptFetchErr);
        }
      }
      setApartment(activeApartment);
      writeCachedProfile(profile, activeApartment);

      setIsSuperAdmin(profile.role === 'super_admin');
      setProfileLoaded(true);

    } catch (error) {
      console.error('[loadUserProfile] error:', error);
      
      // Try to use cache on error
      const cached = readCachedProfile(userId);
      if (cached.profile) {
        console.log('[loadUserProfile] using cache as fallback');
        setUserProfile(cached.profile);
        setApartment(cached.apartment);
        setIsSuperAdmin(cached.profile.role === 'super_admin');
        
        // Load admin apartments even when using cache
        try {
          const { data: apartments, error } = await supabase
            .from('apartments')
            .select('*')
            .eq('created_by', userId)
            .order('created_at', { ascending: false });

          if (error) {
            console.log('[loadUserProfile] Error loading apartments from cache:', error);
            setAdminApartments([]);
          } else {
            console.log('[loadUserProfile] Loaded apartments from cache:', apartments);
            setAdminApartments(apartments || []);
          }
        } catch (err) {
          console.log('[loadUserProfile] Apartment loading failed from cache:', err);
          setAdminApartments([]);
        }
        
        setProfileLoaded(true);
        loadedUserIdRef.current = userId;
        return;
      }
      
      console.error('[loadUserProfile] no cache available, setting bootstrap error');
      setBootstrapError({
        kind: 'fetch',
        message: error.message || 'Could not load your profile',
      });
      setUserProfile(null);
      setApartment(null);
      setAdminApartments([]);
      setProfileLoaded(true);
      loadedUserIdRef.current = null;
    } finally {
      profileLoadLockRef.current = null;
    }
  };

  const fetchProfileInBackground = async (userId) => {
    try {
      console.log('[fetchProfileInBackground] updating cache in background');
      
      // Use only direct Supabase for now
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (!profileError && profile) {
        let activeApartment = null;
        if (profile?.apartment_id) {
          try {
            const { data: apt } = await supabase
              .from('apartments')
              .select('*')
              .eq('id', profile.apartment_id)
              .maybeSingle();
            activeApartment = apt || null;
          } catch (aptErr) {
            console.warn('[fetchProfileInBackground] active apartment error:', aptErr);
          }
        }
        
        writeCachedProfile(profile, activeApartment);
        console.log('[fetchProfileInBackground] cache updated');
      }
    } catch (error) {
      console.log('[fetchProfileInBackground] background update failed:', error);
    }
  };

  const retryBootstrap = async () => {
    if (!user?.id) {
      window.location.href = '/login';
      return;
    }
    setBootstrapError(null);
    setProfileLoaded(false);
    await loadUserProfile(user.id);
  };

  const refreshUserProfile = async () => {
    if (!user?.id) return { success: false, error: 'No user' };
    try {
      await loadUserProfile(user.id);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  const refreshAdminApartments = async (excludeApartmentId = null) => {
    // Simplified for now - just return success
    console.log('[AuthContext] refreshAdminApartments called (simplified)');
    return { success: true };
  };

  const setActiveApartment = async (apartmentId, options = {}) => {
    const { silent = false } = options;
    
    try {
      if (!user) return { success: false };
      
      // Use direct Supabase for now
      const { error } = await supabase
        .from('users')
        .update({ apartment_id: apartmentId || null })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Reload profile to get updated state
      await loadUserProfile(user.id);
      
      if (!silent) toast.success(apartmentId ? 'Apartment selected' : 'No active apartment');
      return { success: true };
    } catch (e) {
      if (!silent) toast.error('Failed to select apartment');
      return { success: false, error: e };
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = data.user.id;
      // Single source of truth: wait for profile bootstrap before Login navigates (avoids ProtectedRoute stuck on loading).
      await loadUserProfile(userId);
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (profileError) {
        console.warn('[signInWithEmail] users row fetch:', profileError);
      }
      return { success: true, user: data.user, profile: profile || null };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error };
    }
  };

  /** Resolve phone to stored user email, then same as email login (returns profile for routing). */
  const signInWithPhone = async (phone, password) => {
    try {
      const raw = String(phone || '').trim();
      const digits = raw.replace(/\D/g, '');
      const q =
        raw.startsWith('+') || digits.length > 10
          ? raw
          : digits.length === 10
            ? `+91${digits}`
            : raw;
      const { data: row, error } = await supabase.from('users').select('email').eq('phone', q).maybeSingle();
      if (error || !row?.email) {
        toast.error('No account found with this phone number');
        return { success: false, error: error || new Error('not found') };
      }
      return signInWithEmail(row.email, password);
    } catch (e) {
      toast.error(e?.message || 'Login failed');
      return { success: false, error: e };
    }
  };

  const signUp = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) throw error;

      const u = data.user;
      if (!u) {
        toast.error('Sign up did not return a user. Try again or check email confirmation settings.');
        return { success: false, error: new Error('No user returned') };
      }

      // When a session is returned (email confirmation disabled), create the app profile immediately.
      if (data.session) {
        const { error: upsertErr } = await supabase.from('users').upsert(
          {
            id: u.id,
            apartment_id: null,
            name: metadata.name || u.user_metadata?.name || email.split('@')[0] || 'Admin',
            email: u.email ?? email,
            phone: metadata.phone || null,
            role: 'admin',
          },
          { onConflict: 'id' }
        );
        if (upsertErr) {
          console.error('[AuthContext] signUp users upsert:', upsertErr);
          toast.error(upsertErr.message || 'Account created but profile row failed. Try signing in.');
          return { success: false, error: upsertErr };
        }
        await loadUserProfile(u.id);
        toast.success('Account created. You can sign in next.');
      } else {
        // Email confirmation required — no session; user must confirm before login.
        toast.success('Check your email to confirm your account, then sign in.');
      }

      return { success: true, user: u, needsEmailConfirmation: !data.session };
    } catch (error) {
      const msg =
        error?.message ||
        error?.msg ||
        error?.error_description ||
        (typeof error === 'string' ? error : null) ||
        'Sign up failed';
      console.error('[AuthContext] signUp:', error);
      toast.error(msg);
      return { success: false, error };
    }
  };

  // OAuth users who signed in but have no row in public.users yet (Signup shows completion form).
  const completeSetup = async ({ name, phone }) => {
    try {
      const authUser = user;
      if (!authUser) {
        toast.error('Not authenticated');
        return { success: false };
      }

      const { data: existingProfile, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (fetchErr) {
        toast.error(fetchErr.message || 'Could not load profile');
        return { success: false, error: fetchErr };
      }

      if (existingProfile) {
        loadedUserIdRef.current = authUser.id;
        setUserProfile(existingProfile);
        let aptForCache = null;
        if (existingProfile.apartment_id) {
          const { data: existingApt } = await supabase
            .from('apartments')
            .select('*')
            .eq('id', existingProfile.apartment_id)
            .maybeSingle();
          if (existingApt) {
            setApartment(existingApt);
            aptForCache = existingApt;
          }
        }
        writeCachedProfile(existingProfile, aptForCache);
        setProfileLoaded(true);
        toast.success('Welcome back!');
        return { success: true, profile: existingProfile };
      }

      const { error: profileError } = await supabase.from('users').insert({
        id: authUser.id,
        apartment_id: null,
        name: name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Admin',
        email: authUser.email,
        phone: phone || null,
        role: 'admin',
      });

      if (profileError) {
        toast.error(profileError.message || 'Could not create profile');
        return { success: false, error: profileError };
      }

      const profile = {
        id: authUser.id,
        apartment_id: null,
        name: name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Admin',
        email: authUser.email,
        phone: phone || null,
        role: 'admin',
        created_at: new Date().toISOString(),
      };

      loadedUserIdRef.current = authUser.id;
      setUserProfile(profile);
      setApartment(null);
      writeCachedProfile(profile, null);
      setProfileLoaded(true);
      toast.success('Profile created! Now create your apartment.');
      return { success: true, profile };
    } catch (error) {
      toast.error(error?.message || 'Setup failed');
      return { success: false, error };
    }
  };

  const signOut = async () => {
    try {
      // Clear superadmin session if exists
      localStorage.removeItem('superadmin_session');
      localStorage.removeItem('superadmin_user');
      setIsSuperAdmin(false);

      // Resident viewer login — no Supabase auth session; only localStorage + React state
      const hasResidentSession =
        typeof localStorage !== 'undefined' && localStorage.getItem('resident_session');
      if (hasResidentSession || isResident) {
        try {
          localStorage.removeItem('resident_session');
        } catch {
          /* ignore */
        }
        setIsResident(false);
        setResidentApartmentId(null);
        setResidentFlatId(null);
        setResidentFlatNumber(null);
        setApartment(null);
        setUser(null);
        setUserProfile(null);
        setBootstrapError(null);
        setProfileLoaded(true);
        setLoading(false);
        toast.success('Logged out');
        window.location.href = '/login';
        return { success: true };
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out');
      return { success: true };
    } catch (error) {
      toast.error('Failed to sign out');
      return { success: false, error };
    }
  };

  const resetPassword = async (email) => {
    try {
      const base = getPublicSiteUrl();
      if (!base) {
        toast.error('Set VITE_APP_URL in .env to your app URL (e.g. http://localhost:5173)');
        return { success: false, error: new Error('VITE_APP_URL missing') };
      }
      const redirectTo = `${base}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success('Check your email for the password reset link');
      return { success: true };
    } catch (error) {
      toast.error(error.message);
      return { success: false, error };
    }
  };

  const signInAsResident = async (username, password) => {
    try {
      // Find viewer settings with matching credentials
      const { data: settings, error } = await supabase
        .from('viewer_settings')
        .select('*, apartments!inner(*)')
        .eq('viewer_username', username)
        .eq('viewer_password', password)
        .single();

      if (error || !settings) {
        return { success: false, error: 'Invalid resident credentials' };
      }

      // Create resident session
      const residentSession = {
        apartment_id: settings.apartment_id,
        apartment_name: settings.apartments?.name || 'Apartment',
        username: username,
        permissions: {
          allow_income_view: settings.allow_income_view,
          allow_expense_view: settings.allow_expense_view,
          allow_maintenance_view: settings.allow_maintenance_view
        }
      };

      localStorage.setItem('resident_session', JSON.stringify(residentSession));
      
      // Set resident state
      setIsResident(true);
      setResidentApartmentId(settings.apartment_id);
      setResidentFlatId(null); // Common login, no specific flat
      setResidentFlatNumber(null);
      setApartment({ id: settings.apartment_id, name: settings.apartments?.name });
      setProfileLoaded(true);
      setLoading(false);

      return { success: true, settings };
    } catch (error) {
      toast.error('Resident login failed');
      return { success: false, error };
    }
  };

  const updateProfile = async (updates) => {
    try {
      if (!user?.id) throw new Error('No user logged in');
      
      const { data: result, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      
      setUserProfile(result);
      
      // Update cache
      const cached = readCachedProfile(user.id);
      writeCachedProfile(result, cached.apartment);
      
      toast.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      toast.error('Failed to update profile');
      return { success: false, error };
    }
  };

  const checkSubscription = () => {
    if (!userProfile) return { valid: false, reason: 'no_profile' };
    if (userProfile.role === 'super_admin') return { valid: true };
    if (!userProfile.subscription_end_date) return { valid: false, reason: 'no_subscription' };
    const endDate = new Date(userProfile.subscription_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDate < today) return { valid: false, reason: 'expired' };
    return { valid: true };
  };

  const value = {
    user,
    userProfile,
    apartment,
    adminApartments,
    loading,
    profileLoaded,
    isResident,
    residentApartmentId,
    residentFlatId,
    residentFlatNumber,
    isSuperAdmin,
    bootstrapError,
    retryBootstrap,
    refreshUserProfile,
    refreshAdminApartments,
    setActiveApartment,
    signInWithEmail,
    signInWithPhone,
    signUp,
    completeSetup,
    signOut,
    signInAsResident,
    resetPassword,
    updateProfile,
    checkSubscription,
    clearCachedApartmentList,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
