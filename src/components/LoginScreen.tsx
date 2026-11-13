import React, { useState } from 'react';
import { Lock, User, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { BRAND_COMPANY } from '../utils/formatters';
import { apiLogin } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
  lockMessage?: string;
  isLeaderOnly?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  lockMessage,
  isLeaderOnly = false
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Harap masukkan username dan password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiLogin(cleanUser, cleanPass, isLeaderOnly);

      if (result.success && result.user) {
        if (isLeaderOnly && result.user.toLowerCase() !== 'sk01') {
          setErrorMsg('Akses ditolak: Web Otorisasi hanya dapat diakses menggunakan akun Leader yang sah.');
          setIsLoading(false);
          return;
        }

        // Only store session-level authentication (cleared automatically when tab/browser is closed)
        sessionStorage.setItem('ske_auth_user', result.user);
        if (result.leaderToken) {
          sessionStorage.setItem('ske_leader_token', result.leaderToken);
        } else {
          sessionStorage.removeItem('ske_leader_token');
        }
        try {
          localStorage.removeItem('ske_auth_logged_in');
        } catch {
          // ignore
        }
        onLoginSuccess(result.user);
      } else {
        setErrorMsg(
          result.message ||
            (isLeaderOnly
              ? 'Akses ditolak: Web Otorisasi hanya dapat diakses menggunakan akun Leader yang sah.'
              : 'Username atau kata sandi salah. Silakan periksa kembali kredensial Anda.')
        );
        setIsLoading(false);
      }
    } catch {
      setErrorMsg('Terjadi kesalahan saat verifikasi login. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
        {/* Top Header with Official Logo */}
        <div className="p-6 sm:p-7 bg-linear-to-b from-slate-50 to-white border-b border-slate-100 text-center">
          <div className="inline-block p-2 bg-white rounded-2xl shadow-xs border border-slate-200/80 mb-3 max-w-[280px]">
            <img
              src={BRAND_COMPANY.logoUrl}
              alt="Sinar Kentjana Group"
              className="w-full h-auto object-contain max-h-[64px]"
            />
          </div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">
            {isLeaderOnly ? 'Web Otorisasi Leader NOO' : 'Sistem NOO Sinar Kentjana'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isLeaderOnly
              ? 'Portal Khusus Pengesahan Plafon & TOP • Sinar Kentjana Cirebon'
              : 'New Open Outlet • Sinar Kentjana Cirebon'}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4.5 flex-1">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100 text-xs font-bold text-slate-800">
            <ShieldCheck className={`w-4 h-4 ${isLeaderOnly ? 'text-amber-600' : 'text-emerald-700'}`} />
            <span>{isLeaderOnly ? 'Otorisasi Khusus Leader' : 'Akses Sistem'}</span>
          </div>

          {isLeaderOnly && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Tautan ini adalah <strong>Web Otorisasi Leader</strong>. Hanya akun <strong>Leader</strong> yang dapat masuk dan memberikan persetujuan.
              </span>
            </div>
          )}

          {lockMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2 animate-fadeIn">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{lockMessage}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isLeaderOnly ? 'Username Leader' : 'Username'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isLeaderOnly ? 'Masukkan username Leader' : 'Masukkan username'}
                autoCapitalize="none"
                autoComplete="username"
                className="w-full text-xs font-semibold pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all"
              />
            </div>
          </div>

          {/* Password Input (Always Hidden) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                className="w-full text-xs font-semibold pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all"
              />
            </div>
          </div>

          {/* Security Notice */}
          <div className="text-[11px] text-slate-400 text-center py-0.5">
            {isLeaderOnly
              ? 'Akses terbatas hanya untuk akun Leader resmi.'
              : 'Gunakan akun terdaftar untuk mengakses formulir dan data outlet.'}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full mt-2 py-3 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer ${
              isLeaderOnly
                ? 'bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800'
                : 'bg-linear-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900'
            }`}
          >
            <span>
              {isLoading
                ? 'Memverifikasi...'
                : isLeaderOnly
                ? 'Masuk ke Web Otorisasi Leader'
                : 'Masuk ke Aplikasi NOO'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500">
          <span>{BRAND_COMPANY.name} • {BRAND_COMPANY.brandName}</span>
          <div className="text-[10px] text-slate-400 mt-0.5">{BRAND_COMPANY.address}</div>
        </div>
      </div>
    </div>
  );
};
