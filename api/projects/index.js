import cors from '../../lib/cors';
const { authenticateToken } = require('../../lib/users');
const { db } = require('../../lib/db');
const { createProject, deleteProject } = require('../../lib/projects');
const { uuidv4 } = require('../../lib/utils');

export default async function handler(req, res) {
  await cors(req, res);
  try {
    const user = await authenticateToken(req, res);
    const userId = user.userId;
    const { projectId } = req.query;

    // === /api/projects ===
    if (!projectId) {
      if (req.method === 'GET') {
        try {
          const projectsSnapshot = await db.collection('projects')
            .where('teamIds', 'array-contains', userId)
            .get();

          const projects = projectsSnapshot.docs.map(doc => ({
            projectId: doc.id,
            ...doc.data()
          }));

          return res.status(200).json({ projects });
        } catch (error) {
          console.error('Error fetching user projects:', error);
          return res.status(500).json({ error: error.message });
        }

      } else if (req.method === 'POST') {
        const { name, description } = req.body;
        const newProjectId = uuidv4();

        try {
          await createProject(newProjectId, name, description, userId);
          return res.status(201).json({ message: 'Project created successfully' });
        } catch (error) {
          console.error('Error creating project:', error);
          return res.status(400).json({ error: error.message });
        }
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // === /api/projects/[projectId] ===
    const projectRef = db.collection('projects').doc(projectId);

    if (req.method === 'GET') {
      const projectDoc = await projectRef.get();
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const projectData = projectDoc.data();
      if (!projectData.teamIds.includes(userId)) {
        return res.status(403).json({ error: 'Access denied: not part of project team' });
      }

      return res.status(200).json({ project: projectData });

    } else if (req.method === 'DELETE') {
      try {
        await deleteProject(projectId, userId);
        return res.status(200).json({ message: 'Project deleted successfully' });
      } catch (error) {
        console.error('Error deleting project:', error);
        return res.status(403).json({ error: error.message });
      }

    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, description } = req.body;
      const projectDoc = await projectRef.get();

      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const projectData = projectDoc.data();
      const userRole = projectData.team.find(m => m.userId === userId)?.role;

      if (userRole !== 'owner' && userRole !== 'editor') {
        return res.status(403).json({ error: 'Access denied: only owner or editor can update project' });
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;

      await projectRef.update(updateData);

      return res.status(200).json({
        message: 'Project updated successfully',
        project: { ...projectData, ...updateData }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Projects endpoint error:', error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
