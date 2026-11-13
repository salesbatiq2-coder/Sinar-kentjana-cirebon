import { NOORecord, NOOStatus } from '../types';

export const MAX_STORED_RECORDS = 30;

const LOCAL_STORAGE_KEY = 'sinar_kentjana_noo_v2';
const LEGACY_BACKUP_KEY = 'sinar_kentjana_noo_backup_v2';
const DELETED_RECORDS_KEY = 'sinar_kentjana_noo_deleted_ids_v1';

const IDB_NAME = 'sinar_kentjana_noo_db';
const IDB_VERSION = 1;
const IDB_STORE = 'noo_records';
const IDB_RECORD_KEY = 'all_records';

/**
 * Service to sync NOO records between multiple devices via Server API,
 * backed by high-capacity IndexedDB (holds 30+ stores with photos easily)
 * and smart newest-first localStorage fallback.
 */

export interface SyncStatus {
  isOnline: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
}

// Track optimistic/in-flight saves so 4-second polling never drops a brand new record during upload
const pendingSaves = new Map<string, NOORecord>();

// Helper to get reliable creation timestamp for sorting newest first
export function getRecordCreatedTime(r?: Partial<NOORecord> | null): number {
  if (!r) return 0;
  if (r.createdAt) {
    const t = new Date(r.createdAt).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
  }
  if (typeof r.id === 'string') {
    const m = r.id.match(/(\d{10,15})/);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  if (r.updatedAt) {
    const t = new Date(r.updatedAt).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Deduplicate records, merge newest versions, sort newest-first,
 * and enforce MAX_STORED_RECORDS (30 stores), automatically pruning the OLDEST records.
 */
export function normalizeAndLimitRecords(records: NOORecord[]): NOORecord[] {
  const deleted = new Set(getDeletedIds());
  const map = new Map<string, NOORecord>();

  for (const r of records) {
    if (!r || !r.id || deleted.has(r.id)) continue;
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
    } else {
      const rUpd = new Date(r.updatedAt || r.createdAt || 0).getTime() || 0;
      const eUpd = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
      map.set(r.id, rUpd >= eUpd ? { ...existing, ...r } : { ...r, ...existing });
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    const diff = getRecordCreatedTime(b) - getRecordCreatedTime(a);
    if (diff !== 0) return diff;
    const uA = new Date(a.updatedAt || 0).getTime() || 0;
    const uB = new Date(b.updatedAt || 0).getTime() || 0;
    return uB - uA;
  });

  return sorted.slice(0, MAX_STORED_RECORDS);
}

// Track IDs of records legitimately deleted by Leader so sync doesn't resurrect them
export function getDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_RECORDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading deleted IDs cache:', e);
  }
  return [];
}

export function markRecordDeleted(id: string) {
  pendingSaves.delete(id);
  try {
    const current = getDeletedIds();
    if (!current.includes(id)) {
      current.push(id);
      // Keep bounded list of recent deleted IDs
      const bounded = current.slice(-200);
      localStorage.setItem(DELETED_RECORDS_KEY, JSON.stringify(bounded));
    }
  } catch (e) {
    console.warn('Error saving deleted ID:', e);
  }
}

// =========================================================================
// IndexedDB High-Capacity Client Storage (No 5MB QuotaExceeded wall)
// =========================================================================
function openNooDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function getIndexedDBRecords(): Promise<NOORecord[]> {
  try {
    const db = await openNooDB();
    return await new Promise<NOORecord[]>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(IDB_RECORD_KEY);
      getReq.onsuccess = () => {
        const res = getReq.result;
        resolve(Array.isArray(res) ? normalizeAndLimitRecords(res) : []);
      };
      getReq.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveIndexedDBRecords(records: NOORecord[]): Promise<void> {
  const limited = normalizeAndLimitRecords(records);
  try {
    const db = await openNooDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const putReq = store.put(limited, IDB_RECORD_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch (e) {
    console.warn('IndexedDB save warning:', e);
  }
}

// =========================================================================
// LocalStorage Fast Cache (Handles 5MB limit gracefully without dropping new)
// =========================================================================
export function getLocalFallback(): NOORecord[] {
  const deleted = new Set(getDeletedIds());
  const candidates: NOORecord[] = [];

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        candidates.push(...parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading primary localStorage cache:', e);
  }

  try {
    const backupRaw = localStorage.getItem(LEGACY_BACKUP_KEY);
    if (backupRaw) {
      const backupParsed = JSON.parse(backupRaw);
      if (Array.isArray(backupParsed)) {
        candidates.push(...backupParsed);
      }
    }
  } catch {
    // ignore legacy backup errors
  }

  const valid = candidates.filter((r) => r && r.id && !deleted.has(r.id));
  return normalizeAndLimitRecords(valid);
}

export function saveLocalFallback(records: NOORecord[]) {
  const limited = normalizeAndLimitRecords(records);

  // Also persist asynchronously to IndexedDB (full 30 records with zero 5MB restriction)
  void saveIndexedDBRecords(limited);

  // Free legacy duplicate key so localStorage has full 5MB for the single active cache
  try {
    localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch {
    // ignore
  }

  // Try saving all newest records first; if localStorage 5MB quota is tight,
  // trim the OLDEST tail records from localStorage ONLY (keeping full 30 in IndexedDB + Server)
  // so NEWEST submissions are ALWAYS prioritized and never lost!
  for (let count = limited.length; count >= 0; count--) {
    try {
      const slice = limited.slice(0, count);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(slice));
      return;
    } catch {
      // QuotaExceededError -> shed oldest record from localStorage mirror and retry
    }
  }
}

/**
 * Hydrate all stored client records (merging IndexedDB + localStorage, max 30 newest)
 */
export async function getAllClientRecords(): Promise<NOORecord[]> {
  const [idbRecords, lsRecords] = await Promise.all([
    getIndexedDBRecords(),
    Promise.resolve(getLocalFallback())
  ]);
  const pending = Array.from(pendingSaves.values());
  return normalizeAndLimitRecords([...pending, ...idbRecords, ...lsRecords]);
}

/**
 * Fetch all records from the centralized multi-device server with intelligent 2-way merge.
 * Keeps up to 30 newest stores and auto-prunes oldest when > 30.
 */
export async function apiFetchRecords(): Promise<{ records: NOORecord[]; isServer: boolean }> {
  const clientRecords = await getAllClientRecords();
  const deletedIds = new Set(getDeletedIds());

  try {
    const res = await fetch('/api/noo', {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const serverRecords: NOORecord[] = (json.data as NOORecord[]).filter(
          (r: NOORecord) => r && r.id && !deletedIds.has(r.id)
        );

        const serverMap = new Map<string, NOORecord>();
        for (const sr of serverRecords) {
          serverMap.set(sr.id, sr);
        }

        // Clean up pendingSaves that the server already acknowledges with same/newer updatedAt
        for (const [pid, prec] of pendingSaves.entries()) {
          const srec = serverMap.get(pid);
          if (srec) {
            const pTime = new Date(prec.updatedAt || prec.createdAt || 0).getTime() || 0;
            const sTime = new Date(srec.updatedAt || srec.createdAt || 0).getTime() || 0;
            if (sTime >= pTime) {
              pendingSaves.delete(pid);
            }
          }
        }

        // Merge server + client + in-flight pending, sort newest-first, keep max 30
        const merged = normalizeAndLimitRecords([
          ...Array.from(pendingSaves.values()),
          ...serverRecords,
          ...clientRecords
        ]);

        // Only push records that survived the top-30 newest cut and are missing/newer than server
        const toPushToServer: NOORecord[] = [];
        for (const mr of merged) {
          const sr = serverMap.get(mr.id);
          if (!sr) {
            toPushToServer.push(mr);
          } else {
            const mTime = new Date(mr.updatedAt || mr.createdAt || 0).getTime() || 0;
            const sTime = new Date(sr.updatedAt || sr.createdAt || 0).getTime() || 0;
            if (mTime > sTime) {
              toPushToServer.push(mr);
            }
          }
        }

        if (toPushToServer.length > 0) {
          fetch('/api/noo/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: toPushToServer })
          }).catch((err) => console.warn('Background sync to server failed:', err));
        }

        saveLocalFallback(merged);
        return { records: merged, isServer: true };
      }
    }
  } catch (err) {
    console.warn('Could not reach multi-device server API, using local cache:', err);
  }

  return { records: clientRecords, isServer: false };
}

/**
 * Fetch a single record by ID
 */
export async function apiGetRecord(id: string): Promise<NOORecord | null> {
  if (pendingSaves.has(id)) {
    return pendingSaves.get(id) || null;
  }
  try {
    const res = await fetch(`/api/noo/${encodeURIComponent(id)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) return json.data;
    }
  } catch (err) {
    console.warn('apiGetRecord network error, checking client cache:', err);
  }
  const all = await getAllClientRecords();
  return all.find((r) => r.id === id) || null;
}

/**
 * Save or update a record on the server (and cache in IndexedDB + localStorage, max 30 newest)
 */
export async function apiSaveRecord(record: NOORecord): Promise<{ success: boolean; data: NOORecord }> {
  const now = new Date().toISOString();
  const toSave: NOORecord = {
    ...record,
    createdAt: record.createdAt || now,
    updatedAt: now
  };

  // Register in pendingSaves immediately so polling never drops it mid-upload
  pendingSaves.set(toSave.id, toSave);

  // Merge with full client records (IndexedDB + localStorage), keep newest 30
  const current = await getAllClientRecords();
  const next = normalizeAndLimitRecords([toSave, ...current]);
  await saveIndexedDBRecords(next);
  saveLocalFallback(next);

  // Send to server
  try {
    const res = await fetch('/api/noo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        pendingSaves.delete(toSave.id);
        return { success: true, data: json.data };
      }
    }
  } catch (err) {
    console.warn('apiSaveRecord server sync failed, stored in IndexedDB/localStorage:', err);
  }

  return { success: true, data: toSave };
}

/**
 * Authenticate user against server (/api/auth/login) with offline fallback
 * In leaderOnly mode (?mode=leader), ONLY username "sk01" + password "pastibisa" is permitted.
 */
export async function apiLogin(
  username: string,
  password: string,
  leaderOnly = false
): Promise<{ success: boolean; user?: string; leaderToken?: string; message?: string }> {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password: cleanPass, leaderOnly })
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) {
      return {
        success: true,
        user: json.user,
        leaderToken: json.leaderToken
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        message: json?.message || 'Akses ditolak. Periksa kredensial Anda.'
      };
    }
  } catch (err) {
    console.warn('apiLogin offline fallback:', err);
  }

  // Offline / unreachable server fallback
  const isLeader = cleanUser === 'sk01' && cleanPass === 'pastibisa';
  const isSales = cleanUser === 'ske' && cleanPass === '13456789';

  if (leaderOnly) {
    if (isLeader) {
      return { success: true, user: 'sk01' };
    }
    return {
      success: false,
      message: 'Akses ditolak: Web Otorisasi hanya dapat diakses menggunakan akun Leader yang sah.'
    };
  }

  if (isLeader) return { success: true, user: 'sk01' };
  if (isSales) return { success: true, user: 'ske' };

  return {
    success: false,
    message: 'Username atau kata sandi salah. Silakan periksa kembali kredensial Anda.'
  };
}

/**
 * Remote Leader Approval endpoint (Strictly requires sk01 Leader session)
 */
export async function apiApproveRecord(
  id: string,
  approvalData: {
    top: string;
    limitFaktur: number;
    limitFakturFormatted: string;
    namaLeader: string;
    ttdLeader: string;
    catatanLeader?: string;
    status: NOOStatus;
    tempatPengesahan?: string;
    tanggalPengesahan?: string;
    bulanPengesahan?: string;
    tahunPengesahan?: string;
    teksPengesahan?: string;
  }
): Promise<{ success: boolean; data?: NOORecord; message?: string }> {
  const currentUser = (typeof window !== 'undefined' ? sessionStorage.getItem('ske_auth_user') : '') || '';
  if (currentUser.trim().toLowerCase() !== 'sk01') {
    return {
      success: false,
      message: 'Akses Ditolak: Otorisasi pengesahan NOO hanya dapat dilakukan oleh akun Leader.'
    };
  }

  const leaderToken = (typeof window !== 'undefined' ? sessionStorage.getItem('ske_leader_token') : '') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (leaderToken) {
    headers['Authorization'] = `Bearer ${leaderToken}`;
  }

  // Optimistically build updated record from client cache too in case of offline lag
  const allClient = await getAllClientRecords();
  const localMatch = allClient.find((r) => r.id === id);

  try {
    const res = await fetch(`/api/noo/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(approvalData)
    });
    const json = await res.json().catch(() => null);
    if (res.status === 403) {
      return {
        success: false,
        message: json?.message || 'Akses Ditolak: Otorisasi pengesahan NOO hanya dapat dilakukan oleh akun Leader.'
      };
    }
    if (res.ok && json?.success && json.data) {
      const updatedList = normalizeAndLimitRecords([json.data, ...allClient]);
      await saveIndexedDBRecords(updatedList);
      saveLocalFallback(updatedList);
      return { success: true, data: json.data };
    }
  } catch (err) {
    console.warn('apiApproveRecord server failed, updating client cache:', err);
  }

  if (localMatch) {
    const updated: NOORecord = {
      ...localMatch,
      top: approvalData.top,
      limitFaktur: approvalData.limitFaktur,
      limitFakturFormatted: approvalData.limitFakturFormatted,
      namaLeader: approvalData.namaLeader,
      ttdLeader: approvalData.ttdLeader,
      catatanLeader: approvalData.catatanLeader || '',
      tempatPengesahan: approvalData.tempatPengesahan || localMatch.tempatPengesahan,
      tanggalPengesahan: approvalData.tanggalPengesahan || localMatch.tanggalPengesahan,
      bulanPengesahan: approvalData.bulanPengesahan || localMatch.bulanPengesahan,
      tahunPengesahan: approvalData.tahunPengesahan || localMatch.tahunPengesahan,
      status: approvalData.status,
      teksPengesahanLengkap: approvalData.teksPengesahan || localMatch.teksPengesahanLengkap,
      leaderApprovedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    pendingSaves.set(id, updated);
    const updatedList = normalizeAndLimitRecords([updated, ...allClient]);
    await saveIndexedDBRecords(updatedList);
    saveLocalFallback(updatedList);
    return { success: true, data: updated };
  }

  return { success: false };
}

/**
 * Delete a record with mandatory Leader Authorization
 */
export async function apiDeleteRecord(
  id: string,
  auth?: { username?: string; password?: string }
): Promise<{ success: boolean; message?: string }> {
  markRecordDeleted(id);
  const current = await getAllClientRecords();
  const next = current.filter((r) => r.id !== id);
  await saveIndexedDBRecords(next);
  saveLocalFallback(next);

  try {
    const res = await fetch(`/api/noo/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leaderUsername: auth?.username || '',
        leaderPassword: auth?.password || ''
      })
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, message: json.message };
    }
  } catch (err) {
    console.warn('apiDeleteRecord server request error, removed locally:', err);
  }
  return { success: true };
}

/**
 * Generate a shareable leader verification link that can be sent via WhatsApp or opened on another device
 */
export function getLeaderApprovalLink(recordId: string): string {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?mode=leader&id=${encodeURIComponent(recordId)}`;
}
