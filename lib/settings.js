// Reglages du serveur, modifiables par l'administrateur dans l'espace parent (aucune
// variable d'environnement a gerer). La cle Gemini est chiffree (AES-256-GCM) avec une
// cle locale data/secret.key, creee toute seule : a garder avec data/ sur le serveur.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, DATA_DIR } = require('./db');

const DEFAULTS = { gemini_model: 'gemini-2.5-flash', gemini_tts_model: 'gemini-2.5-flash-preview-tts', gemini_voice: 'Kore' };

function get(key) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : (DEFAULTS[key] || '');
}
function set(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, String(value));
}
const del = (key) => db.prepare('DELETE FROM settings WHERE key = ?').run(key);

let cachedSecret = null;
function secretKey() {
  if (cachedSecret) return cachedSecret;
  const file = path.join(DATA_DIR, 'secret.key');
  try { cachedSecret = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex'); } catch (e) { /* a creer */ }
  if (!cachedSecret || cachedSecret.length !== 32) {
    cachedSecret = crypto.randomBytes(32);
    fs.writeFileSync(file, cachedSecret.toString('hex'), { mode: 0o600 });
  }
  return cachedSecret;
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}
function decrypt(stored) {
  try {
    const [v, iv, tag, ct] = String(stored).split(':');
    if (v !== 'v1') return '';
    const d = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch (e) { return ''; } // secret.key perdu ou base d'une autre machine : cle a ressaisir
}
const setSecret = (key, plain) => set(key, encrypt(plain));
const getSecret = (key) => { const v = get(key); return v ? decrypt(v) : ''; };

// Cle Gemini : reglage de l'app d'abord ; data/gemini.key et GEMINI_API_KEY ne servent
// que de repli (anciennes installations, tests).
function geminiKey() {
  const k = getSecret('gemini_key');
  if (k) return k;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try { return fs.readFileSync(path.join(DATA_DIR, 'gemini.key'), 'utf8').trim(); } catch (e) { return ''; }
}
function gemini() {
  return {
    key: geminiKey(),
    model: get('gemini_model') || DEFAULTS.gemini_model,
    ttsModel: get('gemini_tts_model') || DEFAULTS.gemini_tts_model,
    voice: get('gemini_voice') || DEFAULTS.gemini_voice,
    base: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
  };
}

module.exports = { get, set, del, setSecret, getSecret, geminiKey, gemini, DEFAULTS };
