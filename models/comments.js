// models/comment.js - Focus: Comment Management

const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { getUserRoleInProject } = require('../utils/utils');
const { createNotification } = require('./notifications');

async function addCommentToTask(projectId, taskId, userId, message) {
    // Logic extracted from lib/projects.js and server.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
        throw { status: 404, message: 'Project not found' };
    }
    
    const projectData = projectDoc.data();
    
    // Verify user is part of the project team
    if (!projectData.teamIds.includes(userId)) {
        throw { status: 403, message: 'Forbidden: You are not part of this project team' };
    }
    
    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
        throw { status: 404, message: 'Task not found' };
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
    
    return commentData;
}

async function deleteComment(projectId, taskId, commentId, userId) {
    // Logic extracted from lib/projects.js and server.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };
    
    const projectData = projectDoc.data();
    const userRole = getUserRoleInProject(projectData.team, userId);
    
    const taskRef = projectRef.collection('tasks').doc(taskId);
    if (!(await taskRef.get()).exists) throw { status: 404, message: 'Task not found' };
    
    const commentRef = taskRef.collection('comments').doc(commentId);
    const commentDoc = await commentRef.get();
    
    if (!commentDoc.exists) throw { status: 404, message: 'Comment not found' };
    
    const commentData = commentDoc.data();
    
    // Only comment author, project owner, or editors can delete comments
    if (commentData.userId !== userId && userRole !== 'owner' && userRole !== 'editor') {
        throw { status: 403, message: 'Forbidden: You do not have permission to delete this comment' };
    }
    
    await commentRef.delete();
}

async function getCommentsByTaskId(projectId, taskId, userId) {
    // Logic extracted from api/projects/tasks/comments/index.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };

    const projectData = projectDoc.data();
    if (!projectData.teamIds.includes(userId)) {
        throw { status: 403, message: 'Access denied: not part of project team' };
    }

    const taskRef = projectRef.collection('tasks').doc(taskId);
    if (!(await taskRef.get()).exists) throw { status: 404, message: 'Task not found' };

    const commentsSnapshot = await taskRef.collection('comments')
        .orderBy('timestamp', 'asc')
        .get();

    return commentsSnapshot.docs.map(doc => ({ ...doc.data() }));
}

module.exports = {
    addCommentToTask,
    deleteComment,
    getCommentsByTaskId
};