const { checkDeadlinesAndNotify } = require('../../lib/notifications');
const { performScheduledTaskMaintenance } = require('../../lib/utils');
const { updateAllTaskStatuses } = require('../../lib/projects');

// Schedule this to run every 30 minutes (most frequent one)
export const config = {
  schedule: '*/30 * * * *',
};

export default async function handler(req, res) {
  const now = new Date().toISOString();
  console.log(`[${now}] Running combined cron tasks...`);

  const tasksToRun = [];

  // Always run task status update every 30 minutes
  tasksToRun.push(updateTaskStatuses());

  // Run maintenance at 3:00 AM
  const nowDate = new Date();
  if (nowDate.getHours() === 3 && nowDate.getMinutes() === 0) {
    tasksToRun.push(runMaintenance());
  }

  // Run notifications every hour at minute 30
  if (nowDate.getMinutes() === 30) {
    tasksToRun.push(runNotifications());
  }

  try {
    const results = await Promise.all(tasksToRun);
    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Error in combined cron job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function runNotifications() {
  console.log(`[${new Date().toISOString()}] Checking deadlines and notifying users...`);
  await checkDeadlinesAndNotify();
  console.log('Deadline check completed');
  return 'notificationsDone';
}

async function runMaintenance() {
  console.log(`[${new Date().toISOString()}] Running full task maintenance...`);
  await performScheduledTaskMaintenance();
  console.log('Full maintenance completed');
  return 'maintenanceDone';
}

async function updateTaskStatuses() {
  console.log(`[${new Date().toISOString()}] Running task status updates...`);
  const count = await updateAllTaskStatuses();
  console.log(`Task status update completed: ${count} tasks updated`);
  return `updated ${count} tasks`;
}
