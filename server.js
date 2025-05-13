const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
const JWT_SECRET = '89b87cb3a2ba8d76a580c4a96293ce612d215f4462dbc8729022ae9b4bdeb92250c19d1388bc25bf7789afc329f89292bb6ea379d27a3939de29ef9e80cbdcc6d2bcc5230fd6bb5df0a93230660b0d8112067bd5b3d4646da95f63cf091c75d2144900accbed7caf2b0c30d831935762fc0e33b498b15307cfe310b558da724559376f4a2691759f6fc0ac2ae60540a34ab6254cbb6c49fc7d584e90e59e5e69fe10febd8e56b25e9ff44b9144e6b8ce18ee72ffe522e25501f109032dc228e56b9bbf12c273080c4e73cff40fcb18134d75de00a8f5b9964e41a4eb259a6b3e3e7ffa4cfe00bc86a2d20c0956573f23e6f753c4bc372e31c25af6539d37c9c8'; // Ganti dengan secret yang aman!

// Inisialisasi Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  }),
});

const db = admin.firestore();
const app = express();

const config = {
  // Schedule for updating task statuses
  taskStatusUpdateSchedule: '*/30 * * * *', // Every 30 minutes
  
  // Schedule for deadline notifications
  deadlineNotificationSchedule: '*/15 * * * *', // Every 15 minutes
  
  // Schedule for full task maintenance
  fullMaintenanceSchedule: '0 0 * * *', // Once daily at midnight
  
  // Enable or disable different types of jobs
  enableTaskStatusUpdates: true,
  enableDeadlineNotifications: true,
  enableFullMaintenance: true
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Functions for Database Operations
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
    console.log('Project created successfully');
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
        console.log(`Project ${projectId} and its related data deleted successfully`);
    } catch (error) {
        console.error('Error deleting project:', error);
        throw new Error('Failed to delete project');
    }
}

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

async function addUserToProject(projectId, userId, role) {
    const projectRef = db.collection('projects').doc(projectId);
    const userRef = db.collection('users').doc(userId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        throw new Error('Project not found');
    }

    try {
        // Perbarui dokumen proyek dengan userId di team
        await projectRef.update({
            team: admin.firestore.FieldValue.arrayUnion({ userId, role }),
            teamIds: admin.firestore.FieldValue.arrayUnion(userId)
        });

        // Perbarui dokumen user dengan projectId
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

        console.log('User added to project successfully');
    } catch (error) {
        console.error('Error adding user to project:', error);
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
        // Hapus userId dari team dalam proyek
        await projectRef.update({
            team: admin.firestore.FieldValue.arrayRemove({ userId, role }),
            teamIds: admin.firestore.FieldValue.arrayRemove(userId)
        });

        // Hapus projectId dari user
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

        console.log('User removed from project successfully');
    } catch (error) {
        console.error('Error removing user from project:', error);
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
    
    console.log('Role updated successfully');
}

async function createUser(userId, email, password, firstName, lastName) {
    const userData = {
        userId,
        email,
        password,
        firstName,
        lastName,
        projects: []
    };
    await db.collection('users').doc(userId).set(userData);
    console.log('User created successfully');
}

async function searchUsers(searchQuery) {
    try {
        const usersRef = db.collection('users');
        // Cari user berdasarkan email atau nama
        const emailResults = await usersRef
            .where('email', '>=', searchQuery)
            .where('email', '<=', searchQuery + '\uf8ff')
            .get();
            
        const firstNameResults = await usersRef
            .where('firstName', '>=', searchQuery)
            .where('firstName', '<=', searchQuery + '\uf8ff')
            .get();

        const lastNameResults = await usersRef
            .where('lastName', '>=', searchQuery)
            .where('lastName', '<=', searchQuery + '\uf8ff')
            .get();

        // Gabungkan hasil pencarian dan hilangkan duplikat
        const userMap = new Map();
        
        [emailResults, firstNameResults, lastNameResults].forEach(snapshot => {
            snapshot.forEach(doc => {
                if (!userMap.has(doc.id)) {
                    userMap.set(doc.id, {
                        userId: doc.id,
                        ...doc.data()
                    });
                }
            });
        });

        return Array.from(userMap.values());
    } catch (error) {
        console.error('Error searching users:', error);
        throw error;
    }
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

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer token_value

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Invalid token

        req.user = user; // userId, email
        next();
    });
}

function getUserRoleInProject(teamArray, userId) {
    const member = teamArray.find(m => m.userId === userId);
    return member ? member.role : null;
}

function getAutoStatus(startDate, endDate) {
    const now = new Date();

    let start, end;
    
    // Handle Firestore Timestamp objects
    if (startDate && typeof startDate.toDate === 'function') {
        start = startDate.toDate();
    } else {
        start = startDate instanceof Date ? startDate : new Date(startDate);
    }
    
    if (endDate && typeof endDate.toDate === 'function') {
        end = endDate.toDate();
    } else {
        end = endDate instanceof Date ? endDate : new Date(endDate);
    }
    
    // Verify dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Invalid date objects in getAutoStatus:', { start, end });
        // Return a safe default if dates are invalid
        return 'Not Started';
    }
    
    if (now < start) return 'Not Started';
    if (now >= start && now <= end) return 'Ongoing';
    if (now > end) return 'Overdue';
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

async function performScheduledTaskMaintenance() {
    try {
        await checkDeadlinesAndNotify();
        await updateAllTaskStatuses();
        console.log('Scheduled task maintenance completed');
    } catch (error) {
        console.error('Error in scheduled task maintenance:', error);
    }
}

function startAutomationJobs() {
  console.log('Initializing task automation jobs...');
  
  if (config.enableTaskStatusUpdates) {
    cron.schedule(config.taskStatusUpdateSchedule, async () => {
      console.log(`[${new Date().toISOString()}] Running task status updates...`);
      try {
        const updatedCount = await updateAllTaskStatuses();
        console.log(`Task status update completed: ${updatedCount} tasks updated`);
      } catch (error) {
        console.error('Error in task status update job:', error);
      }
    });
    console.log(`Task status updates scheduled: ${config.taskStatusUpdateSchedule}`);
  }
  
  if (config.enableDeadlineNotifications) {
    cron.schedule(config.deadlineNotificationSchedule, async () => {
      console.log(`[${new Date().toISOString()}] Checking deadlines and notifying users...`);
      try {
        await checkDeadlinesAndNotify();
        console.log('Deadline check completed');
      } catch (error) {
        console.error('Error in deadline notification job:', error);
      }
    });
    console.log(`Deadline notifications scheduled: ${config.deadlineNotificationSchedule}`);
  }
  
  if (config.enableFullMaintenance) {
    cron.schedule(config.fullMaintenanceSchedule, async () => {
      console.log(`[${new Date().toISOString()}] Running full task maintenance...`);
      try {
        await performScheduledTaskMaintenance();
        console.log('Full maintenance completed');
      } catch (error) {
        console.error('Error in full maintenance job:', error);
      }
    });
    console.log(`Full maintenance scheduled: ${config.fullMaintenanceSchedule}`);
  }
  
  console.log('All automated jobs have been scheduled');
}

function isValidCronExpression(expression) {
  return cron.validate(expression);
}

// API Endpoints
app.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        const user = await admin.auth().createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
        });

        await createUser(user.uid, email, hashedPassword, firstName, lastName);
        res.status(201).json({ message: 'User created successfully', uid: user.uid });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const userSnapshot = await db.collection('users')
            .where('email', '==', email)
            // .where('password', '==', password) // ⚠️ Gunakan hashing untuk produksi!
            .get();

        if (userSnapshot.empty) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        const isMatch = await bcrypt.compare(password, userData.password); // Bandingkan hash

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Buat token
        const token = jwt.sign(
            { userId: userData.userId, email: userData.email },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            userId: userData.userId,
            name: userData.name
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/projects', authenticateToken, async (req, res) => {
    const { projectId, name, description } = req.body;
    const ownerId = req.user.userId;

    try {
        await createProject(projectId, name, description, ownerId);
        res.status(201).json({ message: 'Project created successfully' });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/projects/:projectId/add-tasks', authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    const { taskId, name, deliverable, startDate, endDate, status } = req.body;
    const userId = req.user.userId;


    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
        return res.status(400).json({ error: 'Start date must be before end date' });
    }    

    const autoStatus = status || getAutoStatus(start, end);

    const taskData = {
        taskId: taskId || uuidv4(),
        name,
        deliverable,
        startDate: start,
        endDate: end,
        status: autoStatus,
        createdBy: userId
    };

    try {
        await addTaskToProject(projectId, taskData.taskId, taskData);
        res.status(201).json({ message: 'Task added successfully', taskId: taskData.taskId  });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(400).json({ error: error.message });
    }
});

app.put('/projects/:projectId/update-task/:taskId/status', authenticateToken, async (req, res) => {
    const { projectId, taskId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId

    try {
        await updateTaskStatus(projectId, taskId, userId, status);
        res.status(200).json({ message: 'Task status updated successfully' });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(400).json({ error: error.message });
    }
});

app.delete('/projects/:projectId/delete-task/:taskId', authenticateToken, async (req, res) => {
    const { projectId, taskId } = req.params;
    const userId = req.user.userId;

    try {
        await deleteTaskFromProject(projectId, taskId, userId);
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/projects/:projectId/add-member', authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    const { userId, role } = req.body;

    try {
        await addUserToProject(projectId, userId, role);
        res.status(200).json({ message: 'Member added successfully' });
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/projects/:projectId/remove-member', authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    const { userId, role } = req.body;

    try {
        await removeUserFromProject(projectId, userId, role);
        res.status(200).json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/projects/:projectId/update-member-role', authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    const { userId, newRole } = req.body;

    try {
        await updateMemberRole(projectId, userId, newRole);
        res.status(200).json({ message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error updating member role:', error);
        res.status(400).json({ error: error.message });
    }
});

app.get('/user-projects', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Diambil dari token

    try {
        const projectsSnapshot = await db.collection('projects')
            .where('teamIds', 'array-contains', userId)
            .get();

        const projects = projectsSnapshot.docs.map(doc => ({
            projectId: doc.id,
            ...doc.data()
        }));

        res.status(200).json({ projects });
    } catch (error) {
        console.error('Error fetching user projects:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/projects/:projectId/tasks', authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.userId;

    try {
        const projectRef = db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectData = projectDoc.data();

        if (!projectData.teamIds.includes(userId)) {
            return res.status(403).json({ error: 'Access denied: not part of project team' });
        }

        const tasksSnapshot = await projectRef.collection('tasks').get();

        const tasks = tasksSnapshot.docs.map(doc => ({
            taskId: doc.id,
            ...doc.data()
        }));

        res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/user/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const data = userDoc.data();
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        return res.json({ name: fullName || userId });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/search-users', async (req, res) => {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    try {
        const users = await searchUsers(query);
        res.status(200).json({ users });
    } catch (error) {
        console.error('Error in search users endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/projects/:projectId/tasks/:taskId/comments', authenticateToken, async (req, res) => {
    const { projectId, taskId } = req.params;
    const userId = req.user.userId;

    try {
        const projectRef = db.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectData = projectDoc.data();

        if (!projectData.teamIds.includes(userId)) {
            return res.status(403).json({ error: 'Access denied: not part of project team' });
        }

        const taskRef = projectRef.collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const commentsSnapshot = await taskRef.collection('comments')
            .orderBy('timestamp', 'asc')
            .get();

        const comments = commentsSnapshot.docs.map(doc => ({
            ...doc.data()
        }));

        res.status(200).json({ comments });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/projects/:projectId/tasks/:taskId/comments', authenticateToken, async (req, res) => {
    const { projectId, taskId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    try {
        const comment = await addCommentToTask(projectId, taskId, userId, message);
        res.status(201).json({ message: 'Comment added successfully', comment });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(400).json({ error: error.message });
    }
});

app.delete('/projects/:projectId/tasks/:taskId/comments/:commentId', authenticateToken, async (req, res) => {
    const { projectId, taskId, commentId } = req.params;
    const userId = req.user.userId;

    try {
        await deleteComment(projectId, taskId, commentId, userId);
        res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(400).json({ error: error.message });
    }
});

app.get('/notifications', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { read } = req.query;
    
    try {
        let notificationsQuery = db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc');
            
        // Filter by read status if specified
        // if (read !== undefined) {
        //     notificationsQuery = notificationsQuery.where('read', '==', read === 'true');
        // }
        
        const notificationsSnapshot = await notificationsQuery.get();
        
        const notifications = notificationsSnapshot.docs.map(doc => ({
            ...doc.data()
        }));
        
        res.status(200).json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/notifications/:notificationId/read', authenticateToken, async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.userId;
    
    try {
        await markNotificationAsRead(notificationId, userId);
        res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error updating notification:', error);
        res.status(400).json({ error: error.message });
    }
});

app.put('/notifications/mark-all-read', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    
    try {
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .get();
            
        const batch = db.batch();
        
        notificationsSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        
        await batch.commit();
        
        res.status(200).json({ 
            message: 'All notifications marked as read',
            count: notificationsSnapshot.size
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/projects/:projectId', authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    const userId  = req.user.userId; // To verify if user has permission to delete

    try {
        await deleteProject(projectId, userId);
        res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(403).json({ error: error.message });
    }

});

app.post('/update-task-statuses', authenticateToken, async (req, res) => {
    try {
        const updatedCount = await updateAllTaskStatuses();
        res.status(200).json({ 
            message: 'Task statuses updated successfully', 
            updatedCount 
        });
    } catch (error) {
        console.error('Error in task status update endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/tasks/maintenance', async (req, res) => {
  try {
    await performScheduledTaskMaintenance();
    res.json({ success: true });
  } catch (error) {
    console.error('Error performing task maintenance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/cron/schedules', (req, res) => {
    try {
        const activeJobsInfo = {
            statusUpdate: config.statusUpdate,
            deadlineNotification: config.deadlineNotification,
            fullMaintenance: config.fullMaintenance,
        };
        
        res.json({ 
            success: true, 
            schedules: config,
            activeJobs: activeJobsInfo
        });
    } catch (error) {
        console.error('Error getting cron schedules:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a REST endpoint to update cron schedules on the fly
app.post('/api/cron/update-schedule', (req, res) => {
    try {
        const { taskType, schedule } = req.body;
        
        if (!schedule) {
            return res.status(400).json({ success: false, error: 'Schedule is required' });
        }
        
        if (!isValidCronExpression(schedule)) {
            return res.status(400).json({ success: false, error: 'Invalid cron expression' });
        }
        
        // Update the schedule based on task type
        switch (taskType) {
            case 'status':
                config.statusUpdate = schedule;
                break;
            case 'deadline':
                config.deadlineNotification = schedule;
                break;
            case 'maintenance':
                config.fullMaintenance = schedule;
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid task type' });
        }
        
        // Restart all cron jobs with new schedules
        startAutomationJobs();
        
        // Save the schedule to the database (optional)
        db.collection('system').doc('config').set(config, { merge: true })
            .then(() => {
                console.log('Cron schedules saved to database');
            })
            .catch(error => {
                console.error('Error saving cron schedules:', error);
            });
        
        res.json({ 
            success: true, 
            message: `Schedule for ${taskType} updated to ${schedule}`,
            updatedSchedules: config
        });
    } catch (error) {
        console.error('Error updating cron schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app

// Jalankan Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startAutomationJobs();
});