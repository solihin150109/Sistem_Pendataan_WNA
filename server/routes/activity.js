const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

// GET activity logs
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    var limit = parseInt(req.query.limit) || 100;
    var action = req.query.action;
    var username = req.query.username;
    
    var snapshot = await db.ref('activity_logs')
      .orderByChild('timestamp')
      .limitToLast(limit)
      .once('value');
    
    var logs = [];
    var data = snapshot.val();
    if (data) {
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        logs.push({ id: key, ...data[key] });
      }
      logs.reverse();
      
      if (action) {
        logs = logs.filter(function(log) { return log.action === action; });
      }
      if (username) {
        logs = logs.filter(function(log) { return log.username === username; });
      }
    }
    res.json({ success: true, data: logs, total: logs.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    var username = req.user.username;
    var snapshot = await db.ref('notifications')
      .orderByChild('userId')
      .equalTo(username)
      .once('value');
    
    var notifications = [];
    var data = snapshot.val();
    if (data) {
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (data[key].userId === username) {
          notifications.push({ id: key, ...data[key] });
        }
      }
    }
    notifications.sort(function(a, b) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    res.json({ success: true, data: notifications, total: notifications.length });
  } catch (error) {
    console.error('Error:', error);
    res.json({ success: true, data: [], total: 0 });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    var id = req.params.id;
    await db.ref('notifications/' + id).update({
      read: true,
      readAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all as read
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    var username = req.user.username;
    var snapshot = await db.ref('notifications')
      .orderByChild('userId')
      .equalTo(username)
      .once('value');
    
    var data = snapshot.val();
    if (data) {
      var updates = {};
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!data[key].read) {
          updates[key + '/read'] = true;
          updates[key + '/readAt'] = new Date().toISOString();
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.ref('notifications').update(updates);
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
    var username = req.user.username;
    var snapshot = await db.ref('notifications')
      .orderByChild('userId')
      .equalTo(username)
      .once('value');
    
    var unreadCount = 0;
    var data = snapshot.val();
    if (data) {
      var values = Object.values(data);
      for (var i = 0; i < values.length; i++) {
        if (!values[i].read) unreadCount++;
      }
    }
    res.json({ success: true, unreadCount: unreadCount });
  } catch (error) {
    res.json({ success: true, unreadCount: 0 });
  }
});

module.exports = router;