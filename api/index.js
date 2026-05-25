// api/index.js - Serverless Express app untuk Vercel
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Inisialisasi Firebase Admin dengan environment variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();
const app = express();

// Middleware
app.use(cors({
  origin: ['https://sipagi.vercel.app', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ==================== AUTH MIDDLEWARE ====================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'Administrator') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya Administrator.' 
    });
  }
  next();
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const snapshot = await db.ref(`users/${username}`).once('value');
    const userData = snapshot.val();
    
    if (!userData) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    
    const isValidPassword = await bcrypt.compare(password, userData.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    
    const token = jwt.sign(
      { username, name: userData.name, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      user: { name: userData.name, role: userData.role, username, email: userData.email || '' }
    });
  } catch (error) {
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
    await db.ref(`users/${req.user.username}`).update({ photo, photoUpdatedAt: new Date().toISOString() });
    res.json({ success: true, message: 'Foto berhasil diupload', photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== WNA ROUTES ====================
app.get('/api/wna', authenticateToken, async (req, res) => {
  try {
    const { type, negara, status } = req.query;
    const snapshot = await db.ref('wna').once('value');
    let data = snapshot.val();
    
    let wnaList = [];
    if (data) {
      wnaList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      if (type) wnaList = wnaList.filter(item => item.type === type);
      if (negara) wnaList = wnaList.filter(item => item.negara === negara);
      if (status) wnaList = wnaList.filter(item => item.status === status);
    }
    
    res.json({ success: true, data: wnaList, total: wnaList.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
        }
        if (item.negara) negaraMap[item.negara] = (negaraMap[item.negara] || 0) + 1;
      });
    }
    
    const byCountry = Object.keys(negaraMap).map(name => ({
      name, jumlah: negaraMap[name]
    })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10);
    
    res.json({ success: true, data: { total, byType: { VOA: voa, ITK: itk, ITAS: itas, ITAP: itap }, byCountry } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/wna', authenticateToken, async (req, res) => {
  try {
    // Cek duplikat paspor
    const snapshot = await db.ref('wna').once('value');
    const existing = snapshot.val();
    if (existing && Object.values(existing).some(item => item.noPaspor === req.body.noPaspor)) {
      return res.status(409).json({ success: false, message: 'Nomor paspor sudah terdaftar' });
    }
    
    const newRef = db.ref('wna').push();
    await newRef.set({
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.username,
      createdByName: req.user.name
    });
    
    res.status(201).json({ success: true, message: 'Data WNA berhasil ditambahkan', id: newRef.key });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/wna/:id', authenticateToken, async (req, res) => {
  try {
    await db.ref(`wna/${req.params.id}`).remove();
    res.json({ success: true, message: 'Data WNA berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/wna/export/all', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref('wna').once('value');
    const data = snapshot.val();
    
    const wnaList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe Izin', 'Sponsor', 'Alamat', 'Domisili', 'Status'];
    
    const rows = [headers];
    for (const wna of wnaList) {
      rows.push([
        wna.id, wna.namaLengkap, wna.noPaspor, wna.negara,
        wna.type, wna.sponsor, wna.alamat, wna.domisili, wna.status
      ]);
    }
    
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=wna_export.csv`);
    res.send("\uFEFF" + csv);
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
    const updateData = { name, email, role, nip, jabatan, unitKerja, noTelepon, alamat, isActive, updatedAt: new Date().toISOString() };
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
    await db.ref(`users/${req.params.username}`).update({ isActive: req.body.isActive });
    res.json({ success: true, message: 'Status berhasil diubah' });
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
    let logs = [];
    if (data) {
      logs = Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse();
    }
    res.json({ success: true, data: logs, total: logs.length });
  } catch (error) {
    res.json({ success: true, data: [], total: 0 });
  }
});

app.get('/api/activity/notifications', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref(`user_notifications/${req.user.username}`).orderByChild('timestamp').limitToLast(50).once('value');
    const data = snapshot.val();
    let notifications = [];
    if (data) {
      notifications = Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse();
    }
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
    let unreadCount = 0;
    if (data) {
      unreadCount = Object.values(data).filter(n => !n.read).length;
    }
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
      rows.push([wna.id, wna.namaLengkap, wna.noPaspor, wna.negara, wna.type, wna.sponsor, wna.alamat, wna.domisili, wna.status]);
    }
    
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=laporan_wna.csv`);
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Export untuk Vercel
module.exports = app;