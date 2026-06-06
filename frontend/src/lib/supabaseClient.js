import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("SUPABASE_URL =", import.meta.env.VITE_SUPABASE_URL);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      // Capacitor WebView uses https://localhost — URL hash parsing breaks password login.
      detectSessionInUrl: !Capacitor.isNativePlatform(),
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Base URL for email links (password reset, etc.). Must exactly match an entry under
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 * In the browser, prefer the **current origin** (so custom domains like www stay on www).
 * Use VITE_APP_URL when no window (e.g. tests) or on localhost.
 */
export function getPublicSiteUrl() {
  const env = import.meta.env.VITE_APP_URL;
  if (typeof window !== 'undefined' && window.location?.origin) {
    const o = window.location.origin;
    const isLocal = /localhost|127\.0\.0\.1/.test(o);
    if (!isLocal) {
      return o.replace(/\/$/, '');
    }
  }
  if (env && typeof env === 'string' && env.trim()) {
    return env.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

// Helper function to get signed URL for attachments
export const getSignedUrl = async (path, expiresIn = 3600) => {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
  
  return data?.signedUrl;
};

// Helper function to upload file
export const uploadFile = async (file, path) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file:', error);
    throw error;
  }

  return {
    path: data.path,
    name: file.name,
  };
};

// Helper function to delete file
export const deleteFile = async (path) => {
  const { error } = await supabase.storage
    .from('attachments')
    .remove([path]);

  if (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

// Helper function to format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

// Helper function to format date
export const formatDate = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

// Helper function to get month name
export const getMonthName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
};

// Helper function to get current financial year
export const getCurrentFinancialYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  
  if (month >= 4) {
    return { start: year, end: year + 1 };
  } else {
    return { start: year - 1, end: year };
  }
};

export default supabase;