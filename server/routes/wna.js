const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Helper function untuk membuat notifikasi
async function createNotification(userId, userName, title, message, type, relatedId = null) {
  try {
    const notificationsRef = db.ref('notifications');
    await notificationsRef.push({
      userId: userId,
      userName: userName,
      title: title,
      message: message,
      type: type, // 'success', 'info', 'warning', 'error'
      relatedId: relatedId,
      read: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// GET all WNA with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, negara, status, limit = 1000 } = req.query;
    
    let query = db.ref('wna');
    const snapshot = await query.once('value');
    let data = snapshot.val();
    
    let wnaList = [];
    if (data) {
      wnaList = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      
      if (type) wnaList = wnaList.filter(item => item.type === type);
      if (negara) wnaList = wnaList.filter(item => item.negara === negara);
      if (status) wnaList = wnaList.filter(item => item.status === status);
      
      wnaList = wnaList.slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      data: wnaList,
      total: wnaList.length
    });
  } catch (error) {
    console.error('Error fetching WNA:', error);
      res.status(500).json({ success: false, message: error.message });
  }
});

// GET single WNA by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref(`wna/${req.params.id}`).once('value');
    const data = snapshot.val();
    
    if (!data) {
      return res.status(404).json({ success: false, message: 'WNA not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id, ...data } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET dashboard statistics
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref('wna').once('value');
    const data = snapshot.val();
    
    let total = 0;
    let voa = 0, itk = 0, itas = 0, itap = 0;
    const negaraMap = {};
    const regionMap = {};
    
    if (data) {
      Object.keys(data).forEach(key => {
        const item = data[key];
        total++;
        
        switch(item.type) {
          case 'VOA': voa++; break;
          case 'ITK': itk++; break;
          case 'ITAS': itas++; break;
          case 'ITAP': itap++; break;
        }
        
        if (item.negara) negaraMap[item.negara] = (negaraMap[item.negara] || 0) + 1;
        if (item.domisili) regionMap[item.domisili] = (regionMap[item.domisili] || 0) + 1;
      });
    }
    
    const byCountry = Object.keys(negaraMap).map(name => ({
      name,
      jumlah: negaraMap[name]
    })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10);
    
    res.json({
      success: true,
      data: {
        total,
        byType: { VOA: voa, ITK: itk, ITAS: itas, ITAP: itap },
        byCountry,
        byRegion: regionMap
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE new WNA
router.post('/', authenticateToken, [
  body('namaLengkap').notEmpty().trim(),
  body('noPaspor').notEmpty().trim(),
  body('negara').notEmpty(),
  body('type').isIn(['VOA', 'ITK', 'ITAS', 'ITAP']),
  body('sponsor').notEmpty(),
  body('alamat').notEmpty(),
  body('domisili').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  try {
    // Check if passport already exists
    const snapshot = await db.ref('wna').once('value');
    const existing = snapshot.val();
    let passportExists = false;
    
    if (existing) {
      passportExists = Object.values(existing).some(item => item.noPaspor === req.body.noPaspor);
    }
    
    if (passportExists) {
      return res.status(409).json({ 
        success: false, 
        message: 'Nomor paspor sudah terdaftar' 
      });
    }
    
    const newRef = db.ref('wna').push();
    const wnaData = {
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.username,
      status: 'ACTIVE'
    };
    
    await newRef.set(wnaData);
    
    // Create notification
    await createNotification(
      req.user.username,
      req.user.name,
      'Data WNA Baru Ditambahkan',
      `${req.user.name} menambahkan data WNA baru: ${req.body.namaLengkap} (${req.body.noPaspor})`,
      'success',
      newRef.key
    );
    
    // Log activity
    await db.ref('activity_logs').push({
      action: 'CREATE_WNA',
      wnaId: newRef.key,
      username: req.user.username,
      userName: req.user.name,
      timestamp: new Date().toISOString(),
      data: { namaLengkap: req.body.namaLengkap, noPaspor: req.body.noPaspor }
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Data WNA berhasil ditambahkan',
      id: newRef.key 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE WNA
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref(`wna/${req.params.id}`).once('value');
    const existing = snapshot.val();
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'WNA not found' });
    }
    
    const updateData = {
      ...existing,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.username
    };
    
    await db.ref(`wna/${req.params.id}`).update(updateData);
    
    // Create notification
    await createNotification(
      req.user.username,
      req.user.name,
      'Data WNA Diperbarui',
      `${req.user.name} memperbarui data WNA: ${existing.namaLengkap}`,
      'info',
      req.params.id
    );
    
    // Log activity
    await db.ref('activity_logs').push({
      action: 'UPDATE_WNA',
      wnaId: req.params.id,
      username: req.user.username,
      userName: req.user.name,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Data WNA berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE WNA
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref(`wna/${req.params.id}`).once('value');
    const existing = snapshot.val();
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'WNA not found' });
    }
    
    // Create notification before delete
    await createNotification(
      req.user.username,
      req.user.name,
      'Data WNA Dihapus',
      `${req.user.name} menghapus data WNA: ${existing.namaLengkap} (${existing.noPaspor})`,
      'warning',
      req.params.id
    );
    
    // Log activity
    await db.ref('activity_logs').push({
      action: 'DELETE_WNA',
      wnaId: req.params.id,
      username: req.user.username,
      userName: req.user.name,
      timestamp: new Date().toISOString(),
      data: existing
    });
    
    await db.ref(`wna/${req.params.id}`).remove();
    
    res.json({ success: true, message: 'Data WNA berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// EXPORT all WNA data to CSV
router.get('/export/all', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref('wna').once('value');
    const data = snapshot.val();
    
    if (!data) {
      return res.json({ success: true, data: [], csv: '' });
    }
    
    const wnaList = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));
    
    // Create CSV
    const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe Izin', 'Sponsor', 'Alamat', 'Domisili', 'Latitude', 'Longitude', 'Status', 'Tanggal Dibuat', 'Dibuat Oleh'];
    
    const csvRows = [headers.join(',')];
    
    for (const wna of wnaList) {
      const row = [
        `"${wna.id || ''}"`,
        `"${(wna.namaLengkap || '').replace(/"/g, '""')}"`,
        `"${wna.noPaspor || ''}"`,
        `"${wna.negara || ''}"`,
        `"${wna.type || ''}"`,
        `"${(wna.sponsor || '').replace(/"/g, '""')}"`,
        `"${(wna.alamat || '').replace(/"/g, '""')}"`,
        `"${wna.domisili || ''}"`,
        wna.latitude || '',
        wna.longitude || '',
        `"${wna.status || ''}"`,
        `"${wna.createdAt ? new Date(wna.createdAt).toLocaleDateString('id-ID') : ''}"`,
        `"${wna.createdBy || ''}"`
      ];
      csvRows.push(row.join(','));
    }
    
    const csv = csvRows.join('\n');
    
    // Log export activity
    await db.ref('activity_logs').push({
      action: 'EXPORT_DATA',
      username: req.user.username,
      userName: req.user.name,
      timestamp: new Date().toISOString(),
      data: { totalRecords: wnaList.length }
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=wna_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;