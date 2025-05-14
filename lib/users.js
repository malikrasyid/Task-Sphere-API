const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { db } = require('./db');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

// --- JWT Token Functions ---
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
    const token = authHeader && authHeader.split(' ')[1];

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

// --- Password Hashing & Comparison ---
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// --- User Creation ---
async function createUser(userId, email, password, firstName, lastName) {
  const userData = {
    userId,
    email,
    password,
    firstName,
    lastName,
    projects: []
  };
  await db.collection('users').doc(userId).set(userData);
  console.log('User created successfully');
}

// --- User Search ---
async function searchUsers(searchQuery) {
  try {
    const usersRef = db.collection('users');

    const emailResults = await usersRef
      .where('email', '>=', searchQuery)
      .where('email', '<=', searchQuery + '\uf8ff')
      .get();

    const firstNameResults = await usersRef
      .where('firstName', '>=', searchQuery)
      .where('firstName', '<=', searchQuery + '\uf8ff')
      .get();

    const lastNameResults = await usersRef
      .where('lastName', '>=', searchQuery)
      .where('lastName', '<=', searchQuery + '\uf8ff')
      .get();

    const userMap = new Map();
    [emailResults, firstNameResults, lastNameResults].forEach(snapshot => {
      snapshot.forEach(doc => {
        if (!userMap.has(doc.id)) {
          userMap.set(doc.id, {
            userId: doc.id,
            ...doc.data()
          });
        }
      });
    });

    return Array.from(userMap.values());
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

module.exports = {
  generateToken,
  authenticateToken,
  hashPassword,
  comparePassword,
  createUser,
  searchUsers
};
