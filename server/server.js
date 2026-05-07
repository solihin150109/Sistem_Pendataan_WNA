const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const wnaRoutes = require('./routes/wna');
const activityRoutes = require('./routes/activity');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wna', wnaRoutes);
app.use('/api/activity', activityRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files from React build (untuk production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
  });
} else {
  // Development mode: beri tahu bahwa frontend berjalan terpisah
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Backend API is running', 
      frontend: 'Run `npm run dev` in client folder',
      apiDocs: '/api/health'
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🎨 Frontend: http://localhost:${PORT}`);
  }
});