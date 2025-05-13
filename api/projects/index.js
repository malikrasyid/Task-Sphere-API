// api/projects/index.js
const { authenticateToken } = require('../../lib/auth');
const { createProject } = require('../../lib/projects');
const { db } = require('../../lib/db');

module.exports = async (req, res) => {
  try {
    // Handle GET request - get user projects
    if (req.method === 'GET') {
      const user = await authenticateToken(req, res);
      const userId = user.userId;

      try {
          const projectsSnapshot = await db.collection('projects')
              .where('teamIds', 'array-contains', userId)
              .get();

          const projects = projectsSnapshot.docs.map(doc => ({
              projectId: doc.id,
              ...doc.data()
          }));

          res.status(200).json({ projects });
      } catch (error) {
          console.error('Error fetching user projects:', error);
          res.status(500).json({ error: error.message });
      }
    } else if (req.method === 'POST') {
      const user = await authenticateToken(req, res);
      const { projectId, name, description } = req.body;
      const ownerId = user.userId;

      try {
          await createProject(projectId, name, description, ownerId);
          res.status(201).json({ message: 'Project created successfully' });
      } catch (error) {
          console.error('Error creating project:', error);
          res.status(400).json({ error: error.message });
      }
    } else {
    // Method not allowed
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
};