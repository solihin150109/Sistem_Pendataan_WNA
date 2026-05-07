const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Cari file service account
let serviceAccount = null;
const possiblePaths = [
  path.join(__dirname, 'config', 'serviceAccountKey.json'),
  path.join(__dirname, 'serviceAccountKey.json'),
  path.join(process.cwd(), 'config', 'serviceAccountKey.json')
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    serviceAccount = require(p);
    console.log(`✅ Loaded service account from: ${p}`);
    break;
  }
}

if (!serviceAccount) {
  console.error('\n❌ ERROR: serviceAccountKey.json not found!');
  console.error('Please place serviceAccountKey.json in:');
  console.error(`   ${path.join(__dirname, 'config', 'serviceAccountKey.json')}\n`);
  process.exit(1);
}

// Database URL
const databaseURL = 'https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app';

console.log(`📡 Database URL: ${databaseURL}\n`);

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
  console.log('✅ Firebase Admin initialized\n');
}

const db = admin.database();

async function setupDatabase() {
  console.log('='.repeat(60));
  console.log('🚀 SETUP DATABASE LENGKAP');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. Hapus semua data lama
    console.log('📝 1. MEMBERSIHKAN DATA LAMA...');
    console.log('-'.repeat(40));
    
    const collections = ['users', 'regions', 'wna', 'activity_logs'];
    for (const col of collections) {
      const snapshot = await db.ref(col).once('value');
      if (snapshot.exists()) {
        await db.ref(col).remove();
        console.log(`   ✓ ${col} - dihapus`);
      }
    }
    console.log('   ✅ Database bersih\n');

    // 2. Buat users
    console.log('📝 2. MEMBUAT DATA USERS...');
    console.log('-'.repeat(40));
    
    const adminPassword = await bcrypt.hash('admin', 10);
    await db.ref('users/admin').set({
      name: 'Administrator Sistem',
      role: 'Administrator',
      password: adminPassword,
      email: 'admin@imigrasi.go.id',
      nip: '198204192005011002',
      jabatan: 'Kepala Sub Seksi Izin Tinggal',
      unitKerja: 'Kantor Imigrasi Kelas I TPI Jambi',
      createdAt: new Date().toISOString(),
      isActive: true
    });
    console.log('   ✓ Admin user (admin/admin)');
    
    const operatorPassword = await bcrypt.hash('operator123', 10);
    await db.ref('users/operator').set({
      name: 'Operator Imigrasi',
      role: 'Operator',
      password: operatorPassword,
      email: 'operator@imigrasi.go.id',
      nip: '199103152010011001',
      jabatan: 'Petugas Data Entry',
      unitKerja: 'Kantor Imigrasi Kelas I TPI Jambi',
      createdAt: new Date().toISOString(),
      isActive: true
    });
    console.log('   ✓ Operator user (operator/operator123)');

    // 3. Buat regions
    console.log('\n📝 3. MEMBUAT DATA WILAYAH KERJA...');
    console.log('-'.repeat(40));
    
    const regions = {
      'Kota_Jambi': {
        id: 'Kota_Jambi',
        name: 'Kota Jambi',
        displayName: 'Kota Jambi',
        color: '#ef4444',
        center: { lat: -1.61, lng: 103.61 },
        active: true
      },
      'Kab_Sarolangun': {
        id: 'Kab_Sarolangun',
        name: 'Kab. Sarolangun',
        displayName: 'Kab. Sarolangun',
        color: '#10b981',
        center: { lat: -2.30, lng: 102.65 },
        active: true
      },
      'Kab_Muaro_Jambi': {
        id: 'Kab_Muaro_Jambi',
        name: 'Kab. Muaro Jambi',
        displayName: 'Kab. Muaro Jambi',
        color: '#f59e0b',
        center: { lat: -1.55, lng: 103.82 },
        active: true
      },
      'Kab_Batang_Hari': {
        id: 'Kab_Batang_Hari',
        name: 'Kab. Batang Hari',
        displayName: 'Kab. Batang Hari',
        color: '#06b6d4',
        center: { lat: -1.75, lng: 103.15 },
        active: true
      }
    };
    
    for (const [key, region] of Object.entries(regions)) {
      await db.ref(`regions/${key}`).set(region);
      console.log(`   ✓ ${region.displayName}`);
    }

    // 4. Buat koleksi kosong untuk WNA
    console.log('\n📝 4. MENYIAPKAN KOLEKSI WNA...');
    console.log('-'.repeat(40));
    
    // Buat placeholder lalu hapus (untuk membuat collection)
    const placeholder = await db.ref('wna/_placeholder').set({
      temp: true,
      createdAt: new Date().toISOString()
    });
    await db.ref('wna/_placeholder').remove();
    console.log('   ✓ wna collection siap digunakan');

    // 5. Buat system log
    console.log('\n📝 5. MEMBUAT SYSTEM LOG...');
    console.log('-'.repeat(40));
    
    await db.ref('activity_logs/system_init').set({
      action: 'SYSTEM_INIT',
      username: 'system',
      timestamp: new Date().toISOString(),
      data: { message: 'Database setup completed successfully' }
    });
    console.log('   ✓ System log created');

    // 6. Buat settings
    console.log('\n📝 6. MEMBUAT SETTINGS...');
    console.log('-'.repeat(40));
    
    await db.ref('settings/system').set({
      name: 'Sistem Monitoring WNA',
      version: '1.0.0',
      lastBackup: null,
      maintenanceMode: false
    });
    console.log('   ✓ System settings created');

    // Selesai
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SETUP COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n📊 STRUKTUR DATABASE:');
    console.log('-'.repeat(40));
    console.log(`
database/
├── users/          ✅ (admin, operator)
├── regions/        ✅ (4 wilayah kerja)
├── wna/            ✅ (siap diisi data)
├── activity_logs/  ✅ (system_init)
└── settings/       ✅ (system)
    `);
    
    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('   Administrator:');
    console.log('   ├── username: admin');
    console.log('   └── password: admin\n');
    console.log('   Operator:');
    console.log('   ├── username: operator');
    console.log('   └── password: operator123\n');
    
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Jalankan server: npm run dev');
    console.log('   2. Buka frontend: cd ../client && npm run dev');
    console.log('   3. Login dengan admin/admin');
    console.log('   4. Mulai input data WNA\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Pastikan Realtime Database sudah aktif');
    console.error('   2. Pastikan URL database benar');
    console.error('   3. Pastikan serviceAccountKey.json valid\n');
    process.exit(1);
  }
}

setupDatabase();