const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET all joint closures
router.get('/', verifyToken, (req, res) => {
  try {
    const jcs = db.prepare('SELECT * FROM joint_closure ORDER BY created_at DESC').all();
    res.json(jcs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET JC Detail (including cables and trays)
router.get('/:id', verifyToken, (req, res) => {
  try {
    const jc = db.prepare('SELECT * FROM joint_closure WHERE id = ?').get(req.params.id);
    if (!jc) return res.status(404).json({ error: 'Joint Closure tidak ditemukan' });

    const cables = db.prepare(`
      SELECT r.*, k.nama_kabel, k.total_core, k.total_tube 
      FROM kabel_jc_relation r
      JOIN kabel k ON r.kabel_id = k.id
      WHERE r.jc_id = ?
    `).all(req.params.id);

    const trays = db.prepare('SELECT * FROM tray WHERE jc_id = ? ORDER BY nomor_tray ASC').all(req.params.id);

    res.json({ ...jc, cables, trays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new JC
router.post('/', verifyToken, (req, res) => {
  const { kode_jc, lokasi, latitude, longitude, keterangan } = req.body;
  if (!kode_jc) return res.status(400).json({ error: 'Kode JC wajib diisi' });

  try {
    const result = db.prepare('INSERT INTO joint_closure (kode_jc, lokasi, latitude, longitude, keterangan) VALUES (?, ?, ?, ?, ?)')
      .run(kode_jc, lokasi || '', latitude || '', longitude || '', keterangan || '');
    res.status(201).json({ id: result.lastInsertRowid, message: 'Joint Closure berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE JC
router.delete('/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM joint_closure WHERE id = ?').run(req.params.id);
    res.json({ message: 'Joint Closure berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
