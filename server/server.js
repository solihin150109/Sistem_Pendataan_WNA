require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== FIREBASE INITIALIZATION ====================
let db;
let serviceAccount;

const possiblePaths = [
    path.join(__dirname, 'config', 'serviceAccountKey.json'),
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(process.cwd(), 'config', 'serviceAccountKey.json'),
    path.join(__dirname, 'serviceAccountKey.json')
];

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        try {
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            console.log(`✅ Service account loaded from: ${p}`);
            break;
        } catch (err) {
            console.error(`Error parsing JSON:`, err.message);
        }
    }
}

if (!serviceAccount && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    console.log('✅ Using Firebase from environment variables');
}

if (!serviceAccount) {
    console.error('\n❌ ERROR: serviceAccountKey.json not found!');
    process.exit(1);
}

const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app';

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL,
        });
        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Firebase init failed:', error.message);
        process.exit(1);
    }
}

db = admin.database();

// ==================== MIDDLEWARE ====================
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000', 'https://*.vercel.app'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ==================== AUTH MIDDLEWARE ====================
const JWT_SECRET = process.env.JWT_SECRET || 'sipagi-secret-key-2024';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'Administrator') {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Administrator.' });
    }
    next();
}

// ==================== MULTER CONFIG ====================
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt: ${username}`);
    
    try {
        const snapshot = await db.ref(`users/${username}`).once('value');
        const userData = snapshot.val();
        
        if (!userData) {
            return res.status(401).json({ success: false, message: 'Username atau password salah' });
        }
        
        const isValid = await bcrypt.compare(password, userData.password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Username atau password salah' });
        }
        
        const token = jwt.sign(
            { username, name: userData.name, role: userData.role, email: userData.email || '' },
            JWT_SECRET,
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
        await db.ref(`users/${req.user.username}`).update({ ...req.body, updatedAt: new Date().toISOString() });
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
        const { type, negara, status, limit = '1000' } = req.query;
        const snapshot = await db.ref('wna').once('value');
        let data = snapshot.val();
        let wnaList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        if (type) wnaList = wnaList.filter(item => item.type === type);
        if (negara) wnaList = wnaList.filter(item => item.negara === negara);
        if (status) wnaList = wnaList.filter(item => item.status === status);
        wnaList = wnaList.slice(0, parseInt(limit));
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
                switch (item.type) {
                    case 'VOA': voa++; break;
                    case 'ITK': itk++; break;
                    case 'ITAS': itas++; break;
                    case 'ITAP': itap++; break;
                }
                if (item.negara) negaraMap[item.negara] = (negaraMap[item.negara] || 0) + 1;
            });
        }
        const byCountry = Object.entries(negaraMap).map(([name, jumlah]) => ({ name, jumlah })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10);
        res.json({ success: true, data: { total, byType: { VOA: voa, ITK: itk, ITAS: itas, ITAP: itap }, byCountry } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/wna', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const newRef = db.ref('wna').push();
        await newRef.set({ 
            ...req.body, 
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString(), 
            createdBy: req.user.username 
        });
        res.status(201).json({ success: true, message: 'Data berhasil ditambahkan', id: newRef.key });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/wna/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.ref(`wna/${req.params.id}`).remove();
        res.json({ success: true, message: 'Data berhasil dihapus' });
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
            rows.push([wna.id, wna.namaLengkap || '', wna.noPaspor || '', wna.negara || '', wna.type || '', wna.sponsor || '', wna.alamat || '', wna.domisili || '', wna.status || 'ACTIVE']);
        }
        const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=wna_export_${new Date().toISOString().split('T')[0]}.csv`);
        res.send("\uFEFF" + csv);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== IMPORT ROUTES - FIXED VERSION ====================

// Helper function to clean CSV value
function cleanCsvValue(value) {
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

// Download template
app.get('/api/wna/import/template', authenticateToken, async (req, res) => {
    try {
        const headers = ['namaLengkap', 'noPaspor', 'negara', 'type', 'sponsor', 'alamat', 'domisili', 'latitude', 'longitude', 'status'];
        const csvContent = headers.join(',') + '\n' +
            '"John Doe","ABC123456","United States","VOA","PT Contoh Perusahaan","Jl. Contoh No. 123","Kota Jambi","-1.65","103.2","ACTIVE"\n' +
            '"Jane Smith","XYZ789012","United Kingdom","ITAS","CV Contoh Lain","Jl. Test No. 456","Kota Jambi","-1.65","103.2","ACTIVE"';
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=template_import_wna.csv');
        res.send("\uFEFF" + csvContent);
        console.log('✅ Template downloaded');
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Import file - FIXED VERSION (lebih sederhana dan tidak terlalu ketat)
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

        // Parse file berdasarkan ekstensi
        if (fileOriginalName.toLowerCase().endsWith('.csv')) {
            let csvString = fileBuffer.toString('utf8');
            // Remove BOM
            if (csvString.charCodeAt(0) === 0xFEFF) {
                csvString = csvString.slice(1);
            }
            
            const lines = csvString.split(/\r?\n/);
            if (lines.length < 2) {
                return res.status(400).json({ success: false, message: 'File CSV kosong' });
            }
            
            // Parse headers (baris pertama)
            const headerLine = lines[0];
            const headers = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < headerLine.length; i++) {
                const char = headerLine[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    headers.push(cleanCsvValue(current));
                    current = '';
                } else {
                    current += char;
                }
            }
            headers.push(cleanCsvValue(current));
            
            console.log('Headers:', headers);
            
            // Parse data rows
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = [];
                current = '';
                inQuotes = false;
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        if (inQuotes && line[j + 1] === '"') {
                            current += '"';
                            j++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === ',' && !inQuotes) {
                        values.push(cleanCsvValue(current));
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(cleanCsvValue(current));
                
                // Create row object
                const row = {};
                for (let idx = 0; idx < headers.length; idx++) {
                    const header = headers[idx].toLowerCase();
                    let value = values[idx] || '';
                    if (value === '-' || value === 'null' || value === 'undefined') {
                        value = '';
                    }
                    row[header] = value;
                }
                rows.push(row);
            }
        } else {
            // Parse Excel
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json(worksheet);
            // Convert all keys to lowercase
            rows = rows.map(row => {
                const newRow = {};
                Object.keys(row).forEach(key => {
                    newRow[key.toLowerCase()] = row[key];
                });
                return newRow;
            });
        }

        console.log(`Total rows: ${rows.length}`);

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'File tidak mengandung data' });
        }

        // Process each row
        const importedData = [];
        const errors = [];
        const duplicatePassports = [];

        // Get existing passports from database
        const snapshot = await db.ref('wna').once('value');
        const existingData = snapshot.val() || {};
        const existingPassports = new Set();
        Object.values(existingData).forEach(item => {
            if (item.noPaspor) existingPassports.add(item.noPaspor);
        });

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2;
            
            // Get values with flexible key matching
            const namaLengkap = row.namalengkap || row.nama_lengkap || row.nama || '';
            const noPaspor = row.nopaspor || row.no_paspor || '';
            const negara = row.negara || '';
            const typeRaw = row.type || row.tipe || '';
            const sponsor = row.sponsor || '';
            const alamat = row.alamat || '';
            const domisili = row.domisili || 'Kota Jambi';
            const latitudeRaw = row.latitude || '';
            const longitudeRaw = row.longitude || '';
            const statusRaw = row.status || 'ACTIVE';
            
            // Validation - hanya required fields yang benar-benar wajib
            const validationErrors = [];
            
            if (!namaLengkap) {
                validationErrors.push(`Baris ${rowNumber}: Nama lengkap wajib diisi`);
            }
            if (!noPaspor) {
                validationErrors.push(`Baris ${rowNumber}: Nomor paspor wajib diisi`);
            }
            if (!negara) {
                validationErrors.push(`Baris ${rowNumber}: Negara asal wajib diisi`);
            }
            if (!typeRaw) {
                validationErrors.push(`Baris ${rowNumber}: Tipe izin wajib diisi`);
            }
            if (!alamat) {
                validationErrors.push(`Baris ${rowNumber}: Alamat wajib diisi`);
            }
            
            if (validationErrors.length > 0) {
                errors.push(...validationErrors);
                continue;
            }
            
            // Check duplicate passport
            if (existingPassports.has(noPaspor)) {
                duplicatePassports.push(noPaspor);
                continue;
            }
            
            // Process type
            let type = typeRaw.toString().toUpperCase();
            if (!['VOA', 'ITK', 'ITAS', 'ITAP'].includes(type)) {
                type = 'VOA'; // default to VOA if invalid
            }
            
            // Process status
            let status = statusRaw.toString().toUpperCase();
            if (!['ACTIVE', 'EXPIRED', 'DEPARTED'].includes(status)) {
                status = 'ACTIVE'; // default to ACTIVE if invalid
            }
            
            // Process coordinates
            let latitude = null;
            let longitude = null;
            
            if (latitudeRaw && latitudeRaw.toString().trim()) {
                const latNum = parseFloat(latitudeRaw);
                if (!isNaN(latNum)) latitude = latNum;
            }
            
            if (longitudeRaw && longitudeRaw.toString().trim()) {
                const lngNum = parseFloat(longitudeRaw);
                if (!isNaN(lngNum)) longitude = lngNum;
            }
            
            // Create data object
            const now = new Date().toISOString();
            const data = {
                namaLengkap: namaLengkap.toString().trim(),
                noPaspor: noPaspor.toString().trim(),
                negara: negara.toString().trim(),
                type: type,
                sponsor: sponsor || '-',
                alamat: alamat.toString().trim(),
                domisili: domisili || 'Kota Jambi',
                latitude: latitude,
                longitude: longitude,
                status: status,
                createdAt: now,
                updatedAt: now,
                createdBy: req.user.username,
                createdByName: req.user.name || req.user.username,
                imported: true
            };
            
            importedData.push(data);
        }
        
        console.log(`Valid data: ${importedData.length}, Duplicates: ${duplicatePassports.length}, Errors: ${errors.length}`);
        
        // Save to database
        let importedCount = 0;
        for (const data of importedData) {
            try {
                const newRef = db.ref('wna').push();
                await newRef.set(data);
                importedCount++;
                console.log(`✅ Imported: ${data.namaLengkap} (${data.noPaspor})`);
            } catch (err) {
                console.error('Save error:', err);
                errors.push(`Gagal menyimpan ${data.noPaspor}: ${err.message}`);
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
                duplicateCount: duplicatePassports.length,
                errorCount: errors.length
            }
        });
        
        console.log(`✅ Import completed: ${importedCount} records`);
        
        res.json({
            success: true,
            message: `Import selesai. ${importedCount} data berhasil diimport.`,
            data: {
                totalRows: rows.length,
                importedCount: importedCount,
                duplicateCount: duplicatePassports.length,
                errorCount: errors.length,
                errors: errors.slice(0, 20),
                duplicatePassports: duplicatePassports.slice(0, 20)
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
app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`\n✅ Routes:`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/wna`);
    console.log(`   GET    /api/wna/import/template`);
    console.log(`   POST   /api/wna/import`);
    console.log(`   GET    /api/health\n`);
});