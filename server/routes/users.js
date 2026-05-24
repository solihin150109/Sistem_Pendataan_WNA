const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Middleware untuk cek apakah user adalah admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'Administrator') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya Administrator yang dapat mengakses.' 
    });
  }
  next();
};

// GET all users (hanya admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.ref('users').once('value');
    const data = snapshot.val();
    
    const users = [];
    if (data) {
      Object.keys(data).forEach(key => {
        const { password, ...userWithoutPassword } = data[key];
        users.push({
          id: key,
          username: key,
          ...userWithoutPassword
        });
      });
    }
    
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single user (hanya admin)
router.get('/:username', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const snapshot = await db.ref(`users/${username}`).once('value');
    const userData = snapshot.val();
    
    if (!userData) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const { password, ...userWithoutPassword } = userData;
    res.json({ 
      success: true, 
      data: { username, ...userWithoutPassword } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE new user (hanya admin)
router.post('/', authenticateToken, requireAdmin, [
  body('username').notEmpty().trim(),
  body('name').notEmpty().trim(),
  body('email').isEmail(),
  body('role').isIn(['Administrator', 'Operator']),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  try {
    const { username, name, email, role, password, nip, jabatan, unitKerja, noTelepon, alamat } = req.body;
    
    // Cek apakah user sudah ada
    const existing = await db.ref(`users/${username}`).once('value');
    if (existing.exists()) {
      return res.status(409).json({ success: false, message: 'Username sudah digunakan' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.ref(`users/${username}`).set({
      name,
      email,
      role,
      password: hashedPassword,
      nip: nip || '',
      jabatan: jabatan || '',
      unitKerja: unitKerja || '',
      noTelepon: noTelepon || '',
      alamat: alamat || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Log activity
    await db.ref('activity_logs').push({
      action: 'CREATE_USER',
      username: req.user.username,
      userName: req.user.name,
      targetUser: username,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'User berhasil ditambahkan' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE user (hanya admin)
router.put('/:username', authenticateToken, requireAdmin, [
  body('name').optional().trim(),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['Administrator', 'Operator']),
  body('password').optional().isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  try {
    const { username } = req.params;
    const { name, email, role, password, nip, jabatan, unitKerja, noTelepon, alamat, isActive } = req.body;
    
    const snapshot = await db.ref(`users/${username}`).once('value');
    const existing = snapshot.val();
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const updateData = {
      updatedAt: new Date().toISOString()
    };
    
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (nip !== undefined) updateData.nip = nip;
    if (jabatan !== undefined) updateData.jabatan = jabatan;
    if (unitKerja !== undefined) updateData.unitKerja = unitKerja;
    if (noTelepon !== undefined) updateData.noTelepon = noTelepon;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    await db.ref(`users/${username}`).update(updateData);
    
    // Log activity
    await db.ref('activity_logs').push({
      action: 'UPDATE_USER',
      username: req.user.username,
      userName: req.user.name,
      targetUser: username,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'User berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE user (hanya admin)
router.delete('/:username', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Cek jangan hapus diri sendiri
    if (username === req.user.username) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun sendiri' });
    }
    
    const snapshot = await db.ref(`users/${username}`).once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await db.ref(`users/${username}`).remove();
    
    // Log activity
    await db.ref('activity_logs').push({
      action: 'DELETE_USER',
      username: req.user.username,
      userName: req.user.name,
      targetUser: username,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle user status (hanya admin)
router.put('/:username/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const { isActive } = req.body;
    
    const snapshot = await db.ref(`users/${username}`).once('value');
    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await db.ref(`users/${username}`).update({
      isActive: isActive,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ success: true, message: `Status user ${isActive ? 'diaktifkan' : 'dinonaktifkan'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;