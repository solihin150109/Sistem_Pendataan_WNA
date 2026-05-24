require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Konfigurasi CORS yang lebih permisif untuk development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development
    if (!origin) return callback(null, true);
    
    // Daftar origin yang diizinkan
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'https://localhost:3000',
      'https://localhost:5173',
    ];
    
    // Regex untuk dev tunnel dan codespaces
    const patterns = [
      /\.asse\.devtunnels\.ms$/,
      /\.preview\.app\.github\.dev$/,
      /\.ngrok\.io$/,
      /\.localtunnel\.me$/,
    ];
    
    // Cek apakah origin diizinkan
    const isAllowed = allowedOrigins.includes(origin) || patterns.some(pattern => pattern.test(origin));
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('⚠️ Blocked origin:', origin);
      // Untuk development, tetap izinkan
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Tambahkan logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.headers.origin) {
    console.log(`  Origin: ${req.headers.origin}`);
  }
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const wnaRoutes = require('./routes/wna');
const activityRoutes = require('./routes/activity');
const profileRoutes = require('./routes/profile');
const regionsRoutes = require('./routes/regions');
const usersRoutes = require('./routes/users');      // <-- TAMBAHKAN INI
const reportsRoutes = require('./routes/reports');  // <-- TAMBAHKAN INI

app.use('/api/auth', authRoutes);
app.use('/api/wna', wnaRoutes);
app.use('/api/activity', activityRoutes.router || activityRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/regions', regionsRoutes);
app.use('/api/users', usersRoutes);      // <-- TAMBAHKAN INI
app.use('/api/reports', reportsRoutes);  // <-- TAMBAHKAN INI

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: err.message });
});

// Start server - Listen on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 Local API: http://localhost:${PORT}/api`);
  console.log(`📡 Network API: http://0.0.0.0:${PORT}/api`);
  console.log(`\n✅ CORS enabled for development and tunnel environments\n`);
  console.log(`📋 Available routes:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/verify`);
  console.log(`   GET    /api/wna`);
  console.log(`   GET    /api/wna/stats/dashboard`);
  console.log(`   POST   /api/wna`);
  console.log(`   DELETE /api/wna/:id`);
  console.log(`   GET    /api/profile/me`);
  console.log(`   PUT    /api/profile/me`);
  console.log(`   GET    /api/users`);        // <-- TAMBAHKAN
  console.log(`   POST   /api/users`);        // <-- TAMBAHKAN
  console.log(`   GET    /api/reports/export/excel`);  // <-- TAMBAHKAN
});