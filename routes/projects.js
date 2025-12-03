const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// Import separated controllers
const projectController = require('../controllers/projects');
const taskController = require('../controllers/tasks'); // New Import
const commentController = require('../controllers/comments'); // New Import

// Apply authentication middleware to all project routes
router.use(authenticateToken);

// ----------------------------------------------------
// A. Projects & Members Routes: /api/projects
// ----------------------------------------------------

// GET /api/projects
// POST /api/projects
router.route('/')
    .get(projectController.getProjects)
    .post(projectController.createNewProject);

// GET/PATCH/DELETE /api/projects/:projectId
router.route('/:projectId')
    .get(projectController.getProjectById)
    .patch(projectController.updateProjectDetails)
    .delete(projectController.deleteProjectController);

// Member Management Routes
router.post('/:projectId/members/add', projectController.addMember);
router.post('/:projectId/members/remove', projectController.removeMember);
router.post('/:projectId/members/update-role', projectController.updateMemberRoleController);

// ----------------------------------------------------
// B. Task Routes: /api/projects/:projectId/tasks
// ----------------------------------------------------

// GET /api/projects/:projectId/tasks
// POST /api/projects/:projectId/tasks
router.route('/:projectId/tasks')
    .get(taskController.getTasks)
    .post(taskController.createNewTask);

// GET/PATCH/DELETE /api/projects/:projectId/tasks/:taskId
router.route('/:projectId/tasks/:taskId')
    .get(taskController.getTask)
    .patch(taskController.updateTaskStatusController) 
    .delete(taskController.deleteTask);

// ----------------------------------------------------
// C. Comment Routes: /api/projects/:projectId/tasks/:taskId/comments
// ----------------------------------------------------

// GET/POST /api/projects/:projectId/tasks/:taskId/comments
router.route('/:projectId/tasks/:taskId/comments')
    .get(commentController.getComments)
    .post(commentController.createComment);

// DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId
router.delete('/:projectId/tasks/:taskId/comments/:commentId', commentController.deleteCommentController);

module.exports = router;