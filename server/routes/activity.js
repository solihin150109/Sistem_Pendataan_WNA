const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

// Helper function to create activity log
async function createActivityLog(username, userName, action, data = null) {
  try {
    await db.ref('activity_logs').push({
      username: username,
      userName: userName || username,
      action: action,
      timestamp: new Date().toISOString(),
      data: data,
      ip: null
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
  }
}

// Helper function to create notification
async function createNotification(userId, userName, title, message, type, relatedId = null) {
  try {
    const userNotificationsRef = db.ref(`user_notifications/${userId}`);
    const newNotifRef = await userNotificationsRef.push({
      userId: userId,
      userName: userName,
      title: title,
      message: message,
      type: type,
      relatedId: relatedId,
      read: false,
      readAt: null,
      timestamp: new Date().toISOString()
    });
    
    await db.ref('notifications').push({
      userId: userId,
      userName: userName,
      title: title,
      message: message,
      type: type,
      relatedId: relatedId,
      read: false,
      readAt: null,
      timestamp: new Date().toISOString()
    });
    
    return newNotifRef.key;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

// GET activity logs
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const action = req.query.action;
    const username = req.query.username;
    
    const snapshot = await db.ref('activity_logs')
      .orderByChild('timestamp')
      .limitToLast(limit)
      .once('value');
    
    let logs = [];
    const data = snapshot.val();
    
    if (data) {
      const keys = Object.keys(data);
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        logs.push({ id: key, ...data[key] });
      }
      
      if (action) {
        logs = logs.filter(log => log.action === action);
      }
      if (username) {
        logs = logs.filter(log => log.username === username);
      }
    }
    
    res.json({ success: true, data: logs, total: logs.length });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const limit = parseInt(req.query.limit) || 50;
    
    let snapshot = await db.ref(`user_notifications/${username}`)
      .orderByChild('timestamp')
      .limitToLast(limit)
      .once('value');
    
    let notifications = [];
    let data = snapshot.val();
    
    if (data) {
      const keys = Object.keys(data);
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        notifications.push({ id: key, ...data[key] });
      }
    }
    
    res.json({ success: true, data: notifications, total: notifications.length });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.json({ success: true, data: [], total: 0 });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username;
    const timestamp = new Date().toISOString();
    
    await db.ref(`user_notifications/${username}/${id}`).update({
      read: true,
      readAt: timestamp
    });
    
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all as read
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const timestamp = new Date().toISOString();
    
    const snapshot = await db.ref(`user_notifications/${username}`)
      .orderByChild('read')
      .equalTo(false)
      .once('value');
    
    const data = snapshot.val();
    if (data) {
      const updates = {};
      const keys = Object.keys(data);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        updates[`${key}/read`] = true;
        updates[`${key}/readAt`] = timestamp;
      }
      if (Object.keys(updates).length > 0) {
        await db.ref(`user_notifications/${username}`).update(updates);
      }
    }
    
    res.json({ success: true, message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unread count
router.get('/notifications/unread/count', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    
    const snapshot = await db.ref(`user_notifications/${username}`)
      .orderByChild('read')
      .equalTo(false)
      .once('value');
    
    let unreadCount = 0;
    const data = snapshot.val();
    if (data) {
      unreadCount = Object.keys(data).length;
    }
    
    res.json({ success: true, unreadCount: unreadCount });
  } catch (error) {
    console.error('Error counting unread:', error);
    res.json({ success: true, unreadCount: 0 });
  }
});

module.exports = { router, createActivityLog, createNotification };