const { searchUsers } = require('../../lib/users')
const { authenticateToken } = require('../../lib/auth');

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') {
            await authenticateToken(req, res);
            const { query } = req.query;

            if (!query || query.length < 2) {
                return res.status(400).json({ error: 'Search query must be at least 2 characters' });
            }

            try {
                const users = await searchUsers(query);
                res.status(200).json({ users });
            } catch (error) {
                console.error('Error in search users endpoint:', error);
                res.status(500).json({ error: error.message });
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