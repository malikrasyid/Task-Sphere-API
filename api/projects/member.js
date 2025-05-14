// api/projects/member.js
import cors from '../../lib/cors';
const { authenticateToken } = require('../../lib/users');
const {
  addUserToProject,
  removeUserFromProject,
  updateMemberRole
} = require('../../lib/projects');

export default async function handler(req, res) {
  await cors(req, res);
  const { projectId } = req.query;

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate the user
    await authenticateToken(req, res);

    // Extract common fields
    const { action, userId, role, newRole } = req.body;

    if (!action || !userId) {
      return res.status(400).json({ error: 'Missing required fields: action or userId' });
    }

    switch (action) {
      case 'add':
        if (!role) {
          return res.status(400).json({ error: 'Missing role for adding member' });
        }
        await addUserToProject(projectId, userId, role);
        return res.status(200).json({ message: 'Member added successfully' });

      case 'remove':
        if (!role) {
          return res.status(400).json({ error: 'Missing role for removing member' });
        }
        await removeUserFromProject(projectId, userId, role);
        return res.status(200).json({ message: 'Member removed successfully' });

      case 'update':
        if (!newRole) {
          return res.status(400).json({ error: 'Missing newRole for updating member role' });
        }
        await updateMemberRole(projectId, userId, newRole);
        return res.status(200).json({ message: 'Role updated successfully' });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error(`Error performing action "${req.body.action}" on project ${projectId}:`, error);

    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
