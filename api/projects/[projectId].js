// api/projects/[projectId].js
const { authenticateToken } = require('../../lib/auth');
const { deleteProject } = require('../../lib/projects');
const { db } = require('../../lib/db');

module.exports = async (req, res) => {
  const { projectId } = req.query; // Vercel provides route params via query

  try {
    const user = await authenticateToken(req, res);
    const userId = user.userId;

    // GET - fetch a specific project details
    if (req.method === 'GET') {
      const projectRef = db.collection('projects').doc(projectId);
      const projectDoc = await projectRef.get();

      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const projectData = projectDoc.data();

      // Check if user is part of the project
      if (!projectData.teamIds.includes(userId)) {
        return res.status(403).json({ error: 'Access denied: not part of project team' });
      }

      return res.status(200).json({ project: projectData });
    }

    // DELETE - delete a project
    if (req.method === 'DELETE') {
      await deleteProject(projectId, userId);
      return res.status(200).json({ message: 'Project deleted successfully' });
    }

    // PUT/PATCH - update project details
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, description } = req.body;
      
      const projectRef = db.collection('projects').doc(projectId);
      const projectDoc = await projectRef.get();

      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const projectData = projectDoc.data();

      // Verify user is owner or editor
      const userRole = projectData.team.find(m => m.userId === userId)?.role;
      if (userRole !== 'owner' && userRole !== 'editor') {
        return res.status(403).json({ error: 'Access denied: only owner or editor can update project' });
      }

      // Update the project
      const updateData = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;

      await projectRef.update(updateData);

      return res.status(200).json({ 
        message: 'Project updated successfully',
        project: {
          ...projectData,
          ...updateData
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(`Error handling project ${projectId}:`, error);
    
    // Handle authentication errors
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};