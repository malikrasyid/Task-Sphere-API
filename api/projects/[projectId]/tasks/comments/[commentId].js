const { deleteComment } = require('../../../../../lib/comments');
const { authenticateToken } = require('../../../../../lib/auth');

module.exports = async (req, res) => {
    try {
        const { projectId, taskId, commentId } = req.query;
        const user = await authenticateToken(req, res);
        const userId = user.userId;

        if (req.method === 'DELETE') {
            try {
                await deleteComment(projectId, taskId, commentId, userId);
                res.status(200).json({ message: 'Comment deleted successfully' });
            } catch (error) {
                console.error('Error deleting comment:', error);
                res.status(400).json({ error: error.message });
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
}