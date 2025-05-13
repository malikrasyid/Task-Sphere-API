// api/projects/[projectId]/tasks/index.js
const { authenticateToken } = require('../../../../lib/auth');
const { addTaskToProject } = require('../../../../lib/tasks');
const { db } = require('../../../../lib/db');
const { uuidv4, getAutoStatus } = require('../../../../lib/utils');

module.exports = async (req, res) => {
    const { projectId } = req.query;
  try {
    if (req.method === 'POST') {
        const user = await authenticateToken(req, res);
        const { taskId, name, deliverable, startDate, endDate, status } = req.body;
        const userId = user.userId;
    
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
    } else if (req.method === 'GET') {
        const user = await authenticateToken(req, res);
        const userId = user.userId;

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
    } else {
        // Method not allowed for any other HTTP methods
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Projects endpoint error:', error);
    
    // Handle authentication errors
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};