const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account
let serviceAccount;
try {
    const serviceAccountPath = path.join(__dirname, 'config', 'serviceAccountKey.json');
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Service account loaded\n');
} catch (error) {
    console.error('❌ Failed to load service account:', error.message);
    process.exit(1);
}

const databaseURL = 'https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app';

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
    });
}

const db = admin.database();

async function setupDatabase() {
    console.log('='.repeat(60));
    console.log('🚀 FIXING DATABASE SETUP');
    console.log('='.repeat(60));
    console.log();

    try {
        // Test connection first
        console.log('Testing connection...');
        await db.ref('.info/connected').once('value');
        console.log('✅ Database connected!\n');

        // Create users
        console.log('Creating users...');
        
        const adminPassword = await bcrypt.hash('admin123', 10);
        await db.ref('users/admin').set({
            name: 'Administrator',
            role: 'Administrator',
            password: adminPassword,
            email: 'admin@system.com',
            createdAt: new Date().toISOString(),
            isActive: true
        });
        console.log('✅ Admin user created (admin/admin123)');

        const operatorPassword = await bcrypt.hash('operator123', 10);
        await db.ref('users/operator').set({
            name: 'Operator',
            role: 'Operator',
            password: operatorPassword,
            email: 'operator@system.com',
            createdAt: new Date().toISOString(),
            isActive: true
        });
        console.log('✅ Operator user created (operator/operator123)\n');

        // Create regions
        console.log('Creating regions...');
        const regions = {
            'Kota_Jambi': {
                id: 'Kota_Jambi',
                name: 'Kota Jambi',
                displayName: 'Kota Jambi',
                active: true
            },
            'Kab_Sarolangun': {
                id: 'Kab_Sarolangun',
                name: 'Kab. Sarolangun',
                displayName: 'Kab. Sarolangun',
                active: true
            },
            'Kab_Muaro_Jambi': {
                id: 'Kab_Muaro_Jambi',
                name: 'Kab. Muaro Jambi',
                displayName: 'Kab. Muaro Jambi',
                active: true
            },
            'Kab_Batang_Hari': {
                id: 'Kab_Batang_Hari',
                name: 'Kab. Batang Hari',
                displayName: 'Kab. Batang Hari',
                active: true
            }
        };

        for (const [key, region] of Object.entries(regions)) {
            await db.ref(`regions/${key}`).set(region);
        }
        console.log('✅ Regions created\n');

        // Create test entry
        console.log('Creating test WNA entry...');
        await db.ref('wna/test_entry').set({
            namaLengkap: 'Test User',
            noPaspor: 'TEST123',
            negara: 'Test Country',
            type: 'VOA',
            sponsor: 'Test Sponsor',
            alamat: 'Test Address',
            domisili: 'Kota Jambi',
            status: 'ACTIVE',
            isExample: true,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
        });
        console.log('✅ Test entry created\n');

        console.log('='.repeat(60));
        console.log('✅ SETUP COMPLETE!');
        console.log('='.repeat(60));
        console.log('\n🔑 LOGIN CREDENTIALS:');
        console.log('   Admin: admin / admin123');
        console.log('   Operator: operator / operator123\n');
        console.log('🧪 Test your connection:');
        console.log('   curl http://localhost:5000/api/health\n');
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\n💡 Check:');
        console.error('   1. Is your internet connected?');
        console.error('   2. Is Firebase Realtime Database enabled?');
        console.error('   3. Check Firebase console for database URL\n');
    }
}

setupDatabase();