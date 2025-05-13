// lib/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

// Replace with a secure secret in your environment variables
const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(user) {
  return jwt.sign(
    { userId: user.userId, email: user.email },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

function authenticateToken(req, res) {
  return new Promise((resolve, reject) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer token_value

    if (!token) {
      return reject({ status: 401, message: 'Unauthorized' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return reject({ status: 403, message: 'Forbidden' });
      }
      resolve(user);
    });
  });
}

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  generateToken,
  authenticateToken,
  hashPassword,
  comparePassword
};