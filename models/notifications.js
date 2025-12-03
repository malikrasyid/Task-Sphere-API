// models/notifications.js
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

async function createNotification(notificationData) {
    const notificationId = uuidv4();
    const result = await db.collection('notifications').doc(notificationId).set({
        ...notificationData,
        notificationId
    });
    return { ...notificationData, notificationId };
}

async function markNotificationAsRead(notificationId, userId) {
    const notificationRef = db.collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();
    
    if (!notificationDoc.exists) {
        throw { status: 404, message: 'Notification not found' };
    }
    
    const notificationData = notificationDoc.data();
    
    // Check if notification belongs to the user
    if (notificationData.userId !== userId) {
        throw { status: 403, message: 'Forbidden: You do not have permission to update this notification' };
    }
    
    await notificationRef.update({ read: true });
}

async function markAllNotificationsAsRead(userId) {
    const notificationsSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();
        
    const batch = db.batch();
    
    notificationsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
    
    return notificationsSnapshot.size;
}

async function getNotificationsByUserId(userId, readStatus) {
    let notificationsQuery = db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc');
        
    // The original code has the read filtering commented out, implementing the option here for flexibility
    // if (readStatus !== undefined) {
    //     notificationsQuery = notificationsQuery.where('read', '==', readStatus === 'true');
    // }
    
    const notificationsSnapshot = await notificationsQuery.get();
    
    const notifications = notificationsSnapshot.docs.map(doc => ({
        ...doc.data()
    }));
    
    return notifications;
}

async function checkDeadlinesAndNotify() {
    try {
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        
        const projectsSnapshot = await db.collection('projects').get();
        
        for (const projectDoc of projectsSnapshot.docs) {
            const projectData = projectDoc.data();
            const tasksSnapshot = await projectDoc.ref.collection('tasks').get();
            
            for (const taskDoc of tasksSnapshot.docs) {
                const taskData = taskDoc.data();
                const endDate = new Date(taskData.endDate);
                
                if (taskData.status !== 'Done' && 
                    endDate > now && 
                    endDate - now <= oneDay) {
                    
                    for (const member of projectData.team) {
                        await createNotification({
                            userId: member.userId,
                            projectId: projectData.projectId,
                            taskId: taskData.taskId,
                            title: 'Deadline Approaching',
                            body: `Task '${taskData.name}' will be due in less than 24 hours`,
                            type: 'deadline',
                            timestamp: new Date().toISOString(),
                            read: false
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in deadline notification system:', error);
        throw error;
    }
}

module.exports = {
    createNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getNotificationsByUserId,
    checkDeadlinesAndNotify
}