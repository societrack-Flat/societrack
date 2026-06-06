import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase, getPublicSiteUrl } from '../lib/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { registerNativeOAuthCompleteHandler, routeAfterNativeOAuth } from '../lib/mobileOAuth';
import { markPasswordRecoveryPending } from '../lib/passwordRecovery';
import { paymentsApi } from '../lib/apiClient';
import { SOCIETRACK_PLAN_ID } from '../lib/razorpay';

const AuthContext = createContext(null);
const PROFILE_CACHE_KEY = 'societrack_profile_cache_v1';
const APARTMENT_CACHE_KEY = 'societrack_apartment_cache_v1';
/** Session-only: super admin “manage this society” target (not persisted across devices). */
export const SA_MANAGE_APARTMENT_KEY = 'societrack_sa_manage_apartment_id';

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
  /** When set, super admin uses admin UI for this apartment (sessionStorage-backed). */
  const [saManagedApartmentId, setSaManagedApartmentIdState] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SA_MANAGE_APARTMENT_KEY) : null;
    } catch {
      return null;
    }
  });
  /** Set when profile bootstrap fails or times out (works without localStorage / incognito). */
  const [bootstrapError, setBootstrapError] = useState(null);

  // Tracks the user id already loaded so onAuthStateChange SIGNED_IN events
  // for the same user (token refresh, URL hash processing) don't re-trigger
  // a full profile reload and flash the loading screen.
  const loadedUserIdRef = useRef(null);
  /** For async follow-ups (e.g. background profile fetch) to avoid applying stale data to a different user. */
  const userRef = useRef(null);
  userRef.current = user;
  /** Prevents concurrent loadUserProfile(userId) for the same user (initAuth + SIGNED_IN race). */
  const profileLoadLockRef = useRef(null);
  const profileLoadInflightRef = useRef(new Map());
  const profileLoadedRef = useRef(false);
  profileLoadedRef.current = profileLoaded;

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

  const clearLocalProfileCache = () => {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      localStorage.removeItem(APARTMENT_CACHE_KEY);
    } catch {
      // ignore
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

      if (event === 'PASSWORD_RECOVERY') {
        markPasswordRecoveryPending();
      }

      if (event === 'SIGNED_IN' && session?.user) {
        const uid = session.user.id;
        // Profile bootstrap already running (e.g. signInWithEmail) — don't start a second load.
        if (profileLoadInflightRef.current.has(uid)) {
          setLoading(false);
          return;
        }
        // Same user and profile already ready — skip reload (token refresh, duplicate SIGNED_IN).
        if (loadedUserIdRef.current === uid && profileLoadedRef.current) {
          setLoading(false);
          return;
        }

        setUser(session.user);
        await loadUserProfile(uid);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Do NOT setUser() here. The Supabase client already has the new session; getSession() returns
        // a fresh token. Calling setUser would re-render the whole app, which can destroy or blank
        // Razorpay Standard Checkout v2 (many /checkout-static-next chunk loads) mid-flow. Same user id.
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

  const completeOAuthSignInRef = useRef(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    return registerNativeOAuthCompleteHandler(async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        toast.error('Sign-in did not complete. Please try again.');
        return;
      }

      setUser(session.user);

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        toast.error(profileError.message || 'Could not load profile');
        return;
      }

      if (profile) {
        setUserProfile(profile);
        setProfileLoaded(true);
        loadedUserIdRef.current = session.user.id;
        writeCachedProfile(profile, readCachedProfile(session.user.id).apartment);
        loadUserProfile(session.user.id).catch(() => {});
      } else {
        setUserProfile(null);
        setApartment(null);
        setProfileLoaded(true);
        loadedUserIdRef.current = session.user.id;
      }

      setLoading(false);
      routeAfterNativeOAuth(profile);
    });
  }, []);

  const loadUserProfile = async (userId) => {
    if (!userId) return null;

    const inflight = profileLoadInflightRef.current.get(userId);
    if (inflight) {
      console.log('[loadUserProfile] reusing in-flight load for:', userId);
      return inflight;
    }

    const run = (async () => {
      console.log('[loadUserProfile] called with:', userId);

      profileLoadLockRef.current = userId;

      const previousLoadedId = loadedUserIdRef.current;

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
            loadedUserIdRef.current = userId;
            fetchProfileInBackground(userId);
            return snap.profile;
          }
        }

        console.log('[loadUserProfile] fetching from database...');

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
          console.warn('[loadUserProfile] No public.users row yet for:', userId);
          setUserProfile(null);
          setApartment(null);
          setAdminApartments([]);
          setIsSuperAdmin(false);
          setBootstrapError(null);
          setProfileLoaded(true);
          loadedUserIdRef.current = userId;
          return null;
        }

        console.log('[loadUserProfile] profile found, setting state:', profile);
        setUserProfile(profile);

        if (profile.role === 'super_admin') {
          setAdminApartments([]);
          let saId = null;
          try {
            saId = sessionStorage.getItem(SA_MANAGE_APARTMENT_KEY);
          } catch {
            /* ignore */
          }
          setSaManagedApartmentIdState(saId || null);
          let activeApartment = null;
          if (saId) {
            try {
              const { data: aptRow, error: aptErr } = await supabase
                .from('apartments')
                .select('*')
                .eq('id', saId)
                .maybeSingle();
              if (!aptErr) activeApartment = aptRow || null;
            } catch (aptFetchErr) {
              console.warn('[loadUserProfile] SA managed apartment fetch failed:', aptFetchErr);
            }
          }
          setApartment(activeApartment);
          writeCachedProfile(profile, activeApartment);
          setIsSuperAdmin(true);
          setProfileLoaded(true);
          loadedUserIdRef.current = userId;
          return profile;
        }

        try {
          sessionStorage.removeItem(SA_MANAGE_APARTMENT_KEY);
        } catch {
          /* ignore */
        }
        setSaManagedApartmentIdState(null);

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

        setIsSuperAdmin(false);
        setProfileLoaded(true);
        loadedUserIdRef.current = userId;
        return profile;
      } catch (error) {
        console.error('[loadUserProfile] error:', error);

        const cached = readCachedProfile(userId);
        if (cached.profile) {
          console.log('[loadUserProfile] using cache as fallback');
          setUserProfile(cached.profile);
          if (cached.profile.role === 'super_admin') {
            setAdminApartments([]);
            let saId = null;
            try {
              saId = sessionStorage.getItem(SA_MANAGE_APARTMENT_KEY);
            } catch {
              /* ignore */
            }
            setSaManagedApartmentIdState(saId || null);
            let activeApartment = null;
            if (saId) {
              try {
                const { data: aptRow, error: aptErr } = await supabase
                  .from('apartments')
                  .select('*')
                  .eq('id', saId)
                  .maybeSingle();
                if (!aptErr) activeApartment = aptRow || null;
              } catch (e) {
                console.warn('[loadUserProfile] cache SA apartment:', e);
              }
            }
            setApartment(activeApartment);
            setIsSuperAdmin(true);
          } else {
            try {
              sessionStorage.removeItem(SA_MANAGE_APARTMENT_KEY);
            } catch {
              /* ignore */
            }
            setSaManagedApartmentIdState(null);
            setApartment(cached.apartment);
            setIsSuperAdmin(false);
            try {
              const { data: apartments, error: aptListErr } = await supabase
                .from('apartments')
                .select('*')
                .eq('created_by', userId)
                .order('created_at', { ascending: false });

              if (aptListErr) {
                setAdminApartments([]);
              } else {
                setAdminApartments(apartments || []);
              }
            } catch (err) {
              setAdminApartments([]);
            }
          }

          setProfileLoaded(true);
          loadedUserIdRef.current = userId;
          return cached.profile;
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
        return null;
      } finally {
        profileLoadLockRef.current = null;
      }
    })();

    profileLoadInflightRef.current.set(userId, run);
    try {
      return await run;
    } finally {
      profileLoadInflightRef.current.delete(userId);
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
      
      if (profileError || !profile) return;
      if (userRef.current?.id !== userId) return;

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
        console.log('[fetchProfileInBackground] cache updated, syncing React state');
        if (userRef.current?.id !== userId) return;
        setUserProfile(profile);
        if (profile.role === 'super_admin') {
          setIsSuperAdmin(true);
        } else {
          setIsSuperAdmin(false);
          setApartment(activeApartment);
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

  const refreshUserProfile = async (options = {}) => {
    if (!user?.id) return { success: false, error: 'No user' };
    try {
      if (options.skipCache) clearLocalProfileCache();
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

  const exitSaManageMode = () => {
    try {
      sessionStorage.removeItem(SA_MANAGE_APARTMENT_KEY);
    } catch {
      /* ignore */
    }
    setSaManagedApartmentIdState(null);
    setApartment(null);
  };

  const enterSaManageMode = async (apartmentId) => {
    if (!apartmentId) return { success: false, error: new Error('No apartment') };
    try {
      sessionStorage.setItem(SA_MANAGE_APARTMENT_KEY, apartmentId);
      setSaManagedApartmentIdState(apartmentId);
      const { data, error } = await supabase.from('apartments').select('*').eq('id', apartmentId).maybeSingle();
      if (error) throw error;
      setApartment(data || null);
      return { success: true };
    } catch (e) {
      try {
        sessionStorage.removeItem(SA_MANAGE_APARTMENT_KEY);
      } catch {
        /* ignore */
      }
      setSaManagedApartmentIdState(null);
      toast.error(e?.message || 'Could not open apartment');
      return { success: false, error: e };
    }
  };

  const setActiveApartment = async (apartmentId, options = {}) => {
    const { silent = false } = options;

    try {
      if (!user) return { success: false };

      if (userProfile?.role === 'super_admin') {
        if (!apartmentId) {
          exitSaManageMode();
          if (!silent) toast.success('Exited apartment view');
          return { success: true };
        }
        const r = await enterSaManageMode(apartmentId);
        if (r.success && !silent) toast.success('Apartment selected');
        return r;
      }

      const { error } = await supabase
        .from('users')
        .update({ apartment_id: apartmentId || null })
        .eq('id', user.id);

      if (error) throw error;

      await loadUserProfile(user.id);

      if (!silent) toast.success(apartmentId ? 'Apartment selected' : 'No active apartment');
      return { success: true };
    } catch (e) {
      if (!silent) toast.error('Failed to select apartment');
      return { success: false, error: e };
    }
  };

  const signInWithEmail = async (email, password) => {
    const LOGIN_PROFILE_MS = 15000;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = data.user.id;
      setUser(data.user);

      let profile = null;
      try {
        profile = await Promise.race([
          loadUserProfile(userId),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('PROFILE_LOAD_TIMEOUT')), LOGIN_PROFILE_MS);
          }),
        ]);
      } catch (loadErr) {
        if (loadErr?.message !== 'PROFILE_LOAD_TIMEOUT') throw loadErr;

        const { data: quickProfile, error: quickErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (quickErr) throw quickErr;

        profile = quickProfile || null;
        if (profile) {
          setUserProfile(profile);
          setProfileLoaded(true);
          loadedUserIdRef.current = userId;
          writeCachedProfile(profile, readCachedProfile(userId).apartment);
        } else {
          setUserProfile(null);
          setProfileLoaded(true);
          loadedUserIdRef.current = userId;
        }
        loadUserProfile(userId).catch(() => {});
      }

      setLoading(false);
      return { success: true, user: data.user, profile };
    } catch (error) {
      setLoading(false);
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

  /** After native Google/Apple OAuth — load session + profile and return role for routing. */
  const completeOAuthSignIn = async () => {
    const OAUTH_PROFILE_MS = 15000;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session?.user) {
        return { success: false, error: new Error('Sign-in did not complete. Please try again.') };
      }

      setUser(session.user);

      let profile = null;
      const { data: quickProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      profile = quickProfile || null;

      if (profile) {
        try {
          await Promise.race([
            loadUserProfile(session.user.id),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('PROFILE_LOAD_TIMEOUT')), OAUTH_PROFILE_MS);
            }),
          ]);
        } catch (loadErr) {
          if (loadErr?.message !== 'PROFILE_LOAD_TIMEOUT') throw loadErr;
          setUserProfile(profile);
          setProfileLoaded(true);
          loadedUserIdRef.current = session.user.id;
          writeCachedProfile(profile, readCachedProfile(session.user.id).apartment);
          loadUserProfile(session.user.id).catch(() => {});
        }
      } else {
        setUserProfile(null);
        setApartment(null);
        setProfileLoaded(true);
        loadedUserIdRef.current = session.user.id;
      }

      setLoading(false);
      return { success: true, profile };
    } catch (error) {
      setLoading(false);
      toast.error(error.message || 'Sign-in failed');
      return { success: false, error };
    }
  };
  completeOAuthSignInRef.current = completeOAuthSignIn;

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
      try {
        sessionStorage.removeItem(SA_MANAGE_APARTMENT_KEY);
      } catch {
        /* ignore */
      }
      setSaManagedApartmentIdState(null);

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
    const RESIDENT_LOGIN_MS = 15000;

    try {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      setUser(null);
      setUserProfile(null);
      loadedUserIdRef.current = null;

      const queryPromise = supabase
        .from('viewer_settings')
        .select('*, apartments!inner(*)')
        .eq('viewer_username', username)
        .eq('viewer_password', password)
        .single();

      const { data: settings, error } = await Promise.race([
        queryPromise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Login timed out. Check your connection.')), RESIDENT_LOGIN_MS);
        }),
      ]);

      if (error || !settings) {
        toast.error('Invalid resident credentials');
        return { success: false, error: 'Invalid resident credentials' };
      }

      const residentSession = {
        apartment_id: settings.apartment_id,
        apartment_name: settings.apartments?.name || 'Apartment',
        username: username,
        viewer_password: password,
        permissions: {
          allow_income_view: settings.allow_income_view,
          allow_expense_view: settings.allow_expense_view,
          allow_maintenance_view: settings.allow_maintenance_view
        }
      };

      localStorage.setItem('resident_session', JSON.stringify(residentSession));

      setIsResident(true);
      setResidentApartmentId(settings.apartment_id);
      setResidentFlatId(null);
      setResidentFlatNumber(null);
      setApartment({ id: settings.apartment_id, name: settings.apartments?.name });
      setProfileLoaded(true);
      setLoading(false);

      return { success: true, settings };
    } catch (error) {
      toast.error(error?.message || 'Resident login failed');
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

  /**
   * Email/password accounts (custom signup). Verifies current password, then sets a new one via Supabase Auth.
   */
  const updatePassword = async (newPassword, currentPassword) => {
    try {
      const email = user?.email || userProfile?.email;
      if (!user?.id || !email) {
        toast.error('Signed-in email account required to change password');
        return { success: false };
      }
      const current = String(currentPassword ?? '').trim();
      if (!current) {
        toast.error('Enter your current password');
        return { success: false };
      }
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (verifyErr) {
        toast.error(verifyErr.message || 'Current password is incorrect');
        return { success: false, error: verifyErr };
      }
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        toast.error(updateErr.message || 'Could not update password');
        return { success: false, error: updateErr };
      }
      toast.success('Password updated successfully');
      return { success: true };
    } catch (error) {
      toast.error(error?.message || 'Failed to update password');
      return { success: false, error };
    }
  };

  /**
   * Admin subscription: 45-day trial (full), then paid via Razorpay (30 days / cycle).
   * showSubscribeCta: last 1–2 days of trial or paid period. adminAccess: read-only when lapsed.
   */
  const checkSubscription = () => {
    if (!userProfile) {
      return {
        valid: false,
        reason: 'no_profile',
        status: null,
        daysLeft: null,
        adminAccess: 'full',
        showSubscribeCta: false,
      };
    }
    if (userProfile.role === 'super_admin') {
      return {
        valid: true,
        status: null,
        daysLeft: null,
        reason: null,
        adminAccess: 'full',
        showSubscribeCta: false,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const apt = apartment;
    const defaultFull = {
      valid: true,
      status: null,
      daysLeft: null,
      reason: null,
      adminAccess: 'full',
      showSubscribeCta: false,
    };

    if (!apt) return defaultFull;

    const planIsTrial =
      apt?.plan_name === 'free_trial' ||
      apt?.plan_name === 'free' ||
      String(apt?.subscription_status || '').toLowerCase() === 'trial';

    if (apt.trial_end_date && planIsTrial) {
      const trialEnd = new Date(apt.trial_end_date);
      trialEnd.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((trialEnd.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) {
        return {
          valid: false,
          reason: 'expired',
          status: 'trial',
          daysLeft: 0,
          adminAccess: 'read_only',
          showSubscribeCta: true,
        };
      }
      return {
        valid: true,
        reason: null,
        status: 'trial',
        daysLeft: Math.max(0, daysLeft),
        adminAccess: 'full',
        showSubscribeCta: daysLeft <= 2,
      };
    }

    const paidStatus = String(apt?.subscription_status || '').toLowerCase() === 'active';
    const paidPlan = String(apt?.plan_name || '').toLowerCase();
    const isPaidPlan = paidStatus && (paidPlan === 'societrack_pro' || ['basic', 'standard', 'premium'].includes(paidPlan));
    // Active Pro without an end date yet: treat as paid (e.g. row updated before end_date column sync).
    if (isPaidPlan && !apt.subscription_end_date) {
      return {
        valid: true,
        reason: null,
        status: 'active',
        daysLeft: null,
        adminAccess: 'full',
        showSubscribeCta: false,
      };
    }
    if (isPaidPlan && apt.subscription_end_date) {
      const end = new Date(apt.subscription_end_date);
      end.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) {
        return {
          valid: false,
          reason: 'expired',
          status: 'active',
          daysLeft: 0,
          adminAccess: 'read_only',
          showSubscribeCta: true,
        };
      }
      return {
        valid: true,
        reason: null,
        status: 'active',
        daysLeft: Math.max(0, daysLeft),
        adminAccess: 'full',
        showSubscribeCta: daysLeft <= 2,
      };
    }

    if (userProfile.subscription_end_date) {
      const endDate = new Date(userProfile.subscription_end_date);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) {
        return {
          valid: false,
          reason: 'expired',
          status: null,
          daysLeft: null,
          adminAccess: 'read_only',
          showSubscribeCta: true,
        };
      }
      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
      return {
        valid: true,
        status: 'active',
        daysLeft: Math.max(0, daysLeft),
        reason: null,
        adminAccess: 'full',
        showSubscribeCta: daysLeft <= 2,
      };
    }

    return defaultFull;
  };

  const updateSubscription = async (planId, paymentData) => {
    try {
      await paymentsApi.verifyRazorpayPayment({
        plan_id: planId || SOCIETRACK_PLAN_ID,
        apartment_id: paymentData.apartment_id,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
      });
      // Force a full reload from Supabase; ignore stale localStorage so subscription UI updates immediately.
      const r = await refreshUserProfile({ skipCache: true });
      return { success: r?.success !== false };
    } catch (error) {
      console.error('[updateSubscription]', error);
      return { success: false, error: error?.message || String(error) };
    }
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
    saManagedApartmentId,
    enterSaManageMode,
    exitSaManageMode,
    bootstrapError,
    retryBootstrap,
    refreshUserProfile,
    refreshAdminApartments,
    setActiveApartment,
    signInWithEmail,
    signInWithPhone,
    completeOAuthSignIn,
    signUp,
    completeSetup,
    signOut,
    signInAsResident,
    resetPassword,
    updateProfile,
    updatePassword,
    checkSubscription,
    updateSubscription,
    clearCachedApartmentList,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
