// models/task.js - Focus: Task Management

const { db } = require('../db');
const { getUserRoleInProject, getAutoStatus } = require('../utils/utils');
const { createNotification } = require('./notifications');

async function getTasksByProjectId(projectId, userId) {
    // Logic extracted from api/projects/tasks/index.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        throw { status: 404, message: 'Project not found' };
    }
    const projectData = projectDoc.data();
    if (!projectData.teamIds.includes(userId)) {
        throw { status: 403, message: 'Access denied: not part of project team' };
    }

    const tasksSnapshot = await projectRef.collection('tasks').get();
    return tasksSnapshot.docs.map(doc => ({
        taskId: doc.id,
        ...doc.data()
    }));
}

async function getTaskById(projectId, taskId, userId) {
    // Logic extracted from api/projects/tasks/index.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        throw { status: 404, message: 'Project not found' };
    }
    const projectData = projectDoc.data();
    if (!projectData.teamIds.includes(userId)) {
        throw { status: 403, message: 'Access denied: not part of project team' };
    }

    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
        throw { status: 404, message: 'Task not found' };
    }
    return taskDoc.data();
}

async function addTaskToProject(projectId, taskId, taskData) {
    // Logic extracted from lib/projects.js and server.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };

    await projectRef.collection('tasks').doc(taskId).set(taskData);
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
}

async function updateTaskStatus(projectId, taskId, userId, newStatus) {
    // Logic extracted from lib/projects.js and api/projects/tasks/index.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };
    const projectData = projectDoc.data();

    const userRole = getUserRoleInProject(projectData.team, userId);
    // Note: The original Vercel API only allowed 'owner' or 'editor'
    if (!['owner', 'editor', 'admin'].includes(userRole)) {
        throw { status: 403, message: 'Forbidden: Only owner, editor, or admin can update status' };
    }

    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) throw { status: 404, message: 'Task not found' };

    // The original logic in lib/projects.js was slightly inconsistent, 
    // it's normalized here to allow any status update if the user has permission, 
    // but the PUT/PATCH handler in server.js only allowed 'Done'
    // We'll follow the lib/projects.js full status update logic, but keep the role check
    
    await taskRef.update({ status: newStatus });

    const taskData = taskDoc.data();
    for (const member of projectData.team) {
        if (member.userId !== userId) {
            await createNotification({
                userId: member.userId,
                projectId,
                taskId,
                title: `Task Status: ${newStatus}`,
                body: `Task '${taskData.name}' status manually set to ${newStatus}`,
                type: 'info',
                timestamp: new Date().toISOString(),
                read: false
            });
        }
    }
}

async function deleteTaskFromProject(projectId, taskId, userId) {
    // Logic extracted from lib/projects.js and api/projects/tasks/index.js
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };
    const projectData = projectDoc.data();

    const userRole = getUserRoleInProject(projectData.team, userId);
    if (!['owner', 'editor'].includes(userRole)) {
        throw { status: 403, message: 'Forbidden: You do not have permission to delete tasks' };
    }

    const taskRef = projectRef.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) throw { status: 404, message: 'Task not found' };
    const taskData = taskDoc.data();

    const batch = db.batch();

    // Delete all comments in the task
    const commentsSnapshot = await taskRef.collection('comments').get();
    commentsSnapshot.forEach(doc => batch.delete(doc.ref));

    // Delete related notifications
    const notificationsSnapshot = await db.collection('notifications')
        .where('taskId', '==', taskId).get();
    notificationsSnapshot.forEach(doc => batch.delete(doc.ref));

    batch.delete(taskRef);
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
}

async function updateAllTaskStatuses() {
    // Logic extracted from lib/projects.js and server.js
    const projectsSnapshot = await db.collection('projects').get();
    let updatedCount = 0;

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();
      const tasksSnapshot = await projectDoc.ref.collection('tasks').get();

      for (const taskDoc of tasksSnapshot.docs) {
        const taskId = taskDoc.id;
        const taskData = taskDoc.data();
        if (taskData.status === 'Done') continue;

        // Handles Firestore Timestamp objects and ISO strings
        let startDate = taskData.startDate?.toDate?.() || new Date(taskData.startDate);
        let endDate = taskData.endDate?.toDate?.() || new Date(taskData.endDate);

        if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) continue;

        const currentStatus = taskData.status;
        const newStatus = getAutoStatus(startDate, endDate); // Assumed utility function

        if (currentStatus !== newStatus) {
          await taskDoc.ref.update({ status: newStatus });
          updatedCount++;

          for (const member of projectData.team) {
            await createNotification({
              userId: member.userId,
              projectId,
              taskId,
              title: 'Task Status Update',
              body: `Task '${taskData.name}' status automatically changed to '${newStatus}'`,
              type: 'status',
              timestamp: new Date().toISOString(),
              read: false
            });
          }
        }
      }
    }
    return updatedCount;
}

module.exports = {
  getTasksByProjectId,
  getTaskById,
  addTaskToProject,
  updateTaskStatus,
  deleteTaskFromProject,
  updateAllTaskStatuses,
};