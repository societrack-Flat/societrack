import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabaseClient';

export const MOBILE_OAUTH_REDIRECT = 'com.societrack.app://login';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

let listenerReady = false;
let onOAuthComplete = null;
let pendingLaunchUrl = null;

export function registerNativeOAuthCompleteHandler(handler) {
  onOAuthComplete = handler;

  if (pendingLaunchUrl) {
    const url = pendingLaunchUrl;
    pendingLaunchUrl = null;
    processOAuthCallbackUrl(url).catch((err) => {
      console.error('Pending OAuth launch URL failed:', err);
    });
  }

  return () => {
    if (onOAuthComplete === handler) onOAuthComplete = null;
  };
}

/** Match com.societrack.app://login with or without trailing slash / extra path. */
export function isOAuthCallbackUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'com.societrack.app:' && parsed.hostname === 'login';
  } catch {
    return url.startsWith(MOBILE_OAUTH_REDIRECT);
  }
}

async function completeOAuthFromUrl(url) {
  const queryPart = url.includes('?') ? url.split('?')[1]?.split('#')[0] || '' : '';
  const hashPart = url.includes('#') ? url.split('#')[1] || '' : '';
  const hashParams = new URLSearchParams(hashPart);
  const queryParams = new URLSearchParams(queryPart);

  const oauthError =
    hashParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error_description') ||
    queryParams.get('error');
  if (oauthError) throw new Error(oauthError);

  const access_token = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');
  const code = queryParams.get('code');

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  throw new Error('Sign-in could not be completed. Please try again.');
}

async function processOAuthCallbackUrl(url) {
  if (!isOAuthCallbackUrl(url)) return false;

  try {
    await Browser.close();
  } catch {
    /* browser may already be closed */
  }

  await completeOAuthFromUrl(url);

  if (onOAuthComplete) {
    try {
      await onOAuthComplete();
    } catch (err) {
      console.error('OAuth post-complete handler failed:', err);
    }
  }

  return true;
}

async function ensureNativeOAuthListener() {
  if (listenerReady) return;
  listenerReady = true;

  const handleLaunchUrl = async () => {
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url && isOAuthCallbackUrl(launch.url)) {
        if (onOAuthComplete) {
          await processOAuthCallbackUrl(launch.url);
        } else {
          pendingLaunchUrl = launch.url;
        }
      }
    } catch (err) {
      console.warn('getLaunchUrl failed:', err);
    }
  };

  await handleLaunchUrl();

  await App.addListener('appUrlOpen', async (event) => {
    try {
      await processOAuthCallbackUrl(event.url);
    } catch (err) {
      console.error('OAuth callback failed:', err);
    }
  });

  // Some Android builds deliver the deep link on resume instead of appUrlOpen.
  await App.addListener('resume', () => {
    handleLaunchUrl().catch((err) => {
      console.warn('OAuth resume check failed:', err);
    });
  });
}

/**
 * Native Google/Apple sign-in — opens system browser (same as web redirect flow).
 * Session + navigation are handled when the app receives com.societrack.app://login.
 */
export async function signInWithOAuthNative(provider) {
  await ensureNativeOAuthListener();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: MOBILE_OAUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  if (error) return { error };
  if (!data?.url) return { error: new Error('No OAuth URL returned') };

  try {
    await Browser.open({ url: data.url });
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

let nativeNavigateHandler = null;

export function registerNativeNavigateHandler(handler) {
  nativeNavigateHandler = handler;
  return () => {
    if (nativeNavigateHandler === handler) nativeNavigateHandler = null;
  };
}

export function routeAfterNativeOAuth(profile) {
  let path = '/signup';
  if (profile?.role === 'super_admin') path = '/superadmin/dashboard';
  else if (profile?.role === 'admin') path = '/admin/dashboard';
  else if (profile?.role === 'resident') path = '/resident/dashboard';

  // Full navigation reload avoids React auth race after OAuth on Android WebView.
  window.location.replace(path);
}
