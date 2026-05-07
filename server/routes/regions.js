const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

// GET all regions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.ref('regions').once('value');
    const data = snapshot.val();
    
    const regions = [];
    if (data) {
      Object.keys(data).forEach(key => {
        regions.push({ id: key, ...data[key] });
      });
    }
    
    res.json({ success: true, data: regions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET WNA distribution by region
router.get('/distribution', authenticateToken, async (req, res) => {
  try {
    const wnaSnapshot = await db.ref('wna').once('value');
    const wnaData = wnaSnapshot.val();
    
    const distribution = {};
    if (wnaData) {
      Object.values(wnaData).forEach(item => {
        const domisili = item.domisili;
        if (domisili) {
          distribution[domisili] = (distribution[domisili] || 0) + 1;
        }
      });
    }
    
    res.json({ success: true, data: distribution });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET WNA by specific region
router.get('/:region/wna', authenticateToken, async (req, res) => {
  try {
    const { region } = req.params;
    const snapshot = await db.ref('wna').once('value');
    const data = snapshot.val();
    
    const wnaList = [];
    if (data) {
      Object.keys(data).forEach(key => {
        const item = data[key];
        if (item.domisili === decodeURIComponent(region)) {
          wnaList.push({ id: key, ...item });
        }
      });
    }
    
    res.json({ success: true, data: wnaList, total: wnaList.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;