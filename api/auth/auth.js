// api/auth/login.js
const { db, admin } = require('../../lib/utils');
const { comparePassword, generateToken, hashPassword } = require('../../lib/users');
const { createUser } = require('../../lib/users');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, firstName, lastName, email, password } = req.body;

    if (action === 'login') {
      try {
        const userSnapshot = await db.collection('users')
          .where('email', '==', email)
          .get();

        if (userSnapshot.empty) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        const isMatch = await comparePassword(password, userData.password);

        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create token
        const token = generateToken({
          userId: userData.userId,
          email: userData.email
        });

        res.status(200).json({
          message: 'Login successful',
          token,
          userId: userData.userId,
          name: `${userData.firstName} ${userData.lastName}`
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    } else if (action === 'signup') {
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
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}