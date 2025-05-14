const admin = require('firebase-admin');

let db;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Parse the JSON string from environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    db = admin.firestore();
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

db = admin.firestore();

module.exports = {
  db,
  admin
};