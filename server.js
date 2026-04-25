// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Init DB at startup (creates tables + seeds admin)
const db = require('./backend/config/db');
const { verifyToken } = require('./backend/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

// Routes
const authRoutes = require('./backend/routes/auth');
const userRoutes = require('./backend/routes/users');
const kabelRoutes = require('./backend/routes/kabel');
const jcRoutes = require('./backend/routes/joint-closure');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/kabel', kabelRoutes);
app.use('/api/joint-closure', jcRoutes);

// Dashboard Stats Aggregation
app.get('/api/stats', verifyToken, (req, res) => {
  try {
    const total_users = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c;
    const total_kabel = db.prepare('SELECT COUNT(*) as c FROM kabel').get().c;
    const total_jc = db.prepare('SELECT COUNT(*) as c FROM joint_closure').get().c;
    const total_splices = db.prepare('SELECT COUNT(*) as c FROM splicing_core').get().c;
    const total_trays = db.prepare('SELECT COUNT(*) as c FROM tray').get().c;
    const active_jc = db.prepare("SELECT COUNT(*) as c FROM joint_closure WHERE status_jc='active'").get().c;
    res.json({ total_users, total_kabel, total_jc, total_splices, total_trays, active_jc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activity Logs
app.get('/api/activity-logs', verifyToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Default index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// 404 handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 CoreNMS Server running at http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
});
