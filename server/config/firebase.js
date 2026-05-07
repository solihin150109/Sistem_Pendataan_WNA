const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const databaseURL = 'https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app';

console.log(`📡 Database URL: ${databaseURL}`);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: databaseURL
});

console.log('✅ Firebase Admin initialized (Realtime Database)');

const db = admin.database();
const auth = admin.auth();

module.exports = { admin, db, auth };