// Base SQLite du Cahier Malin : listes de mots et progression par profil (prenom
// choisi sur l'appareil), plus le cache des declinaisons deja demandees a l'IA.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.CAHIER_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'cahier.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Migrations : PRAGMA user_version = nombre de migrations deja appliquees.
const MIGRATIONS = [
  `CREATE TABLE lists (
     profile TEXT NOT NULL,
     id TEXT NOT NULL,
     name TEXT NOT NULL,
     words TEXT NOT NULL,            -- JSON [{w, s}]
     position INTEGER NOT NULL,
     PRIMARY KEY (profile, id)
   );
   CREATE TABLE kv (
     profile TEXT NOT NULL,
     key TEXT NOT NULL,              -- progress | stars | settings | gradeFloors
     value TEXT NOT NULL,            -- JSON
     updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (profile, key)
   );
   CREATE TABLE declinaisons (
     cle TEXT PRIMARY KEY,           -- mot|options
     result TEXT NOT NULL,           -- JSON
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   );`,
];
let version = db.prepare('PRAGMA user_version').get().user_version;
for (; version < MIGRATIONS.length; version++) {
  db.exec('BEGIN');
  try {
    db.exec(MIGRATIONS[version]);
    db.exec(`PRAGMA user_version = ${version + 1}`);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

const KEYS = ['progress', 'stars', 'settings', 'gradeFloors'];

function getState(profile) {
  const lists = db.prepare('SELECT id, name, words FROM lists WHERE profile = ? ORDER BY position').all(profile)
    .map((r) => ({ id: r.id, name: r.name, words: JSON.parse(r.words) }));
  const kv = {};
  for (const r of db.prepare('SELECT key, value FROM kv WHERE profile = ?').all(profile)) kv[r.key] = JSON.parse(r.value);
  const exists = lists.length > 0 || Object.keys(kv).length > 0;
  return { exists, lists, ...kv };
}

function saveState(profile, s) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM lists WHERE profile = ?').run(profile);
    const ins = db.prepare('INSERT INTO lists (profile, id, name, words, position) VALUES (?, ?, ?, ?, ?)');
    s.lists.forEach((l, i) => ins.run(profile, l.id, l.name, JSON.stringify(l.words), i));
    const up = db.prepare(`INSERT INTO kv (profile, key, value) VALUES (?, ?, ?)
      ON CONFLICT (profile, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`);
    for (const k of KEYS) if (s[k] !== undefined) up.run(profile, k, JSON.stringify(s[k]));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function getCache(cle) {
  const r = db.prepare('SELECT result FROM declinaisons WHERE cle = ?').get(cle);
  return r ? JSON.parse(r.result) : null;
}
function setCache(cle, result) {
  db.prepare('INSERT OR REPLACE INTO declinaisons (cle, result) VALUES (?, ?)').run(cle, JSON.stringify(result));
}

module.exports = { DATA_DIR, getState, saveState, getCache, setCache };
