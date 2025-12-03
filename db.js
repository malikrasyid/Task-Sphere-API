// db.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error('FIREBASE_PRIVATE_KEY environment variable is not set or is empty. Please check your .env file.');
    }
    
    // This .replace() logic is necessary because Vercel and common dotenv configurations 
    // store the private key's newlines as the literal string '\n', which must be converted.
    const correctedPrivateKey = privateKey.replace(/\\n/g, '\n');

    const credentials = {
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: correctedPrivateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    };
    
    admin.initializeApp({
      credential: admin.credential.cert(credentials)
    });
    
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error:", error.message || error);
    throw new Error('Failed to initialize Firebase Admin SDK. Check environment variables.');
  }
}

const db = admin.firestore();

module.exports = {
  db,
  admin
};