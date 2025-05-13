const { checkDeadlinesAndNotify } = require ('../../lib/notifications');

export const config = {
  schedule: '30 * * * *', // adjust to match config.deadlineNotificationSchedule
};

export default async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] Checking deadlines and notifying users...`);
  try {
    await checkDeadlinesAndNotify();
    console.log('Deadline check completed');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in deadline notification job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
