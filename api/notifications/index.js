import cors from '../../lib/cors';
const { authenticateToken } = require('../../lib/users');
const { markNotificationAsRead, createNotification } = require('../../lib/notifications');
const { db } = require('../../lib/db');

export default async function handler(req, res) {
  await cors(req, res);
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
        } else if (req.method === 'POST') {
            const { projectId, taskId, title, body, type } = req.body;
            
            if (!projectId || !taskId || !title || !body) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            try {
                const notification = await createNotification({
                    userId,
                    projectId,
                    taskId,
                    title,
                    body,
                    type: type || 'info',
                    timestamp: new Date().toISOString(),
                    read: false
                });
                
                return res.status(201).json({ 
                    message: 'Notification created successfully',
                    notification
                });
            } catch (error) {
                console.error('Error creating notification:', error);
                return res.status(500).json({ error: error.message });
            }
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
            const { notificationId } = req.query;

            if (notificationId) {
                // --- Mark a single notification as read ---
                try {
                await markNotificationAsRead(notificationId, userId);
                return res.status(200).json({ message: 'Notification marked as read' });
                } catch (error) {
                console.error('Error updating notification:', error);
                return res.status(400).json({ error: error.message });
                }
            } else {
                // --- Mark all unread notifications as read ---
                try {
                    const snapshot = await db.collection('notifications')
                        .where('userId', '==', userId)
                        .where('read', '==', false)
                        .get();

                    const batch = db.batch();
                    snapshot.docs.forEach(doc => {
                        batch.update(doc.ref, { read: true });
                    });
                    await batch.commit();

                    return res.status(200).json({ 
                        message: 'All notifications marked as read',
                        count: snapshot.size
                    });
                } catch (error) {
                    console.error('Error marking all notifications as read:', error);
                    return res.status(500).json({ error: error.message });
                }
            }
        }
        else {
            // Method not allowed for any other HTTP methods
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Projects endpoint error:', error);
        if (error.status) {
        return res.status(error.status).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}