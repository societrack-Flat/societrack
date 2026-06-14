import * as XLSX from 'xlsx';
import { isNativeApp } from './nativeApp';
import { saveDirectDownload } from './nativeFile';

async function deliverBlob(blob, filename) {
  if (isNativeApp()) {
    await saveDirectDownload(blob, filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadTextFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  await deliverBlob(blob, filename);
}

export async function downloadBlob(blob, filename) {
  await deliverBlob(blob, filename);
}

export async function downloadPdf(doc, filename) {
  if (isNativeApp()) {
    const blob = doc.output('blob');
    await deliverBlob(blob, filename);
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
    await deliverBlob(blob, filename);
    return;
  }
  XLSX.writeFile(workbook, filename);
}
