const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Cari service account key
let serviceAccount;
let serviceAccountPath;

const possiblePaths = [
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(process.cwd(), 'config', 'serviceAccountKey.json'),
    path.join(__dirname, '..', 'serviceAccountKey.json')
];

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        serviceAccountPath = p;
        try {
            serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
            console.log(`✅ Service account loaded from: ${p}`);
            break;
        } catch (err) {
            console.error(`Error parsing JSON from ${p}:`, err.message);
        }
    }
}

if (!serviceAccount) {
    console.error('\n❌ ERROR: serviceAccountKey.json not found or invalid!');
    console.error('Please ensure serviceAccountKey.json exists in server/config/ folder\n');
    process.exit(1);
}

const databaseURL = 'https://pendataanwna-default-rtdb.asia-southeast1.firebasedatabase.app';

// Clean initialization
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL,
            databaseAuthVariableOverride: null
        });
        console.log('✅ Firebase Admin initialized successfully');
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        process.exit(1);
    }
}

const db = admin.database();
const auth = admin.auth();

// Test connection immediately
setTimeout(async () => {
    try {
        await db.ref('.info/connected').once('value');
        console.log('✅ Firebase Realtime Database is connected');
    } catch (error) {
        console.error('❌ Firebase Realtime Database connection failed:', error.message);
    }
}, 1000);

module.exports = { admin, db, auth };