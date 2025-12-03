const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const taskController = require('../controllers/tasks');

router.use(authenticateToken);

// GET /api/projects/:projectId/tasks
// POST /api/projects/:projectId/tasks
router.route('/:projectId/tasks')
    .get(taskController.getTasks)
    .post(taskController.createNewTask);

// GET /api/projects/:projectId/tasks/:taskId
// PATCH /api/projects/:projectId/tasks/:taskId (Used for status updates or any other task detail update)
// DELETE /api/projects/:projectId/tasks/:taskId
router.route('/:projectId/tasks/:taskId')
    .get(taskController.getTask)
    .patch(taskController.updateTaskStatusController) 
    .delete(taskController.deleteTask);

module.exports = router;