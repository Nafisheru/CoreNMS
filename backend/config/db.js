// backend/config/db.js
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, '../../database.sqlite'));

// Optimasi SQLite untuk stabilitas & performa (seperti di ZTENMS)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'technician',
    whatsapp TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- MASTER KABEL
  CREATE TABLE IF NOT EXISTS kabel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_kabel TEXT NOT NULL,
    jenis_kabel TEXT,
    total_core INTEGER DEFAULT 0,
    total_tube INTEGER DEFAULT 0,
    keterangan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- JOINT CLOSURE (JC)
  CREATE TABLE IF NOT EXISTS joint_closure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_jc TEXT UNIQUE NOT NULL,
    lokasi TEXT,
    koordinat TEXT,
    status_jc TEXT DEFAULT 'active',
    keterangan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- RELASI KABEL DI DALAM JC (SISI A / B)
  CREATE TABLE IF NOT EXISTS kabel_jc_relation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jc_id INTEGER,
    kabel_id INTEGER,
    sisi_kabel TEXT, -- SISI A / SISI B / IN / OUT
    arah_kabel TEXT, -- ARAH KE OLT / ARAH KE ODP
    keterangan TEXT,
    FOREIGN KEY (jc_id) REFERENCES joint_closure(id) ON DELETE CASCADE,
    FOREIGN KEY (kabel_id) REFERENCES kabel(id) ON DELETE RESTRICT
  );

  -- TRAY DI DALAM JC
  CREATE TABLE IF NOT EXISTS tray (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jc_id INTEGER,
    nomor_tray INTEGER,
    kapasitas_tray INTEGER DEFAULT 24,
    keterangan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jc_id) REFERENCES joint_closure(id) ON DELETE CASCADE
  );

  -- SPLICING CORE MAPPING
  CREATE TABLE IF NOT EXISTS splicing_core (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tray_id INTEGER,
    asal_relation_id INTEGER,
    asal_tube INTEGER,
    asal_core INTEGER,
    tujuan_relation_id INTEGER,
    tujuan_tube INTEGER,
    tujuan_core INTEGER,
    status_core TEXT DEFAULT 'used', -- used, broken, reserve, idle
    keterangan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tray_id) REFERENCES tray(id) ON DELETE CASCADE,
    FOREIGN KEY (asal_relation_id) REFERENCES kabel_jc_relation(id),
    FOREIGN KEY (tujuan_relation_id) REFERENCES kabel_jc_relation(id)
  );
`);

// Seed Admin if not exists
const adminCount = db.prepare('SELECT count(*) as count FROM users WHERE role = ?').get('admin');
if (adminCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
    .run('admin', hash, 'Administrator', 'admin');
  console.log('[DB] Default admin created (admin / admin123)');
}

module.exports = db;
