const { authenticateToken } = require('../../../lib/auth');
const { addUserToProject } = require('../../../lib/projects');

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

    // Add user to project
    await addUserToProject(projectId, userId, role);
    
    return res.status(200).json({ message: 'Member added successfully' });
  } catch (error) {
    console.error(`Error adding member to project ${projectId}:`, error);
    
    // Handle authentication errors
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};