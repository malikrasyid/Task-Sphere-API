const { authenticateToken } = require('../../../../lib/auth');
const { deleteTaskFromProject, updateTaskStatus } = require('../../../../lib/tasks');

module.exports = async (req, res) => {
    try {
        const { projectId, taskId } = req.query;
        const user = await authenticateToken(req, res);
        const userId = user.userId

        if (req.method === 'PUT' || req.method === 'PATCH') {
            const { status } = req.body;

            try {
                await updateTaskStatus(projectId, taskId, userId, status);
                res.status(200).json({ message: 'Task status updated successfully' });
            } catch (error) {
                console.error('Error updating task status:', error);
                res.status(400).json({ error: error.message });
            }
        } else if (req.method === 'DELETE') {
            try {
                await deleteTaskFromProject(projectId, taskId, userId);
                res.status(200).json({ message: 'Task deleted successfully' });
            } catch (error) {
                console.error('Error deleting task:', error);
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