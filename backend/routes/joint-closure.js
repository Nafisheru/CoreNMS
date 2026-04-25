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

// GET all joint closures (with stats)
router.get('/', verifyToken, (req, res) => {
  try {
    const jcs = db.prepare(`
      SELECT jc.*,
        (SELECT COUNT(*) FROM kabel_jc_relation WHERE jc_id = jc.id) as cable_count,
        (SELECT COUNT(*) FROM tray WHERE jc_id = jc.id) as tray_count
      FROM joint_closure jc
      ORDER BY jc.created_at DESC
    `).all();
    res.json(jcs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new JC
router.post('/', verifyToken, (req, res) => {
  const { kode_jc, lokasi, koordinat, keterangan } = req.body;
  if (!kode_jc) return res.status(400).json({ error: 'Kode JC wajib diisi' });

  // Check duplicate
  const existing = db.prepare('SELECT id FROM joint_closure WHERE kode_jc = ?').get(kode_jc);
  if (existing) return res.status(409).json({ error: `Kode JC "${kode_jc}" sudah digunakan` });

  try {
    const result = db.prepare('INSERT INTO joint_closure (kode_jc, lokasi, koordinat, keterangan) VALUES (?, ?, ?, ?)')
      .run(kode_jc, lokasi || '', koordinat || '', keterangan || '');
    logActivity(req.user.id, req.user.username, 'ADD_JC', `Menambah JC: ${kode_jc}`);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Joint Closure berhasil ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CONNECT CABLE to JC
router.post('/connect-cable', verifyToken, (req, res) => {
  const { jc_id, kabel_id, sisi_kabel, arah_kabel, keterangan } = req.body;
  if (!jc_id || !kabel_id) return res.status(400).json({ error: 'jc_id dan kabel_id wajib diisi' });

  try {
    // Check if same cable+side already connected
    const existing = db.prepare('SELECT id FROM kabel_jc_relation WHERE jc_id=? AND kabel_id=? AND sisi_kabel=?')
      .get(jc_id, kabel_id, sisi_kabel);
    if (existing) return res.status(409).json({ error: 'Kabel dengan posisi yang sama sudah terhubung ke JC ini' });

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
    // Check if any splice uses this relation
    const hasSplice = db.prepare('SELECT id FROM splicing_core WHERE asal_relation_id=? OR tujuan_relation_id=?')
      .get(req.params.id, req.params.id);
    if (hasSplice) {
      return res.status(409).json({ error: 'Kabel ini masih memiliki data splicing. Hapus semua splicing terlebih dahulu.' });
    }

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
  if (!jc_id || !nomor_tray) return res.status(400).json({ error: 'jc_id dan nomor_tray wajib diisi' });

  // Check duplicate tray number in same JC
  const existing = db.prepare('SELECT id FROM tray WHERE jc_id=? AND nomor_tray=?').get(jc_id, nomor_tray);
  if (existing) return res.status(409).json({ error: `Tray #${nomor_tray} sudah ada di JC ini` });

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
    const tray = db.prepare('SELECT * FROM tray WHERE id=?').get(req.params.id);
    if (!tray) return res.status(404).json({ error: 'Tray tidak ditemukan' });

    db.prepare('UPDATE tray SET nomor_tray=?, kapasitas_tray=?, keterangan=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(nomor_tray ?? tray.nomor_tray, kapasitas_tray ?? tray.kapasitas_tray, keterangan ?? tray.keterangan, req.params.id);
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
    const splices = db.prepare(`
      SELECT sc.*,
        sc.asal_core as source_core,
        sc.tujuan_core as target_core,
        rA.kabel_id as source_kabel_id,
        rB.kabel_id as target_kabel_id,
        kA.nama_kabel as source_kabel_name,
        kB.nama_kabel as target_kabel_name
      FROM splicing_core sc
      LEFT JOIN kabel_jc_relation rA ON sc.asal_relation_id = rA.id
      LEFT JOIN kabel_jc_relation rB ON sc.tujuan_relation_id = rB.id
      LEFT JOIN kabel kA ON rA.kabel_id = kA.id
      LEFT JOIN kabel kB ON rB.kabel_id = kB.id
      WHERE sc.tray_id = ?
      ORDER BY sc.asal_core ASC
    `).all(req.params.trayId);
    res.json(splices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/splices', verifyToken, (req, res) => {
  const { tray_id, source_relation_id, source_core, target_relation_id, target_core,
          source_kabel_id, target_kabel_id, status_core, keterangan } = req.body;

  if (!tray_id) return res.status(400).json({ error: 'tray_id wajib diisi' });

  try {
    // Determine the JC ID for this tray to resolve relations
    const tray = db.prepare('SELECT jc_id FROM tray WHERE id=?').get(tray_id);
    if (!tray) return res.status(404).json({ error: 'Tray tidak ditemukan' });

    // Robust Relation Resolution
    let asalRelId = source_relation_id;
    let tujuanRelId = target_relation_id;

    if (!asalRelId && source_kabel_id) {
      const rel = db.prepare('SELECT id FROM kabel_jc_relation WHERE jc_id=? AND kabel_id=?').get(tray.jc_id, source_kabel_id);
      if (rel) asalRelId = rel.id;
    }
    if (!tujuanRelId && target_kabel_id) {
      const rel = db.prepare('SELECT id FROM kabel_jc_relation WHERE jc_id=? AND kabel_id=?').get(tray.jc_id, target_kabel_id);
      if (rel) tujuanRelId = rel.id;
    }

    if (!asalRelId || !tujuanRelId) return res.status(400).json({ error: 'Kabel tidak terhubung ke JC ini' });

    // Validate Core Ranges
    const kA = db.prepare('SELECT k.total_core FROM kabel_jc_relation r JOIN kabel k ON r.kabel_id=k.id WHERE r.id=?').get(asalRelId);
    const kB = db.prepare('SELECT k.total_core FROM kabel_jc_relation r JOIN kabel k ON r.kabel_id=k.id WHERE r.id=?').get(tujuanRelId);
    
    if (source_core > kA.total_core || target_core > kB.total_core) {
      return res.status(400).json({ error: 'Nomor core melebihi kapasitas kabel' });
    }

    // Check if core already connected (Cross-tray check is better)
    const existingAsal = db.prepare(`
      SELECT sc.id, t.nomor_tray 
      FROM splicing_core sc 
      JOIN tray t ON sc.tray_id = t.id 
      WHERE t.jc_id=? AND sc.asal_relation_id=? AND sc.asal_core=?
    `).get(tray.jc_id, asalRelId, source_core);
    
    if (existingAsal) return res.status(409).json({ error: `Core asal #${source_core} sudah terpakai di Tray #${existingAsal.nomor_tray}` });

    const existingTujuan = db.prepare(`
      SELECT sc.id, t.nomor_tray 
      FROM splicing_core sc 
      JOIN tray t ON sc.tray_id = t.id 
      WHERE t.jc_id=? AND sc.tujuan_relation_id=? AND sc.tujuan_core=?
    `).get(tray.jc_id, tujuanRelId, target_core);
    
    if (existingTujuan) return res.status(409).json({ error: `Core tujuan #${target_core} sudah terpakai di Tray #${existingTujuan.nomor_tray}` });

    const result = db.prepare(`
      INSERT INTO splicing_core (tray_id, asal_relation_id, asal_core, tujuan_relation_id, tujuan_core, status_core, keterangan)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tray_id, asalRelId, source_core, tujuanRelId, target_core, status_core || 'used', keterangan || '');

    res.json({ id: result.lastInsertRowid, message: 'Core berhasil disambung' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/splices/:id', verifyToken, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM splicing_core WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Data splicing tidak ditemukan' });
    res.json({ message: 'Sambungan core berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Stats for dashboard
router.get('/stats', verifyToken, (req, res) => {
  try {
    const total_jc = db.prepare('SELECT COUNT(*) as c FROM joint_closure').get().c;
    const active_jc = db.prepare("SELECT COUNT(*) as c FROM joint_closure WHERE status_jc='active'").get().c;
    const total_splices = db.prepare('SELECT COUNT(*) as c FROM splicing_core').get().c;
    const total_trays = db.prepare('SELECT COUNT(*) as c FROM tray').get().c;
    res.json({ total_jc, active_jc, total_splices, total_trays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Activity Logs
router.get('/activity-logs', verifyToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    res.json(logs);
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
             k.nama_kabel, k.total_core, k.total_tube, k.jenis_kabel
      FROM kabel_jc_relation r
      JOIN kabel k ON r.kabel_id = k.id
      WHERE r.jc_id = ?
    `).all(req.params.id);

    const trays = db.prepare('SELECT * FROM tray WHERE jc_id = ? ORDER BY nomor_tray ASC').all(req.params.id);

    // Count splices per tray
    trays.forEach(t => {
      t.splice_count = db.prepare('SELECT COUNT(*) as c FROM splicing_core WHERE tray_id=?').get(t.id).c;
    });

    res.json({ ...jc, cables, trays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', verifyToken, (req, res) => {
  const { kode_jc, lokasi, koordinat, keterangan, status_jc } = req.body;
  try {
    const jc = db.prepare('SELECT * FROM joint_closure WHERE id=?').get(req.params.id);
    if (!jc) return res.status(404).json({ error: 'Joint Closure tidak ditemukan' });

    // Check duplicate kode_jc (exclude self)
    if (kode_jc && kode_jc !== jc.kode_jc) {
      const dup = db.prepare('SELECT id FROM joint_closure WHERE kode_jc=? AND id!=?').get(kode_jc, req.params.id);
      if (dup) return res.status(409).json({ error: `Kode JC "${kode_jc}" sudah digunakan` });
    }

    db.prepare('UPDATE joint_closure SET kode_jc=?, lokasi=?, koordinat=?, keterangan=?, status_jc=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(
        kode_jc ?? jc.kode_jc,
        lokasi ?? jc.lokasi,
        koordinat ?? jc.koordinat,
        keterangan ?? jc.keterangan,
        status_jc ?? jc.status_jc,
        req.params.id
      );
    logActivity(req.user.id, req.user.username, 'EDIT_JC', `Update JC: ${kode_jc || jc.kode_jc}`);
    res.json({ message: 'Joint Closure berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', verifyToken, (req, res) => {
  try {
    const jc = db.prepare('SELECT * FROM joint_closure WHERE id=?').get(req.params.id);
    if (!jc) return res.status(404).json({ error: 'Joint Closure tidak ditemukan' });

    db.prepare('DELETE FROM joint_closure WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, req.user.username, 'DELETE_JC', `Hapus JC: ${jc.kode_jc}`);
    res.json({ message: 'Joint Closure berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
