import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  User, 
  CreditCard, 
  ShieldCheck, 
  Camera, 
  Save, 
  Printer, 
  Download,
  RotateCcw, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  Share2
} from 'lucide-react';
import { 
  NOORecord, 
  StoreCategory, 
  StoreType, 
  TermOfPayment, 
  CameraModalState 
} from '../types';
import { getLeaderApprovalLink } from '../services/api';
import { 
  formatRupiah, 
  parseRupiah, 
  generateNOONumber, 
  updateNOONumberSales,
  getIndonesianDateComponents,
  MONTHS_ID,
  BRAND_COMPANY 
} from '../utils/formatters';
import { downloadNOOPdf } from '../utils/pdfGenerator';
import { GpsPicker } from './GpsPicker';
import { PhotoUploaderField } from './PhotoUploaderField';
import { SignaturePad } from './SignaturePad';
import { CameraCaptureModal } from './CameraCaptureModal';

interface NOOFormProps {
  currentRecord?: NOORecord | null;
  onSaveRecord: (record: NOORecord) => void;
  onSaveAndPrint: (record: NOORecord) => void;
  onSaveAndDownloadPdf?: (record: NOORecord) => void;
  existingCount: number;
}

const CATEGORY_OPTIONS: StoreCategory[] = [
  'Toko Listrik (TL)',
  'Toko Bangunan (TB)',
  'Toko Elektronik(TE)',
  'Toko Kelontong (TK)',
  'Supermarket (MM)',
  'Lainnya'
];

const STORE_TYPE_OPTIONS: StoreType[] = [
  'R',
  'RK',
  'SG',
  'SGK',
  'GS1',
  'GS1k',
  'GS2',
  'GS2k',
  'Lainnya'
];

const TOP_OPTIONS: TermOfPayment[] = [
  'Cash Before Delivery (CBD)',
  'Cash On Delivery (COD)',
  '7 Hari',
  '14 Hari',
  '28 Hari',
  '55 Hari',
  '85 Hari',
  '100 Hari',
  'Custom'
];

export const NOOForm: React.FC<NOOFormProps> = ({
  currentRecord,
  onSaveRecord,
  onSaveAndPrint,
  onSaveAndDownloadPdf,
  existingCount
}) => {
  const today = getIndonesianDateComponents();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Form states based on currentRecord or fresh defaults
  const [formData, setFormData] = useState<NOORecord>(() => {
    if (currentRecord) return currentRecord;

    return {
      id: 'noo-' + Date.now(),
      nooNumber: generateNOONumber(existingCount),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Menunggu Approval Leader',
      namaToko: '',
      kategoriToko: 'Toko Listrik',
      typeToko: 'R',
      alamatToko: '',
      kota: '',
      areaCover: '',
      namaPemilik: '',
      nomorHp: '',
      top: 'Menunggu Otorisasi Leader',
      limitFaktur: 0,
      limitFakturFormatted: 'Menunggu Otorisasi Leader',
      namaSales: '',
      kodeSales: '',
      gpsLatitude: '',
      gpsLongitude: '',
      fotoTampakDepan: '',
      fotoTampakDalam: '',
      fotoGudang: '',
      fotoTandaPengenal: '',
      fotoCapToko: '',
      ttdSales: '',
      namaLeader: 'Niko adi',
      tempatPengesahan: 'Cirebon',
      tanggalPengesahan: today.day,
      bulanPengesahan: today.month,
      tahunPengesahan: today.year,
      teksPengesahanLengkap: `Cirebon, tanggal ${today.day} bulan ${today.month} tahun ${today.year}`,
      ttdLeader: '',
      catatanLeader: '',
      namaPenandatanganToko: '',
      jabatanPenandatanganToko: 'Owner',
      ttdToko: '',
      adminEmailNotification: ''
    };
  });

  // Modal camera state
  const [cameraModal, setCameraModal] = useState<CameraModalState>({
    isOpen: false,
    targetField: null,
    fieldLabel: ''
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Update field helper
  const updateField = <K extends keyof NOORecord>(field: K, value: NOORecord[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Update formatted limit
      if (field === 'limitFaktur') {
        updated.limitFakturFormatted = formatRupiah(value as number);
      }

      // Update NOO number dynamically when sales name changes
      if (field === 'namaSales') {
        updated.nooNumber = updateNOONumberSales(prev.nooNumber, (value as string) || '', existingCount);
      }

      // Update full clause pengesahan leader
      if (
        field === 'tempatPengesahan' ||
        field === 'tanggalPengesahan' ||
        field === 'bulanPengesahan' ||
        field === 'tahunPengesahan'
      ) {
        const place = field === 'tempatPengesahan' ? (value as string) : prev.tempatPengesahan;
        const day = field === 'tanggalPengesahan' ? (value as string) : prev.tanggalPengesahan;
        const month = field === 'bulanPengesahan' ? (value as string) : prev.bulanPengesahan;
        const year = field === 'tahunPengesahan' ? (value as string) : prev.tahunPengesahan;
        updated.teksPengesahanLengkap = `${place || 'Cirebon'}, tanggal ${day || '.....'} bulan ${month || '.....'} tahun ${year || '2026'}`;
      }

      return updated;
    });
  };

  // Open camera modal for specific field
  const handleOpenLiveCamera = (
    field: 'fotoTampakDepan' | 'fotoTampakDalam' | 'fotoGudang' | 'fotoTandaPengenal' | 'fotoCapToko',
    fieldLabel: string
  ) => {
    setCameraModal({
      isOpen: true,
      targetField: field,
      fieldLabel
    });
  };

  const handlePhotoCaptured = (dataUrl: string) => {
    if (cameraModal.targetField) {
      updateField(cameraModal.targetField, dataUrl);
    }
  };

  // Validation
  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.namaToko.trim()) errors.push('1. Nama Toko wajib diisi.');
    if (!formData.kategoriToko) errors.push('2. Kategori Toko wajib dipilih.');
    if (!formData.typeToko) errors.push('3. Type Toko wajib dipilih.');
    if (!formData.alamatToko.trim()) errors.push('4. Alamat Toko wajib diisi.');
    if (!formData.kota.trim()) errors.push('5. Kota / Kabupaten wajib diisi.');
    if (!formData.namaPemilik.trim()) errors.push('6. Nama Pemilik Toko wajib diisi.');
    if (!formData.nomorHp.trim()) errors.push('7. Nomor HP/WA Pemilik wajib diisi.');
    if (!formData.namaSales.trim()) errors.push('10. Nama Sales wajib diisi.');

    // 5 Mandatory Photos check
    if (!formData.fotoTampakDepan) errors.push('12. Foto Toko Tampak Depan wajib diisi (kamera HP/upload).');
    if (!formData.fotoTampakDalam) errors.push('13. Foto Toko Tampak Dalam wajib diisi (kamera HP/upload).');
    if (!formData.fotoGudang) errors.push('14. Foto Gudang wajib diisi (kamera HP/upload).');
    if (!formData.fotoTandaPengenal) errors.push('15. Foto Tanda Pengenal (KTP/SIM) wajib diisi.');
    if (!formData.fotoCapToko) errors.push('16. Foto Cap / Stempel Toko wajib diisi.');

    // Signatures check
    if (!formData.ttdSales) errors.push('17. Tanda Tangan Sales wajib digoreskan.');
    if (!formData.ttdToko) errors.push('19. Tanda Tangan Digital Toko wajib digoreskan.');

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      window.scrollTo({ top: 200, behavior: 'smooth' });
      return;
    }

    const updated = {
      ...formData,
      updatedAt: new Date().toISOString()
    };
    onSaveRecord(updated);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 4000);
  };

  const handleSaveAndPrintClick = () => {
    if (!validateForm()) {
      window.scrollTo({ top: 200, behavior: 'smooth' });
      return;
    }
    const updated = {
      ...formData,
      updatedAt: new Date().toISOString()
    };
    onSaveAndPrint(updated);
  };

  const handleSaveAndDownloadPdfClick = async () => {
    if (!validateForm()) {
      window.scrollTo({ top: 200, behavior: 'smooth' });
      return;
    }
    const updated = {
      ...formData,
      updatedAt: new Date().toISOString()
    };
    onSaveRecord(updated);

    if (onSaveAndDownloadPdf) {
      onSaveAndDownloadPdf(updated);
    } else {
      setIsGeneratingPdf(true);
      try {
        await downloadNOOPdf(updated);
      } finally {
        setIsGeneratingPdf(false);
      }
    }
  };

  const handleReset = () => {
    if (!confirm('Apakah Anda yakin ingin mengosongkan formulir dan membuat NOO baru mas sales?')) return;
    setFormData({
      id: 'noo-' + Date.now(),
      nooNumber: generateNOONumber(existingCount + 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Menunggu Approval Leader',
      namaToko: '',
      kategoriToko: 'Toko Listrik',
      typeToko: 'R',
      alamatToko: '',
      kota: '',
      areaCover: '',
      namaPemilik: '',
      nomorHp: '',
      top: 'Menunggu Otorisasi Leader',
      limitFaktur: 0,
      limitFakturFormatted: 'Menunggu Otorisasi Leader',
      namaSales: '',
      kodeSales: '',
      gpsLatitude: '',
      gpsLongitude: '',
      fotoTampakDepan: '',
      fotoTampakDalam: '',
      fotoGudang: '',
      fotoTandaPengenal: '',
      fotoCapToko: '',
      ttdSales: '',
      namaLeader: 'Niko adi',
      tempatPengesahan: 'Cirebon',
      tanggalPengesahan: today.day,
      bulanPengesahan: today.month,
      tahunPengesahan: today.year,
      teksPengesahanLengkap: `Cirebon, tanggal ${today.day} bulan ${today.month} tahun ${today.year}`,
      ttdLeader: '',
      catatanLeader: '',
      namaPenandatanganToko: '',
      jabatanPenandatanganToko: 'Owner',
      ttdToko: '',
      adminEmailNotification: ''
    });
    setValidationErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 pb-24">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-emerald-700 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-xs font-bold">Data NOO Berhasil Disimpan!</div>
            <div className="text-[11px] text-emerald-200">
              Tersimpan di database lokal & siap dikirim via email / dicetak.
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors Box */}
      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 text-red-800 font-bold text-xs mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>Harap lengkapi kolom wajib berikut ({validationErrors.length}):</span>
          </div>
          <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Form Title Banner */}
        <div className="p-4 sm:p-5 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
              Formulir Pendaftaran Resmi
            </span>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              NEW OPEN OUTLET (NOO) — SINAR KENTJANA GROUP
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Distributor Resmi Alat Listrik • Cirebon - Jawa Barat
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Nomor Dokumen:</span>
            <span className="font-mono text-sm font-bold text-emerald-300">
              {formData.nooNumber}
            </span>
            <span className="block text-[10px] text-emerald-400/80 font-sans mt-0.5">
              NOO/SK/[SALES]/[TAHUN]/[NO]
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          {/* SECTION 1: DATA IDENTITAS OUTLET */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
              <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                A
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                1. Data Identitas Toko & Pemilik
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Nama Toko */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. Nama Toko <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.namaToko}
                    onChange={(e) => updateField('namaToko', e.target.value)}
                    placeholder="Contoh: Toko Listrik SINAR KENTJANA"
                    className="w-full text-xs font-medium pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* 2. Kategori Toko */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  2. Kategori Toko <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                  {CATEGORY_OPTIONS.filter((c) => c !== 'Lainnya').map((cat) => {
                    const isSelected = formData.kategoriToko === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => updateField('kategoriToko', cat)}
                        className={`px-2.5 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => updateField('kategoriToko', 'Lainnya')}
                    className={`px-2.5 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                      formData.kategoriToko === 'Lainnya' ||
                      !CATEGORY_OPTIONS.includes(formData.kategoriToko as StoreCategory)
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    Lainnya...
                  </button>
                </div>
                {(formData.kategoriToko === 'Lainnya' ||
                  !CATEGORY_OPTIONS.includes(formData.kategoriToko as StoreCategory)) && (
                  <input
                    type="text"
                    value={formData.kategoriToko === 'Lainnya' ? '' : formData.kategoriToko}
                    onChange={(e) => updateField('kategoriToko', e.target.value || 'Lainnya')}
                    placeholder="Ketik kategori toko lainnya..."
                    className="w-full text-xs font-medium px-3 py-2 bg-white border border-emerald-400 rounded-lg focus:ring-1 focus:ring-emerald-600 outline-none"
                  />
                )}
              </div>

              {/* 3. Type Toko Pilihan: R, RK, SG, SGK, GS1, GS1k, GS2, GS2k, Lainnya */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  3. Type Toko <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-5 gap-1.5 mb-2">
                  {STORE_TYPE_OPTIONS.map((typeOpt) => {
                    const standardTypes = ['R', 'RK', 'SG', 'SGK', 'GS1', 'GS1k', 'GS2', 'GS2k'];
                    const isSelected =
                      formData.typeToko === typeOpt ||
                      (typeOpt === 'Lainnya' && !standardTypes.includes(formData.typeToko));
                    return (
                      <button
                        key={typeOpt}
                        type="button"
                        onClick={() => updateField('typeToko', typeOpt)}
                        className={`px-2 py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs ring-2 ring-emerald-600/30'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30'
                        }`}
                      >
                        {typeOpt}
                      </button>
                    );
                  })}
                </div>
                {(formData.typeToko === 'Lainnya' ||
                  !['R', 'RK', 'SG', 'SGK', 'GS1', 'GS1k', 'GS2', 'GS2k'].includes(formData.typeToko)) && (
                  <input
                    type="text"
                    value={formData.typeToko === 'Lainnya' ? '' : formData.typeToko}
                    onChange={(e) => updateField('typeToko', e.target.value || 'Lainnya')}
                    placeholder="Ketik spesifikasi type toko lainnya..."
                    className="w-full text-xs font-medium px-3 py-2 bg-white border border-emerald-400 rounded-lg focus:ring-1 focus:ring-emerald-600 outline-none"
                  />
                )}
              </div>

              {/* 4. Alamat Toko */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  4. Alamat Lengkap Toko <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.alamatToko}
                  onChange={(e) => updateField('alamatToko', e.target.value)}
                  placeholder="Jl. Raya / No., RT/RW, Desa/Kelurahan, Kecamatan..."
                  className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none resize-y"
                />
              </div>

              {/* 5. Kota / Kabupaten */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  5. Kota / Kabupaten <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.kota}
                    onChange={(e) => updateField('kota', e.target.value)}
                    placeholder="Contoh: Cirebon, Kuningan, Majalengka, indramayu..."
                    className="w-full text-xs font-medium pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* Area Cover/Rayon */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Area Cover (Wilayah / Jalur Distribusi/Rayon) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.areaCover || ''}
                  onChange={(e) => updateField('areaCover', e.target.value)}
                  placeholder="Contoh: Pekalongan, Wonosobo, Karawang, Tasik..."
                  className="w-full text-xs font-medium px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                />
              </div>

              {/* 6. Nama Pemilik Toko */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  6. Pemilik Toko <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.namaPemilik}
                    onChange={(e) => {
                      updateField('namaPemilik', e.target.value);
                      if (!formData.namaPenandatanganToko) {
                        updateField('namaPenandatanganToko', e.target.value);
                      }
                    }}
                    placeholder="Nama lengkap pemilik toko"
                    className="w-full text-xs font-medium pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* 7. Nomor HP / WA Pemilik */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  7. Nomor HP / WhatsApp Pemilik <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={formData.nomorHp}
                    onChange={(e) => updateField('nomorHp', e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full text-xs font-mono pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* 10. Nama Sales */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  10. Nama Sales Yang Mengajukan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.namaSales}
                  onChange={(e) => updateField('namaSales', e.target.value)}
                  placeholder="Nama sales person yang melakukan survei"
                  className="w-full text-xs font-medium px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                />
              </div>
            </div>

            {/* 11. GPS Location */}
            <div className="pt-2">
              <GpsPicker
                latitude={formData.gpsLatitude}
                longitude={formData.gpsLongitude}
                accuracy={formData.gpsAccuracy}
                onCoordinatesChange={(lat, lng, acc) => {
                  updateField('gpsLatitude', lat);
                  updateField('gpsLongitude', lng);
                  if (acc !== undefined) updateField('gpsAccuracy', acc);
                }}
              />
            </div>
          </section>

          {/* SECTION 2: 5 FOTO WAJIB OUTLET */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                  B
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    2. Lampiran 5 Foto Wajib (Kamera HP Langsung di Web)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Semua 5 foto di bawah wajib diambil langsung menggunakan kamera HP di lokasi
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                Semua Wajib
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 12. Foto Tampak Depan */}
              <PhotoUploaderField
                fieldNumber={12}
                label="Foto Toko Tampak Depan"
                description="Plang toko & fasad bangunan terlihat jelas"
                photoUrl={formData.fotoTampakDepan}
                onOpenLiveCamera={() =>
                  handleOpenLiveCamera('fotoTampakDepan', '12. Foto Toko Tampak Depan')
                }
                onFileSelected={(dataUrl) => updateField('fotoTampakDepan', dataUrl)}
                onRemovePhoto={() => updateField('fotoTampakDepan', '')}
              />

              {/* 13. Foto Tampak Dalam */}
              <PhotoUploaderField
                fieldNumber={13}
                label="Foto Toko Tampak Dalam"
                description="Rak display, etalase, dan stok barang dagangan"
                photoUrl={formData.fotoTampakDalam}
                onOpenLiveCamera={() =>
                  handleOpenLiveCamera('fotoTampakDalam', '13. Foto Toko Tampak Dalam')
                }
                onFileSelected={(dataUrl) => updateField('fotoTampakDalam', dataUrl)}
                onRemovePhoto={() => updateField('fotoTampakDalam', '')}
              />

              {/* 14. Foto Gudang */}
              <PhotoUploaderField
                fieldNumber={14}
                label="Foto Gudang Toko"
                description="Area penyimpanan stok cadangan toko"
                photoUrl={formData.fotoGudang}
                onOpenLiveCamera={() =>
                  handleOpenLiveCamera('fotoGudang', '14. Foto Gudang Toko')
                }
                onFileSelected={(dataUrl) => updateField('fotoGudang', dataUrl)}
                onRemovePhoto={() => updateField('fotoGudang', '')}
              />

              {/* 15. Foto Tanda Pengenal */}
              <PhotoUploaderField
                fieldNumber={15}
                label="Foto Tanda Pengenal (KTP / SIM)"
                description="Foto e-KTP / SIM pemilik toko terbaca jelas"
                photoUrl={formData.fotoTandaPengenal}
                onOpenLiveCamera={() =>
                  handleOpenLiveCamera('fotoTandaPengenal', '15. Foto Tanda Pengenal KTP/SIM')
                }
                onFileSelected={(dataUrl) => updateField('fotoTandaPengenal', dataUrl)}
                onRemovePhoto={() => updateField('fotoTandaPengenal', '')}
              />

              {/* 16. Foto Cap Toko */}
              <PhotoUploaderField
                fieldNumber={16}
                label="Foto Cap / Stempel Toko"
                description="Stempel basah fisik toko di atas kertas"
                photoUrl={formData.fotoCapToko}
                onOpenLiveCamera={() =>
                  handleOpenLiveCamera('fotoCapToko', '16. Foto Cap / Stempel Fisik Toko')
                }
                onFileSelected={(dataUrl) => updateField('fotoCapToko', dataUrl)}
                onRemovePhoto={() => updateField('fotoCapToko', '')}
              />
            </div>
          </section>

          {/* SECTION 3: TANDA TANGAN DIGITAL (17 & 19) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                  C
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    3. Tanda Tangan Digital (Sales & Toko)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tanda tangan digital Sales dan Pemilik Toko. Plafon Limit, TOP & TTD Leader disahkan secara terpisah di Web Otorisasi Leader.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                2 Pihak Penandatangan
              </span>
            </div>

            {/* Otorisasi Leader Notice */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Catatan Otorisasi Leader:</strong> Ketentuan Plafon Limit Faktur, TOP (Term of Payment), dan Tanda Tangan Pengesahan Leader diisi serta disahkan secara khusus oleh Leader melalui Portal Otorisasi Leader (bukan pada form sales ini).
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 17. TTD Sales */}
              <SignaturePad
                label="17. Tanda Tangan Sales"
                subLabel="Sales Penanggung Jawab"
                nameValue={formData.namaSales}
                onNameChange={(name) => updateField('namaSales', name)}
                namePlaceholder="Nama Sales..."
                signatureDataUrl={formData.ttdSales}
                onSignatureChange={(sig) => updateField('ttdSales', sig)}
                canvasHeightClass="h-[50vh] min-h-[380px] sm:h-[440px] md:h-[480px]"
              />

              {/* 19. TTD Toko */}
              <SignaturePad
                label="19. Tanda Tangan Toko"
                subLabel="Pemilik / Penanggung Jawab"
                nameValue={formData.namaPenandatanganToko}
                onNameChange={(name) => updateField('namaPenandatanganToko', name)}
                namePlaceholder="Nama Pemilik Toko..."
                signatureDataUrl={formData.ttdToko}
                onSignatureChange={(sig) => updateField('ttdToko', sig)}
                canvasHeightClass="h-[50vh] min-h-[380px] sm:h-[440px] md:h-[480px]"
              />
            </div>
          </section>

          {/* Action Buttons Bar */}
          <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Form Baru</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* WhatsApp Share Link for Leader Remote Approval */}
              <button
                type="button"
                onClick={() => {
                  const link = getLeaderApprovalLink(formData.id);
                  const message = `Halo Leader / Otorisator Sinar Kentjana,\nMohon pengesahan & otorisasi NOO Toko Baru berikut:\n\n*Nama Toko:* ${formData.namaToko || '-'}\n*Kota:* ${formData.kota || '-'}\n*Sales:* ${formData.namaSales || '-'}\n*No NOO:* ${formData.nooNumber}\n\nSilakan klik tautan verifikasi jarak jauh ini langsung dari HP Anda untuk mengisi Plafon Limit, TOP, dan Tanda Tangan Pengesahan:\n${link}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
                }}
                title="Bagi Link Verifikasi ke WhatsApp Leader agar bisa disetujui dari HP lain"
                className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Kirim Link ke WA Leader</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>Simpan NOO Toko Baru</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Camera Modal Viewfinder */}
      <CameraCaptureModal
        isOpen={cameraModal.isOpen}
        onClose={() => setCameraModal((prev) => ({ ...prev, isOpen: false }))}
        title={cameraModal.fieldLabel}
        onPhotoCaptured={handlePhotoCaptured}
        metadataStoreName={formData.namaToko}
        metadataGps={
          formData.gpsLatitude && formData.gpsLongitude
            ? `${formData.gpsLatitude}, ${formData.gpsLongitude}`
            : undefined
        }
      />
    </div>
  );
};
