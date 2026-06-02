// api/index.js - Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');

// ==================== FIREBASE ADMIN INITIALIZATION ====================
let db;
let isFirebaseInitialized = false;

function initFirebase() {
  if (isFirebaseInitialized) return;
  
  try {
    if (admin.apps.length === 0) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;
      
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const databaseURL = process.env.FIREBASE_DATABASE_URL;
      
      if (!projectId || !clientEmail || !privateKey || !databaseURL) {
        console.error('Missing Firebase environment variables');
        throw new Error('Firebase configuration incomplete');
      }
      
      console.log('Initializing Firebase Admin...');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey,
        }),
        databaseURL: databaseURL,
      });
      
      console.log('Firebase Admin initialized successfully');
    }
    
    db = admin.database();
    isFirebaseInitialized = true;
    
    db.ref('.info/connected').once('value').then(() => {
      console.log('✅ Firebase Realtime Database connected');
    }).catch(err => {
      console.error('❌ Firebase connection test failed:', err.message);
    });
    
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    throw error;
  }
}

initFirebase();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: [
    'https://pantau-asing.vercel.app',
    'https://sipagi.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== AUTH MIDDLEWARE ====================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }
  
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET not configured');
    return res.status(500).json({ 
      success: false, 
      message: 'Server configuration error' 
    });
  }
  
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      console.error('JWT verification error:', err.message);
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Administrator') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya Administrator.' 
    });
  }
  next();
}

// ==================== MULTER CONFIGURATION ====================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ==================== HELPER FUNCTIONS ====================
function cleanValue(value) {
  if (!value || value === 'null' || value === 'undefined' || value === '-') {
    return '';
  }
  let cleaned = value.toString().trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    firebaseInitialized: isFirebaseInitialized
  });
});

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log(`Login attempt for user: ${username}`);
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username dan password wajib diisi' 
    });
  }
  
  try {
    if (!db) initFirebase();
    
    const snapshot = await db.ref(`users/${username}`).once('value');
    const userData = snapshot.val();
    
    if (!userData) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    
    if (userData.isActive === false) {
      return res.status(401).json({ success: false, message: 'Akun Anda telah dinonaktifkan.' });
    }
    
    const isValidPassword = await bcrypt.compare(password, userData.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    
    const token = jwt.sign(
      { username, name: userData.name, role: userData.role, email: userData.email || '' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    db.ref('activity_logs').push({
      username, action: 'LOGIN', timestamp: new Date().toISOString()
    }).catch(err => console.error('Log error:', err.message));
    
    res.json({
      success: true, token,
      user: { name: userData.name, role: userData.role, username, email: userData.email || '' }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ==================== PROFILE ROUTES ====================
app.get('/api/profile/me', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref(`users/${req.user.username}`).once('value');
    const userData = snapshot.val();
    const { password, ...profile } = userData;
    res.json({ success: true, data: { username: req.user.username, ...profile } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/profile/me', authenticateToken, async (req, res) => {
  try {
    const { name, email, nip, jabatan, unitKerja, noTelepon, alamat } = req.body;
    await db.ref(`users/${req.user.username}`).update({
      name, email, nip, jabatan, unitKerja, noTelepon, alamat,
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Profil berhasil diperbarui' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/profile/me/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const snapshot = await db.ref(`users/${req.user.username}`).once('value');
    const userData = snapshot.val();
    
    const isValid = await bcrypt.compare(currentPassword, userData.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Password saat ini salah' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.ref(`users/${req.user.username}`).update({ password: hashedPassword });
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/profile/me/photo', authenticateToken, async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo || !photo.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Format foto tidak valid' });
    }
    await db.ref(`users/${req.user.username}`).update({ photo, photoUpdatedAt: new Date().toISOString() });
    res.json({ success: true, message: 'Foto berhasil diupload', photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== WNA ROUTES ====================

// 1. Download template
app.get('/api/wna/import/template', authenticateToken, async (req, res) => {
  try {
    console.log('📥 Download template requested by:', req.user.username);
    
    const headers = ['namaLengkap', 'noPaspor', 'negara', 'type', 'sponsor', 'alamat', 'domisili', 'latitude', 'longitude', 'status'];
    const csvContent = headers.join(',') + '\n' +
      '"John Doe","ABC123456","United States","VOA","PT Contoh","Jl. Contoh No. 123","Kota Jambi","-1.65","103.2","ACTIVE"\n' +
      '"Jane Smith","XYZ789012","United Kingdom","ITAS","CV Lain","Jl. Test No. 456","Kota Jambi","-1.65","103.2","ACTIVE"';
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=template_import_wna.csv');
    res.send("\uFEFF" + csvContent);
    console.log('✅ Template downloaded');
  } catch (error) {
    console.error('Template error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Import file (VERSI YANG SUDAH DIPERBAIKI - TIDAK KETAT)
app.post('/api/wna/import', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    console.log('📥 Import request from:', req.user.username);
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diupload' });
    }

    const fileBuffer = req.file.buffer;
    const fileOriginalName = req.file.originalname;
    let rows = [];

    console.log(`Processing file: ${fileOriginalName}`);

    // Parse CSV
    if (fileOriginalName.toLowerCase().endsWith('.csv')) {
      let csvString = fileBuffer.toString('utf8');
      if (csvString.charCodeAt(0) === 0xFEFF) {
        csvString = csvString.slice(1);
      }
      
      const lines = csvString.split(/\r?\n/);
      if (lines.length < 2) {
        return res.status(400).json({ success: false, message: 'File CSV kosong' });
      }
      
      // Parse headers
      const headers = lines[0].split(',').map(h => cleanValue(h).toLowerCase());
      
      // Parse rows
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < lines[i].length; j++) {
          const char = lines[i][j];
          if (char === '"') {
            if (inQuotes && lines[i][j + 1] === '"') {
              current += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(cleanValue(current));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(cleanValue(current));
        
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        rows.push(row);
      }
    } else {
      // Parse Excel
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
      rows = rows.map(r => {
        const newRow = {};
        Object.keys(r).forEach(k => { newRow[k.toLowerCase()] = r[k]; });
        return newRow;
      });
    }

    console.log(`Total rows: ${rows.length}`);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File tidak mengandung data' });
    }

    // Get existing passports
    const snapshot = await db.ref('wna').once('value');
    const existingData = snapshot.val() || {};
    const existingPassports = new Set();
    Object.values(existingData).forEach(item => {
      if (item.noPaspor) existingPassports.add(item.noPaspor);
    });

    let importedCount = 0;
    const errors = [];
    const duplicates = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      
      // Get values (case insensitive)
      const nama = row.namalengkap || row.nama_lengkap || row.nama || '';
      const paspor = row.nopaspor || row.no_paspor || '';
      const negara = row.negara || '';
      const typeRaw = (row.type || row.tipe || 'VOA').toString().toUpperCase();
      const sponsor = row.sponsor || '-';
      const alamat = row.alamat || '';
      const domisili = row.domisili || 'Kota Jambi';
      const latRaw = row.latitude || '';
      const lngRaw = row.longitude || '';
      const statusRaw = (row.status || 'ACTIVE').toString().toUpperCase();
      
      // Validate required fields
      if (!nama || !paspor || !negara || !alamat) {
        errors.push(`Baris ${rowNum}: Data tidak lengkap (nama, paspor, negara, alamat wajib diisi)`);
        continue;
      }
      
      // Check duplicate passport
      if (existingPassports.has(paspor)) {
        duplicates.push(paspor);
        continue;
      }
      
      // Validate type
      let type = typeRaw;
      if (!['VOA', 'ITK', 'ITAS', 'ITAP'].includes(type)) {
        type = 'VOA';
      }
      
      // Validate status
      let status = statusRaw;
      if (!['ACTIVE', 'EXPIRED', 'DEPARTED'].includes(status)) {
        status = 'ACTIVE';
      }
      
      // Parse coordinates
      let lat = null;
      let lng = null;
      if (latRaw && latRaw.toString().trim()) {
        const parsed = parseFloat(latRaw);
        if (!isNaN(parsed)) lat = parsed;
      }
      if (lngRaw && lngRaw.toString().trim()) {
        const parsed = parseFloat(lngRaw);
        if (!isNaN(parsed)) lng = parsed;
      }
      
      // Create data object
      const now = new Date().toISOString();
      const data = {
        namaLengkap: nama,
        noPaspor: paspor,
        negara: negara,
        type: type,
        sponsor: sponsor,
        alamat: alamat,
        domisili: domisili,
        latitude: lat,
        longitude: lng,
        status: status,
        createdAt: now,
        updatedAt: now,
        createdBy: req.user.username,
        createdByName: req.user.name || req.user.username,
        imported: true
      };
      
      // Save to database
      try {
        const newRef = db.ref('wna').push();
        await newRef.set(data);
        importedCount++;
        existingPassports.add(paspor);
        console.log(`✅ Imported: ${nama} (${paspor})`);
      } catch (err) {
        errors.push(`Baris ${rowNum}: Gagal menyimpan - ${err.message}`);
      }
    }
    
    // Log activity
    await db.ref('activity_logs').push({
      action: 'IMPORT_WNA',
      username: req.user.username,
      userName: req.user.name,
      timestamp: new Date().toISOString(),
      data: {
        fileName: fileOriginalName,
        totalRows: rows.length,
        importedCount: importedCount,
        duplicateCount: duplicates.length,
        errorCount: errors.length
      }
    });
    
    console.log(`✅ Import completed: ${importedCount} success, ${duplicates.length} duplicates, ${errors.length} errors`);
    
    res.json({
      success: true,
      message: `Import selesai. ${importedCount} data berhasil diimport.`,
      data: {
        totalRows: rows.length,
        importedCount: importedCount,
        duplicateCount: duplicates.length,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
        duplicatePassports: duplicates.slice(0, 20)
      }
    });
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengimport data: ' + error.message 
    });
  }
});

// 3. Dashboard stats
app.get('/api/wna/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref('wna').once('value');
    const data = snapshot.val();
    
    let total = 0, voa = 0, itk = 0, itas = 0, itap = 0;
    const negaraMap = {};
    
    if (data) {
      Object.values(data).forEach(item => {
        total++;
        switch(item.type) {
          case 'VOA': voa++; break;
          case 'ITK': itk++; break;
          case 'ITAS': itas++; break;
          case 'ITAP': itap++; break;
          default: break;
        }
        if (item.negara) negaraMap[item.negara] = (negaraMap[item.negara] || 0) + 1;
      });
    }
    
    const byCountry = Object.entries(negaraMap)
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 10);
    
    res.json({ success: true, data: { total, byType: { VOA: voa, ITK: itk, ITAS: itas, ITAP: itap }, byCountry } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Export all
app.get('/api/wna/export/all', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref('wna').once('value');
    const data = snapshot.val();
    const wnaList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    
    const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe Izin', 'Sponsor', 'Alamat', 'Domisili', 'Status'];
    const rows = [headers];
    
    for (const wna of wnaList) {
      rows.push([
        wna.id, wna.namaLengkap || '', wna.noPaspor || '', wna.negara || '',
        wna.type || '', wna.sponsor || '', wna.alamat || '', wna.domisili || '',
        wna.status || 'ACTIVE'
      ]);
    }
    
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=wna_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Get WNA list
app.get('/api/wna', authenticateToken, async (req, res) => {
  try {
    const { type, negara, status, limit = '1000' } = req.query;
    const snapshot = await db.ref('wna').once('value');
    let data = snapshot.val();
    
    let wnaList = [];
    if (data) {
      wnaList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      if (type) wnaList = wnaList.filter(item => item.type === type);
      if (negara) wnaList = wnaList.filter(item => item.negara === negara);
      if (status) wnaList = wnaList.filter(item => item.status === status);
      wnaList = wnaList.slice(0, parseInt(limit));
    }
    
    res.json({ success: true, data: wnaList, total: wnaList.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Create WNA
app.post('/api/wna', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const newRef = db.ref('wna').push();
    await newRef.set({
      ...req.body, status: req.body.status || 'ACTIVE',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: req.user.username, createdByName: req.user.name || req.user.username
    });
    res.status(201).json({ success: true, message: 'Data berhasil ditambahkan', id: newRef.key });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Delete WNA
app.delete('/api/wna/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.ref(`wna/${req.params.id}`).remove();
    res.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== USERS ROUTES ====================
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.ref('users').once('value');
    const data = snapshot.val();
    const users = [];
    if (data) {
      for (const [username, userData] of Object.entries(data)) {
        const { password, ...userWithoutPassword } = userData;
        users.push({ id: username, username, ...userWithoutPassword });
      }
    }
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, name, email, role, password, nip, jabatan, unitKerja, noTelepon, alamat } = req.body;
    
    const existing = await db.ref(`users/${username}`).once('value');
    if (existing.exists()) {
      return res.status(409).json({ success: false, message: 'Username sudah digunakan' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.ref(`users/${username}`).set({
      name, email, role, password: hashedPassword,
      nip: nip || '', jabatan: jabatan || '', unitKerja: unitKerja || '',
      noTelepon: noTelepon || '', alamat: alamat || '',
      isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'User berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/users/:username', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, role, nip, jabatan, unitKerja, noTelepon, alamat, isActive } = req.body;
    const updateData = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (nip !== undefined) updateData.nip = nip;
    if (jabatan !== undefined) updateData.jabatan = jabatan;
    if (unitKerja !== undefined) updateData.unitKerja = unitKerja;
    if (noTelepon !== undefined) updateData.noTelepon = noTelepon;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    await db.ref(`users/${req.params.username}`).update(updateData);
    res.json({ success: true, message: 'User berhasil diperbarui' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/users/:username', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.username === req.user.username) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun sendiri' });
    }
    await db.ref(`users/${req.params.username}`).remove();
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/users/:username/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    await db.ref(`users/${req.params.username}`).update({ isActive, updatedAt: new Date().toISOString() });
    res.json({ success: true, message: `Status user ${isActive ? 'diaktifkan' : 'dinonaktifkan'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ACTIVITY LOGS ====================
app.get('/api/activity/logs', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const snapshot = await db.ref('activity_logs').orderByChild('timestamp').limitToLast(limit).once('value');
    const data = snapshot.val();
    let logs = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse() : [];
    res.json({ success: true, data: logs, total: logs.length });
  } catch (error) {
    res.json({ success: true, data: [], total: 0 });
  }
});

app.get('/api/activity/notifications', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref(`user_notifications/${req.user.username}`).orderByChild('timestamp').limitToLast(50).once('value');
    const data = snapshot.val();
    let notifications = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse() : [];
    res.json({ success: true, data: notifications, total: notifications.length });
  } catch (error) {
    res.json({ success: true, data: [], total: 0 });
  }
});

app.put('/api/activity/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.ref(`user_notifications/${req.user.username}/${req.params.id}`).update({ read: true, readAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/activity/notifications/unread/count', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref(`user_notifications/${req.user.username}`).once('value');
    const data = snapshot.val();
    let unreadCount = data ? Object.values(data).filter(n => !n.read).length : 0;
    res.json({ success: true, unreadCount });
  } catch (error) {
    res.json({ success: true, unreadCount: 0 });
  }
});

// ==================== REPORTS ====================
app.get('/api/reports/export/excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.ref('wna').once('value');
    const data = snapshot.val();
    const wnaList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    
    const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe Izin', 'Sponsor', 'Alamat', 'Domisili', 'Status'];
    const rows = [headers];
    for (const wna of wnaList) {
      rows.push([wna.id, wna.namaLengkap || '', wna.noPaspor || '', wna.negara || '', wna.type || '', wna.sponsor || '', wna.alamat || '', wna.domisili || '', wna.status || 'ACTIVE']);
    }
    
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=laporan_wna_${new Date().toISOString().split('T')[0]}.csv`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== REGIONS ====================
app.get('/api/regions', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref('regions').once('value');
    const data = snapshot.val();
    const regions = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== FALLBACK ====================
app.all('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

module.exports = app;