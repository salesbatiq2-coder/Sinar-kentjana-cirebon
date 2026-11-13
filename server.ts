import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High limits for base64 photo uploads from camera and multi-record sync (up to 30 stores)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Persistent JSON file storage with automatic backup
const MAX_STORED_RECORDS = 30;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'noo_records.json');
const BACKUP_FILE = path.join(DATA_DIR, 'noo_records_backup.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to get reliable creation timestamp for sorting newest first
function getRecordCreatedTime(r: any): number {
  if (!r) return 0;
  if (r.createdAt) {
    const t = new Date(r.createdAt).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
  }
  // Fallback to timestamp embedded in id like "noo-1762900000000"
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

// Deduplicate, sort newest-first, and enforce max 30 stores (auto-removing the oldest if > 30)
function normalizeAndLimitRecords(records: any[]): any[] {
  const map = new Map<string, any>();
  for (const r of records) {
    if (!r || !r.id) continue;
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

  if (sorted.length > MAX_STORED_RECORDS) {
    const prunedCount = sorted.length - MAX_STORED_RECORDS;
    console.log(`[Storage] Auto-pruned ${prunedCount} oldest NOO record(s) to maintain max ${MAX_STORED_RECORDS} newest stores.`);
  }
  return sorted.slice(0, MAX_STORED_RECORDS);
}

// Read records helper with auto-recovery from backup
function readRecords(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data) && data.length > 0) return normalizeAndLimitRecords(data);
    }
  } catch (err) {
    console.error('Error reading records file:', err);
  }

  // If primary file is missing or empty, attempt recovery from backup
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
      const backupData = JSON.parse(backupContent);
      if (Array.isArray(backupData) && backupData.length > 0) {
        const normalized = normalizeAndLimitRecords(backupData);
        console.log(`[Storage] Recovered ${normalized.length} records from backup file.`);
        try {
          fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
        } catch {
          // ignore
        }
        return normalized;
      }
    }
  } catch (err) {
    console.error('Error reading backup records file:', err);
  }

  return [];
}

// Write records helper (writes to primary and keeps persistent backup, max 30 newest stores)
function writeRecords(records: any[], forceBackupUpdate = false) {
  try {
    const limited = normalizeAndLimitRecords(records);
    fs.writeFileSync(DATA_FILE, JSON.stringify(limited, null, 2), 'utf-8');
    if (limited.length > 0 || forceBackupUpdate) {
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(limited, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error writing records file:', err);
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  const records = readRecords();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    recordCount: records.length,
    maxRecords: MAX_STORED_RECORDS,
    service: 'Sinar Kentjana NOO Sync Server'
  });
});

// GET all records
app.get('/api/noo', (req, res) => {
  const records = readRecords();
  res.json({
    success: true,
    data: records
  });
});

// GET single record by ID
app.get('/api/noo/:id', (req, res) => {
  const { id } = req.params;
  const records = readRecords();
  const record = records.find((r) => r.id === id);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }
  res.json({ success: true, data: record });
});

// POST save / upsert record
app.post('/api/noo', (req, res) => {
  const record = req.body;
  if (!record || !record.id) {
    return res.status(400).json({ success: false, message: 'Invalid record data' });
  }

  const records = readRecords();
  const index = records.findIndex((r) => r.id === record.id);
  const now = new Date().toISOString();

  let savedRecord: any;
  if (index >= 0) {
    savedRecord = {
      ...records[index],
      ...record,
      createdAt: records[index].createdAt || record.createdAt || now,
      updatedAt: now
    };
    records[index] = savedRecord;
  } else {
    savedRecord = {
      ...record,
      createdAt: record.createdAt || now,
      updatedAt: now
    };
    records.unshift(savedRecord);
  }

  const limited = normalizeAndLimitRecords(records);
  writeRecords(limited);
  const finalSaved = limited.find((r) => r.id === savedRecord.id) || savedRecord;
  res.json({ success: true, data: finalSaved });
});

// Helper to verify Leader Credentials strictly (username: sk01, password: pastibisa)
const LEADER_TOKEN_SECRET = process.env.LEADER_TOKEN_SECRET || 'sinar-kentjana-sk01-leader-hmac-2026';

function verifyLeaderAuth(username?: string, password?: string): boolean {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();
  return cleanUser === 'sk01' && cleanPass === 'pastibisa';
}

function createLeaderToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      user: username.toLowerCase(),
      role: 'leader',
      iat: Date.now(),
      exp: Date.now() + 12 * 60 * 60 * 1000 // 12 hours max
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', LEADER_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyLeaderToken(token?: string): boolean {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', LEADER_TOKEN_SECRET).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return decoded?.role === 'leader' && decoded?.user === 'sk01' && typeof decoded?.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function verifyLeaderRequest(req: express.Request): boolean {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (verifyLeaderToken(token)) return true;
  }
  const { leaderUsername, leaderPassword } = req.body || {};
  return verifyLeaderAuth(leaderUsername, leaderPassword);
}

// POST /api/auth/login - Server-side credential verification and Leader token issuance
app.post('/api/auth/login', (req, res) => {
  const { username, password, leaderOnly } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  const isLeader = cleanUser === 'sk01' && cleanPass === 'pastibisa';
  const isSales = cleanUser === 'ske' && cleanPass === '13456789';

  if (leaderOnly) {
    if (!isLeader) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Web Otorisasi hanya dapat diakses menggunakan akun Leader yang sah.'
      });
    }
    return res.json({
      success: true,
      user: 'sk01',
      role: 'leader',
      leaderToken: createLeaderToken('sk01')
    });
  }

  if (isLeader) {
    return res.json({
      success: true,
      user: 'sk01',
      role: 'leader',
      leaderToken: createLeaderToken('sk01')
    });
  }

  if (isSales) {
    return res.json({
      success: true,
      user: 'ske',
      role: 'sales'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Username atau kata sandi salah. Silakan periksa kembali kredensial Anda.'
  });
});

// POST remote leader approval - Strictly requires verified Leader (sk01)
app.post('/api/noo/:id/approve', (req, res) => {
  if (!verifyLeaderRequest(req)) {
    return res.status(403).json({
      success: false,
      message: 'Akses Ditolak: Otorisasi pengesahan NOO hanya dapat dilakukan oleh akun Leader.'
    });
  }

  const { id } = req.params;
  const {
    top,
    limitFaktur,
    limitFakturFormatted,
    namaLeader,
    ttdLeader,
    catatanLeader,
    status = 'Disetujui',
    tempatPengesahan,
    tanggalPengesahan,
    bulanPengesahan,
    tahunPengesahan,
    teksPengesahan
  } = req.body;

  const records = readRecords();
  const index = records.findIndex((r) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  const now = new Date().toISOString();
  const target = records[index];

  records[index] = {
    ...target,
    top: top !== undefined && top !== '' ? top : (target.top || '30 Hari'),
    limitFaktur: limitFaktur !== undefined ? limitFaktur : target.limitFaktur,
    limitFakturFormatted: limitFakturFormatted || target.limitFakturFormatted,
    namaLeader: namaLeader || target.namaLeader || 'NIKO ADI.',
    ttdLeader: ttdLeader !== undefined ? ttdLeader : target.ttdLeader,
    catatanLeader: catatanLeader !== undefined ? catatanLeader : target.catatanLeader,
    tempatPengesahan: tempatPengesahan || target.tempatPengesahan || 'Cirebon',
    tanggalPengesahan: tanggalPengesahan || target.tanggalPengesahan,
    bulanPengesahan: bulanPengesahan || target.bulanPengesahan,
    tahunPengesahan: tahunPengesahan || target.tahunPengesahan,
    teksPengesahanLengkap: teksPengesahan || target.teksPengesahanLengkap,
    status: status || target.status || 'Disetujui',
    leaderApprovedAt: now,
    updatedAt: now
  };

  writeRecords(records);
  res.json({ success: true, data: records[index] });
});

// POST bulk sync records from clients (keeps newest up to 30 stores, auto-deletes oldest)
app.post('/api/noo/sync', (req, res) => {
  const { records: incoming } = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ success: false, message: 'Invalid records array' });
  }

  const current = readRecords();
  const merged = normalizeAndLimitRecords([...current, ...incoming]);

  writeRecords(merged);
  res.json({ success: true, data: merged });
});

// Legacy duplicate verifyLeaderAuth removed (consolidated above)

// POST or DELETE /api/noo/:id/delete - Strictly requires Leader Authorization
app.post('/api/noo/:id/delete', (req, res) => {
  const { id } = req.params;
  const { leaderUsername, leaderPassword } = req.body || {};

  if (!verifyLeaderAuth(leaderUsername, leaderPassword)) {
    return res.status(403).json({
      success: false,
      message: 'Otorisasi Leader Gagal! Penghapusan data NOO wajib disahkan oleh Leader.'
    });
  }

  const records = readRecords();
  const target = records.find((r) => r.id === id);
  const newRecords = records.filter((r) => r.id !== id);
  writeRecords(newRecords, true);
  console.log(`[Audit] Record ${id} ("${target ? target.namaToko : ''}") deleted with Leader authorization by ${leaderUsername} at ${new Date().toISOString()}`);
  res.json({ success: true, message: `Data toko "${target ? target.namaToko : id}" berhasil dihapus dengan otorisasi Leader.` });
});

app.delete('/api/noo/:id', (req, res) => {
  const { id } = req.params;
  const { leaderUsername, leaderPassword } = req.body || {};

  if (!verifyLeaderAuth(leaderUsername, leaderPassword)) {
    return res.status(403).json({
      success: false,
      message: 'Otorisasi Leader Gagal! Penghapusan data NOO wajib disahkan oleh Leader.'
    });
  }

  const records = readRecords();
  const target = records.find((r) => r.id === id);
  const newRecords = records.filter((r) => r.id !== id);
  writeRecords(newRecords, true);
  res.json({ success: true, message: `Data toko "${target ? target.namaToko : id}" berhasil dihapus.` });
});

// Dev environment vs Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sinar Kentjana NOO Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
