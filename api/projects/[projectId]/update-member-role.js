// api/projects/[projectId]/update-member-role.js
const { authenticateToken } = require('../../../lib/auth');
const { updateMemberRole } = require('../../../lib/projects');

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
    const { userId, newRole } = req.body;

    // Update member role
    await updateMemberRole(projectId, userId, newRole);
    
    return res.status(200).json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error(`Error updating member role in project ${projectId}:`, error);
    
    // Handle authentication errors
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};