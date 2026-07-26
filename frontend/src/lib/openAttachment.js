import { getSignedUrl } from './supabaseClient';
import { getApiBaseUrl } from './apiBaseUrl';
import { isNativeApp } from './nativeApp';
import { Browser } from '@capacitor/browser';

function readResidentSession() {
  try {
    const raw = localStorage.getItem('resident_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Strip bucket prefix or legacy full URLs — storage path only. */
export function normalizeAttachmentPath(attachmentPath) {
  let path = String(attachmentPath || '').trim();
  if (!path) return '';

  if (path.startsWith('http://') || path.startsWith('https://')) {
    for (const marker of ['/attachments/', '/object/sign/attachments/', '/object/public/attachments/']) {
      const idx = path.indexOf(marker);
      if (idx >= 0) {
        path = path.slice(idx + marker.length);
        break;
      }
    }
    if (path.includes('?')) path = path.split('?')[0];
  }

  return path.replace(/^\/+/, '');
}

function filenameFromPath(attachmentPath) {
  const normalized = normalizeAttachmentPath(attachmentPath);
  if (!normalized) return 'attachment';
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'attachment';
}

/** Open a URL in a way that works on laptop browsers, mobile web, and the Android app. */
export async function openUrlInBrowser(url, filename = 'attachment') {
  if (!url) return;

  if (isNativeApp()) {
    await Browser.open({ url });
    return;
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

async function getResidentAttachmentUrl(attachmentPath) {
  const session = readResidentSession();
  if (!session?.username || !session?.viewer_password) {
    throw new Error('Resident session expired. Please sign in again.');
  }

  const normalizedPath = normalizeAttachmentPath(attachmentPath);
  if (!normalizedPath) throw new Error('Invalid attachment');

  const response = await fetch(`${getApiBaseUrl()}/api/resident/attachment-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      viewer_username: session.username,
      viewer_password: session.viewer_password,
      attachment_path: normalizedPath,
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
  const normalizedPath = normalizeAttachmentPath(attachmentPath);
  if (!normalizedPath) return null;

  const session = readResidentSession();
  if (session?.username) {
    return getResidentAttachmentUrl(normalizedPath);
  }

  return getSignedUrl(normalizedPath);
}

/** Open an income/expense attachment (works on laptop, phone browser, and Android app). */
export async function openAttachment(attachmentPath) {
  const url = await resolveAttachmentUrl(attachmentPath);
  if (!url) throw new Error('Could not get attachment link');
  await openUrlInBrowser(url, filenameFromPath(attachmentPath));
}
