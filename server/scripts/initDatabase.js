const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Perbaiki path - cari di folder config (bukan scripts/config)
const serviceAccountPath = path.join(__dirname, '..', 'config', 'serviceAccountKey.json');

console.log(`🔍 Looking for service account at: ${serviceAccountPath}`);

if (!fs.existsSync(serviceAccountPath)) {
  console.error('\n❌ ERROR: serviceAccountKey.json not found!');
  console.error(`Expected location: ${serviceAccountPath}`);
  console.error('\n💡 Solutions:');
  console.error('1. Place serviceAccountKey.json in: D:\\Sistem-Pendataan-WNA\\server\\config\\');
  console.error('2. Or download it from Firebase Console:');
  console.error('   Project Settings > Service Accounts > Generate New Private Key\n');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
console.log('✅ Loaded service account\n');

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
    // 1. Cek dan buat struktur database
    console.log('📝 1. MEMERIKSA STRUKTUR DATABASE...');
    console.log('-'.repeat(40));
    
    // Buat users jika belum ada
    const usersExist = await db.ref('users').once('value');
    if (!usersExist.exists()) {
      console.log('   📝 Creating users...');
      const adminPassword = await bcrypt.hash('admin', 10);
      await db.ref('users/admin').set({
        name: 'Administrator Sistem',
        role: 'Administrator',
        password: adminPassword,
        email: 'admin@imigrasi.go.id',
        createdAt: new Date().toISOString(),
        isActive: true
      });
      
      const operatorPassword = await bcrypt.hash('operator123', 10);
      await db.ref('users/operator').set({
        name: 'Operator Imigrasi',
        role: 'Operator',
        password: operatorPassword,
        email: 'operator@imigrasi.go.id',
        createdAt: new Date().toISOString(),
        isActive: true
      });
      console.log('   ✓ Users created (admin & operator)');
    } else {
      console.log('   ✓ Users already exist');
    }
    
    // Buat regions jika belum ada
    const regionsExist = await db.ref('regions').once('value');
    if (!regionsExist.exists()) {
      console.log('   📝 Creating regions...');
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
      }
      console.log('   ✓ Regions created');
    } else {
      console.log('   ✓ Regions already exist');
    }
    
    // ============ PERBAIKAN: Buat tabel wna dengan data permanen ============
    console.log('   📝 Creating wna table...');
    const wnaExist = await db.ref('wna').once('value');
    
    if (!wnaExist.exists()) {
      // Buat 1 data sample yang INFORMATIF dan akan tetap ada sampai dihapus user
      await db.ref('wna/example_entry').set({
        namaLengkap: 'John Doe (Contoh Data)',
        noPaspor: 'XYZ9876543',
        negara: 'Australia',
        type: 'VOA',
        sponsor: 'PT. Contoh Perusahaan',
        alamat: 'Jl. Contoh Alamat No. 123',
        domisili: 'Kota Jambi',
        latitude: -1.61,
        longitude: 103.61,
        status: 'ACTIVE',
        note: '⚠️ INI ADALAH DATA CONTOH - Silakan hapus setelah menginput data asli',
        isExample: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      });
      console.log('   ✓ WNA table created with example data');
      console.log('   ℹ️ Tabel wna akan tetap terlihat (ada 1 data contoh)');
      console.log('   ℹ️ Silakan hapus data contoh setelah menginput data asli');
    } else {
      console.log('   ✓ WNA table already exists');
    }
    // ============ END PERBAIKAN ============
    
    // Buat settings jika belum ada
    const settingsExist = await db.ref('settings').once('value');
    if (!settingsExist.exists()) {
      console.log('   📝 Creating settings...');
      await db.ref('settings/system').set({
        name: 'Sistem Monitoring WNA',
        version: '1.0.0',
        createdAt: new Date().toISOString()
      });
      console.log('   ✓ Settings created');
    } else {
      console.log('   ✓ Settings already exist');
    }
    
    // Buat activity_logs jika belum ada
    const logsExist = await db.ref('activity_logs').once('value');
    if (!logsExist.exists()) {
      console.log('   📝 Creating activity_logs...');
      await db.ref('activity_logs/system_init').set({
        action: 'SYSTEM_INIT',
        username: 'system',
        timestamp: new Date().toISOString(),
        data: { message: 'Database initialized' }
      });
      console.log('   ✓ Activity logs created');
    } else {
      console.log('   ✓ Activity logs already exist');
    }

    // Selesai
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SETUP COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n📊 STRUKTUR DATABASE:');
    console.log('-'.repeat(40));
    
    // Tampilkan semua tabel yang ada
    const tables = await db.ref('/').once('value');
    const tableList = Object.keys(tables.val() || {});
    for (const table of tableList) {
      const count = await db.ref(table).once('value');
      const childCount = count.numChildren();
      console.log(`   ✅ ${table} (${childCount} items)`);
    }
    
    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('   Administrator:');
    console.log('   ├── username: admin');
    console.log('   └── password: admin\n');
    console.log('   Operator:');
    console.log('   ├── username: operator');
    console.log('   └── password: operator123\n');
    
    console.log('📝 CATATAN PENTING:');
    console.log('   Tabel "wna" memiliki 1 data contoh yang akan TERLIHAT');
    console.log('   Silakan HAPUS data contoh tersebut setelah Anda menginput data WNA asli');
    console.log('   Data contoh dapat dihapus melalui aplikasi atau Firebase Console\n');
    
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Refresh Firebase Console - tabel wna akan TERLIHAT');
    console.log('   2. Jalankan server: npm run dev');
    console.log('   3. Buka frontend: cd ../client && npm run dev');
    console.log('   4. Login dengan admin/admin');
    console.log('   5. Hapus data contoh, lalu mulai input data WNA asli\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Pastikan Realtime Database sudah aktif di Firebase Console');
    console.error('   2. Cek URL database: https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app');
    console.error('   3. Pastikan rules database: { "rules": { ".read": true, ".write": true } }\n');
    process.exit(1);
  }
}

setupDatabase();