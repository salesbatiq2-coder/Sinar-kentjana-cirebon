import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { NOORecord } from '../types';

export interface GeneratedPdfResult {
  blob: Blob;
  file: File;
  base64: string;
  fileName: string;
}

/**
 * Formats approval date specifically for official PDF filenames.
 * Checks leader approval date, clause date, or record date.
 */
export function formatApprovalDateForFilename(record: NOORecord): string {
  // 1. If leaderApprovedAt exists (ISO date timestamp)
  if (record.leaderApprovedAt) {
    try {
      const d = new Date(record.leaderApprovedAt);
      if (!isNaN(d.getTime())) {
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    } catch {
      // fallback
    }
  }

  // 2. If tanggalPengesahan and bulanPengesahan are filled in
  if (record.tanggalPengesahan && record.bulanPengesahan) {
    const tgl = String(record.tanggalPengesahan).trim().replace(/[._-]+/g, '');
    const bln = String(record.bulanPengesahan).trim().replace(/[._-]+/g, '');
    const thn = String(record.tahunPengesahan || new Date().getFullYear()).trim().replace(/[._-]+/g, '');
    if (tgl && bln) {
      return `${tgl} ${bln} ${thn}`;
    }
  }

  // 3. Fallback to updatedAt
  if (record.updatedAt) {
    try {
      const d = new Date(record.updatedAt);
      if (!isNaN(d.getTime())) {
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    } catch {
      // fallback
    }
  }

  // 4. Default to current date
  const now = new Date();
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Returns clean filename formatted as: "[Nama Toko] - [Tanggal Disetujui].pdf"
 */
export function getNOOPdfFileName(record: NOORecord): string {
  const rawToko = (record.namaToko || '').trim();
  // Strip illegal filesystem characters: / \ ? % * : | " < >
  const safeToko = rawToko.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim() || 'Toko';
  const approvedDate = formatApprovalDateForFilename(record);

  return `${safeToko} - ${approvedDate}.pdf`;
}

/**
 * Builds a jsPDF document from the rendered HTML element
 */
async function buildPdfFromElement(
  record: NOORecord,
  elementId: string
): Promise<{ pdf: jsPDF; fileName: string } | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    return null;
  }

  const fileName = getNOOPdfFileName(record);
  const cleanTitle = fileName.replace(/\.pdf$/i, '');
  document.title = cleanTitle;

  element.classList.add('force-render-pdf');
  const originalDisplay = element.style.display;
  const originalPosition = element.style.position;
  const originalLeft = element.style.left;
  const originalTop = element.style.top;
  const originalZIndex = element.style.zIndex;
  const originalWidth = element.style.width;

  try {
    element.style.setProperty('display', 'block', 'important');
    element.style.setProperty('position', 'fixed', 'important');
    element.style.setProperty('left', '0', 'important');
    element.style.setProperty('top', '0', 'important');
    element.style.setProperty('z-index', '99999', 'important');
    element.style.setProperty('width', '850px', 'important');
    element.style.setProperty('background', '#ffffff', 'important');

    // Wait for all images (logo, 5 mandatory photos, 3 signatures) to load
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // Short render frame pause for browser layout
    await new Promise((r) => setTimeout(r, 120));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 850
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth - 14; // 7mm margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 7;

    pdf.addImage(imgData, 'JPEG', 7, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 7, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return { pdf, fileName };
  } finally {
    element.classList.remove('force-render-pdf');
    element.style.display = originalDisplay;
    element.style.position = originalPosition;
    element.style.left = originalLeft;
    element.style.top = originalTop;
    element.style.zIndex = originalZIndex;
    element.style.width = originalWidth;
  }
}

/**
 * Downloads a direct PDF file of the specified NOO record.
 */
export async function downloadNOOPdf(
  record: NOORecord,
  elementId: string = 'printable-noo-document'
): Promise<boolean> {
  const fileName = getNOOPdfFileName(record);
  const cleanTitle = fileName.replace(/\.pdf$/i, '');
  document.title = cleanTitle;

  try {
    const result = await buildPdfFromElement(record, elementId);
    if (!result) {
      console.warn(`Element #${elementId} not found, falling back to window.print()`);
      window.print();
      return false;
    }
    result.pdf.save(result.fileName);
    return true;
  } catch (error) {
    console.error('Error generating direct PDF with html2canvas:', error);
    window.print();
    return false;
  }
}

/**
 * Generates and returns a PDF Blob and File object for attaching to email, Web Share API, or uploading.
 */
export async function getNOOPdfBlobAndFile(
  record: NOORecord,
  elementId: string = 'printable-noo-document'
): Promise<GeneratedPdfResult | null> {
  try {
    const result = await buildPdfFromElement(record, elementId);
    if (!result) return null;

    const blob = result.pdf.output('blob');
    const file = new File([blob], result.fileName, { type: 'application/pdf' });
    const base64 = result.pdf.output('datauristring');

    return {
      blob,
      file,
      base64,
      fileName: result.fileName
    };
  } catch (error) {
    console.error('Failed to generate PDF blob/file:', error);
    return null;
  }
}
