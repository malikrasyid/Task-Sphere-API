import cors from '../../../../lib/cors';
const { addCommentToTask, deleteComment } = require('../../../../lib/projects');
const { authenticateToken } = require('../../../../lib/users');
const { db } = require('../../../../lib/db');

export default async function handler(req, res) {
  await cors(req, res);
  const { projectId, taskId, commentId } = req.query;

  try {
    const user = await authenticateToken(req, res);
    const userId = user.userId;

    // -------- GET (Fetch all comments for a task or a single comment) --------
    if (req.method === 'GET') {
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

      // If commentId is provided, fetch a single comment
      if (commentId) {
        const commentRef = taskRef.collection('comments').doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
          return res.status(404).json({ error: 'Comment not found' });
        }

        const comment = commentDoc.data();
        return res.status(200).json({ comment });
      }

      // Otherwise fetch all comments for the task
      const commentsSnapshot = await taskRef.collection('comments')
        .orderBy('timestamp', 'asc')
        .get();

      const comments = commentsSnapshot.docs.map(doc => ({
        ...doc.data()
      }));

      return res.status(200).json({ comments });
    }

    // -------- POST (Add a new comment to a task) --------
    if (req.method === 'POST') {
      const { message } = req.body;
      const comment = await addCommentToTask(projectId, taskId, userId, message);
      return res.status(201).json({ message: 'Comment added successfully', comment });
    }

    // -------- DELETE (Delete a comment by ID) --------
    if (req.method === 'DELETE' && commentId) {
      await deleteComment(projectId, taskId, commentId, userId);
      return res.status(200).json({ message: 'Comment deleted successfully' });
    }

    // -------- Invalid Method or Missing Params --------
    return res.status(405).json({ error: 'Method not allowed or missing parameters' });

  } catch (error) {
    console.error('Comments endpoint error:', error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
