const admin = require('firebase-admin');

let serviceAccount;

// Periksa apakah sedang di Vercel (Production) atau di Laptop (Development)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    // Ambil data dari Environment Variable Vercel
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // PERBAIKAN KRUSIAL: Memperbaiki format private_key agar valid di server Linux/Vercel
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (error) {
    console.error('❌ Gagal memproses FIREBASE_SERVICE_ACCOUNT JSON:', error.message);
  }
} else {
  // Jika sedang di laptop, gunakan file lokal seperti biasa
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (error) {
    console.error('❌ File serviceAccountKey.json tidak ditemukan di lokal!');
  }
}

const databaseURL = 'https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
    console.log('✅ Firebase Admin initialized (Realtime Database)');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
  }
}

const db = admin.database();
const auth = admin.auth();

module.exports = { admin, db, auth };