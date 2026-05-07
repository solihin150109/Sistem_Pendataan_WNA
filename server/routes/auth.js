const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');
const { body, validationResult } = require('express-validator');

// Admin login
router.post('/login', [
  body('username').notEmpty().trim().escape(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    // Get user from Realtime Database
    const snapshot = await db.ref(`users/${username}`).once('value');
    const userData = snapshot.val();

    if (!userData) {
      return res.status(401).json({ 
        success: false, 
        message: 'Username atau password salah' 
      });
    }

    const isValidPassword = await bcrypt.compare(password, userData.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Username atau password salah' 
      });
    }

    const token = jwt.sign(
      { 
        username: username, 
        name: userData.name, 
        role: userData.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log login activity
    await db.ref('activity_logs').push({
      username: username,
      action: 'LOGIN',
      timestamp: new Date().toISOString(),
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    res.json({
      success: true,
      token: token,
      user: {
        name: userData.name,
        role: userData.role,
        username: username,
        email: userData.email || ''
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server' 
    });
  }
});

// Verify token
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Change password
router.post('/change-password', [
  body('username').notEmpty(),
  body('oldPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  try {
    const snapshot = await db.ref(`users/${username}`).once('value');
    const userData = snapshot.val();

    if (!userData) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isValid = await bcrypt.compare(oldPassword, userData.password);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Password lama salah' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.ref(`users/${username}`).update({ 
      password: hashedPassword, 
      updatedAt: new Date().toISOString() 
    });

    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;