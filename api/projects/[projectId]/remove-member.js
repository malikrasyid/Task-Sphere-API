// api/projects/[projectId]/remove-member.js
const { authenticateToken } = require('../../../lib/auth');
const { removeUserFromProject } = require('../../../lib/projects');

module.exports = async (req, res) => {
  const { projectId } = req.query; // Vercel provides route params via query

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    await authenticateToken(req, res);
    
    // Extract data from request body
    const { userId, role } = req.body;

    // Remove user from project
    await removeUserFromProject(projectId, userId, role);
    
    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error(`Error removing member from project ${projectId}:`, error);
    
    // Handle authentication errors
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};