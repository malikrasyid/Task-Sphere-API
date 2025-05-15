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

  const results = [];
  const nowDate = new Date();

  // Always run task status update every 30 minutes
  try {
    const statusResult = await updateTaskStatuses();
    results.push(statusResult);
  } catch (error) {
    console.error('Error updating task statuses:', error);
    results.push({ task: 'updateTaskStatuses', error: error.message });
  }

  // Run maintenance at 3:00 AM
  if (nowDate.getUTCHours() === 3 && nowDate.getMinutes() === 0) {
    try {
      const maintenanceResult = await runMaintenance();
      results.push(maintenanceResult);
    } catch (error) {
      console.error('Error running maintenance:', error);
      results.push({ task: 'runMaintenance', error: error.message });
    }
  }

  // Run notifications every hour at minute 30
  if (nowDate.getMinutes() === 30) {
    try {
      const notificationsResult = await runNotifications();
      results.push(notificationsResult);
    } catch (error) {
      console.error('Error running notifications:', error);
      results.push({ task: 'runNotifications', error: error.message });
    }
  }

  return res.status(200).json({ success: true, results });
}

async function runNotifications() {
  console.log(`[${new Date().toISOString()}] Checking deadlines and notifying users...`);
  await checkDeadlinesAndNotify();
  console.log('Deadline check completed');
  return { task: 'notifications', status: 'completed' };
}

async function runMaintenance() {
  console.log(`[${new Date().toISOString()}] Running full task maintenance...`);
  await performScheduledTaskMaintenance();
  console.log('Full maintenance completed');
  return { task: 'maintenance', status: 'completed' };
}

async function updateTaskStatuses() {
  console.log(`[${new Date().toISOString()}] Running task status updates...`);
  const count = await updateAllTaskStatuses();
  console.log(`Task status update completed: ${count} tasks updated`);
  return { task: 'taskStatusUpdate', status: 'completed', updatedCount: count };
}
