const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const commentController = require('../controllers/comments');

router.use(authenticateToken);

// GET /api/projects/:projectId/tasks/:taskId/comments
// POST /api/projects/:projectId/tasks/:taskId/comments
router.route('/:projectId/tasks/:taskId/comments')
    .get(commentController.getComments)
    .post(commentController.createComment);

// DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId
router.delete('/:projectId/tasks/:taskId/comments/:commentId', commentController.deleteCommentController);

module.exports = router;