// Comptes parents : mot de passe scrypt, sessions en base (cookie HttpOnly), espace
// parent re-verrouille apres 15 minutes (il faut retaper le mot de passe).
const crypto = require('crypto');
const { promisify } = require('util');
const { db } = require('./db');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'cm_session';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const UNLOCK_MS = 15 * 60 * 1000;

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await scrypt(pw, salt, 64)).toString('hex')}`;
}
const DUMMY = `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`;
async function verifyPassword(pw, stored) {
  const [scheme, saltHex, hashHex] = String(stored || DUMMY).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(String(pw), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual) && !!stored; // compte inconnu : meme duree, jamais vrai
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function tokenFrom(req) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return ''; } }
  }
  return '';
}
// Racine de l'app vue du navigateur (ex. /cahier-malin/) : le cookie ne sort pas de la.
function rootPath(req) {
  const u = req.originalUrl.split('?')[0];
  const i = u.indexOf('/api');
  return (i >= 0 ? u.slice(0, i) : '') + '/';
}
function cookie(req, res, token, maxAgeMs) {
  const secure = req.secure || String(req.get('x-forwarded-proto') || '').split(',')[0] === 'https';
  res.append('Set-Cookie', [`${COOKIE}=${token}`, `Path=${rootPath(req)}`, `Max-Age=${Math.floor(maxAgeMs / 1000)}`, 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : ''].filter(Boolean).join('; '));
}

function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, Date.now() + SESSION_TTL_MS);
  cookie(req, res, token, SESSION_TTL_MS);
}
function endSession(req, res) {
  const t = tokenFrom(req);
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
  cookie(req, res, '', 0);
}

// Pose req.user (ou null) et req.session.
function loadUser(req, res, next) {
  req.user = null; req.session = null;
  const t = tokenFrom(req);
  if (t) {
    const row = db.prepare(`SELECT u.id, u.username, u.is_admin, u.voice, s.expires_at, s.parent_until, s.token_hash
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(t));
    if (row && row.expires_at > Date.now()) {
      req.user = { id: row.id, username: row.username, isAdmin: !!row.is_admin, voice: row.voice };
      req.session = { hash: row.token_hash, unlocked: row.parent_until > Date.now() };
    }
  }
  next();
}
function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Connexion nécessaire.', login: true });
  next();
}
function requireParent(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Connexion nécessaire.', login: true });
  if (!req.session.unlocked) return res.status(403).json({ error: 'Espace parent verrouillé.', locked: true });
  next();
}
function unlock(req) {
  db.prepare('UPDATE sessions SET parent_until = ? WHERE token_hash = ?').run(Date.now() + UNLOCK_MS, req.session.hash);
}
function lock(req) {
  db.prepare('UPDATE sessions SET parent_until = 0 WHERE token_hash = ?').run(req.session.hash);
}

// Freine les essais de mot de passe : 8 echecs / 15 min par adresse + identifiant.
const fails = new Map();
function throttle(key) {
  const now = Date.now();
  const f = (fails.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  fails.set(key, f);
  return f.length >= 8;
}
const noteFail = (key) => { const f = fails.get(key) || []; f.push(Date.now()); fails.set(key, f); };
const clearFails = (key) => fails.delete(key);

module.exports = { hashPassword, verifyPassword, startSession, endSession, loadUser, requireUser, requireParent, unlock, lock, throttle, noteFail, clearFails, rootPath };
