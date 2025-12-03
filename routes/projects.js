const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// Import separated controllers
const projectController = require('../controllers/projects');

// Apply authentication middleware to all project routes
router.use(authenticateToken);

// GET /api/projects
// POST /api/projects
router.route('/')
    .get(projectController.getProjects)
    .post(projectController.createNewProject);

// GET /api/projects/:projectId
// PATCH /api/projects/:projectId
// DELETE /api/projects/:projectId
router.route('/:projectId')
    .get(projectController.getProjectById)
    .patch(projectController.updateProjectDetails)
    .delete(projectController.deleteProjectController);

// POST /api/projects/:projectId/members/add
router.post('/:projectId/members/add', projectController.addMember);

// POST /api/projects/:projectId/members/remove
router.post('/:projectId/members/remove', projectController.removeMember);

// POST /api/projects/:projectId/members/update-role
router.post('/:projectId/members/update-role', projectController.updateMemberRoleController);

module.exports = router;