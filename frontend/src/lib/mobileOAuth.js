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
let pendingOAuthResolve = null;
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
  if (!url?.startsWith(MOBILE_OAUTH_REDIRECT)) return false;

  try {
    await Browser.close();
  } catch {
    /* browser may already be closed */
  }

  await completeOAuthFromUrl(url);

  if (onOAuthComplete) {
    await onOAuthComplete();
  }

  if (pendingOAuthResolve) {
    pendingOAuthResolve({ error: null });
    pendingOAuthResolve = null;
  }

  return true;
}

async function ensureNativeOAuthListener() {
  if (listenerReady) return;
  listenerReady = true;

  const launch = await App.getLaunchUrl();
  if (launch?.url?.startsWith(MOBILE_OAUTH_REDIRECT)) {
    if (onOAuthComplete) {
      processOAuthCallbackUrl(launch.url).catch((err) => {
        console.error('OAuth launch URL failed:', err);
      });
    } else {
      pendingLaunchUrl = launch.url;
    }
  }

  await App.addListener('appUrlOpen', async (event) => {
    try {
      await processOAuthCallbackUrl(event.url);
    } catch (err) {
      console.error('OAuth callback failed:', err);
      if (pendingOAuthResolve) {
        pendingOAuthResolve({ error: err });
        pendingOAuthResolve = null;
      }
    }
  });
}

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

  return new Promise((resolve) => {
    pendingOAuthResolve = resolve;

    Browser.open({ url: data.url }).catch((err) => {
      if (pendingOAuthResolve === resolve) {
        pendingOAuthResolve = null;
        resolve({ error: err });
      }
    });

    setTimeout(() => {
      if (pendingOAuthResolve === resolve) {
        pendingOAuthResolve = null;
        resolve({ error: new Error('Sign-in timed out. Please try again.') });
      }
    }, 300000);
  });
}

export function routeAfterNativeOAuth(profile) {
  let path = '/signup';
  if (profile?.role === 'super_admin') path = '/superadmin/dashboard';
  else if (profile?.role === 'admin') path = '/admin/dashboard';
  else if (profile?.role === 'resident') path = '/resident/dashboard';
  window.location.replace(path);
}
