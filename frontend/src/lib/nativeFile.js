import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileSharer } from '@capgo/capacitor-file-sharer';
import toast from 'react-hot-toast';
import { isNativeApp } from './nativeApp';

function sanitizeFilename(name) {
  const base = String(name || 'file').split(/[/\\]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
}

function mimeFromFilename(name) {
  const ext = String(name).split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'));
        return;
      }
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Save directly to the device Downloads folder (Android) — no share sheet.
 * Shows a toast when the file is saved.
 */
export async function saveDirectDownload(blob, filename) {
  const safeName = sanitizeFilename(filename);
  const base64 = await blobToBase64(blob);
  const contentType = mimeFromFilename(safeName);

  if (Capacitor.getPlatform() === 'android') {
    await FileSharer.save({
      filename: safeName,
      contentType,
      base64Data: base64,
      android: {
        saveDirectory: 'downloads',
        relativePath: 'Download/Societrack',
      },
    });
    toast.success(`Downloaded — check Downloads/Societrack/${safeName}`);
    return;
  }

  if (isNativeApp()) {
    await Filesystem.writeFile({
      path: `Societrack/${safeName}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    toast.success(`Saved: ${safeName}`);
    return;
  }
}

/** Download a remote file and save locally (Android) or open in browser (web). */
export async function openRemoteFile(url, filename = 'attachment') {
  if (!url) throw new Error('Missing file URL');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not download file');
  }
  const blob = await response.blob();

  if (isNativeApp()) {
    await saveDirectDownload(blob, filename);
    return;
  }

  const objUrl = URL.createObjectURL(blob);
  try {
    const popup = window.open(objUrl, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.assign(objUrl);
    setTimeout(() => URL.revokeObjectURL(objUrl), 120000);
  } catch {
    URL.revokeObjectURL(objUrl);
    throw new Error('Could not open file');
  }
}
