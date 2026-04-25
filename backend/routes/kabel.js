const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// Utility for logging
function logActivity(userId, username, action, details) {
  try {
    db.prepare('INSERT INTO activity_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
      .run(userId, username, action, details);
  } catch (err) {
    console.error('[LOG ERROR]', err.message);
  }
}

// GET all cables (with usage count)
router.get('/', verifyToken, (req, res) => {
  try {
    const cables = db.prepare(`
      SELECT k.*,
        (SELECT COUNT(*) FROM kabel_jc_relation WHERE kabel_id = k.id) as jc_count
      FROM kabel k
      ORDER BY k.created_at DESC
    `).all();
    res.json(cables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats
router.get('/stats', verifyToken, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as c FROM kabel').get().c;
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new cable
router.post('/', verifyToken, (req, res) => {
  const { nama_kabel, jenis_kabel, total_core, total_tube, keterangan } = req.body;
  if (!nama_kabel || !nama_kabel.trim()) return res.status(400).json({ error: 'Nama kabel wajib diisi' });

  // Check duplicate name
  const existing = db.prepare('SELECT id FROM kabel WHERE nama_kabel = ?').get(nama_kabel.trim());
  if (existing) return res.status(409).json({ error: `Nama kabel "${nama_kabel}" sudah ada` });

  try {
    const result = db.prepare('INSERT INTO kabel (nama_kabel, jenis_kabel, total_core, total_tube, keterangan) VALUES (?, ?, ?, ?, ?)')
      .run(nama_kabel.trim(), jenis_kabel || '', total_core || 0, total_tube || 0, keterangan || '');
    logActivity(req.user.id, req.user.username, 'ADD_KABEL', `Menambah kabel: ${nama_kabel}`);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Kabel berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update cable
router.put('/:id', verifyToken, (req, res) => {
  const { nama_kabel, jenis_kabel, total_core, total_tube, keterangan } = req.body;
  if (!nama_kabel || !nama_kabel.trim()) return res.status(400).json({ error: 'Nama kabel wajib diisi' });

  const cable = db.prepare('SELECT * FROM kabel WHERE id=?').get(req.params.id);
  if (!cable) return res.status(404).json({ error: 'Kabel tidak ditemukan' });

  // Check duplicate name (exclude self)
  if (nama_kabel.trim() !== cable.nama_kabel) {
    const dup = db.prepare('SELECT id FROM kabel WHERE nama_kabel=? AND id!=?').get(nama_kabel.trim(), req.params.id);
    if (dup) return res.status(409).json({ error: `Nama kabel "${nama_kabel}" sudah ada` });
  }

  try {
    db.prepare('UPDATE kabel SET nama_kabel=?, jenis_kabel=?, total_core=?, total_tube=?, keterangan=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(nama_kabel.trim(), jenis_kabel || '', total_core || 0, total_tube || 0, keterangan || '', req.params.id);
    logActivity(req.user.id, req.user.username, 'EDIT_KABEL', `Update kabel: ${nama_kabel}`);
    res.json({ message: 'Kabel berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cable
router.delete('/:id', verifyToken, (req, res) => {
  const cable = db.prepare('SELECT * FROM kabel WHERE id=?').get(req.params.id);
  if (!cable) return res.status(404).json({ error: 'Kabel tidak ditemukan' });

  // Check if cable is used in any JC
  const inUse = db.prepare('SELECT COUNT(*) as c FROM kabel_jc_relation WHERE kabel_id=?').get(req.params.id);
  if (inUse.c > 0) {
    return res.status(409).json({ 
      error: `Kabel ini terpasang di ${inUse.c} Joint Closure. Lepaskan koneksi terlebih dahulu sebelum menghapus.` 
    });
  }

  try {
    db.prepare('DELETE FROM kabel WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, req.user.username, 'DELETE_KABEL', `Hapus kabel: ${cable.nama_kabel}`);
    res.json({ message: 'Kabel berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
