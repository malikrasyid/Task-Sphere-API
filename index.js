require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { db, admin } = require('./db'); 
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const notificationRoutes = require('./routes/notifications');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Get the primary production URL from environment variable
const productionUrl = process.env.FRONTEND_URL; 

// List of allowed origins for development (e.g., common ports for React, Vue, Vite, etc.)
const allowedLocalOrigins = [
  'http://localhost:5173'
];

const allowedOrigins = [productionUrl, ...allowedLocalOrigins].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true); 
        
        // Check if the origin is in our allowed list
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Reject all other origins
            callback(new Error(`Not allowed by CORS policy for origin: ${origin}`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
};

// ----------------------------------------------------
// --- Middleware ---
// ----------------------------------------------------
app.use(cors()); // Global CORS enablement
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// ----------------------------------------------------
// --- Root Route ---
// ----------------------------------------------------
app.get('/', (req, res) => {
    res.json({ message: 'Task Sphere API is running' });
});


// ----------------------------------------------------
// --- API Routes ---
// ----------------------------------------------------
app.use('/api/auth', authRoutes); 
app.use('/api/users', userRoutes); 
app.use('/api/projects', projectRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.use(errorHandler);

// ----------------------------------------------------
// --- Start Server ---
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;