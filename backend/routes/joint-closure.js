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

// POST new JC
router.post('/', verifyToken, (req, res) => {
  const { kode_jc, lokasi, koordinat, keterangan } = req.body;
  if (!kode_jc) return res.status(400).json({ error: 'Kode JC wajib diisi' });
  try {
    const result = db.prepare('INSERT INTO joint_closure (kode_jc, lokasi, koordinat, keterangan) VALUES (?, ?, ?, ?)')
      .run(kode_jc, lokasi || '', koordinat || '', keterangan || '');
    res.status(201).json({ id: result.lastInsertRowid, message: 'Joint Closure berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CONNECT CABLE to JC
router.post('/connect-cable', verifyToken, (req, res) => {
  const { jc_id, kabel_id, sisi_kabel, arah_kabel, keterangan } = req.body;
  try {
    const result = db.prepare('INSERT INTO kabel_jc_relation (jc_id, kabel_id, sisi_kabel, arah_kabel, keterangan) VALUES (?, ?, ?, ?, ?)')
      .run(jc_id, kabel_id, sisi_kabel, arah_kabel || '', keterangan || '');
    res.json({ id: result.lastInsertRowid, message: 'Kabel berhasil dihubungkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DISCONNECT CABLE from JC
router.delete('/disconnect-cable/:id', verifyToken, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM kabel_jc_relation WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Relasi kabel tidak ditemukan' });
    res.json({ message: 'Kabel berhasil diputuskan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TRAY MANAGEMENT ROUTES
router.post('/trays', verifyToken, (req, res) => {
  const { jc_id, nomor_tray, kapasitas_tray, keterangan } = req.body;
  try {
    const result = db.prepare('INSERT INTO tray (jc_id, nomor_tray, kapasitas_tray, keterangan) VALUES (?, ?, ?, ?)')
      .run(jc_id, nomor_tray, kapasitas_tray || 24, keterangan || '');
    res.json({ id: result.lastInsertRowid, message: 'Tray berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/trays/:id', verifyToken, (req, res) => {
  const { nomor_tray, kapasitas_tray, keterangan } = req.body;
  try {
    const result = db.prepare('UPDATE tray SET nomor_tray = ?, kapasitas_tray = ?, keterangan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(nomor_tray, kapasitas_tray, keterangan || '', req.params.id);
    res.json({ message: 'Tray berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/trays/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM tray WHERE id = ?').run(req.params.id);
    res.json({ message: 'Tray berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPLICING MANAGEMENT ROUTES
router.get('/trays/:trayId/splices', verifyToken, (req, res) => {
  try {
    const splices = db.prepare('SELECT * FROM splicing WHERE tray_id = ?').all(req.params.trayId);
    res.json(splices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/splices', verifyToken, (req, res) => {
  const { tray_id, source_kabel_id, source_core, target_kabel_id, target_core } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO splicing (tray_id, source_kabel_id, source_core, target_kabel_id, target_core)
      VALUES (?, ?, ?, ?, ?)
    `).run(tray_id, source_kabel_id, source_core, target_kabel_id, target_core);
    res.json({ id: result.lastInsertRowid, message: 'Core berhasil disambung' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/splices/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM splicing WHERE id = ?').run(req.params.id);
    res.json({ message: 'Sambungan core berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GENERIC PARAMETERIZED ROUTES (MUST BE LAST)
router.get('/:id', verifyToken, (req, res) => {
  try {
    const jc = db.prepare('SELECT * FROM joint_closure WHERE id = ?').get(req.params.id);
    if (!jc) return res.status(404).json({ error: 'Joint Closure tidak ditemukan' });

    const cables = db.prepare(`
      SELECT r.id, r.jc_id, r.kabel_id, r.sisi_kabel, r.arah_kabel, r.keterangan,
             k.nama_kabel, k.total_core, k.total_tube 
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

router.put('/:id', verifyToken, (req, res) => {
  const { kode_jc, lokasi, koordinat, keterangan } = req.body;
  try {
    db.prepare('UPDATE joint_closure SET kode_jc = ?, lokasi = ?, koordinat = ?, keterangan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(kode_jc, lokasi, koordinat, keterangan, req.params.id);
    res.json({ message: 'Joint Closure berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', verifyToken, (req, res) => {
  try {
    db.prepare('DELETE FROM joint_closure WHERE id = ?').run(req.params.id);
    res.json({ message: 'Joint Closure berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
