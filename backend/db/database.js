const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "journal.db");

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
  }
  return db;
}

function initSchema() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS journal_entries (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        ambience    TEXT NOT NULL,
        text        TEXT NOT NULL,
        emotion     TEXT,
        keywords    TEXT,
        summary     TEXT,
        analyzed_at TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_journal_created ON journal_entries(created_at)`);
      db.run(`CREATE TABLE IF NOT EXISTS analysis_cache (
        text_hash   TEXT PRIMARY KEY,
        emotion     TEXT NOT NULL,
        keywords    TEXT NOT NULL,
        summary     TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { getDb, initSchema, dbRun, dbGet, dbAll };
