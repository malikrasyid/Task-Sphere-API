// lib/projects.js
const { db } = require('./db');
const { uuidv4, getUserRoleInProject } = require('./utils');
const { createNotification } = require('./notifications');
const { admin } = require('./db');

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

  if (!projectDoc.exists) {
    throw new Error('Project not found');
  }

  const projectData = projectDoc.data();
  const userRole = getUserRoleInProject(projectData.team, userId);

  if (userRole !== 'owner') {
    throw new Error('Forbidden: Only owner can delete the project');
  }

  const batch = db.batch();

  try {
    // 1. Delete all tasks in the project
    const tasksSnapshot = await projectRef.collection('tasks').get();
    if (!tasksSnapshot.empty) {
      for (const taskDoc of tasksSnapshot.docs) {
        // Delete comments for each task
        const commentsSnapshot = await taskDoc.ref.collection('comments').get();
        if (!commentsSnapshot.empty) {
          commentsSnapshot.docs.forEach(commentDoc => {
            batch.delete(commentDoc.ref);
          });
        }
        // Delete the task
        batch.delete(taskDoc.ref);
      }
    }

    // 2. Remove project reference from all team members' user documents
    const team = projectData.team || [];
    for (const member of team) {
      const userRef = db.collection('users').doc(member.userId);
      batch.update(userRef, {
        projects: admin.firestore.FieldValue.arrayRemove(projectId)
      });
    }

    // 3. Delete related notifications
    const notificationsSnapshot = await db.collection('notifications')
      .where('projectId', '==', projectId)
      .get();
    
    if (!notificationsSnapshot.empty) {
      notificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
    }

    // 4. Delete the project document itself
    batch.delete(projectRef);

    // Commit all operations
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error deleting project:', error);
    throw new Error('Failed to delete project');
  }
}

async function addUserToProject(projectId, userId, role) {
  const projectRef = db.collection('projects').doc(projectId);
  const userRef = db.collection('users').doc(userId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new Error('Project not found');
  }
  
  const projectData = projectDoc.data();

  try {
    // Update project document with userId in team
    await projectRef.update({
      team: admin.firestore.FieldValue.arrayUnion({ userId, role }),
      teamIds: admin.firestore.FieldValue.arrayUnion(userId)
    });

    // Update user document with projectId
    await userRef.update({
      projects: admin.firestore.FieldValue.arrayUnion(projectId)
    });

    // Create notification for added user
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
  } catch (error) {
    console.error('Error adding user to project:', error);
    throw error;
  }
}

async function removeUserFromProject(projectId, userId, role) {
  const projectRef = db.collection('projects').doc(projectId);
  const userRef = db.collection('users').doc(userId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new Error('Project not found');
  }
  
  const projectData = projectDoc.data();

  try {
    // Remove userId from team in project
    await projectRef.update({
      team: admin.firestore.FieldValue.arrayRemove({ userId, role }),
      teamIds: admin.firestore.FieldValue.arrayRemove(userId)
    });

    // Remove projectId from user
    await userRef.update({
      projects: admin.firestore.FieldValue.arrayRemove(projectId)
    });

    // Create notification for removed user
    await createNotification({
      userId,
      title: 'Project Removal',
      body: `You have been removed from project '${projectData.name}'`,
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing user from project:', error);
    throw error;
  }
}

async function updateMemberRole(projectId, userId, newRole) {
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new Error('Project not found');
  }

  const projectData = projectDoc.data();
  const oldRole = projectData.team.find(member => member.userId === userId)?.role;

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

module.exports = {
  createProject,
  deleteProject,
  addUserToProject,
  removeUserFromProject,
  updateMemberRole
};