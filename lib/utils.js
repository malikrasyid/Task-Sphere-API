const { v4: uuidv4 } = require('uuid');
const { checkDeadlinesAndNotify } = require('./notifications');
const { updateAllTaskStatuses } = require('./projects');

function getUserRoleInProject(teamArray, userId) {
  const member = teamArray.find(m => m.userId === userId);
  return member ? member.role : null;
}

function getAutoStatus(startDate, endDate) {
  const now = new Date();

  let start, end;

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

async function performScheduledTaskMaintenance() {
  try {
    await checkDeadlinesAndNotify();
    await updateAllTaskStatuses();
    console.log('Scheduled task maintenance completed');
  } catch (error) {
    console.error('Error in scheduled task maintenance:', error);
  }
}

module.exports = {
  uuidv4,
  getUserRoleInProject,
  getAutoStatus,
  performScheduledTaskMaintenance
};