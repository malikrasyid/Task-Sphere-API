// controllers/auth.js
const { createUser, findUserByEmail } = require('../models/users');
const { hashPassword, comparePassword, generateToken } = require('../services/auth');
const { admin } = require('../db'); 

// Centralized error handler logic for Auth
const handleAuthError = (res, error, defaultMessage = 'Authentication failed') => {
    console.error('Auth Controller Error:', error);
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    // Handle Firebase Admin errors (e.g., auth/email-already-in-use)
    if (error.code && error.code.startsWith('auth/')) {
        return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || defaultMessage });
};

async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const userData = await findUserByEmail(email);

        if (!userData) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await comparePassword(password, userData.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken({
            userId: userData.userId,
            email: userData.email
        });
        
        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

        res.status(200).json({
            message: 'Login successful',
            token,
            userId: userData.userId,
            name: fullName
        });
    } catch (error) {
        handleAuthError(res, error, 'Login failed');
    }
}

async function signup(req, res) {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Check if user already exists
        if (await findUserByEmail(email)) {
             return res.status(400).json({ error: 'User with this email already exists' });
        }

        const hashedPassword = await hashPassword(password);
        
        // 1. Create user in Firebase Auth (using admin SDK)
        const user = await admin.auth().createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
        });

        // 2. Create user document in Firestore
        await createUser(user.uid, email, hashedPassword, firstName, lastName);

        res.status(201).json({ message: 'User created successfully', uid: user.uid });
    } catch (error) {
        handleAuthError(res, error, 'Signup failed');
    }
}

module.exports = {
    login,
    signup,
};