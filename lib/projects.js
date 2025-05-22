// lib/projectManager.js
const { db, admin } = require('./db');
const { v4: uuidv4 } = require('uuid');
const { getUserRoleInProject, getAutoStatus } = require('./utils');
const { createNotification } = require('./notifications');

async function createProject(projectId, name, description, ownerId) {
  projectId = projectId || uuidv4();
  const team = [{ userId: ownerId, role: 'owner' }];
  const teamIds = team.map(member => member.userId);
  const projectData = {
    projectId,
    name,
    description,
    owner: ownerId,
    team,
    teamIds,
    createdAt: new Date().toISOString()
  };
  await db.collection('projects').doc(projectId).set(projectData);
  return projectData;
}

async function deleteProject(projectId, userId) {
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw new Error('Project not found');

  const projectData = projectDoc.data();
  const userRole = getUserRoleInProject(projectData.team, userId);
  if (userRole !== 'owner') throw new Error('Forbidden: Only owner can delete the project');

  const batch = db.batch();

  // Delete tasks and comments
  const tasksSnapshot = await projectRef.collection('tasks').get();
  for (const taskDoc of tasksSnapshot.docs) {
    const commentsSnapshot = await taskDoc.ref.collection('comments').get();
    commentsSnapshot.forEach(comment => batch.delete(comment.ref));
    batch.delete(taskDoc.ref);
  }

  // Remove project from users
  for (const member of projectData.team) {
    const userRef = db.collection('users').doc(member.userId);
    batch.update(userRef, {
      projects: admin.firestore.FieldValue.arrayRemove(projectId)
    });
  }

  // Delete related notifications
  const notificationsSnapshot = await db.collection('notifications')
    .where('projectId', '==', projectId).get();
  notificationsSnapshot.forEach(doc => batch.delete(doc.ref));

  batch.delete(projectRef);
  await batch.commit();

  return { success: true };
}

async function addUserToProject(projectId, userId, role) {
  const projectRef = db.collection('projects').doc(projectId);
  const userRef = db.collection('users').doc(userId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw new Error('Project not found');
  const projectData = projectDoc.data();

  await projectRef.update({
    team: admin.firestore.FieldValue.arrayUnion({ userId, role }),
    teamIds: admin.firestore.FieldValue.arrayUnion(userId)
  });

  await userRef.update({
    projects: admin.firestore.FieldValue.arrayUnion(projectId)
  });

  await createNotification({
    userId,
    projectId,
    title: 'Project Invitation',
    body: `You have been added to project '${projectData.name}' as ${role}`,
    type: 'info',
    timestamp: new Date().toISOString(),
    read: false
  });

  return { success: true };
}

async function removeUserFromProject(projectId, userId, role) {
  const projectRef = db.collection('projects').doc(projectId);
  const userRef = db.collection('users').doc(userId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw new Error('Project not found');
  const projectData = projectDoc.data();

  await projectRef.update({
    team: admin.firestore.FieldValue.arrayRemove({ userId, role }),
    teamIds: admin.firestore.FieldValue.arrayRemove(userId)
  });

  await userRef.update({
    projects: admin.firestore.FieldValue.arrayRemove(projectId)
  });

  await createNotification({
    userId,
    title: 'Project Removal',
    body: `You have been removed from project '${projectData.name}'`,
    type: 'info',
    timestamp: new Date().toISOString(),
    read: false
  });

  return { success: true };
}

async function updateMemberRole(projectId, userId, newRole) {
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw new Error('Project not found');

  const projectData = projectDoc.data();
  const oldRole = projectData.team.find(m => m.userId === userId)?.role;

  const updatedTeam = projectData.team.map(member =>
    member.userId === userId ? { ...member, role: newRole } : member
  );

  await projectRef.update({ team: updatedTeam });

  await createNotification({
    userId,
    projectId,
    title: 'Role Update',
    body: `Your role in project '${projectData.name}' has been updated from ${oldRole} to ${newRole}`,
    type: 'info',
    timestamp: new Date().toISOString(),
    read: false
  });

  return { success: true, oldRole, newRole };
}

async function addTaskToProject(projectId, taskId, taskData) {
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw new Error('Project not found');

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

  console.log('Task added successfully');
}

async function updateTaskStatus(projectId, taskId, userId, newStatus) {
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw new Error('Project not found');
  const projectData = projectDoc.data();

  const userRole = getUserRoleInProject(projectData.team, userId);
  if (!['owner', 'admin'].includes(userRole)) {
    throw new Error('Forbidden: Only owner or admin can update status');
  }

  const taskRef = projectRef.collection('tasks').doc(taskId);
  const taskDoc = await taskRef.get();
  if (!taskDoc.exists) throw new Error('Task not found');

  const validStatuses = ['Ongoing', 'Overdue', 'Done'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: Must be one of ${validStatuses.join(', ')}`);
  }

  await taskRef.update({ status: newStatus });

  const taskData = taskDoc.data();
  for (const member of projectData.team) {
    if (member.userId !== userId) {
      await createNotification({
        userId: member.userId,
        projectId,
        taskId,
        title: `Task ${newStatus}`,
        body: `Task '${taskData.name}' has been marked as ${newStatus}`,
        type: 'info',
        timestamp: new Date().toISOString(),
        read: false
      });
    }
  }

  console.log(`The Status of Task ${taskId} is changed to ${newStatus}`);
}

async function deleteTaskFromProject(projectId, taskId, userId) {
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw new Error('Project not found');
  const projectData = projectDoc.data();

  const userRole = getUserRoleInProject(projectData.team, userId);
  if (!['owner', 'editor'].includes(userRole)) {
    throw new Error('Forbidden: You do not have permission to delete tasks');
  }

  const taskRef = projectRef.collection('tasks').doc(taskId);
  const taskDoc = await taskRef.get();
  if (!taskDoc.exists) throw new Error('Task not found');
  const taskData = taskDoc.data();

  const batch = db.batch();

  const commentsSnapshot = await taskRef.collection('comments').get();
  commentsSnapshot.forEach(doc => batch.delete(doc.ref));

  const notificationsSnapshot = await db.collection('notifications')
    .where('taskId', '==', taskId).get();
  notificationsSnapshot.forEach(doc => batch.delete(doc.ref));

  batch.delete(taskRef);
  await batch.commit();

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
      if (taskData.status === 'Done') continue;

      let startDate = taskData.startDate?.toDate?.() || new Date(taskData.startDate);
      let endDate = taskData.endDate?.toDate?.() || new Date(taskData.endDate);

      if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
        console.log(`Skipping invalid task date for ${taskId}`);
        continue;
      }

      const newStatus = getAutoStatus(startDate, endDate);
      if (taskData.status !== newStatus) {
        await taskDoc.ref.update({ status: newStatus });
        updatedCount++;

        for (const member of projectData.team) {
          await createNotification({
            userId: member.userId,
            projectId,
            taskId,
            title: 'Task Status Update',
            body: `Task '${taskData.name}' status changed to '${newStatus}'`,
            type: 'info',
            timestamp: new Date().toISOString(),
            read: false
          });
        }
      }
    }
  }

  console.log(`Updated ${updatedCount} task statuses`);
}

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

module.exports = {
  createProject,
  deleteProject,
  addUserToProject,
  removeUserFromProject,
  updateMemberRole,
  addTaskToProject,
  updateTaskStatus,
  deleteTaskFromProject,
  updateAllTaskStatuses,
  addCommentToTask,
  deleteComment
};
