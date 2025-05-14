const { db } = require('../../lib/db');
const { searchUsers } = require('../../lib/users')
const { authenticateToken } = require('../../lib/users');

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') {
            await authenticateToken(req, res);
            const { action, query, userId } = req.query;

            if (action === 'search') {
                if (!query || query.length < 2) {
                    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
                }

                try {
                    const users = await searchUsers(query);
                    return res.status(200).json({ users });
                } catch (error) {
                    console.error('Error in search users endpoint:', error);
                    return res.status(500).json({ error: error.message });
                }
            } else if (action === 'name') {
                if (!userId) {
                    return res.status(400).json({ error: 'Missing userId parameter' });
                }

                try {
                    const userDoc = await db.collection('users').doc(userId).get();
                    if (!userDoc.exists) {
                    return res.status(404).json({ error: 'User not found' });
                    }

                    const data = userDoc.data();
                    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                    return res.status(200).json({ name: fullName || userId });
                } catch (error) {
                    console.error('Error fetching user name:', error);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }
            } else {
            return res.status(400).json({ error: 'Invalid or missing action parameter' });
            }
        } 
    } catch (error) {
    console.error('Users endpoint error:', error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}