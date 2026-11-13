import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Download, 
  Trash2, 
  Eye, 
  ShieldCheck, 
  FileSpreadsheet,
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Edit3,
  Share2,
  Copy,
  Check,
  Calendar,
  AlertCircle,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { NOORecord, NOOStatus } from '../types';
import { 
  formatRupiah, 
  parseRupiah,
  formatDateTimeID, 
  exportNOOToExcel, 
  buildGoogleMapsUrl,
  MONTHS_ID,
  getIndonesianDateComponents
} from '../utils/formatters';
import { downloadNOOPdf } from '../utils/pdfGenerator';
import { SignaturePad } from './SignaturePad';
import { getLeaderApprovalLink, apiApproveRecord, MAX_STORED_RECORDS, getRecordCreatedTime } from '../services/api';

interface AdminPortalProps {
  records: NOORecord[];
  onUpdateRecord: (updated: NOORecord) => void;
  onDeleteRecord: (id: string, auth?: { username: string; password: string }) => void;
  onSelectPrint: (record: NOORecord) => void;
  onDownloadPdf?: (record: NOORecord) => void;
  onEditInForm: (record: NOORecord) => void;
}

const STANDARD_TOP_OPTIONS = [
  'Cash Before Delivery (CBD)',
  'Cash On Delivery (COD)',
  '7 Hari',
  '14 Hari',
  '21 Hari',
  '28 Hari',
  '30 Hari',
  '45 Hari',
  '55 Hari',
  '60 Hari',
  '85 Hari',
  '100 Hari',
  'Custom'
];

const PRESET_LIMITS = [
  { label: '5 Jt', value: 5000000 },
  { label: '10 Jt', value: 10000000 },
  { label: '15 Jt', value: 15000000 },
  { label: '20 Jt', value: 20000000 },
  { label: '25 Jt', value: 25000000 },
  { label: '50 Jt', value: 50000000 },
  { label: '100 Jt', value: 100000000 }
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  records,
  onUpdateRecord,
  onDeleteRecord,
  onDownloadPdf,
  onEditInForm
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | NOOStatus>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Check if logged in user is strictly sk01 (Leader)
  const authUser = (typeof window !== 'undefined' ? sessionStorage.getItem('ske_auth_user') : '') || '';
  const isLeaderLoggedIn = authUser.trim().toLowerCase() === 'sk01';
  const hasOpenedUrlLeaderModalRef = useRef(false);

  // Helper to copy leader approval link
  const handleCopyApprovalLink = (record: NOORecord) => {
    const link = getLeaderApprovalLink(record.id);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  // Helper to open WhatsApp to send approval link directly to leader
  const handleShareWhatsApp = (record: NOORecord) => {
    const link = getLeaderApprovalLink(record.id);
    const message = `Semangat Pagi,\nMohon verifikasi & approve NOO berikut:\n\n*Nama Toko:* ${record.namaToko}\n*Kota:* ${record.kota}\n*Sales:* ${record.namaSales}\n*No NOO:* ${record.nooNumber}\n*Status:* ${record.status}\n*Nilai Awal Order:*..\n*Catatan:*..\n\nbuka tautan otorisasi di bawah ini untuk menetapkan Limit Plafon, TOP, Catatan, dan Tanda Tangan Digital: @085724450934\n\n${link}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Leader Authorization Delete Modal State
  const [recordToDelete, setRecordToDelete] = useState<NOORecord | null>(null);
  const [deleteLeaderUser, setDeleteLeaderUser] = useState<string>('');
  const [deleteLeaderPass, setDeleteLeaderPass] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleInitiateDelete = (record: NOORecord) => {
    setRecordToDelete(record);
    setDeleteLeaderUser('');
    setDeleteLeaderPass('');
    setDeleteReason('');
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const cleanUser = deleteLeaderUser.trim().toLowerCase();
    const cleanPass = deleteLeaderPass.trim();

    const isAuthorized = cleanUser === 'sk01' && cleanPass === 'pastibisa';
    if (!isAuthorized) {
      setDeleteError('Otorisasi Gagal: Username atau Password Leader salah! Penghapusan data pengajuan hanya berhak disahkan oleh Leader.');
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteRecord(recordToDelete.id, { username: cleanUser, password: cleanPass });
      alert(`Data pengajuan toko "${recordToDelete.namaToko}" (${recordToDelete.nooNumber}) berhasil dihapus dengan otorisasi resmi Leader Sales.`);
      setRecordToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      setDeleteError('Gagal menghapus data dari server. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Modal detail & approval states
  const [selectedRecord, setSelectedRecord] = useState<NOORecord | null>(null);
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
  const [leaderForm, setLeaderForm] = useState<{
    top: string;
    isCustomTop: boolean;
    customTopStr: string;
    limitFaktur: number;
    limitInputStr: string;
    namaLeader: string;
    ttdLeader: string;
    catatanLeader: string;
    status: NOOStatus;
    tempatPengesahan: string;
    tanggalPengesahan: string;
    bulanPengesahan: string;
    tahunPengesahan: string;
    teksPengesahan: string;
  }>({
    top: '30 Hari',
    isCustomTop: false,
    customTopStr: '',
    limitFaktur: 10000000,
    limitInputStr: 'Rp 10.000.000',
    namaLeader: 'NIKO ADI.',
    ttdLeader: '',
    catatanLeader: '',
    status: 'Disetujui',
    tempatPengesahan: 'Cirebon',
    tanggalPengesahan: '29',
    bulanPengesahan: 'Oktober',
    tahunPengesahan: '2026',
    teksPengesahan: 'Cirebon, tanggal 29 bulan Oktober tahun 2026'
  });

  // Extract unique cities
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.kota) set.add(r.kota.trim());
    });
    return Array.from(set);
  }, [records]);

  // Filtered records (always sorted newest-first)
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const matchesSearch =
          r.namaToko.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.nooNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.namaSales.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.namaPemilik.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.kota.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
        const matchesCity = cityFilter === 'ALL' || r.kota.toLowerCase() === cityFilter.toLowerCase();

        return matchesSearch && matchesStatus && matchesCity;
      })
      .sort((a, b) => getRecordCreatedTime(b) - getRecordCreatedTime(a));
  }, [records, searchTerm, statusFilter, cityFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = records.length;
    const pending = records.filter((r) => r.status === 'Menunggu Approval Leader').length;
    const approved = records.filter((r) => r.status === 'Disetujui').length;
    const totalLimit = records
      .filter((r) => r.status === 'Disetujui')
      .reduce((sum, r) => sum + (r.limitFaktur || 0), 0);

    return { total, pending, approved, totalLimit };
  }, [records]);

  // Open leader approval modal with fully populated editable fields (Strictly sk01 only)
  const handleOpenLeaderModal = (record: NOORecord) => {
    if (!isLeaderLoggedIn) {
      alert('Akses Ditolak: Web Otorisasi hanya dapat digunakan oleh akun Leader.');
      return;
    }
    setSelectedRecord(record);
    const dateComp = getIndonesianDateComponents();
    
    // Determine TOP
    const recordTop = record.top && record.top !== 'Menunggu Otorisasi Leader' ? record.top.trim() : '30 Hari';
    const isKnownTop = STANDARD_TOP_OPTIONS.some((opt) => opt.toLowerCase() === recordTop.toLowerCase() && opt !== 'Custom');
    const matchedTop = isKnownTop ? (STANDARD_TOP_OPTIONS.find((opt) => opt.toLowerCase() === recordTop.toLowerCase()) || '30 Hari') : 'Custom';
    
    // Determine Limit
    const initialLimit = typeof record.limitFaktur === 'number' && record.limitFaktur > 0 ? record.limitFaktur : 10000000;
    
    // Determine Date Clause
    const tempat = record.tempatPengesahan || 'Cirebon';
    const tanggal = record.tanggalPengesahan || dateComp.day;
    const bulan = record.bulanPengesahan || dateComp.month;
    const tahun = record.tahunPengesahan || dateComp.year;
    const defaultTeks = `${tempat}, tanggal ${tanggal} bulan ${bulan} tahun ${tahun}`;
    const teks = record.teksPengesahanLengkap || defaultTeks;

    setLeaderForm({
      top: matchedTop,
      isCustomTop: !isKnownTop,
      customTopStr: !isKnownTop ? recordTop : '',
      limitFaktur: initialLimit,
      limitInputStr: formatRupiah(initialLimit),
      namaLeader: record.namaLeader && record.namaLeader.trim() ? record.namaLeader : 'NIKO ADI.',
      ttdLeader: record.ttdLeader || '',
      catatanLeader: record.catatanLeader || '',
      status: record.status === 'Menunggu Approval Leader' ? 'Disetujui' : record.status,
      tempatPengesahan: tempat,
      tanggalPengesahan: tanggal,
      bulanPengesahan: bulan,
      tahunPengesahan: tahun,
      teksPengesahan: teks
    });

    setIsLeaderModalOpen(true);
  };

  // Auto-open modal when opened directly via Leader WhatsApp approval link (?mode=leader&id=...)
  useEffect(() => {
    if (hasOpenedUrlLeaderModalRef.current || isLeaderModalOpen) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('id');
      const mode = params.get('mode');

      if (targetId && records.length > 0) {
        const found = records.find((r) => r.id === targetId);
        if (found) {
          hasOpenedUrlLeaderModalRef.current = true;
          if (mode === 'leader' && isLeaderLoggedIn) {
            handleOpenLeaderModal(found);
          } else {
            setSelectedRecord(found);
          }
        }
      }
    } catch (e) {
      console.warn('Error reading URL parameters in AdminPortal:', e);
    }
  }, [records, isLeaderModalOpen, isLeaderLoggedIn]);

  // Helper to re-generate the date clause string when date parts change
  const updateDateClause = (tempat: string, tgl: string, bln: string, thn: string) => {
    const clause = `${tempat || 'Cirebon'}, tanggal ${tgl || '1'} bulan ${bln || 'Januari'} tahun ${thn || '2026'}`;
    setLeaderForm((prev) => ({
      ...prev,
      tempatPengesahan: tempat,
      tanggalPengesahan: tgl,
      bulanPengesahan: bln,
      tahunPengesahan: thn,
      teksPengesahan: clause
    }));
  };

  // Save leader approval (Strictly sk01 only)
  const handleSaveLeaderApproval = async () => {
    if (!selectedRecord) return;
    if (!isLeaderLoggedIn) {
      alert('Akses Ditolak: Otorisasi pengesahan NOO hanya dapat dilakukan oleh akun Leader.');
      return;
    }

    // Validate Signature
    if (!leaderForm.ttdLeader || !leaderForm.ttdLeader.trim()) {
      const proceed = confirm('Tanda tangan leader masih kosong. Apakah Anda ingin tetap menyimpan pengesahan tanpa tanda tangan?');
      if (!proceed) return;
    }

    // Determine resolved TOP value
    const resolvedTop = leaderForm.isCustomTop
      ? (leaderForm.customTopStr.trim() || 'Custom')
      : leaderForm.top;

    // Determine resolved Limit
    const resolvedLimit = leaderForm.limitFaktur >= 0 ? leaderForm.limitFaktur : 0;
    const resolvedLimitFormatted = formatRupiah(resolvedLimit);

    setIsSubmittingApproval(true);

    try {
      const approvalPayload = {
        top: resolvedTop,
        limitFaktur: resolvedLimit,
        limitFakturFormatted: resolvedLimitFormatted,
        namaLeader: leaderForm.namaLeader.trim() || 'NIKO ADI.',
        ttdLeader: leaderForm.ttdLeader,
        catatanLeader: leaderForm.catatanLeader.trim(),
        status: leaderForm.status,
        tempatPengesahan: leaderForm.tempatPengesahan,
        tanggalPengesahan: leaderForm.tanggalPengesahan,
        bulanPengesahan: leaderForm.bulanPengesahan,
        tahunPengesahan: leaderForm.tahunPengesahan,
        teksPengesahan: leaderForm.teksPengesahan
      };

      const res = await apiApproveRecord(selectedRecord.id, approvalPayload);
      if (!res.success || !res.data) {
        alert(res.message || 'Akses Ditolak: Otorisasi pengesahan hanya dapat dilakukan oleh akun Leader.');
        return;
      }

      const updatedRecord: NOORecord = res.data;

      onUpdateRecord(updatedRecord);
      setSelectedRecord(updatedRecord);
      setIsLeaderModalOpen(false);

      // Clean URL if mode=leader was in search params
      if (window.history.replaceState) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      alert(`Pengesahan Otorisasi Leader untuk Toko "${updatedRecord.namaToko}" berhasil disimpan! Status: ${updatedRecord.status}.`);
    } catch (err) {
      console.error('Failed to save leader approval:', err);
      alert('Terjadi kendala saat menyimpan otorisasi leader. Silakan coba lagi.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      {/* Leader Identity Banner if SKE01 logged in */}
      {isLeaderLoggedIn && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-200">
                Portal Otorisasi Leader Aktif (User: SK01)
              </div>
              <div className="text-sm font-semibold text-white">
                Anda memiliki akses penuh menetapkan Plafon Limit Faktur, Term of Payment (TOP), Catatan & TTD Pengesahan.
              </div>
            </div>
          </div>
          <div className="text-xs bg-black/25 px-3 py-1.5 rounded-lg font-mono text-amber-100 shrink-0">
            Leader: NIKO ADI.
          </div>
        </div>
      )}

      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Pengajuan NOO
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {stats.total} <span className="text-sm font-semibold text-slate-400">/ {MAX_STORED_RECORDS}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Maks. {MAX_STORED_RECORDS} toko terbaru (data terlama otomatis terhapus jika &gt; {MAX_STORED_RECORDS})
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center justify-between">
            <span>Menunggu Approval</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1 tabular-nums">
            {stats.pending}
          </div>
          <div className="text-[11px] text-amber-700 mt-1">
            Perlu penetapan TOP, Plafon Limit & TTD
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
            <span>Outlet Disetujui</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">
            {stats.approved}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Siap order dan buka faktur penjualan
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Plafon Limit Disetujui
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1 font-mono tabular-nums truncate">
            {formatRupiah(stats.totalLimit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total eksposur kredit aktif
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan Nama Toko, No NOO, Sales, Pemilik, Kota..."
            className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-600 outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | NOOStatus)}
            className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-600 outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="Menunggu Approval Leader">Menunggu Approval</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Ditolak">Ditolak</option>
          </select>

          {/* City Filter */}
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-600 outline-none"
          >
            <option value="ALL">Semua Kota</option>
            {uniqueCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          {/* Export to Excel */}
          <button
            onClick={() => exportNOOToExcel(filteredRecords)}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel ({filteredRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="text-xs font-bold text-slate-800">
            Daftar Pengajuan NOO ({filteredRecords.length} / {MAX_STORED_RECORDS} Outlet Terbaru)
          </div>
          <div className="text-xs text-slate-500">
            Pengajuan terbaru tampil di atas • Batas simpan {MAX_STORED_RECORDS} toko (pengajuan terlama otomatis dihapus jika &gt; {MAX_STORED_RECORDS})
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3.5 align-middle">Dokumen & Toko</th>
                <th className="py-3 px-3 align-middle">Kategori & Type</th>
                <th className="py-3 px-3 align-middle">Kota & Alamat</th>
                <th className="py-3 px-3 align-middle">Pemilik & Kontak</th>
                <th className="py-3 px-3 align-middle">Ketentuan (TOP & Limit)</th>
                <th className="py-3 px-3 align-middle">Sales & GPS</th>
                <th className="py-3 px-3 text-center align-middle">Status</th>
                <th className="py-3 px-3 text-right align-middle">Aksi Otorisasi & Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada data NOO yang tersimpan.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Toko */}
                    <td className="py-3 px-3.5 align-middle">
                      <div className="font-bold text-slate-900 leading-snug">
                        {r.namaToko}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-800">
                        {r.nooNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatDateTimeID(r.createdAt)}
                      </div>
                    </td>

                    {/* Kategori & Type */}
                    <td className="py-3 px-3 align-middle">
                      <div className="font-medium text-slate-800">{r.kategoriToko}</div>
                      <div className="text-[11px] text-slate-500">{r.typeToko}</div>
                    </td>

                    {/* Kota & Alamat */}
                    <td className="py-3 px-3 align-middle max-w-[200px]">
                      <div className="font-bold text-slate-900">{r.kota}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-2">
                        {r.alamatToko}
                      </div>
                    </td>

                    {/* Pemilik */}
                    <td className="py-3 px-3 align-middle">
                      <div className="font-semibold text-slate-900">{r.namaPemilik}</div>
                      <div className="text-[11px] font-mono text-slate-600">{r.nomorHp}</div>
                    </td>

                    {/* Ketentuan TOP & Limit */}
                    <td className="py-3 px-3 align-middle">
                      <div className={`font-bold ${r.top && r.top !== 'Menunggu Otorisasi Leader' ? 'text-slate-800' : 'text-amber-700 italic'}`}>
                        {r.top || 'Menunggu Otorisasi'}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-emerald-800">
                        {r.limitFaktur && r.limitFaktur > 0 ? formatRupiah(r.limitFaktur) : (r.limitFakturFormatted || 'Menunggu Otorisasi')}
                      </div>
                      {r.ttdLeader ? (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>TTD Leader Ada</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                          Belum TTD Leader
                        </div>
                      )}
                    </td>

                    {/* Sales & GPS */}
                    <td className="py-3 px-3 align-middle">
                      <div className="font-semibold text-slate-900">{r.namaSales}</div>
                      {r.gpsLatitude && r.gpsLongitude ? (
                        <a
                          href={buildGoogleMapsUrl(r.gpsLatitude, r.gpsLongitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline"
                        >
                          <span>Peta GPS</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">Tanpa GPS</span>
                      )}
                    </td>

                    {/* Status Badge - Centered & Aligned Middle */}
                    <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                      {r.status === 'Disetujui' && (
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Disetujui</span>
                        </span>
                      )}
                      {r.status === 'Menunggu Approval Leader' && (
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-bold text-amber-800 bg-amber-100 rounded-full">
                          <span>Perlu Approval</span>
                        </span>
                      )}
                      {r.status === 'Ditolak' && (
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-bold text-red-800 bg-red-100 rounded-full">
                          <XCircle className="w-3 h-3 text-red-700" />
                          <span>Ditolak</span>
                        </span>
                      )}
                    </td>

                    {/* Action Buttons with explicit labels - Strictly Horizontal (Mendatar) */}
                    <td className="py-3 px-3 text-right align-middle whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap">
                        {/* Leader Direct Otorisasi Button */}
                        {isLeaderLoggedIn && (
                          <button
                            type="button"
                            onClick={() => handleOpenLeaderModal(r)}
                            title="Otorisasi Langsung Toko Ini (Leader)"
                            className="px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-400 rounded-lg inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Otorisasi</span>
                          </button>
                        )}

                        {/* Share to WA Leader */}
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(r)}
                          title="Bagi Link Otorisasi ke WhatsApp Leader"
                          className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                        >
                          <Share2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>Share</span>
                        </button>

                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(r)}
                          title="Lihat Detail & Foto Lengkap"
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span>Lihat</span>
                        </button>

                        {/* Download PDF */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onDownloadPdf) {
                              onDownloadPdf(r);
                            } else {
                              downloadNOOPdf(r);
                            }
                          }}
                          title="Download Berkas PDF NOO"
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span>Download</span>
                        </button>

                        {/* Edit in form */}
                        <button
                          type="button"
                          onClick={() => onEditInForm(r)}
                          title="Edit Formulir"
                          className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-lg inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Edit</span>
                        </button>

                        {/* Delete - Requires Leader Authorization */}
                        <button
                          type="button"
                          onClick={() => handleInitiateDelete(r)}
                          title="Hapus Data (Wajib Otorisasi Leader)"
                          className="px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg inline-flex items-center gap-1 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedRecord && !isLeaderModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setSelectedRecord(null)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-sm font-bold">{selectedRecord.namaToko}</h3>
                <p className="text-xs text-emerald-400 font-mono">{selectedRecord.nooNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onDownloadPdf) {
                      onDownloadPdf(selectedRecord);
                    } else {
                      downloadNOOPdf(selectedRecord);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="text-slate-400 hover:text-white p-1 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Status Header & Remote Share Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs text-slate-500">Status Otorisasi: </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    selectedRecord.status === 'Disetujui'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedRecord.status === 'Ditolak'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedRecord.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isLeaderLoggedIn && (
                    <button
                      type="button"
                      onClick={() => handleOpenLeaderModal(selectedRecord)}
                      className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs"
                      title="Buka Form Pengesahan & Otorisasi Leader"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Otorisasi Toko Ini</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(selectedRecord)}
                    className="text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs"
                    title="Kirim tautan langsung ke WhatsApp Leader"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Kirim Link ke WA Leader</span>
                  </button>
                </div>
              </div>

              {/* Data Table Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Kategori Toko:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.kategoriToko}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Type Toko:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.typeToko}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Kota:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.kota}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Pemilik Toko:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.namaPemilik}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">No. HP / WA:</span>
                  <span className="font-bold text-slate-900 font-mono">{selectedRecord.nomorHp}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Sales Pengaju:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.namaSales}</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-amber-800 block">Term of Payment:</span>
                  <span className="font-bold text-slate-900">{selectedRecord.top || 'Menunggu Otorisasi'}</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-amber-800 block">Limit Faktur:</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {selectedRecord.limitFaktur && selectedRecord.limitFaktur > 0
                      ? formatRupiah(selectedRecord.limitFaktur)
                      : (selectedRecord.limitFakturFormatted || 'Menunggu Otorisasi')}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block">Titik GPS:</span>
                  <span className="font-mono text-[11px]">{selectedRecord.gpsLatitude}, {selectedRecord.gpsLongitude}</span>
                </div>
              </div>

              {/* Photos Gallery */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">5 Foto Dokumentasi Lapangan:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'Tampak Depan', src: selectedRecord.fotoTampakDepan },
                    { label: 'Tampak Dalam', src: selectedRecord.fotoTampakDalam },
                    { label: 'Gudang Toko', src: selectedRecord.fotoGudang },
                    { label: 'KTP / SIM', src: selectedRecord.fotoTandaPengenal },
                    { label: 'Cap Toko', src: selectedRecord.fotoCapToko }
                  ].map((p, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-1 bg-slate-50 text-center">
                      <div className="text-[10px] font-bold text-slate-700 truncate mb-1">{p.label}</div>
                      <div className="h-20 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                        {p.src ? (
                          <img src={p.src} alt={p.label} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-400">Kosong</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signatures Review */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">Tanda Tangan Pengesahan:</h4>
                <div className="grid grid-cols-3 gap-3 border border-slate-200 rounded-xl p-3 bg-slate-50 text-center text-xs">
                  <div>
                    <div className="text-[11px] font-bold text-slate-700">Sales</div>
                    <div className="h-16 flex items-center justify-center">
                      {selectedRecord.ttdSales ? (
                        <img src={selectedRecord.ttdSales} alt="TTD Sales" className="max-h-16" />
                      ) : (
                        <span className="text-slate-400 italic">Belum TTD</span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 border-t border-slate-200 pt-1">
                      ( {selectedRecord.namaSales} )
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-slate-700">Toko</div>
                    <div className="h-16 flex items-center justify-center">
                      {selectedRecord.ttdToko ? (
                        <img src={selectedRecord.ttdToko} alt="TTD Toko" className="max-h-16" />
                      ) : (
                        <span className="text-slate-400 italic">Belum TTD</span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 border-t border-slate-200 pt-1">
                      ( {selectedRecord.namaPenandatanganToko || selectedRecord.namaPemilik} )
                    </div>
                  </div>

                  <div className="bg-amber-50/70 rounded-lg p-1 border border-amber-200">
                    <div className="text-[11px] font-bold text-slate-900">Leader Sales</div>
                    <div className="text-[10px] text-amber-900">{selectedRecord.teksPengesahanLengkap || '-'}</div>
                    <div className="h-16 flex items-center justify-center">
                      {selectedRecord.ttdLeader ? (
                        <img src={selectedRecord.ttdLeader} alt="TTD Leader" className="max-h-16" />
                      ) : (
                        <span className="text-amber-800 font-medium italic">Belum Disahkan</span>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 border-t border-slate-200 pt-1">
                      ( {selectedRecord.namaLeader || 'Belum Ada'} )
                    </div>
                  </div>
                </div>
              </div>

              {/* Catatan Leader Preview */}
              {selectedRecord.catatanLeader && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                  <div className="font-bold text-amber-900 mb-0.5">Catatan Leader:</div>
                  <div className="text-slate-800 whitespace-pre-wrap">{selectedRecord.catatanLeader}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LEADER APPROVAL MODAL - STRICTLY SK01 LEADER ONLY */}
      {isLeaderLoggedIn && isLeaderModalOpen && selectedRecord && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs"
          onClick={() => setIsLeaderModalOpen(false)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-amber-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-xs">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5 text-white" />
                  <span>Pengesahan Otorisasi Leader Sales (Sinar Kentjana)</span>
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Toko: <strong className="text-white">{selectedRecord.namaToko}</strong> ({selectedRecord.kota}) • {selectedRecord.nooNumber}
                </p>
              </div>
              <button
                onClick={() => setIsLeaderModalOpen(false)}
                className="text-amber-100 hover:text-white p-1 text-sm font-bold rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 text-xs">
              {/* Informational Guidance */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Formulir Otorisasi Leader</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Silakan tentukan <strong>Term of Payment (TOP)</strong>, <strong>Plafon Limit Faktur</strong>, <strong>Catatan Pengesahan</strong>, dan goreskan <strong>Tanda Tangan Digital</strong> di bawah ini.
                  </p>
                </div>
              </div>

              {/* Outlet Summary Pill */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px]">
                <div>
                  <span className="text-slate-500 block">Kategori / Type:</span>
                  <span className="font-bold text-slate-800">{selectedRecord.kategoriToko} / {selectedRecord.typeToko}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pemilik / Kontak:</span>
                  <span className="font-bold text-slate-800">{selectedRecord.namaPemilik} ({selectedRecord.nomorHp})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sales Pengaju:</span>
                  <span className="font-bold text-slate-800">{selectedRecord.namaSales}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Kota:</span>
                  <span className="font-bold text-slate-800">{selectedRecord.kota}</span>
                </div>
              </div>

              {/* SECTION: TOP & Plafon Limit */}
              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4">
                <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2">
                  1. Ketentuan Transaksi (Ditetapkan Leader)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* TOP Dropdown + Custom */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Term of Payment (TOP) *
                    </label>
                    <select
                      value={leaderForm.top}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Custom') {
                          setLeaderForm((prev) => ({ ...prev, top: 'Custom', isCustomTop: true }));
                        } else {
                          setLeaderForm((prev) => ({ ...prev, top: val, isCustomTop: false, customTopStr: '' }));
                        }
                      }}
                      className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                    >
                      {STANDARD_TOP_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {leaderForm.isCustomTop && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={leaderForm.customTopStr}
                          onChange={(e) => setLeaderForm((prev) => ({ ...prev, customTopStr: e.target.value }))}
                          placeholder="Ketik ketentuan TOP khusus, misal: 14 hari setelah faktur"
                          className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg outline-none focus:border-amber-600"
                        />
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Pilih dari daftar standar atau pilih &ldquo;Custom&rdquo; untuk mengetik manual.
                    </span>
                  </div>

                  {/* Limit Faktur with Presets */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Plafon Limit Faktur (Rp) *
                    </label>
                    <input
                      type="text"
                      value={leaderForm.limitInputStr}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const digits = raw.replace(/\D/g, '');
                        const num = digits ? parseInt(digits, 10) : 0;
                        setLeaderForm((prev) => ({
                          ...prev,
                          limitFaktur: num,
                          limitInputStr: digits ? formatRupiah(num) : ''
                        }));
                      }}
                      onBlur={() => {
                        setLeaderForm((prev) => ({
                          ...prev,
                          limitInputStr: formatRupiah(prev.limitFaktur)
                        }));
                      }}
                      placeholder="Rp 0"
                      className="w-full text-sm font-mono font-bold p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                    />

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {PRESET_LIMITS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setLeaderForm((prev) => ({
                              ...prev,
                              limitFaktur: preset.value,
                              limitInputStr: formatRupiah(preset.value)
                            }));
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-colors ${
                            leaderForm.limitFaktur === preset.value
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Keputusan & Catatan */}
              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4">
                <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2">
                  2. Keputusan & Catatan Otorisasi
                </div>

                {/* Status Decision Radio */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">
                    Status Keputusan:
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-800 text-xs">
                      <input
                        type="radio"
                        name="approval_status"
                        checked={leaderForm.status === 'Disetujui'}
                        onChange={() => setLeaderForm((prev) => ({ ...prev, status: 'Disetujui' }))}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Disetujui (Approved)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-red-700 text-xs">
                      <input
                        type="radio"
                        name="approval_status"
                        checked={leaderForm.status === 'Ditolak'}
                        onChange={() => setLeaderForm((prev) => ({ ...prev, status: 'Ditolak' }))}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span>Ditolak (Rejected)</span>
                    </label>
                  </div>
                </div>

                {/* Catatan Leader (Multi-line editable textarea) */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Catatan Leader / Arahan Transaksi:
                  </label>
                  <textarea
                    rows={3}
                    value={leaderForm.catatanLeader}
                    onChange={(e) => setLeaderForm((prev) => ({ ...prev, catatanLeader: e.target.value }))}
                    placeholder="Tulis catatan plafon, syarat transaksi perdana, atau ketentuan khusus toko baru ini..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              {/* SECTION: Klausul Tempat & Tanggal Pengesahan */}
              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  <span>3. Klausul Tempat & Tanggal Pengesahan</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tempat</label>
                    <input
                      type="text"
                      value={leaderForm.tempatPengesahan}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateDateClause(v, leaderForm.tanggalPengesahan, leaderForm.bulanPengesahan, leaderForm.tahunPengesahan);
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={leaderForm.tanggalPengesahan}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateDateClause(leaderForm.tempatPengesahan, v, leaderForm.bulanPengesahan, leaderForm.tahunPengesahan);
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bulan</label>
                    <select
                      value={leaderForm.bulanPengesahan}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateDateClause(leaderForm.tempatPengesahan, leaderForm.tanggalPengesahan, v, leaderForm.tahunPengesahan);
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      {MONTHS_ID.map((bln) => (
                        <option key={bln} value={bln}>
                          {bln}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tahun</label>
                    <input
                      type="text"
                      value={leaderForm.tahunPengesahan}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateDateClause(leaderForm.tempatPengesahan, leaderForm.tanggalPengesahan, leaderForm.bulanPengesahan, v);
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Teks Klausul Lengkap (Tercetak di Atas Tanda Tangan):
                  </label>
                  <input
                    type="text"
                    value={leaderForm.teksPengesahan}
                    onChange={(e) => setLeaderForm((prev) => ({ ...prev, teksPengesahan: e.target.value }))}
                    className="w-full p-2.5 font-medium bg-amber-50 border border-amber-200 rounded-lg text-amber-950 font-mono text-xs"
                  />
                </div>
              </div>

              {/* SECTION: Tanda Tangan Digital Leader */}
              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2">
                  4. Tanda Tangan Digital Pengesahan Leader Sales
                </div>

                <div className="bg-white rounded-xl p-2 border border-slate-200">
                  <SignaturePad
                    label="Tanda Tangan Otorisasi Leader Sales"
                    subLabel="Goreskan tanda tangan digital pengesahan di bawah ini (bisa disentuh langsung di layar HP/komputer):"
                    nameValue={leaderForm.namaLeader}
                    onNameChange={(name) => setLeaderForm((prev) => ({ ...prev, namaLeader: name }))}
                    signatureDataUrl={leaderForm.ttdLeader}
                    onSignatureChange={(sig) => setLeaderForm((prev) => ({ ...prev, ttdLeader: sig }))}
                    headerPrefixText={leaderForm.teksPengesahan}
                    canvasHeightClass="h-[50vh] min-h-[360px] sm:h-[420px] md:h-[450px]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLeaderModalOpen(false)}
                  disabled={isSubmittingApproval}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveLeaderApproval}
                  disabled={isSubmittingApproval}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingApproval ? 'Menyimpan...' : 'Simpan & Sahkan Otorisasi'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL OTORISASI LEADER UNTUK HAPUS DATA */}
      {recordToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => {
            if (!isDeleting) setRecordToDelete(null);
          }}
        >
          <div
            className="bg-white border border-red-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 text-white flex items-center justify-between border-b border-red-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-600/30 text-red-300 rounded-xl border border-red-500/40">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Otorisasi Leader Hapus Data</span>
                  </h3>
                  <p className="text-[11px] text-red-200">
                    Penghapusan data toko wajib disahkan oleh Leader Sales
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) setRecordToDelete(null);
                }}
                className="text-slate-400 hover:text-white p-1 text-sm font-bold rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs">
              {/* Security Warning Notice */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong className="font-bold block text-red-950 mb-0.5">Proteksi Data Pengajuan Sinar Kentjana:</strong>
                  Data yang sudah di-input tersimpan aman dan tidak boleh hilang. Sesuai instruksi manajemen, setiap penghapusan data toko <strong className="text-red-950">WAJIB diotorisasi oleh Leader Sales</strong>.
                </div>
              </div>

              {/* Shop Info Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Data Toko yang Diajukan Dihapus:</span>
                  <span className="font-mono text-emerald-700 font-bold">{recordToDelete.nooNumber}</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900">{recordToDelete.namaToko}</div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                  <div>Kota: <strong className="text-slate-800">{recordToDelete.kota || '-'}</strong></div>
                  <div>Sales: <strong className="text-slate-800">{recordToDelete.namaSales || '-'}</strong></div>
                  <div>Status: <span className="font-bold text-amber-700">{recordToDelete.status}</span></div>
                  <div>Limit: <strong className="text-slate-800">{recordToDelete.limitFakturFormatted || formatRupiah(recordToDelete.limitFaktur)}</strong></div>
                </div>
              </div>

              {/* Error Alert */}
              {deleteError && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 flex items-start gap-2 animate-shake">
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{deleteError}</span>
                </div>
              )}

              {/* Credentials Input */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Username Leader Otorisasi *
                  </label>
                  <input
                    type="text"
                    value={deleteLeaderUser}
                    onChange={(e) => setDeleteLeaderUser(e.target.value)}
                    placeholder="Masukkan username leader"
                    autoComplete="off"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Password Leader Otorisasi *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={deleteLeaderPass}
                      onChange={(e) => setDeleteLeaderPass(e.target.value)}
                      placeholder="Masukkan kata sandi leader"
                      autoComplete="new-password"
                      autoFocus
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Alasan Penghapusan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Contoh: Toko ganda, salah input sales, pembatalan toko..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:border-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) setRecordToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Memproses...' : 'Otorisasi & Hapus Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

