// controllers/users.js
const { findUserById, searchUsers } = require('../models/users');

// Centralized error handler logic
const handleUsersError = (res, error, defaultMessage = 'Internal server error') => {
    console.error('Users Controller Error:', error);
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || defaultMessage });
};

async function getUserName(req, res) {
    const userId = req.params.userId; 

    try {
        const userData = await findUserById(userId);
        
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
        
        return res.status(200).json({ name: fullName || userId, userId: userData.userId });
    } catch (error) {
        handleUsersError(res, error);
    }
}

async function searchUsersController(req, res) {
    const { query } = req.query; 
    
    if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    try {
        const users = await searchUsers(query);
        res.status(200).json({ users });
    } catch (error) {
        handleUsersError(res, error);
    }
}

module.exports = {
    getUserName,
    searchUsersController,
};