import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NOOForm } from './components/NOOForm';
import { AdminPortal } from './components/AdminPortal';
import { LoginScreen } from './components/LoginScreen';
import { PrintDocument } from './components/PrintDocument';
import { NOORecord } from './types';
import { INITIAL_SAMPLE_RECORDS } from './utils/sampleData';
import { BRAND_COMPANY } from './utils/formatters';
import { downloadNOOPdf, getNOOPdfFileName } from './utils/pdfGenerator';
import {
  apiFetchRecords,
  apiSaveRecord,
  apiDeleteRecord,
  getAllClientRecords,
  normalizeAndLimitRecords,
  MAX_STORED_RECORDS
} from './services/api';

const STORAGE_KEY = 'sinar_kentjana_noo_v2';
const AUTH_USER_KEY = 'ske_auth_user';
const AUTH_LEADER_TOKEN_KEY = 'ske_leader_token';
const AUTH_LOGGED_KEY = 'ske_auth_logged_in';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes auto-lock

function checkIsLeaderModeUrl(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'leader';
  } catch {
    return false;
  }
}

export default function App() {
  const [lockMessage, setLockMessage] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLeaderLinkMode] = useState<boolean>(() => checkIsLeaderModeUrl());

  // Authentication state (Sales: ske; Leader: sk01)
  // Only valid per active session - closing the tab/window automatically locks the app
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      // Clear any legacy persistent login from localStorage so closing the browser/tab always locks the app
      localStorage.removeItem(AUTH_LOGGED_KEY);
      const user = sessionStorage.getItem(AUTH_USER_KEY);
      const clean = user ? user.toLowerCase() : '';
      return clean === 'ske' || clean === 'sk01';
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState<string>(() => {
    try {
      return sessionStorage.getItem(AUTH_USER_KEY) || 'ske';
    } catch {
      return 'ske';
    }
  });

  const handleLoginSuccess = (username: string) => {
    try {
      sessionStorage.setItem(AUTH_USER_KEY, username);
      localStorage.removeItem(AUTH_LOGGED_KEY);
    } catch {
      // ignore
    }
    setIsAuthenticated(true);
    setCurrentUser(username);
    setLockMessage('');

    // If Leader logs in (sk01), automatically direct to Admin Portal for verification
    const clean = username.toLowerCase();
    if (clean === 'sk01') {
      setActiveTab('admin');
    }
  };

  const handleLogout = (message?: string) => {
    try {
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(AUTH_LEADER_TOKEN_KEY);
      localStorage.removeItem(AUTH_LOGGED_KEY);
    } catch (e) {
      console.warn('Error clearing auth:', e);
    }
    setIsAuthenticated(false);
    setLockMessage(
      message || 'Aplikasi telah terkunci. Masukkan kembali username dan password untuk melanjutkan.'
    );
  };

  // 1. Auto-lock when tab or browser is closed/unloaded
  useEffect(() => {
    const handleUnload = () => {
      try {
        sessionStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(AUTH_LEADER_TOKEN_KEY);
        localStorage.removeItem(AUTH_LOGGED_KEY);
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // 2. Auto-lock on inactivity (after web is used and left idle)
  useEffect(() => {
    if (!isAuthenticated) return;

    let timer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout(
          'Aplikasi terkunci otomatis setelah tidak ada aktivitas demi keamanan data. Silakan masukkan username dan password kembali.'
        );
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, resetInactivityTimer);
      });
    };
  }, [isAuthenticated]);

  const [activeTab, setActiveTab] = useState<'form' | 'admin'>('form');

  // Load records initially from localStorage fast cache (sorted newest-first, max 30)
  const [records, setRecords] = useState<NOORecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeAndLimitRecords(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading stored NOO records:', e);
    }
    return INITIAL_SAMPLE_RECORDS;
  });

  // 3. Hydrate high-capacity IndexedDB + centralized multi-device server polling & synchronization
  useEffect(() => {
    let isMounted = true;

    const hydrateLocal = async () => {
      try {
        const localAll = await getAllClientRecords();
        if (isMounted && localAll.length > 0) {
          setRecords((prev) => {
            const merged = normalizeAndLimitRecords([...prev, ...localAll]);
            if (
              prev.length === merged.length &&
              prev.every((p, idx) => p.id === merged[idx].id && p.updatedAt === merged[idx].updatedAt)
            ) {
              return prev;
            }
            return merged;
          });
        }
      } catch (err) {
        console.warn('Error hydrating IndexedDB records:', err);
      }
    };

    const syncRecords = async () => {
      try {
        const res = await apiFetchRecords();
        if (isMounted) {
          setIsOnline(res.isServer);
          if (res.records) {
            const normalized = normalizeAndLimitRecords(res.records);
            setRecords((prev) => {
              // Deep compare records so we don't trigger unnecessary re-renders every 4 seconds
              if (
                prev.length === normalized.length &&
                prev.every((p, idx) => p.id === normalized[idx].id && p.updatedAt === normalized[idx].updatedAt)
              ) {
                return prev;
              }
              return normalized;
            });
          }
        }
      } catch (err) {
        if (isMounted) setIsOnline(false);
      }
    };

    // Hydrate IndexedDB immediately, then sync with server
    hydrateLocal().then(() => syncRecords());

    // Poll every 4 seconds when user tab is active for real-time remote approval
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncRecords();
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 4. Remote Leader Authorization Deep-Link handler (?mode=leader&id=...)
  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const targetId = params.get('id');

      if (mode === 'leader' && currentUser.toLowerCase() !== 'sk01') {
        return;
      }

      if (targetId) {
        // Switch to admin portal so the leader can review and verify immediately
        setActiveTab('admin');
      }
    } catch (err) {
      console.warn('Error reading URL params:', err);
    }
  }, [isAuthenticated, currentUser]);

  // Current record being edited in form
  const [editingRecord, setEditingRecord] = useState<NOORecord | null>(null);

  // Record for printing
  const [printRecord, setPrintRecord] = useState<NOORecord | null>(records[0] || null);

  // Handle saving new or updated record from form (keeps max 30 newest stores, auto-deletes oldest)
  const handleSaveRecord = async (newOrUpdated: NOORecord) => {
    const now = new Date().toISOString();
    const toSave: NOORecord = {
      ...newOrUpdated,
      createdAt: newOrUpdated.createdAt || now,
      updatedAt: now
    };

    // Optimistic local state update: always sort newest-first and cap at MAX_STORED_RECORDS (30)
    setRecords((prev) => normalizeAndLimitRecords([toSave, ...prev]));
    setPrintRecord(toSave);

    // Save to IndexedDB + localStorage + Server
    const res = await apiSaveRecord(toSave);
    if (res?.data) {
      setRecords((prev) => normalizeAndLimitRecords([res.data, ...prev]));
    }
  };

  // Handle save and print in one action with custom PDF name title
  const handleSaveAndPrint = async (record: NOORecord) => {
    await handleSaveRecord(record);
    setPrintRecord(record);
    const originalTitle = document.title;
    document.title = getNOOPdfFileName(record).replace(/\.pdf$/i, '');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 200);
  };

  // Handle save and direct download PDF file
  const handleSaveAndDownloadPdf = async (record: NOORecord) => {
    await handleSaveRecord(record);
    setPrintRecord(record);
    setTimeout(async () => {
      await downloadNOOPdf(record);
    }, 200);
  };

  // Trigger print for a specific record from admin / export tab
  const handleSelectPrint = (record: NOORecord) => {
    setPrintRecord(record);
    const originalTitle = document.title;
    document.title = getNOOPdfFileName(record).replace(/\.pdf$/i, '');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 200);
  };

  // Trigger direct PDF download for a specific record
  const handleDownloadPdf = async (record: NOORecord) => {
    setPrintRecord(record);
    setTimeout(async () => {
      await downloadNOOPdf(record);
    }, 200);
  };


  // Handle edit record in Form
  const handleEditInForm = (record: NOORecord) => {
    setEditingRecord(record);
    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle delete record with mandatory Leader Authorization
  const handleDeleteRecord = async (id: string, auth?: { username: string; password: string }) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (editingRecord?.id === id) {
      setEditingRecord(null);
    }
    await apiDeleteRecord(id, auth);
  };

  // Counts for header badge
  const pendingCount = records.filter((r) => r.status === 'Menunggu Approval Leader').length;

  // Gate app behind Login Screen; if opening ?mode=leader, STRICTLY require sk01 Leader session
  const requiresLeaderReauth = isLeaderLinkMode && currentUser.trim().toLowerCase() !== 'sk01';
  if (!isAuthenticated || requiresLeaderReauth) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        isLeaderOnly={isLeaderLinkMode}
        lockMessage={
          requiresLeaderReauth
            ? 'Tautan ini adalah Web Otorisasi Leader. Akses ditolak untuk akun selain Leader. Silakan masuk menggunakan akun Leader.'
            : lockMessage
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* 1. Official Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'form' && !editingRecord) {
            // Keep default fresh
          }
        }}
        totalRecordsCount={records.length}
        pendingCount={pendingCount}
        currentUser={currentUser}
        isOnline={isOnline}
        onLogout={() => handleLogout('Aplikasi telah dikunci secara manual. Silakan masukkan username dan kata sandi kembali.')}
      />

      {/* 2. Main Tab View Content */}
      <main className="flex-1 no-print">
        {activeTab === 'form' && (
          <NOOForm
            key={editingRecord ? editingRecord.id : 'fresh-form'}
            currentRecord={editingRecord}
            onSaveRecord={handleSaveRecord}
            onSaveAndPrint={handleSaveAndPrint}
            onSaveAndDownloadPdf={handleSaveAndDownloadPdf}
            existingCount={records.length}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPortal
            records={records}
            onUpdateRecord={handleSaveRecord}
            onDeleteRecord={handleDeleteRecord}
            onSelectPrint={handleSelectPrint}
            onDownloadPdf={handleDownloadPdf}
            onEditInForm={handleEditInForm}
          />
        )}
      </main>

      {/* 3. Official Printable Document (Target for window.print()) */}
      {printRecord && <PrintDocument record={printRecord} />}

      {/* 5. Clean Footer */}
      <footer className="no-print bg-white border-t border-slate-200 text-slate-500 text-xs py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-bold text-slate-800">{BRAND_COMPANY.name}</span> • {BRAND_COMPANY.brandName}
            <p className="text-[11px] text-slate-400 mt-0.5">
              {BRAND_COMPANY.address} | Telp: {BRAND_COMPANY.phone} | Medsos: {BRAND_COMPANY.social}
            </p>
          </div>
          <div className="text-[11px] text-slate-400">
            Aplikasi Formulir New Open Outlet (NOO) & Verifikasi Limit Faktur • Versi SKE 1.0
          </div>
        </div>
      </footer>
    </div>
  );
}
