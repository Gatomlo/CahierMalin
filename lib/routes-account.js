// Routes comptes et espace parent. Public : /me, /setup, /login, /logout.
// Connecte : /unlock, /lock. Espace parent deverrouille (mot de passe retape) : le reste.
const express = require('express');
const auth = require('./auth');
const acc = require('./accounts');
const tts = require('./tts');
const settings = require('./settings');
const forms = require('./forms');

const router = express.Router();
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,29}$/u;
const USER_RE = /^[\p{L}\p{N}._@-]{3,40}$/u;
const pwOk = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 100;
const ipKey = (req, name) => `${req.ip}|${String(name || '').toLowerCase()}`;

function me(req) {
  return {
    user: req.user ? { username: req.user.username, isAdmin: req.user.isAdmin, voice: req.user.voice } : null,
    needsSetup: acc.userCount() === 0,
    profiles: req.user ? acc.profilesOf(req.user.id) : [],
    unlocked: !!(req.session && req.session.unlocked),
    voices: tts.VOICES,
  };
}
router.get('/me', (req, res) => res.json(me(req)));

// Tout premier compte : administrateur, reprend les profils d'avant les comptes.
router.post('/setup', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (acc.userCount() > 0) return bad(res, 'Un compte existe déjà.', 409);
    if (!USER_RE.test(String(username))) return bad(res, 'Identifiant : 3 à 40 caractères (lettres, chiffres, . _ - @).');
    if (!pwOk(password)) return bad(res, 'Mot de passe : 8 caractères au minimum.');
    const id = acc.createUser(String(username), await auth.hashPassword(password), true);
    const claimed = acc.claimLegacy(id);
    if (!claimed && !acc.profilesOf(id).length) acc.addProfile(id, 'Élève');
    auth.startSession(req, res, id);
    req.user = { id, username, isAdmin: true, voice: 'Kore' };
    req.session = { unlocked: false };
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const k = ipKey(req, username);
    if (auth.throttle(k)) return bad(res, 'Trop d’essais, réessaie dans quelques minutes.', 429);
    const u = acc.userByName(String(username || ''));
    if (!(await auth.verifyPassword(password, u && u.pass_hash))) { auth.noteFail(k); return bad(res, 'Identifiant ou mot de passe incorrect.', 401); }
    auth.clearFails(k);
    auth.startSession(req, res, u.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/logout', (req, res) => { auth.endSession(req, res); res.json({ ok: true }); });

router.post('/unlock', auth.requireUser, async (req, res, next) => {
  try {
    const k = ipKey(req, req.user.username) + '|unlock';
    if (auth.throttle(k)) return bad(res, 'Trop d’essais, réessaie dans quelques minutes.', 429);
    const u = acc.userByName(req.user.username);
    if (!(await auth.verifyPassword((req.body || {}).password, u.pass_hash))) { auth.noteFail(k); return bad(res, 'Mot de passe incorrect.', 401); }
    auth.clearFails(k);
    auth.unlock(req);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/lock', auth.requireUser, (req, res) => { auth.lock(req); res.json({ ok: true }); });

/* ---------------- espace parent ---------------- */
const parent = express.Router();
router.use('/parent', auth.requireParent, parent);

// Profil cible : doit appartenir au compte connecte.
parent.param('pid', (req, res, next, pid) => {
  const p = acc.getProfile(req.user.id, parseInt(pid, 10));
  if (!p) return bad(res, 'Profil inconnu.', 404);
  req.target = p;
  next();
});

parent.get('/profiles', (req, res) => res.json({ profiles: acc.profilesOf(req.user.id).map((p) => {
  const s = acc.stateOf(p.id);
  return { id: p.id, name: p.name, target: (s.settings && s.settings.target) || 3, lists: s.lists.map((l) => ({ id: l.id, name: l.name, mots: l.words.length })) };
}) }));
parent.post('/profiles', (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!NAME_RE.test(name)) return bad(res, 'Prénom : 30 caractères au plus (lettres, chiffres).');
  if (acc.profilesOf(req.user.id).length >= 12) return bad(res, '12 profils au maximum.');
  res.json({ id: acc.addProfile(req.user.id, name) });
});
parent.patch('/profiles/:pid', (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!NAME_RE.test(name)) return bad(res, 'Prénom invalide.');
  acc.renameProfile(req.target.id, name);
  res.json({ ok: true });
});
parent.delete('/profiles/:pid', (req, res) => {
  if (acc.profilesOf(req.user.id).length <= 1) return bad(res, 'Garde au moins un profil.');
  acc.deleteProfile(req.target.id);
  res.json({ ok: true });
});
parent.put('/profiles/:pid/settings', (req, res) => {
  const t = parseInt((req.body || {}).target, 10);
  if (!(t >= 1 && t <= 10)) return bad(res, 'Réglage invalide (1 à 10).');
  acc.mergeSettings(req.target.id, { target: t });
  res.json({ ok: true });
});
parent.get('/profiles/:pid/suivi', (req, res) => res.json(acc.suivi(req.target.id)));

// Export / import / copie de listes
parent.get('/profiles/:pid/export', (req, res) => {
  const s = acc.stateOf(req.target.id);
  res.set('Content-Disposition', `attachment; filename="cahier-malin-${req.target.id}.json"`);
  res.json({ format: 'cahier-malin', version: 1, profil: req.target.name, lists: s.lists, progress: s.progress, settings: s.settings, stars: s.stars });
});
parent.post('/profiles/:pid/import', (req, res) => {
  const b = req.body || {};
  const lists = Array.isArray(b.lists) ? b.lists.slice(0, 100) : null;
  if (b.format !== 'cahier-malin' || !lists) return bad(res, 'Ce fichier n’est pas une sauvegarde du Cahier Malin.');
  const clean = [];
  for (const l of lists) {
    if (!l || typeof l.name !== 'string' || !Array.isArray(l.words)) continue;
    const words = l.words.slice(0, 500).filter((w) => w && typeof w.w === 'string' && w.w.trim() && w.w.length <= 120)
      .map((w) => ({ w: w.w.trim(), s: typeof w.s === 'string' ? w.s.slice(0, 220) : '', ...(typeof w.g === 'string' && w.g.length <= 120 ? { g: w.g } : {}) }));
    if (words.length) clean.push({ name: l.name.slice(0, 120), words });
  }
  if (!clean.length) return bad(res, 'Aucune liste exploitable dans ce fichier.');
  res.json({ added: acc.addLists(req.target.id, clean) });
});
parent.post('/copy', (req, res) => {
  const { from, to, listId } = req.body || {};
  const a = acc.getProfile(req.user.id, parseInt(from, 10)), b = acc.getProfile(req.user.id, parseInt(to, 10));
  if (!a || !b || a.id === b.id) return bad(res, 'Profils invalides.');
  if (!acc.copyList(a.id, b.id, String(listId))) return bad(res, 'Liste introuvable.', 404);
  res.json({ ok: true });
});

// Compte
parent.put('/voice', (req, res) => {
  const v = (req.body || {}).voice;
  if (!tts.VOICES.includes(v)) return bad(res, 'Voix inconnue.');
  acc.setVoice(req.user.id, v);
  res.json({ ok: true });
});
parent.put('/password', async (req, res, next) => {
  try {
    const { old, password } = req.body || {};
    const u = acc.userByName(req.user.username);
    if (!(await auth.verifyPassword(old, u.pass_hash))) return bad(res, 'Ancien mot de passe incorrect.', 401);
    if (!pwOk(password)) return bad(res, 'Mot de passe : 8 caractères au minimum.');
    acc.setPassword(req.user.id, await auth.hashPassword(password));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Administrateur : autres comptes parents (une famille chacun)
const admin = (req, res, next) => (req.user.isAdmin ? next() : bad(res, 'Réservé à l’administrateur.', 403));
parent.get('/users', admin, (req, res) => res.json({ users: acc.listUsers() }));
parent.post('/users', admin, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!USER_RE.test(String(username))) return bad(res, 'Identifiant : 3 à 40 caractères (lettres, chiffres, . _ - @).');
    if (!pwOk(password)) return bad(res, 'Mot de passe : 8 caractères au minimum.');
    if (acc.userByName(String(username))) return bad(res, 'Cet identifiant existe déjà.', 409);
    const id = acc.createUser(String(username), await auth.hashPassword(password), false);
    acc.addProfile(id, 'Élève');
    res.json({ id });
  } catch (e) { next(e); }
});
parent.delete('/users/:id', admin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return bad(res, 'Tu ne peux pas supprimer ton propre compte.');
  acc.deleteUser(id);
  res.json({ ok: true });
});

// Reglages du serveur (administrateur) : cle Gemini chiffree, modeles, voix par defaut.
function adminSettings() {
  const g = settings.gemini();
  const stored = !!settings.getSecret('gemini_key');
  return {
    keySet: !!g.key, keyHint: g.key ? g.key.slice(-4) : '',
    keySource: stored ? 'app' : (g.key ? 'ancienne installation' : ''),
    model: g.model, ttsModel: g.ttsModel, voice: g.voice, voices: tts.VOICES,
    defaults: { model: settings.DEFAULTS.gemini_model, ttsModel: settings.DEFAULTS.gemini_tts_model },
  };
}
parent.get('/admin/settings', admin, (req, res) => res.json(adminSettings()));
parent.put('/admin/settings', admin, (req, res) => {
  const b = req.body || {};
  const MODEL_RE = /^[\w.-]{1,60}$/;
  if (b.model !== undefined && !MODEL_RE.test(b.model)) return bad(res, 'Nom de modèle invalide.');
  if (b.ttsModel !== undefined && !MODEL_RE.test(b.ttsModel)) return bad(res, 'Nom de modèle vocal invalide.');
  if (b.voice !== undefined && !tts.VOICES.includes(b.voice)) return bad(res, 'Voix inconnue.');
  if (typeof b.geminiKey === 'string' && b.geminiKey.trim()) {
    const k = b.geminiKey.trim();
    if (!/^[\w-]{20,200}$/.test(k)) return bad(res, 'Cette clé ne ressemble pas à une clé Gemini.');
    settings.setSecret('gemini_key', k);
  } else if (b.clearKey === true) {
    settings.del('gemini_key');
  }
  if (b.model !== undefined) settings.set('gemini_model', b.model);
  if (b.ttsModel !== undefined) settings.set('gemini_tts_model', b.ttsModel);
  if (b.voice !== undefined) settings.set('gemini_voice', b.voice);
  res.json(adminSettings());
});
parent.post('/admin/test-gemini', admin, async (req, res, next) => {
  try { res.json({ ok: await forms.testGemini() }); } catch (e) { next(e); }
});

module.exports = router;
