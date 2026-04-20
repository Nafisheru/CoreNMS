const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// GET all cables
router.get('/', verifyToken, (req, res) => {
  try {
    const cables = db.prepare('SELECT * FROM kabel ORDER BY created_at DESC').all();
    res.json(cables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new cable
router.post('/', verifyToken, (req, res) => {
  const { nama_kabel, jenis_kabel, total_core, total_tube, keterangan } = req.body;
  if (!nama_kabel) return res.status(400).json({ error: 'Nama kabel wajib diisi' });

  try {
    const result = db.prepare('INSERT INTO kabel (nama_kabel, jenis_kabel, total_core, total_tube, keterangan) VALUES (?, ?, ?, ?, ?)')
      .run(nama_kabel, jenis_kabel || '', total_core || 0, total_tube || 0, keterangan || '');
    res.status(201).json({ id: result.lastInsertRowid, message: 'Kabel berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update cable
router.put('/:id', verifyToken, (req, res) => {
  const { nama_kabel, jenis_kabel, total_core, total_tube, keterangan } = req.body;
  try {
    db.prepare('UPDATE kabel SET nama_kabel=?, jenis_kabel=?, total_core=?, total_tube=?, keterangan=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(nama_kabel, jenis_kabel, total_core, total_tube, keterangan, req.params.id);
    res.json({ message: 'Kabel berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cable
router.delete('/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM kabel WHERE id = ?').run(req.params.id);
    res.json({ message: 'Kabel berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
