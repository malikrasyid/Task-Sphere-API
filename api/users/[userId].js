const { db } = require('../../lib/db');
const { authenticateToken } = require('../../lib/auth');

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') {
            await authenticateToken(req, res);
            const { userId } = req.query;

            try {
                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const data = userDoc.data();
                const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                return res.json({ name: fullName || userId });
            } catch (error) {
                console.error('Error fetching user:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        } else {
            // Method not allowed for any other HTTP methods
            return res.status(405).json({ error: 'Method not allowed' });
        }       
    } catch (error) {
        console.error('Projects endpoint error:', error);
        
        // Handle authentication errors
        if (error.status) {
        return res.status(error.status).json({ error: error.message });
        }
        
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}