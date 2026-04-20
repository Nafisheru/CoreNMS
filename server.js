// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

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

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// SPA fallback
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 CoreNMS Server running at http://localhost:${PORT}`);
});
