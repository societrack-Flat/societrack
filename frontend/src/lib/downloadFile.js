import { Browser } from '@capacitor/browser';
import * as XLSX from 'xlsx';
import { isNativeApp } from './nativeApp';

async function openBlobInBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    if (isNativeApp()) {
      await Browser.open({ url });
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function downloadTextFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  await openBlobInBrowser(blob, filename);
}

export async function downloadBlob(blob, filename) {
  await openBlobInBrowser(blob, filename);
}

export async function downloadPdf(doc, filename) {
  if (isNativeApp()) {
    const blob = doc.output('blob');
    await openBlobInBrowser(blob, filename);
    return;
  }
  doc.save(filename);
}

export async function downloadXlsx(workbook, filename) {
  if (isNativeApp()) {
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await openBlobInBrowser(blob, filename);
    return;
  }
  XLSX.writeFile(workbook, filename);
}
