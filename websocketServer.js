const WebSocket = require('ws');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://your-project-id.firebaseio.com'
});

const db = admin.firestore();
const wss = new WebSocket.Server({ port: 8080 });

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// Function to broadcast data to all connected clients
const broadcast = (message) => {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
};

// **1. Listen for changes in "projects" collection**
db.collection('projects').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
        broadcast({
            type: `project:${change.type}`, // created, modified, removed
            data: { id: change.doc.id, ...change.doc.data() }
        });
    });
}, error => {
    console.error("🚨 Error Firestore listener:", error);
});

// **2. Listen for changes in "tasks" collection**
db.collectionGroup('tasks').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
        broadcast({
            type: `task:${change.type}`,
            data: { id: change.doc.id, ...change.doc.data() }
        });
    });
});

// **3. Listen for changes in "user" collection**
db.collection('users').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
        broadcast({
            type: `user:${change.type}`,
            data: { id: change.doc.id, ...change.doc.data() }
        });
    });
});

console.log('WebSocket server running on ws://localhost:8080');
