// routes/notifications.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notifications');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/notifications - Fetch all notifications
// POST /api/notifications - Create a new notification (used internally by other services/endpoints)
router.route('/')
    .get(notificationController.getNotifications)
    .post(notificationController.createNewNotification);

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', notificationController.markAllAsRead);

// PUT /api/notifications/:notificationId/read
router.put('/:notificationId/read', notificationController.markSingleAsRead);

module.exports = router;