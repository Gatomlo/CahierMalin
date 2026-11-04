// Requetes sur comptes, profils enfants, journal des essais, copie et export de listes.
// Les listes et la progression d'un profil sont rangees sous la cle 'p<id>' (tables lists/kv).
const { db, getState, saveState } = require('./db');

const key = (id) => 'p' + id;

/* ---------------- comptes ---------------- */
const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const userByName = (name) => db.prepare('SELECT * FROM users WHERE username = ?').get(name);
function createUser(username, passHash, isAdmin) {
  return Number(db.prepare('INSERT INTO users (username, pass_hash, is_admin) VALUES (?, ?, ?)').run(username, passHash, isAdmin ? 1 : 0).lastInsertRowid);
}
const listUsers = () => db.prepare(`SELECT u.id, u.username, u.is_admin AS isAdmin, u.created_at AS createdAt,
  (SELECT COUNT(*) FROM profiles p WHERE p.user_id = u.id) AS profiles FROM users u ORDER BY u.id`).all();

function wipeProfileData(k) {
  db.prepare('DELETE FROM lists WHERE profile = ?').run(k);
  db.prepare('DELETE FROM kv WHERE profile = ?').run(k);
  db.prepare('DELETE FROM attempts WHERE profile = ?').run(k);
}
function deleteUser(id) {
  db.exec('BEGIN');
  try {
    for (const p of db.prepare('SELECT id FROM profiles WHERE user_id = ?').all(id)) wipeProfileData(key(p.id));
    db.prepare('DELETE FROM users WHERE id = ?').run(id); // profils et sessions suivent (ON DELETE CASCADE)
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
const setPassword = (id, hash) => db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, id);
const setVoice = (id, voice) => db.prepare('UPDATE users SET voice = ? WHERE id = ?').run(voice, id);

/* ---------------- profils ---------------- */
const profilesOf = (userId) => db.prepare('SELECT id, name FROM profiles WHERE user_id = ? ORDER BY id').all(userId);
const getProfile = (userId, id) => db.prepare('SELECT id, name FROM profiles WHERE id = ? AND user_id = ?').get(id, userId);
const addProfile = (userId, name) => Number(db.prepare('INSERT INTO profiles (user_id, name) VALUES (?, ?)').run(userId, name).lastInsertRowid);
const renameProfile = (id, name) => db.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name, id);
function deleteProfile(id) {
  db.exec('BEGIN');
  try { wipeProfileData(key(id)); db.prepare('DELETE FROM profiles WHERE id = ?').run(id); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

// Premier compte : reprend les profils "libres" d'avant les comptes (cle = prenom).
function claimLegacy(userId) {
  const olds = db.prepare(`SELECT profile AS p FROM lists UNION SELECT profile FROM kv`).all().map((r) => r.p).filter((p) => !/^p\d+$/.test(p));
  let n = 0;
  for (const old of olds) {
    const id = addProfile(userId, old.charAt(0).toUpperCase() + old.slice(1));
    db.prepare('UPDATE lists SET profile = ? WHERE profile = ?').run(key(id), old);
    db.prepare('UPDATE kv SET profile = ? WHERE profile = ?').run(key(id), old);
    n++;
  }
  return n;
}

/* ---------------- reglages, listes ---------------- */
function mergeSettings(id, patch) {
  const s = getState(key(id));
  saveState(key(id), { lists: s.lists, settings: Object.assign({}, s.settings || {}, patch) });
}
const stateOf = (id) => { const s = getState(key(id)); delete s.exists; return s; };

function newId() { return 'list_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function addLists(id, lists) {
  const s = getState(key(id));
  const added = lists.map((l) => ({ id: newId(), name: l.name, words: l.words }));
  saveState(key(id), { lists: s.lists.concat(added) });
  return added.length;
}
function copyList(fromId, toId, listId) {
  const l = getState(key(fromId)).lists.find((x) => x.id === listId);
  if (!l) return 0;
  return addLists(toId, [{ name: l.name, words: l.words.map((w) => Object.assign({}, w)) }]);
}

/* ---------------- journal des essais, suivi ---------------- */
function logAttempts(id, events) {
  const ins = db.prepare('INSERT INTO attempts (profile, at, kind, list_name, mode, word, ok) VALUES (?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  try { for (const e of events) ins.run(key(id), e.at, e.kind, e.list, e.mode, e.word, e.ok ? 1 : 0); db.exec('COMMIT'); }
  catch (err) { db.exec('ROLLBACK'); throw err; }
}

const DAY = 86400000;
function suivi(id) {
  const k = key(id), now = Date.now();
  const q = (sql, ...a) => db.prepare(sql).all(...a);
  const byDay = {};
  q(`SELECT strftime('%Y-%m-%d', at/1000, 'unixepoch', 'localtime') AS d, COUNT(*) AS n, SUM(ok) AS ok
     FROM attempts WHERE profile = ? AND at >= ? GROUP BY d`, k, now - 14 * DAY).forEach((r) => { byDay[r.d] = r; });
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ d: ds, n: byDay[ds] ? byDay[ds].n : 0, ok: byDay[ds] ? byDay[ds].ok : 0 });
  }
  const since = now - 90 * DAY;
  const total = q('SELECT COUNT(*) AS n, SUM(ok) AS ok, MAX(at) AS last FROM attempts WHERE profile = ? AND at >= ?', k, since)[0];
  const jeux = q('SELECT mode, COUNT(*) AS n, SUM(ok) AS ok FROM attempts WHERE profile = ? AND at >= ? GROUP BY mode ORDER BY n DESC', k, since);
  const mots = q(`SELECT word, list_name AS list, COUNT(*) AS n, SUM(ok) AS ok, SUM(1 - ok) AS ko FROM attempts
    WHERE profile = ? AND at >= ? GROUP BY word, list_name HAVING ko > 0 ORDER BY ko DESC, n DESC LIMIT 15`, k, since);
  const st = getState(k);
  const target = Math.max(1, parseInt(st.settings && st.settings.target, 10) || 3);
  const listes = st.lists.map((l) => {
    const prog = (st.progress || {})[l.id] || {};
    const acquis = l.words.filter((w) => Object.keys((prog[w.w] && prog[w.w].modes) || {}).length >= target).length;
    return { name: l.name, mots: l.words.length, acquis };
  });
  return { days, total: { n: total.n, ok: total.ok || 0, last: total.last }, jeux, mots, listes, target };
}

module.exports = { key, userCount, userByName, createUser, listUsers, deleteUser, setPassword, setVoice, profilesOf, getProfile, addProfile, renameProfile, deleteProfile, claimLegacy, mergeSettings, stateOf, addLists, copyList, logAttempts, suivi };
