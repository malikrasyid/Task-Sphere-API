const { db } = require('./db');
const { uuidv4} = require('./utils');

async function createNotification(notificationData) {
    const notificationId = uuidv4();
    await db.collection('notifications').doc(notificationId).set({
        ...notificationData,
        notificationId
    });
    console.log('Notification created successfully');
}

async function markNotificationAsRead(notificationId, userId) {
    const notificationRef = db.collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();
    
    if (!notificationDoc.exists) {
        throw new Error('Notification not found');
    }
    
    const notificationData = notificationDoc.data();
    
    // Check if notification belongs to the user
    if (notificationData.userId !== userId) {
        throw new Error('Forbidden: You do not have permission to update this notification');
    }
    
    await notificationRef.update({ read: true });
    console.log(`Notification ${notificationId} marked as read`);
}

async function checkDeadlinesAndNotify() {
    try {
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000; // 1 day in milliseconds
        
        // Get all tasks
        const projectsSnapshot = await db.collection('projects').get();
        
        for (const projectDoc of projectsSnapshot.docs) {
            const projectData = projectDoc.data();
            const tasksSnapshot = await projectDoc.ref.collection('tasks').get();
            
            for (const taskDoc of tasksSnapshot.docs) {
                const taskData = taskDoc.data();
                const endDate = new Date(taskData.endDate);
                
                // If task is not done and deadline is within 24 hours
                if (taskData.status !== 'Done' && 
                    endDate > now && 
                    endDate - now <= oneDay) {
                    
                    // Notify all team members
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
        
        console.log('Deadline checks and notifications completed');
    } catch (error) {
        console.error('Error in deadline notification system:', error);
    }
}

module.exports = {
    createNotification,
    markNotificationAsRead,
    checkDeadlinesAndNotify
}