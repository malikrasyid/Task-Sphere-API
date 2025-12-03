// models/project.js - Focus: Project and Member Management

const { db, admin } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { getUserRoleInProject } = require('../utils/utils'); // Assumed utility
const { createNotification } = require('./notifications');
// Assuming createTask/deleteTask/Comment functions are now imported by other files, 
// not called directly here, except during cascaded delete.

async function createProject(projectId, name, description, ownerId) {
  // Logic extracted from lib/projects.js and server.js
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
  // Logic extracted from lib/projects.js and server.js
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };

  const projectData = projectDoc.data();
  const userRole = getUserRoleInProject(projectData.team, userId);
  if (userRole !== 'owner') throw { status: 403, message: 'Forbidden: Only owner can delete the project' };

  const batch = db.batch();

  // Delete tasks and their comments (Cascading deletion)
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

async function getProjectsByUserId(userId) {
  // Logic extracted from api/projects/index.js
  const projectsSnapshot = await db.collection('projects')
    .where('teamIds', 'array-contains', userId)
    .get();

  return projectsSnapshot.docs.map(doc => ({
    projectId: doc.id,
    ...doc.data()
  }));
}

async function getProjectById(projectId) {
  // Logic extracted from api/projects/index.js
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    return null;
  }
  return projectDoc.data();
}

async function updateProjectDetails(projectId, updateData, userId) {
  // Logic extracted from api/projects/index.js
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw { status: 404, message: 'Project not found' };
  }

  const projectData = projectDoc.data();
  const userRole = getUserRoleInProject(projectData.team, userId);

  if (userRole !== 'owner' && userRole !== 'editor') {
    throw { status: 403, message: 'Access denied: only owner or editor can update project' };
  }
  
  await projectRef.update(updateData);
  return { ...projectData, ...updateData };
}

async function addUserToProject(projectId, userId, role) {
  // Logic extracted from lib/projects.js and server.js
  const projectRef = db.collection('projects').doc(projectId);
  const userRef = db.collection('users').doc(userId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };
  const projectData = projectDoc.data();

  // Role validation needed: Ensure role is valid (e.g., 'owner', 'editor', 'member')

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
  // Logic extracted from lib/projects.js and server.js
  const projectRef = db.collection('projects').doc(projectId);
  const userRef = db.collection('users').doc(userId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };
  const projectData = projectDoc.data();
  
  // Role is required for arrayRemove to match the exact object, as per the original code

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
  // Logic extracted from lib/projects.js and server.js
  const projectRef = db.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) throw { status: 404, message: 'Project not found' };

  const projectData = projectDoc.data();
  const member = projectData.team.find(m => m.userId === userId);

  if (!member) throw { status: 404, message: 'User is not a member of the project' };
  
  const oldRole = member.role;

  // Role validation needed: Ensure newRole is valid

  const updatedTeam = projectData.team.map(m =>
    m.userId === userId ? { ...m, role: newRole } : m
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
  getProjectsByUserId,
  getProjectById,
  updateProjectDetails,
  addUserToProject,
  removeUserFromProject,
  updateMemberRole,
};