const admin = require('firebase-admin');

let serviceAccount;

// Logika untuk mendeteksi Environment Vercel vs Lokal
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    // Parsing JSON dari Environment Variable Vercel
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // Perbaikan karakter newline (\n) agar Private Key terbaca benar oleh Google
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (err) {
    console.error("❌ Error parsing FIREBASE_SERVICE_ACCOUNT:", err.message);
  }
} else {
  // Jika di laptop, pakai file lokal
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch (err) {
    console.error("❌ File serviceAccountKey.json tidak ditemukan di lokal!");
  }
}

// Pastikan URL database ini sesuai dengan Firebase Console kamu
const databaseURL = "https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
    console.log('✅ Firebase Admin SDK Berhasil Terhubung');
  } catch (err) {
    console.error('❌ Inisialisasi Firebase Gagal:', err.message);
  }
}

const db = admin.database();
const auth = admin.auth();

module.exports = { admin, db, auth };