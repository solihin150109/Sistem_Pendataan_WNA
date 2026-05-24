const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// GET profile user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const snapshot = await db.ref(`users/${username}`).once('value');
        const userData = snapshot.val();

        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Remove password from response
        const { password, ...profile } = userData;
        
        res.json({
            success: true,
            data: {
                username: username,
                ...profile
            }
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// UPDATE profile
router.put('/me', authenticateToken, [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('nip').optional().trim(),
    body('jabatan').optional().trim(),
    body('unitKerja').optional().trim(),
    body('noTelepon').optional().trim(),
    body('alamat').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const username = req.user.username;
        const { name, email, nip, jabatan, unitKerja, noTelepon, alamat } = req.body;

        const snapshot = await db.ref(`users/${username}`).once('value');
        const userData = snapshot.val();

        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const updateData = {
            name: name || userData.name,
            email: email || userData.email,
            nip: nip || userData.nip,
            jabatan: jabatan || userData.jabatan,
            unitKerja: unitKerja || userData.unitKerja,
            noTelepon: noTelepon || userData.noTelepon || '',
            alamat: alamat || userData.alamat || '',
            updatedAt: new Date().toISOString()
        };

        await db.ref(`users/${username}`).update(updateData);

        // Log activity
        await db.ref('activity_logs').push({
            action: 'UPDATE_PROFILE',
            username: username,
            timestamp: new Date().toISOString(),
            data: { updatedFields: Object.keys(updateData) }
        });

        res.json({
            success: true,
            message: 'Profil berhasil diperbarui',
            data: updateData
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// CHANGE password
router.put('/me/password', authenticateToken, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const username = req.user.username;
        const { currentPassword, newPassword } = req.body;

        const snapshot = await db.ref(`users/${username}`).once('value');
        const userData = snapshot.val();

        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isValid = await bcrypt.compare(currentPassword, userData.password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Password saat ini salah' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.ref(`users/${username}`).update({
            password: hashedPassword,
            passwordUpdatedAt: new Date().toISOString()
        });

        // Log activity
        await db.ref('activity_logs').push({
            action: 'CHANGE_PASSWORD',
            username: username,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Password berhasil diubah'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// UPLOAD foto profile (menggunakan base64 karena Firebase Realtime Database)
router.post('/me/photo', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const { photo } = req.body; // base64 string

        if (!photo) {
            return res.status(400).json({ success: false, message: 'Foto tidak ditemukan' });
        }

        // Validasi format base64
        if (!photo.startsWith('data:image/')) {
            return res.status(400).json({ success: false, message: 'Format foto tidak valid' });
        }

        // Simpan foto ke database (sebagai base64)
        await db.ref(`users/${username}`).update({
            photo: photo,
            photoUpdatedAt: new Date().toISOString()
        });

        // Log activity
        await db.ref('activity_logs').push({
            action: 'UPDATE_PHOTO',
            username: username,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Foto profil berhasil diperbarui',
            photo: photo
        });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;