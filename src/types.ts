export type StoreCategory = 
  | 'Toko Listrik'
  | 'Toko Listrik (TK)'
  | 'Toko Bangunan'
  | 'Toko Bangunan (TB)'
  | 'Toko Elektronik'
  | 'Toko Elektronik(TE)'
  | 'Toko Kelontong'
  | 'Toko Kelontong (TK)'
  | 'Supermarket'
  | 'Supermarket (MM)'
  | 'Lainnya'
  | string;

export type StoreType = 
  | 'R'
  | 'RK'
  | 'SG'
  | 'SGK'
  | 'GS1'
  | 'GS1k'
  | 'GS2'
  | 'GS2k'
  | 'Lainnya'
  | string;

export type TermOfPayment = 
  | 'Cash Before Delivery (CBD)'
  | 'Cash On Delivery (COD)'
  | '7 Hari'
  | '14 Hari'
  | '21 Hari'
  | '28 Hari'
  | '30 Hari'
  | '45 Hari'
  | '55 Hari'
  | '60 Hari'
  | '85 Hari'
  | '100 Hari'
  | 'Custom'
  | string;

export type NOOStatus = 'Draft' | 'Menunggu Approval Leader' | 'Disetujui' | 'Ditolak';

export interface NOORecord {
  id: string;
  nooNumber: string; // e.g. NOO/SKG/2026/001
  createdAt: string;
  updatedAt: string;
  status: NOOStatus;

  // 1. Nama Toko
  namaToko: string;

  // 2. Kategori Toko
  kategoriToko: StoreCategory | string;

  // 3. Type Toko
  typeToko: StoreType | string;

  // 4. Alamat Toko
  alamatToko: string;

  // 5. Kota / Kabupaten
  kota: string;

  // Area Cover (Wilayah Distribusi / Jalur)
  areaCover: string;

  // 6. Pemilik Toko
  namaPemilik: string;

  // 7. Nomor HP / WA Pemilik
  nomorHp: string;

  // 8. Term of Payment (diisi leader)
  top: TermOfPayment | string;

  // 9. Limit Faktur (diisi leader)
  limitFaktur: number; // numeric value
  limitFakturFormatted: string; // formatted IDR

  // 10. Nama Sales
  namaSales: string;
  kodeSales?: string;

  // 11. GPS (Latitude, Longitude)
  gpsLatitude: string;
  gpsLongitude: string;
  gpsAccuracy?: number;
  gpsTimestamp?: string;
  googleMapsUrl?: string;

  // 12. Foto Toko Tampak Depan (Wajib)
  fotoTampakDepan: string; // base64 or url

  // 13. Foto Toko Tampak Dalam (Wajib)
  fotoTampakDalam: string; // base64 or url

  // 14. Foto Gudang (Wajib)
  fotoGudang: string; // base64 or url

  // 15. Foto Tanda Pengenal KTP/SIM (Wajib)
  fotoTandaPengenal: string; // base64 or url

  // 16. Foto Cap Toko (Wajib)
  fotoCapToko: string; // base64 or url

  // 17. Tanda Tangan Sales
  ttdSales: string; // canvas dataURL
  salesSignedAt?: string;

  // 18. Tanda Tangan Leader Pengesahan
  namaLeader: string;
  tempatPengesahan: string; // e.g. "Cirebon"
  tanggalPengesahan: string; // e.g. "29"
  bulanPengesahan: string; // e.g. "Oktober"
  tahunPengesahan: string; // e.g. "2026"
  teksPengesahanLengkap?: string; // e.g. "Cirebon, tanggal 29 bulan Oktober tahun 2026"
  ttdLeader: string; // canvas dataURL
  leaderApprovedAt?: string;
  catatanLeader?: string;

  // 19. Tanda Tangan Digital Toko
  namaPenandatanganToko: string;
  jabatanPenandatanganToko?: string; // Pemilik / Penanggung Jawab
  ttdToko: string; // canvas dataURL
  tokoSignedAt?: string;

  // Email submission metadata
  adminEmailNotification?: string;
  sentToEmailAt?: string;
}

export interface CameraModalState {
  isOpen: boolean;
  targetField: 'fotoTampakDepan' | 'fotoTampakDalam' | 'fotoGudang' | 'fotoTandaPengenal' | 'fotoCapToko' | null;
  fieldLabel: string;
}
