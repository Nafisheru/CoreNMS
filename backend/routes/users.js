// backend/routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Utility for logging
function logActivity(userId, username, action, details) {
  try {
    db.prepare('INSERT INTO activity_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
      .run(userId, username, action, details);
  } catch (err) {
    console.error('[LOG ERROR]', err.message);
  }
}

// GET /api/users
router.get('/', verifyToken, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, role, whatsapp, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/users
router.post('/', verifyToken, requireRole('admin'), (req, res) => {
  const { username, password, full_name, role, whatsapp } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Data tidak lengkap' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username sudah digunakan' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, full_name, role, whatsapp) VALUES (?, ?, ?, ?, ?)')
    .run(username, hash, full_name || '', role, whatsapp || '');

  logActivity(req.user.id, req.user.username, 'ADD_USER', `Menambah user: ${username} (${role})`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'User berhasil dibuat' });
});

// PUT /api/users/:id
router.put('/:id', verifyToken, requireRole('admin'), (req, res) => {
  const { full_name, role, status, password, whatsapp } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  let newHash = user.password_hash;
  if (password) {
    newHash = bcrypt.hashSync(password, 10);
  }

  db.prepare('UPDATE users SET full_name=?, role=?, status=?, password_hash=?, whatsapp=? WHERE id=?')
    .run(
      full_name !== undefined ? full_name : user.full_name,
      role || user.role,
      status || user.status,
      newHash,
      whatsapp !== undefined ? whatsapp : user.whatsapp,
      req.params.id
    );

  logActivity(req.user.id, req.user.username, 'EDIT_USER', `Update user: ${user.username}`);
  res.json({ message: 'User berhasil diupdate' });
});

// DELETE /api/users/:id
router.delete('/:id', verifyToken, requireRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Tidak dapat menghapus diri sendiri' });
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, req.user.username, 'DELETE_USER', `Menghapus user: ${user.username}`);
  res.json({ message: 'User berhasil dihapus' });
});

module.exports = router;
