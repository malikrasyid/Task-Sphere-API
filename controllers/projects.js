// controllers/project.js - Handles Project and Member logic
const projectModel = require('../models/projects');
const { uuidv4 } = require('../utils/utils');

// Centralized error handler logic
const handleProjectError = (res, error, defaultMessage = 'Internal server error') => {
    console.error('Project Controller Error:', error);
    if (error.status) {
        return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || defaultMessage });
};

async function getProjects(req, res) {
    try {
        const projects = await projectModel.getProjectsByUserId(req.user.userId);
        return res.status(200).json({ projects });
    } catch (error) {
        handleProjectError(res, error, 'Error fetching user projects');
    }
}

async function createNewProject(req, res) {
    const { name, description } = req.body;
    const ownerId = req.user.userId;
    
    if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    try {
        const newProjectId = uuidv4(); 
        await projectModel.createProject(newProjectId, name, description, ownerId);
        return res.status(201).json({ message: 'Project created successfully', projectId: newProjectId });
    } catch (error) {
        handleProjectError(res, error, 'Error creating project');
    }
}

async function getProjectById(req, res) {
    const { projectId } = req.params;
    const userId = req.user.userId;
    
    try {
        const project = await projectModel.getProjectById(projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        if (!project.teamIds.includes(userId)) {
            return res.status(403).json({ error: 'Access denied: not part of project team' });
        }

        return res.status(200).json({ project });
    } catch (error) {
        handleProjectError(res, error);
    }
}

async function updateProjectDetails(req, res) {
    const { projectId } = req.params;
    const userId = req.user.userId;
    const { name, description } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No fields provided for update' });
    }

    try {
        const updatedProject = await projectModel.updateProjectDetails(projectId, updateData, userId);
        return res.status(200).json({
            message: 'Project updated successfully',
            project: updatedProject
        });
    } catch (error) {
        handleProjectError(res, error, 'Error updating project');
    }
}

async function deleteProjectController(req, res) {
    const { projectId } = req.params;
    const userId = req.user.userId;

    try {
        await projectModel.deleteProject(projectId, userId);
        return res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
        handleProjectError(res, error, 'Error deleting project');
    }
}

// --- Member Management ---
async function addMember(req, res) {
    const { projectId } = req.params;
    const { userId, role } = req.body;
    
    if (!userId || !role) {
        return res.status(400).json({ error: 'Missing required fields: userId or role' });
    }

    try {
        await projectModel.addUserToProject(projectId, userId, role);
        res.status(200).json({ message: 'Member added successfully' });
    } catch (error) {
        handleProjectError(res, error, 'Error adding member');
    }
}

async function removeMember(req, res) {
    const { projectId } = req.params;
    const { userId, role } = req.body; 

    if (!userId || !role) {
        return res.status(400).json({ error: 'Missing required fields: userId or role' });
    }

    try {
        await projectModel.removeUserFromProject(projectId, userId, role);
        res.status(200).json({ message: 'Member removed successfully' });
    } catch (error) {
        handleProjectError(res, error, 'Error removing member');
    }
}

async function updateMemberRoleController(req, res) {
    const { projectId } = req.params;
    const { userId, newRole } = req.body;

    if (!userId || !newRole) {
        return res.status(400).json({ error: 'Missing required fields: userId or newRole' });
    }

    try {
        await projectModel.updateMemberRole(projectId, userId, newRole);
        res.status(200).json({ message: 'Role updated successfully' });
    } catch (error) {
        handleProjectError(res, error, 'Error updating member role');
    }
}


module.exports = {
    getProjects,
    createNewProject,
    getProjectById,
    updateProjectDetails,
    deleteProjectController,
    addMember,
    removeMember,
    updateMemberRoleController,
};