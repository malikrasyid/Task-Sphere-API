// controllers/task.js
const taskModel = require('../models/tasks');
const { uuidv4, getAutoStatus } = require('../utils/utils');

// Centralized error handler logic
const handleTaskError = (res, error, defaultMessage = 'Internal server error') => {
    console.error('Task Controller Error:', error);
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || defaultMessage });
};

async function getTasks(req, res) {
    const { projectId } = req.params;
    const userId = req.user.userId;
    
    try {
        const tasks = await taskModel.getTasksByProjectId(projectId, userId);
        return res.status(200).json({ tasks });
    } catch (error) {
        handleTaskError(res, error, 'Error fetching tasks');
    }
}

async function getTask(req, res) {
    const { projectId, taskId } = req.params;
    const userId = req.user.userId;
    
    try {
        const task = await taskModel.getTaskById(projectId, taskId, userId);
        return res.status(200).json({ task });
    } catch (error) {
        handleTaskError(res, error, 'Error fetching task');
    }
}

async function createNewTask(req, res) {
    const { projectId } = req.params;
    const { name, deliverable, startDate, endDate, status } = req.body;
    const userId = req.user.userId;

    if (!name || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields: name, startDate, or endDate' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
        return res.status(400).json({ error: 'Start date must be before end date' });
    }

    try {
        const autoStatus = status || getAutoStatus(start, end);
        const newTaskId = uuidv4();

        const taskData = {
            taskId: newTaskId,
            name,
            deliverable,
            startDate: start.toISOString(), 
            endDate: end.toISOString(),
            status: autoStatus,
            createdBy: userId
        };

        await taskModel.addTaskToProject(projectId, newTaskId, taskData);
        return res.status(201).json({ message: 'Task added successfully', taskId: newTaskId });
    } catch (error) {
        handleTaskError(res, error, 'Error adding task');
    }
}

async function updateTaskStatusController(req, res) {
    const { projectId, taskId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;
    
    if (!status) {
        return res.status(400).json({ error: 'Missing required field: status' });
    }

    try {
        await taskModel.updateTaskStatus(projectId, taskId, userId, status);
        res.status(200).json({ message: 'Task status updated successfully' });
    } catch (error) {
        handleTaskError(res, error, 'Error updating task status');
    }
}

async function deleteTask(req, res) {
    const { projectId, taskId } = req.params;
    const userId = req.user.userId;

    try {
        await taskModel.deleteTaskFromProject(projectId, taskId, userId);
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        handleTaskError(res, error, 'Error deleting task');
    }
}

module.exports = {
    getTasks,
    getTask,
    createNewTask,
    updateTaskStatusController,
    deleteTask,
};