// api/auth/signup.js
const { admin } = require('../../lib/db');
const { hashPassword } = require('../../lib/auth');
const { uuidv4 } = require('../../lib/utils');
const { createUser } = require('../../lib/users');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, lastName, email, password } = req.body;

  try {
    const hashedPassword = await hashPassword(password);
    
    const user = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    await createUser(user.uid, email, hashedPassword, firstName, lastName);
    res.status(201).json({ message: 'User created successfully', uid: user.uid });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
};