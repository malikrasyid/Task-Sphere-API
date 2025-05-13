// lib/utils.js
const { v4: uuidv4 } = require('uuid');

function getUserRoleInProject(teamArray, userId) {
  const member = teamArray.find(m => m.userId === userId);
  return member ? member.role : null;
}

function getAutoStatus(startDate, endDate) {
  const now = new Date();

  let start, end;
  
  // Handle Firestore Timestamp objects
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
  
  // Verify dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid date objects in getAutoStatus:', { start, end });
    // Return a safe default if dates are invalid
    return 'Not Started';
  }
  
  if (now < start) return 'Not Started';
  if (now >= start && now <= end) return 'Ongoing';
  if (now > end) return 'Overdue';
}

module.exports = {
  uuidv4,
  getUserRoleInProject,
  getAutoStatus
};