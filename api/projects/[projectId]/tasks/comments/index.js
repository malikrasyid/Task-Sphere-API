const { addCommentToTask } = require('../../../../../lib/comments');
const { authenticateToken } = require('../../../../../lib/auth');
const { db } = require('../../../../../lib/db');

module.exports = async (req, res) => {
    try {
        const { projectId, taskId } = req.query;
        const user = await authenticateToken(req, res);
        const userId = user.userId;

        if (req.method === 'GET') {
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

                const taskRef = projectRef.collection('tasks').doc(taskId);
                const taskDoc = await taskRef.get();

                if (!taskDoc.exists) {
                    return res.status(404).json({ error: 'Task not found' });
                }

                const commentsSnapshot = await taskRef.collection('comments')
                    .orderBy('timestamp', 'asc')
                    .get();

                const comments = commentsSnapshot.docs.map(doc => ({
                    ...doc.data()
                }));

                res.status(200).json({ comments });
            } catch (error) {
                console.error('Error fetching comments:', error);
                res.status(500).json({ error: error.message });
            }
        } else if (req.method === 'POST') {
            const { message } = req.body;

            try {
                const comment = await addCommentToTask(projectId, taskId, userId, message);
                res.status(201).json({ message: 'Comment added successfully', comment });
            } catch (error) {
                console.error('Error adding comment:', error);
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