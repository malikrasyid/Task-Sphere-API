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
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);

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