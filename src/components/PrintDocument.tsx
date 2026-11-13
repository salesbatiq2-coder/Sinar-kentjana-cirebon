import React from 'react';
import { NOORecord } from '../types';
import { BRAND_COMPANY, formatRupiah, formatDateTimeID } from '../utils/formatters';

interface PrintDocumentProps {
  record: NOORecord;
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({ record }) => {
  return (
    <div id="printable-noo-document" className="print-only print-container max-w-4xl mx-auto p-4 bg-white text-slate-900 font-sans">
      {/* Official Sinar Kentjana Letterhead */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between gap-4">
          <img 
            src={BRAND_COMPANY.logoUrl} 
            alt="Sinar Kentjana Group" 
            className="w-full max-w-[420px] h-auto object-contain block"
          />
          <div className="text-right text-[10px] text-slate-600 leading-tight">
            <p className="font-bold text-slate-900 text-xs">{BRAND_COMPANY.name}</p>
            <p>{BRAND_COMPANY.address}</p>
            <p>Telp: {BRAND_COMPANY.phone} | {BRAND_COMPANY.social}</p>
            <p className="text-emerald-800 font-semibold mt-0.5">Dokumen Resmi Registrasi Outlet Baru</p>
          </div>
        </div>
      </div>

      {/* Document Title & Meta Bar */}
      <div className="bg-slate-100 border border-slate-300 rounded p-2 mb-4 flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-sm tracking-wide text-slate-900">
            FORM NEW OPEN OUTLET (NOO)
          </span>
          <span className="ml-2 text-slate-600 font-mono">
            No: {record.nooNumber}
          </span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-slate-700">Tanggal: </span>
          <span>{formatDateTimeID(record.createdAt)}</span>
          <span className="ml-3 px-2 py-0.5 bg-emerald-800 text-white font-bold rounded text-[10px]">
            {record.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Grid of 19 Template Fields */}
      <div className="border border-slate-300 rounded overflow-hidden text-xs mb-4">
        <div className="bg-slate-800 text-white font-bold px-3 py-1.5 text-xs">
          I. DATA IDENTITAS OUTLET BARU
        </div>
        
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="w-1/4 p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                1. Nama Toko
              </td>
              <td className="w-1/4 p-2 font-semibold text-slate-900 border-r border-slate-200">
                {record.namaToko || '-'}
              </td>
              <td className="w-1/4 p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                2. Kategori Toko
              </td>
              <td className="w-1/4 p-2 font-medium text-slate-800">
                {record.kategoriToko || '-'}
              </td>
            </tr>

            <tr className="border-b border-slate-200">
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                3. Type Toko
              </td>
              <td className="p-2 font-medium text-slate-800 border-r border-slate-200">
                {record.typeToko || '-'}
              </td>
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                5. Kota / Kabupaten
              </td>
              <td className="p-2 font-semibold text-slate-900">
                {record.kota || '-'}
              </td>
            </tr>

            <tr className="border-b border-slate-200">
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                Area Cover / Jalur
              </td>
              <td className="p-2 font-semibold text-emerald-900 border-r border-slate-200">
                {record.areaCover || '-'}
              </td>
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                6. Pemilik Toko
              </td>
              <td className="p-2 font-semibold text-slate-900">
                {record.namaPemilik || '-'}
              </td>
            </tr>

            <tr className="border-b border-slate-200">
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                7. Nomor HP / WA Pemilik
              </td>
              <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200">
                {record.nomorHp || '-'}
              </td>
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                10. Sales Penanggung Jawab
              </td>
              <td className="p-2 font-bold text-slate-900">
                {record.namaSales || '-'} {record.kodeSales ? `(${record.kodeSales})` : ''}
              </td>
            </tr>

            <tr className="border-b border-slate-200">
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200 align-top">
                4. Alamat Lengkap Toko
              </td>
              <td colSpan={3} className="p-2 font-medium text-slate-800">
                {record.alamatToko || '-'}
              </td>
            </tr>

            <tr className="border-b border-slate-200">
              <td className="p-2 font-bold bg-slate-50 text-slate-700 border-r border-slate-200">
                11. Titik Koordinat GPS Toko
              </td>
              <td colSpan={3} className="p-2 font-mono text-xs">
                {record.gpsLatitude && record.gpsLongitude ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">
                      Latitude: {record.gpsLatitude} | Longitude: {record.gpsLongitude}
                    </span>
                    <span className="text-[10px] text-emerald-800 underline truncate">
                      {record.googleMapsUrl || `https://maps.google.com/?q=${record.gpsLatitude},${record.gpsLongitude}`}
                    </span>
                  </div>
                ) : (
                  '-'
                )}
              </td>
            </tr>

            {/* Leader Section for TOP & Limit Faktur */}
            <tr className="bg-amber-50/70 border-b border-slate-300">
              <td className="p-2.5 font-bold text-amber-950 border-r border-slate-200">
                8. Term of Payment (TOP)
                <span className="block text-[10px] font-normal text-amber-800">(Ketentuan Leader)</span>
              </td>
              <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200 text-sm">
                {record.top || 'Menunggu Pengisian Leader'}
              </td>
              <td className="p-2.5 font-bold text-amber-950 border-r border-slate-200">
                9. Limit Faktur
                <span className="block text-[10px] font-normal text-amber-800">(Plafon Kredit Leader)</span>
              </td>
              <td className="p-2.5 font-mono font-bold text-emerald-800 text-sm">
                {formatRupiah(record.limitFaktur)}
              </td>
            </tr>

            {record.catatanLeader && (
              <tr>
                <td className="p-2 font-bold bg-amber-50/90 text-amber-950 border-r border-slate-200">
                  Catatan Pengesahan Leader
                </td>
                <td colSpan={3} className="p-2 italic text-slate-700">
                  &ldquo;{record.catatanLeader}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* II. Foto Tanda Pengenal (KTP / SIM Pemilik Toko) - TERSENDIRI & BESAR */}
      <div className="border-2 border-emerald-700 rounded-lg overflow-hidden text-xs mb-4 bg-white print-break-inside-avoid">
        <div className="bg-emerald-800 text-white font-bold px-3 py-2 text-xs flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
            <span>II. FOTO TANDA PENGENAL (KTP / SIM PEMILIK TOKO) — DOKUMEN IDENTITAS KHUSUS</span>
          </div>
          <span className="text-[10px] font-medium bg-emerald-900 px-2 py-0.5 rounded text-emerald-200">
            Tampilan Skala Besar & Terpisah
          </span>
        </div>

        <div className="p-3 bg-emerald-50/30 flex flex-col md:flex-row gap-4 items-center">
          {/* medium KTP Photo Frame */}
          <div className="w-full md:w-3/5 border-2 border-slate-300 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center min-h-[220px] max-h-[300px]">
            {record.fotoTandaPengenal ? (
              <img 
                src={record.fotoTandaPengenal} 
                alt="Foto KTP / SIM Pemilik Toko" 
                className="w-full h-full object-contain max-h-[280px]" 
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <span className="text-xs font-bold block mb-1">Foto KTP / SIM Belum Dilampirkan</span>
                <span className="text-[10px] italic">Wajib difoto langsung via kamera HP</span>
              </div>
            )}
          </div>

          {/* KTP Verification Details Panel */}
          <div className="w-full md:w-2/5 space-y-2 bg-white p-3 rounded-lg border border-emerald-200 text-xs">
            <div className="font-bold text-slate-800 border-b border-slate-200 pb-1">
              Verifikasi Identitas Pemilik Toko
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Nama Lengkap Pemilik:</span>
              <span className="font-bold text-slate-900">{record.namaPemilik || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Nomor HP / WhatsApp:</span>
              <span className="font-bold text-slate-900 font-mono">{record.nomorHp || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Kota / Area Cover:</span>
              <span className="font-medium text-slate-800">{record.kota || '-'} ({record.areaCover || 'Area Umum'})</span>
            </div>
            <div className="pt-1.5 border-t border-slate-100 text-[10px] text-emerald-800 font-medium">
              ✓ Foto KTP/SIM ini diverifikasi langsung saat kunjungan sales ganteng di lokasi outlet.
            </div>
          </div>
        </div>
      </div>

      {/* III. Foto Fisik Toko (4 Foto Dokumentasi Lebih Besar - Grid 2x2) */}
      <div className="border border-slate-300 rounded-lg overflow-hidden text-xs mb-4 print-break-inside-avoid">
        <div className="bg-slate-800 text-white font-bold px-3 py-1.5 text-xs flex justify-between items-center">
          <span>III. DOKUMENTASI FISIK OUTLET (4 FOTO TOKO LAPANGAN — RESOLUSI BESAR)</span>
          <span className="text-[10px] font-normal text-emerald-300">Format 2x2 Foto Detail</span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50">
          {/* 12. Foto Tampak Depan */}
          <div className="border border-slate-300 rounded-lg bg-white p-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
              <span>12. Foto Tampak Depan Toko</span>
              <span className="text-[9px] text-emerald-700 font-semibold">Tampak Plang & Fasad</span>
            </div>
            <div className="h-48 bg-slate-100 flex items-center justify-center overflow-hidden rounded border border-slate-200">
              {record.fotoTampakDepan ? (
                <img src={record.fotoTampakDepan} alt="Tampak Depan" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-400 italic">Belum Ada Foto</span>
              )}
            </div>
          </div>

          {/* 13. Foto Tampak Dalam */}
          <div className="border border-slate-300 rounded-lg bg-white p-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
              <span>13. Foto Tampak Dalam Toko</span>
              <span className="text-[9px] text-emerald-700 font-semibold">Etalase & Rak Barang</span>
            </div>
            <div className="h-48 bg-slate-100 flex items-center justify-center overflow-hidden rounded border border-slate-200">
              {record.fotoTampakDalam ? (
                <img src={record.fotoTampakDalam} alt="Tampak Dalam" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-400 italic">Belum Ada Foto</span>
              )}
            </div>
          </div>

          {/* 14. Foto Gudang Toko */}
          <div className="border border-slate-300 rounded-lg bg-white p-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
              <span>14. Foto Gudang Penyimpanan</span>
              <span className="text-[9px] text-emerald-700 font-semibold">Kapasitas Stok</span>
            </div>
            <div className="h-48 bg-slate-100 flex items-center justify-center overflow-hidden rounded border border-slate-200">
              {record.fotoGudang ? (
                <img src={record.fotoGudang} alt="Gudang Toko" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-400 italic">Belum Ada Foto</span>
              )}
            </div>
          </div>

          {/* 16. Foto Cap / Stempel Toko */}
          <div className="border border-slate-300 rounded-lg bg-white p-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
              <span>16. Foto Cap / Stempel Basah Toko</span>
              <span className="text-[9px] text-emerald-700 font-semibold">Legalitas Toko</span>
            </div>
            <div className="h-48 bg-slate-100 flex items-center justify-center overflow-hidden rounded border border-slate-200">
              {record.fotoCapToko ? (
                <img src={record.fotoCapToko} alt="Cap Toko" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-400 italic">Belum Ada Foto</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* IV. Lembar Pengesahan Tanda Tangan (3 TTD: Sales, Toko, Leader) */}
      <div className="border border-slate-300 rounded-lg overflow-hidden text-xs print-break-inside-avoid">
        <div className="bg-slate-800 text-white font-bold px-3 py-1.5 text-xs">
          IV. PENGESAHAN TANDA TANGAN ELEKTRONIK (SALES, TOKO & LEADER)
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-300 bg-white">
          {/* 17. TTD Sales */}
          <div className="p-3 flex flex-col justify-between text-center min-h-[175px]">
            <div>
              <div className="font-bold text-slate-800 text-xs">
                17. Sales Penanggung Jawab
              </div>
              <div className="text-[10px] text-slate-500">
                Pengaju Permohonan NOO
              </div>
            </div>

            <div className="my-2 h-20 flex items-center justify-center">
              {record.ttdSales ? (
                <img src={record.ttdSales} alt="TTD Sales" className="max-h-20 max-w-full object-contain" />
              ) : (
                <div className="text-[10px] text-slate-300 italic">( Belum TTD )</div>
              )}
            </div>

            <div className="border-t border-slate-300 pt-1 font-bold text-slate-900 text-xs">
              ( {record.namaSales || '_________________'} )
            </div>
          </div>

          {/* 19. TTD Toko */}
          <div className="p-3 flex flex-col justify-between text-center min-h-[175px]">
            <div>
              <div className="font-bold text-slate-800 text-xs">
                19. Pihak Pemilik / Toko
              </div>
              <div className="text-[10px] text-slate-500">
                Persetujuan Ketentuan NOO
              </div>
            </div>

            <div className="my-2 h-20 flex items-center justify-center">
              {record.ttdToko ? (
                <img src={record.ttdToko} alt="TTD Toko" className="max-h-20 max-w-full object-contain" />
              ) : (
                <div className="text-[10px] text-slate-300 italic">( Belum TTD )</div>
              )}
            </div>

            <div className="border-t border-slate-300 pt-1 font-bold text-slate-900 text-xs">
              ( {record.namaPenandatanganToko || record.namaPemilik || '_________________'} )
            </div>
          </div>

          {/* 18. TTD Leader Pengesahan (dengan tanggal/bulan/tahun) */}
          <div className="p-3 flex flex-col justify-between text-center min-h-[175px] bg-amber-50/20">
            <div>
              <div className="font-bold text-slate-900 text-xs">
                18. Pengesahan Leader Sales
              </div>
              {/* Teks di atas TTD diisi ......., tanggal ..... bulan.... tahun */}
              <div className="text-[10px] font-bold text-amber-900 mt-0.5 border-b border-amber-200 pb-1">
                {record.teksPengesahanLengkap || `${record.tempatPengesahan || 'Cirebon'}, tanggal ${record.tanggalPengesahan || '.....'} bulan ${record.bulanPengesahan || '..........'} tahun ${record.tahunPengesahan || '2026'}`}
              </div>
            </div>

            <div className="my-2 h-20 flex items-center justify-center">
              {record.ttdLeader ? (
                <img src={record.ttdLeader} alt="TTD Leader" className="max-h-20 max-w-full object-contain" />
              ) : (
                <div className="text-[10px] text-amber-800 font-medium italic">( Menunggu Pengesahan )</div>
              )}
            </div>

            <div className="border-t border-slate-300 pt-1 font-bold text-slate-900 text-xs">
              ( {record.namaLeader || '_________________'} )
            </div>
          </div>
        </div>
      </div>

      {/* Official Footer Note */}
      <div className="mt-3 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-200 pt-2">
        <span>Dicetak dari Sistem Aplikasi NOO Sinar Kentjana Group • Cirebon</span>
        <span>Dokumen ini sah dan mengikat untuk proses administrasi pembukaan outlet baru</span>
      </div>
    </div>
  );
};
