import * as XLSX from 'xlsx';
import { NOORecord } from '../types';

export const BRAND_COMPANY = {
  name: 'SINAR KENTJANA GROUP',
  brandName: 'BATIQ ELECTRICAL CIREBON',
  address: 'Jalan Raya Ciperna No 2, Cirebon 45152 - Jawa Barat',
  phone: '0231 - 483632',
  email: '',
  social: '@batiqelectric',
  logoUrl: '/assets/aistudio/WhatsApp_Image_2026-10-29_at_14.13.17_79c6ebc9.jpeg'
};

export const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function getIndonesianDateComponents(date: Date = new Date()) {
  return {
    day: String(date.getDate()),
    month: MONTHS_ID[date.getMonth()],
    year: String(date.getFullYear()),
    full: `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`
  };
}

export function formatRupiah(amount: number | string): string {
  const num = typeof amount === 'string' ? parseRupiah(amount) : amount;
  if (isNaN(num) || num === 0) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function parseRupiah(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

export function formatDateTimeID(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export function buildGoogleMapsUrl(lat: string, lng: string): string {
  if (!lat || !lng) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(lat.trim())},${encodeURIComponent(lng.trim())}`;
}

export function formatSalesNameForCode(namaSales?: string): string {
  if (!namaSales || !namaSales.trim()) return 'SALES';
  const clean = namaSales
    .trim()
    .toUpperCase()
    .replace(/[/\\?%*:|"<>#]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'SALES';
}

export function generateNOONumber(existingCount: number = 0, namaSales?: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const index = String(existingCount + 1).padStart(3, '0');
  const cleanSales = formatSalesNameForCode(namaSales);
  return `NOO/SK/${cleanSales}/${year}/${index}`;
}

export function updateNOONumberSales(currentNooNumber: string, newSalesName: string, existingCount: number = 0): string {
  const cleanSales = formatSalesNameForCode(newSalesName);
  const currentYear = new Date().getFullYear();
  const defaultIndex = String(existingCount + 1).padStart(3, '0');

  if (!currentNooNumber) {
    return `NOO/SK/${cleanSales}/${currentYear}/${defaultIndex}`;
  }

  // Parse existing number formats:
  // 1. NOO/SK/2026/001 (old 4-part format)
  // 2. NOO/SK/SALES/2026/001 (new 5-part format)
  // 3. NOO/SK/DIMAS/2026/001
  const parts = currentNooNumber.split('/');
  if (parts.length === 4 && parts[0] === 'NOO' && parts[1] === 'SK') {
    const yr = parts[2] || String(currentYear);
    const idx = parts[3] || defaultIndex;
    return `NOO/SK/${cleanSales}/${yr}/${idx}`;
  } else if (parts.length >= 5 && parts[0] === 'NOO' && parts[1] === 'SK') {
    const yr = parts[parts.length - 2] || String(currentYear);
    const idx = parts[parts.length - 1] || defaultIndex;
    return `NOO/SK/${cleanSales}/${yr}/${idx}`;
  }

  return `NOO/SK/${cleanSales}/${currentYear}/${defaultIndex}`;
}

export function exportNOOToExcel(records: NOORecord[], fileName?: string) {
  const data = records.map((r, i) => ({
    'No': i + 1,
    'Nomor NOO': r.nooNumber,
    'Status': r.status,
    'Tanggal Pengajuan': formatDateTimeID(r.createdAt),
    '1. Nama Toko': r.namaToko,
    '2. Kategori Toko': r.kategoriToko,
    '3. Type Toko': r.typeToko,
    '4. Alamat Toko': r.alamatToko,
    '5. Kota': r.kota,
    'Area Cover': r.areaCover || '-',
    '6. Pemilik Toko': r.namaPemilik,
    '7. No. HP Pemilik': r.nomorHp,
    '8. TOP (Term of Payment)': r.top || '-',
    '9. Limit Faktur (Rp)': r.limitFaktur,
    '10. Nama Sales': r.namaSales,
    '11. Koordinat GPS': `${r.gpsLatitude || ''}, ${r.gpsLongitude || ''}`,
    'Google Maps Link': r.googleMapsUrl || buildGoogleMapsUrl(r.gpsLatitude, r.gpsLongitude),
    '12. Foto Depan Ada': r.fotoTampakDepan ? 'Ya (Terlampir)' : 'Tidak',
    '13. Foto Dalam Ada': r.fotoTampakDalam ? 'Ya (Terlampir)' : 'Tidak',
    '14. Foto Gudang Ada': r.fotoGudang ? 'Ya (Terlampir)' : 'Tidak',
    '15. Foto KTP Ada': r.fotoTandaPengenal ? 'Ya (Terlampir)' : 'Tidak',
    '16. Foto Cap Toko Ada': r.fotoCapToko ? 'Ya (Terlampir)' : 'Tidak',
    '17. TTD Sales': r.ttdSales ? 'Tertandatangani' : 'Belum',
    '18. TTD Leader Pengesahan': r.ttdLeader ? `Disahkan (${r.teksPengesahanLengkap || r.namaLeader})` : 'Belum Disahkan',
    '19. TTD Toko': r.ttdToko ? `Tertandatangani (${r.namaPenandatanganToko})` : 'Belum',
    'Catatan Leader': r.catatanLeader || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Column width styling
  const colWidths = [
    { wch: 5 },  // No
    { wch: 18 }, // No NOO
    { wch: 22 }, // Status
    { wch: 18 }, // Tanggal
    { wch: 24 }, // Toko
    { wch: 18 }, // Kategori
    { wch: 16 }, // Type
    { wch: 35 }, // Alamat
    { wch: 15 }, // Kota
    { wch: 20 }, // Pemilik
    { wch: 16 }, // No HP
    { wch: 20 }, // TOP
    { wch: 18 }, // Limit Faktur
    { wch: 18 }, // Sales
    { wch: 22 }, // GPS
    { wch: 35 }, // Maps Link
    { wch: 16 }, // Foto 1
    { wch: 16 }, // Foto 2
    { wch: 16 }, // Foto 3
    { wch: 16 }, // Foto 4
    { wch: 16 }, // Foto 5
    { wch: 16 }, // TTD Sales
    { wch: 30 }, // TTD Leader
    { wch: 25 }, // TTD Toko
    { wch: 25 }  // Catatan
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data NOO Sinar Kentjana');

  const targetName = fileName || `Data_NOO_Sinar_Kentjana_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, targetName);
}

export function buildEmailBodyText(record: NOORecord): string {
  return `FORM PENGAJUAN NEW OPEN OUTLET (NOO)
SINAR KENTJANA GROUP - BATIQ ELECTRICAL CIREBON
==================================================
Nomor Dokumen : ${record.nooNumber}
Tanggal Input : ${formatDateTimeID(record.createdAt)}
Status NOO    : ${record.status}

1. DATA TOKO
--------------------------------------------------
Nama Toko     : ${record.namaToko}
Kategori Toko : ${record.kategoriToko}
Type Toko     : ${record.typeToko}
Alamat Toko   : ${record.alamatToko}
Kota/Kab      : ${record.kota}
Area Cover    : ${record.areaCover || '-'}
Nama Pemilik  : ${record.namaPemilik}
Nomor HP/WA   : ${record.nomorHp}

2. KETENTUAN TRANSAKSI (DIISI OLEH LEADER)
--------------------------------------------------
Term of Payment (TOP) : ${record.top || 'Menunggu Pengisian Leader'}
Limit Faktur          : ${formatRupiah(record.limitFaktur)}

3. SALES & LOKASI
--------------------------------------------------
Nama Sales   : ${record.namaSales}
Lokasi GPS   : ${record.gpsLatitude || '-'}, ${record.gpsLongitude || '-'}
Google Maps  : ${record.googleMapsUrl || buildGoogleMapsUrl(record.gpsLatitude, record.gpsLongitude)}

4. VERIFIKASI DOKUMEN & FOTO (5/5 WAJIB)
--------------------------------------------------
- Foto Toko Tampak Depan : ${record.fotoTampakDepan ? 'SUDAH TERVERIFIKASI' : 'BELUM'}
- Foto Toko Tampak Dalam : ${record.fotoTampakDalam ? 'SUDAH TERVERIFIKASI' : 'BELUM'}
- Foto Gudang            : ${record.fotoGudang ? 'SUDAH TERVERIFIKASI' : 'BELUM'}
- Foto Tanda Pengenal    : ${record.fotoTandaPengenal ? 'SUDAH TERVERIFIKASI' : 'BELUM'}
- Foto Cap Toko Fisik    : ${record.fotoCapToko ? 'SUDAH TERVERIFIKASI' : 'BELUM'}

5. PENGESAHAN TANDA TANGAN DIGITAL
--------------------------------------------------
- Sales Penanggung Jawab : ${record.namaSales} (${record.ttdSales ? 'Sudah TTD' : 'Belum'})
- Pengesahan Toko        : ${record.namaPenandatanganToko} (${record.ttdToko ? 'Sudah TTD' : 'Belum'})
- Pengesahan Leader      : ${record.namaLeader || '-'} (${record.ttdLeader ? 'Sudah TTD' : 'Menunggu Approval'})
- Keterangan Pengesahan  : ${record.teksPengesahanLengkap || '-'}

Catatan Leader : ${record.catatanLeader || 'Belum ada catatan'}

==================================================
Dikirim secara otomatis dari Aplikasi NOO Sinar Kentjana Group
Jalan Raya Ciperna No 2, Cirebon 45152 - Jawa Barat
Telp: 0231-483632 | Email: ${BRAND_COMPANY.email}
`;
}
