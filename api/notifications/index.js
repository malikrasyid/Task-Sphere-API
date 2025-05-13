const { authenticateToken } = require('../../lib/auth');
const { db } = require('../../lib/db');

module.exports = async (req, res) => {
    try {
        const user = await authenticateToken(req, res);
        const userId = user.userId;

        if (req.method === 'GET') {
            const { read } = req.query;
            try {
                let notificationsQuery = db.collection('notifications')
                    .where('userId', '==', userId)
                    .orderBy('timestamp', 'desc');
                    
                // Filter by read status if specified
                // if (read !== undefined) {
                //     notificationsQuery = notificationsQuery.where('read', '==', read === 'true');
                // }
                
                const notificationsSnapshot = await notificationsQuery.get();
                
                const notifications = notificationsSnapshot.docs.map(doc => ({
                    ...doc.data()
                }));
                
                res.status(200).json({ notifications });
            } catch (error) {
                console.error('Error fetching notifications:', error);
                res.status(500).json({ error: error.message });
            }
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
            try {
                const notificationsSnapshot = await db.collection('notifications')
                    .where('userId', '==', userId)
                    .where('read', '==', false)
                    .get();
                    
                const batch = db.batch();
                
                notificationsSnapshot.docs.forEach(doc => {
                    batch.update(doc.ref, { read: true });
                });
                
                await batch.commit();
                
                res.status(200).json({ 
                    message: 'All notifications marked as read',
                    count: notificationsSnapshot.size
                });
            } catch (error) {
                console.error('Error marking all notifications as read:', error);
                res.status(500).json({ error: error.message });
            }
        }
        else {
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