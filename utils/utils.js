// utils/utils.js
const { v4: uuidv4 } = require('uuid');

/**
 * Finds the role of a user within a project team array.
 * @param {Array<{userId: string, role: string}>} teamArray The project's team array.
 * @param {string} userId The ID of the user to find.
 * @returns {string | null} The user's role or null if not found.
 */
function getUserRoleInProject(teamArray, userId) {
  const member = teamArray.find(m => m.userId === userId);
  return member ? member.role : null;
}

/**
 * Automatically determines the status of a task based on current date and start/end dates.
 * @param {string | Date} startDate The task's start date.
 * @param {string | Date} endDate The task's end date.
 * @returns {'Not Started' | 'Ongoing' | 'Overdue'} The calculated status.
 */
function getAutoStatus(startDate, endDate) {
  const now = new Date();

  let start, end;

  // Handle various date types (Date object, ISO string, Firestore Timestamp)
  if (startDate && typeof startDate.toDate === 'function') {
    start = startDate.toDate();
  } else {
    start = startDate instanceof Date ? startDate : new Date(startDate);
  }

  if (endDate && typeof endDate.toDate === 'function') {
    end = endDate.toDate();
  } else {
    end = endDate instanceof Date ? endDate : new Date(endDate);
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid date objects in getAutoStatus:', { start, end });
    return 'Not Started';
  }

  if (now < start) return 'Not Started';
  if (now >= start && now <= end) return 'Ongoing';
  if (now > end) return 'Overdue';
}

module.exports = {
  uuidv4,
  getUserRoleInProject,
  getAutoStatus,
};