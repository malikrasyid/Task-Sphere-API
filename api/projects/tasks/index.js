import cors from '../../../lib/cors';
const { authenticateToken } = require('../../../lib/users');
const {
  addTaskToProject,
  deleteTaskFromProject,
  updateTaskStatus
} = require('../../../lib/projects');
const { uuidv4, getAutoStatus } = require('../../../lib/utils');
const { db } = require('../../../lib/db');

export default async function handler(req, res) {
  await cors(req, res);
  const { projectId, taskId } = req.query;

  try {
    const user = await authenticateToken(req, res);
    const userId = user.userId;

    // -------- POST (Create Task) --------
    if (req.method === 'POST' && !taskId) {
      const { name, deliverable, startDate, endDate, status } = req.body;
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(400).json({ error: 'Start date must be before end date' });
      }

      const autoStatus = status || getAutoStatus(start, end);
      const newTaskId = uuidv4();

      const taskData = {
        taskId: newTaskId,
        name,
        deliverable,
        startDate: start,
        endDate: end,
        status: autoStatus,
        createdBy: userId
      };

      await addTaskToProject(projectId, newTaskId, taskData);
      return res.status(201).json({ message: 'Task added successfully', taskId: newTaskId });
    }

    // -------- GET (Fetch Tasks) --------
    if (req.method === 'GET' && !taskId) {
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

      return res.status(200).json({ tasks });
    }

    // -------- PUT/PATCH (Update Task Status) --------
    if ((req.method === 'PUT' || req.method === 'PATCH') && taskId) {
      const { status } = req.body;

      await updateTaskStatus(projectId, taskId, userId, status);
      return res.status(200).json({ message: 'Task status updated successfully' });
    }

    // -------- DELETE (Delete Task) --------
    if (req.method === 'DELETE' && taskId) {
      await deleteTaskFromProject(projectId, taskId, userId);
      return res.status(200).json({ message: 'Task deleted successfully' });
    }

    // -------- Invalid Method --------
    return res.status(405).json({ error: 'Method not allowed or missing parameters' });

  } catch (error) {
    console.error('Task endpoint error:', error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
