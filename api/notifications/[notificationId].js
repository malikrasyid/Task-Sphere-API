const { authenticateToken } = require('../../lib/auth');
const { markNotificationAsRead } = require('../../lib/notifications');

module.exports = async (req, res) => {
    try {
        if (req.method === 'PUT' || req.method === 'PATCH') {
            const { notificationId } = req.query;
            const user = await authenticateToken(req, res);
            const userId = user.userId;
            try {
                await markNotificationAsRead(notificationId, userId);
                res.status(200).json({ message: 'Notification marked as read' });
            } catch (error) {
                console.error('Error updating notification:', error);
                res.status(400).json({ error: error.message });
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