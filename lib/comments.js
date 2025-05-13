const { db } = require('./db');
const { createNotification } = require('./notifications');
const { uuidv4, getUserRoleInProject } = require('./utils');

async function addCommentToTask(projectId, taskId, userId, message) {
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
        throw new Error('Project not found');
    }
    
    const projectData = projectDoc.data();
    
    // Verify user is part of the project team
    if (!projectData.teamIds.includes(userId)) {
        throw new Error('Forbidden: You are not part of this project team');
    }
    
    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
        throw new Error('Task not found');
    }
    
    const taskData = taskDoc.data();
    const commentId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const commentData = {
        commentId,
        userId,
        message,
        timestamp
    };
    
    await taskRef.collection('comments').doc(commentId).set(commentData);
    
    // Create notifications for team members about new comment
    for (const member of projectData.team) {
        if (member.userId !== userId) {
            await createNotification({
                userId: member.userId,
                projectId,
                taskId,
                title: 'New Comment',
                body: `New comment on task '${taskData.name}'`,
                type: 'message',
                timestamp,
                read: false
            });
        }
    }
    
    console.log('Comment added successfully');
    return commentData;
}

async function deleteComment(projectId, taskId, commentId, userId) {
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
        throw new Error('Project not found');
    }
    
    const projectData = projectDoc.data();
    const userRole = getUserRoleInProject(projectData.team, userId);
    
    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
        throw new Error('Task not found');
    }
    
    const commentRef = taskRef.collection('comments').doc(commentId);
    const commentDoc = await commentRef.get();
    
    if (!commentDoc.exists) {
        throw new Error('Comment not found');
    }
    
    const commentData = commentDoc.data();
    
    // Only comment author, project owner, or editors can delete comments
    if (commentData.userId !== userId && userRole !== 'owner' && userRole !== 'editor') {
        throw new Error('Forbidden: You do not have permission to delete this comment');
    }
    
    await commentRef.delete();
    console.log(`Comment ${commentId} deleted successfully`);
}

module.exports= {
    addCommentToTask,
    deleteComment
}