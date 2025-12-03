// controllers/notifications.js
const { 
    createNotification, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    getNotificationsByUserId 
} = require('../models/notifications');

// Centralized error handler logic
const handleNotificationError = (res, error, defaultMessage = 'Internal server error') => {
    console.error('Notification Controller Error:', error);
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || defaultMessage });
};

async function getNotifications(req, res) {
    const userId = req.user.userId;
    
    try {
        const notifications = await getNotificationsByUserId(userId, req.query.read); 
        res.status(200).json({ notifications });
    } catch (error) {
        handleNotificationError(res, error, 'Error fetching notifications');
    }
}

async function createNewNotification(req, res) {
    const userId = req.user.userId;
    const { projectId, taskId, title, body, type } = req.body;
    
    if (!projectId || !title || !body) {
        return res.status(400).json({ error: 'Missing required fields: projectId, title, or body' });
    }

    try {
        const notificationData = {
            userId,
            projectId,
            taskId, 
            title,
            body,
            type: type || 'info',
            timestamp: new Date().toISOString(),
            read: false
        };

        const notification = await createNotification(notificationData);
        
        return res.status(201).json({ 
            message: 'Notification created successfully',
            notification
        });
    } catch (error) {
        handleNotificationError(res, error, 'Error creating notification');
    }
}

async function markSingleAsRead(req, res) {
    const { notificationId } = req.params;
    const userId = req.user.userId;
    
    try {
        await markNotificationAsRead(notificationId, userId);
        res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        handleNotificationError(res, error, 'Error updating notification');
    }
}

async function markAllAsRead(req, res) {
    const userId = req.user.userId;
    
    try {
        const count = await markAllNotificationsAsRead(userId);
        
        res.status(200).json({ 
            message: 'All notifications marked as read',
            count: count
        });
    } catch (error) {
        handleNotificationError(res, error, 'Error marking all notifications as read');
    }
}

module.exports = {
    getNotifications,
    createNewNotification,
    markSingleAsRead,
    markAllAsRead,
};