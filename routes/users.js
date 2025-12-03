// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/users');
const authenticateToken = require('../middleware/auth');

// GET /api/users/search?query=...
router.get('/search', authenticateToken, userController.searchUsersController);

// GET /api/users/:userId - Get user name by ID (can be public or authenticated, 
// keeping it open as per original server.js logic, but /api/users/name was in api/users/index.js)
router.get('/:userId', userController.getUserName); 

module.exports = router;