const { v4: uuidv4 } = require('uuid');
const { checkDeadlinesAndNotify } = require('./notifications');
const { updateAllTaskStatuses } = require('./projects');
const admin = require('firebase-admin');

let db;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    }),
  });
}

db = admin.firestore();

function getUserRoleInProject(teamArray, userId) {
  const member = teamArray.find(m => m.userId === userId);
  return member ? member.role : null;
}

function getAutoStatus(startDate, endDate) {
  const now = new Date();

  let start, end;

  if (startDate && typeof startDate.toDate === 'function') {
    start = startDate.toDate();
  } else {
    start = startDate instanceof Date ? startDate : new Date(startDate);
  }

  if (endDate && typeof endDate.toDate === 'function') {
    end = endDate.toDate();
  } else {
    end = endDate instanceof Date ? endDate : new Date(endDate);
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid date objects in getAutoStatus:', { start, end });
    return 'Not Started';
  }

  if (now < start) return 'Not Started';
  if (now >= start && now <= end) return 'Ongoing';
  if (now > end) return 'Overdue';
}

async function performScheduledTaskMaintenance() {
  try {
    await checkDeadlinesAndNotify();
    await updateAllTaskStatuses();
    console.log('Scheduled task maintenance completed');
  } catch (error) {
    console.error('Error in scheduled task maintenance:', error);
  }
}

module.exports = {
  db,
  admin,
  uuidv4,
  getUserRoleInProject,
  getAutoStatus,
  performScheduledTaskMaintenance
};