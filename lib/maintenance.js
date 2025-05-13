const { checkDeadlinesAndNotify } = require('./notifications');
const { updateAllTaskStatuses } = require('./tasks');

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
    performScheduledTaskMaintenance
}