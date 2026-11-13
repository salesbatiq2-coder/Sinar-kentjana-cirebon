import React from 'react';
import { FileText, Database, Download, Phone, MapPin, Lock } from 'lucide-react';
import { BRAND_COMPANY } from '../utils/formatters';

interface HeaderProps {
  activeTab: 'form' | 'admin';
  setActiveTab: (tab: 'form' | 'admin') => void;
  totalRecordsCount: number;
  pendingCount: number;
  currentUser?: string;
  isOnline?: boolean;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalRecordsCount,
  pendingCount,
  currentUser = 'ske',
  isOnline = true,
  onLogout
}) => {
  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner with Company Info and User Login Badge */}
      <div className="bg-linear-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Form Pengajuan New Open Outlet (NOO) Sinar Kentjana groub
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {BRAND_COMPANY.address}
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-300">
            {/* Multi-Device Cloud Sync Badge */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 rounded text-[11px] text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isOnline ? 'Sinkronisasi Multi-Device Aktif' : 'Mode Offline (Lokal)'}</span>
            </div>

            <a 
              href="tel:0231483632" 
              className="hidden sm:flex items-center gap-1 hover:text-white transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              {BRAND_COMPANY.phone}
            </a>
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                <span className="px-2 py-0.5 rounded-md bg-emerald-900/80 border border-emerald-600/50 text-emerald-300 font-semibold text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Sesi Aktif
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-red-800/90 hover:bg-red-700 border border-red-600/70 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Kunci Aplikasi Sekarang (Harus masukkan username & kata sandi kembali)"
                  >
                    <Lock className="w-3 h-3 text-red-200" />
                    <span>Kunci Aplikasi</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Brand Letterhead Visual */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Logo Banner Image */}
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs max-w-[420px] sm:max-w-[480px]">
              <img 
                src={BRAND_COMPANY.logoUrl} 
                alt="Sinar Kentjana Group - Batiq Electrical Cirebon" 
                className="w-full h-auto object-contain block max-h-[70px] sm:max-h-[80px]"
                loading="eager"
              />
            </div>
            <div className="hidden lg:block border-l border-slate-200 pl-4 py-1">
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                NEW OPEN OUTLET (NOO)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Registrasi Toko Baru & Verifikasi Limit Kredit
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 self-end md:self-auto">
            <div className="text-right pr-2 hidden sm:block">
              <div className="text-xs font-semibold text-slate-800">
                {totalRecordsCount} Outlet Terdata
              </div>
              <div className="text-[11px] text-amber-700 font-medium">
                {pendingCount} Menunggu Approval
              </div>
            </div>
            
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs ${
                activeTab === 'form' 
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800' 
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Input NOO Baru</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2 mt-3 pt-2 border-t border-slate-100 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'form'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Form Input Toko Baru</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors relative ${
              activeTab === 'admin'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>2. Portal Admin & Verifikasi Leader</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-500 text-white font-bold rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
