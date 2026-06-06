import { Browser } from '@capacitor/browser';
import { getSignedUrl } from './supabaseClient';
import { getApiBaseUrl } from './apiBaseUrl';
import { isNativeApp } from './nativeApp';

const API_BASE_URL = getApiBaseUrl();

function readResidentSession() {
  try {
    const raw = localStorage.getItem('resident_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Open a URL in a way that works on phone browsers and the Android app. */
export async function openUrlInBrowser(url) {
  if (!url) return;
  if (isNativeApp()) {
    await Browser.open({ url });
    return;
  }
  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  if (isMobileDevice) {
    window.location.assign(url);
    return;
  }
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.assign(url);
}

async function getResidentAttachmentUrl(attachmentPath) {
  const session = readResidentSession();
  if (!session?.username || !session?.viewer_password) {
    throw new Error('Resident session expired. Please sign in again.');
  }

  const response = await fetch(`${API_BASE_URL}/api/resident/attachment-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      viewer_username: session.username,
      viewer_password: session.viewer_password,
      attachment_path: attachmentPath,
    }),
  });

  if (!response.ok) {
    let msg = 'Failed to open attachment';
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') msg = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.url;
}

/**
 * Resolve a storage path to a viewable URL (admin: Supabase auth; resident: backend signed URL).
 */
export async function resolveAttachmentUrl(attachmentPath) {
  if (!attachmentPath) return null;

  const session = readResidentSession();
  if (session?.username) {
    return getResidentAttachmentUrl(attachmentPath);
  }

  return getSignedUrl(attachmentPath);
}

/** Open an income/expense attachment (works on laptop, phone browser, and Android app). */
export async function openAttachment(attachmentPath) {
  const url = await resolveAttachmentUrl(attachmentPath);
  if (!url) throw new Error('Could not get attachment link');
  await openUrlInBrowser(url);
}
