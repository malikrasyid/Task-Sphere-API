// /api/cron/status-update.js
const { updateAllTaskStatuses } = require ('../../lib/tasks');

export const config = {
  schedule: '*/30 * * * *' // from taskStatusUpdateSchedule
};

export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] Running task status updates...`);
  try {
    const updatedCount = await updateAllTaskStatuses();
    console.log(`Task status update completed: ${updatedCount} tasks updated`);
    res.status(200).json({ success: true, updatedCount });
  } catch (error) {
    console.error('Error in task status update job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
