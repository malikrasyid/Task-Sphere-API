const { db } = require('./db');
const { createNotification } = require('./notifications');
const { getUserRoleInProject, getAutoStatus } = require('./utils')

async function addTaskToProject(projectId, taskId, taskData) {
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
        throw new Error('Project not found');
    }

    await projectRef.collection('tasks').doc(taskId).set(taskData);

    // Create notifications for team members about new task
    const projectData = projectDoc.data();
    for (const member of projectData.team) {
        if (member.userId !== taskData.createdBy) {
            await createNotification({
                userId: member.userId,
                projectId,
                taskId,
                title: 'New Task Created',
                body: `New task '${taskData.name}' has been added to project '${projectData.name}'`,
                type: 'info',
                timestamp: new Date().toISOString(),
                read: false
            });
        }
    }

    console.log('Task added successfully');
}

async function updateTaskStatus(projectId, taskId, userId, newStatus) {
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        throw new Error('Project not found');
    }

    const projectData = projectDoc.data();
    const userRole = getUserRoleInProject(projectData.team, userId);

    if (userRole !== 'owner' && userRole !== 'editor') {
        throw new Error('Forbidden: Only owner or editor can update status');
    }

    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
        throw new Error('Task not found');
    }
    
    if (newStatus !== 'Done') {
        throw new Error('Invalid status: Only "Done" can be manually set');
    }

    await taskRef.update({ status: 'Done' });

    // Create notification for task completed
    const taskData = taskDoc.data();
    for (const member of projectData.team) {
        if (member.userId !== userId) {
            await createNotification({
                userId: member.userId,
                projectId,
                taskId,
                title: 'Task Completed',
                body: `Task '${taskData.name}' has been marked as Done`,
                type: 'info',
                timestamp: new Date().toISOString(),
                read: false
            });
        }
    }

    console.log(`Task ${taskId} marked as Done`);
}

async function deleteTaskFromProject(projectId, taskId, userId) {
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        throw new Error('Project not found');
    }

    const projectData = projectDoc.data();
    const userRole = getUserRoleInProject(projectData.team, userId);

    if (userRole !== 'owner' && userRole !== 'editor') {
        throw new Error('Forbidden: You do not have permission to delete tasks');
    }

    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
        throw new Error('Task not found');
    }

    const taskData = taskDoc.data();
    const batch = db.batch();

    // Delete all comments in the task
    const commentsSnapshot = await taskRef.collection('comments').get();
    if (!commentsSnapshot.empty) {
        commentsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }

    // Delete related notifications
    const notificationsSnapshot = await db.collection('notifications')
        .where('taskId', '==', taskId)
        .get();
    
    if (!notificationsSnapshot.empty) {
        notificationsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }

    // Delete the task
    batch.delete(taskRef);
    
    // Execute batch operations
    await batch.commit();
    
    // Notify team members about task deletion
    for (const member of projectData.team) {
        if (member.userId !== userId) {
            await createNotification({
                userId: member.userId,
                projectId,
                title: 'Task Deleted',
                body: `Task '${taskData.name}' has been deleted from project '${projectData.name}'`,
                type: 'info',
                timestamp: new Date().toISOString(),
                read: false
            });
        }
    }
    console.log(`Task ${taskId} from project ${projectId} deleted successfully`);
}

async function updateAllTaskStatuses() {
    try {
        const now = new Date();
        const projectsSnapshot = await db.collection('projects').get();
        let updatedCount = 0;
        
        for (const projectDoc of projectsSnapshot.docs) {
            const projectId = projectDoc.id;
            const projectData = projectDoc.data();
            const tasksSnapshot = await projectDoc.ref.collection('tasks').get();
            
            for (const taskDoc of tasksSnapshot.docs) {
                const taskId = taskDoc.id;
                const taskData = taskDoc.data();
                
                // Skip tasks that are already marked as Done (manual completion)
                if (taskData.status === 'Done') continue;

                try {
                    // Handle Firestore Timestamp objects
                    let startDate, endDate;
                    
                    // Check if startDate is a Firestore Timestamp
                    if (taskData.startDate && typeof taskData.startDate.toDate === 'function') {
                        startDate = taskData.startDate.toDate();
                    } else if (taskData.startDate) {
                        startDate = new Date(taskData.startDate);
                    } else {
                        console.log(`Task ${taskId} is missing startDate, skipping`);
                        continue;
                    }
                    
                    // Check if endDate is a Firestore Timestamp
                    if (taskData.endDate && typeof taskData.endDate.toDate === 'function') {
                        endDate = taskData.endDate.toDate();
                    } else if (taskData.endDate) {
                        endDate = new Date(taskData.endDate);
                    } else {
                        console.log(`Task ${taskId} is missing endDate, skipping`);
                        continue;
                    }
                    
                    // Sanity check for valid dates
                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        console.log(`Task ${taskId} has invalid dates, skipping: ${JSON.stringify({startDate, endDate})}`);
                        continue;
                    }
                    
                    const currentStatus = taskData.status;
                    const newStatus = getAutoStatus(startDate, endDate);
                    
                    // Only update if status has changed
                    if (currentStatus !== newStatus) {
                        await projectDoc.ref.collection('tasks').doc(taskId).update({ 
                            status: newStatus 
                        });
                        
                        updatedCount++;
                        
                        // Create notifications for status changes
                        for (const member of projectData.team) {
                            await createNotification({
                                userId: member.userId,
                                projectId: projectId,
                                taskId: taskId,
                                title: 'Task Status Update',
                                body: `Task '${taskData.name}' status automatically changed from '${currentStatus}' to '${newStatus}'`,
                                type: 'status',
                                timestamp: new Date().toISOString(),
                                read: false
                            });
                        }
                    }
                } catch (taskError) {
                    console.error(`Error processing task ${taskId}:`, taskError);
                    console.log('Task data:', JSON.stringify(taskData));
                    // Continue with next task
                    continue;
                }
            }
        }
        
        console.log(`Task status update completed: ${updatedCount} tasks updated`);
        return updatedCount;
    } catch (error) {
        console.error('Error updating task statuses:', error);
        throw error;
    }
}

module.exports = {
    addTaskToProject,
    updateTaskStatus,
    deleteTaskFromProject,
    updateAllTaskStatuses
}