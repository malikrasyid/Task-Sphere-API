// controllers/comment.js
const commentModel = require('../models/comments');

// Centralized error handler logic
const handleCommentError = (res, error, defaultMessage = 'Internal server error') => {
    console.error('Comment Controller Error:', error);
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || defaultMessage });
};

async function getComments(req, res) {
    const { projectId, taskId } = req.params;
    const userId = req.user.userId;

    try {
        const comments = await commentModel.getCommentsByTaskId(projectId, taskId, userId);
        return res.status(200).json({ comments });
    } catch (error) {
        handleCommentError(res, error, 'Error fetching comments');
    }
}

async function createComment(req, res) {
    const { projectId, taskId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message) {
        return res.status(400).json({ error: 'Comment message is required' });
    }

    try {
        const comment = await commentModel.addCommentToTask(projectId, taskId, userId, message);
        return res.status(201).json({ message: 'Comment added successfully', comment });
    } catch (error) {
        handleCommentError(res, error, 'Error adding comment');
    }
}

async function deleteCommentController(req, res) {
    const { projectId, taskId, commentId } = req.params;
    const userId = req.user.userId;

    try {
        await commentModel.deleteComment(projectId, taskId, commentId, userId);
        return res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
        handleCommentError(res, error, 'Error deleting comment');
    }
}

module.exports = {
    getComments,
    createComment,
    deleteCommentController,
};