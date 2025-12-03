const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../services/auth');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer token_value

    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });

        req.user = user; 
        next();
    });
}

module.exports = authenticateToken;