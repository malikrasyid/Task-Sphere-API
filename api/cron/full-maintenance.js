const { performScheduledTaskMaintenance } = require ('../../lib/maintenance');

export const config = {
  schedule: '0 3 * * *', // adjust to match config.fullMaintenanceSchedule
};

export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] Running full task maintenance...`);
  try {
    await performScheduledTaskMaintenance();
    console.log('Full maintenance completed');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in full maintenance job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
