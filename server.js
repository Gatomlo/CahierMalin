// Le Cahier Malin : serveur Express. Seul (npm start, PORT) ou monte dans node-gateway
// sur /cahier-malin (dossier apps/cahier-malin) : le module exporte l'app, et n'ecoute
// un port ou n'installe de gestionnaire global que s'il est lance directement.
const path = require('path');
const express = require('express');
const db = require('./lib/db');
const forms = require('./lib/forms');

if (require.main === module) {
  const fatal = (kind) => (err) => { console.error(`${kind} :`, err); process.exit(1); };
  process.on('uncaughtException', fatal('Erreur non interceptee'));
  process.on('unhandledRejection', fatal('Promesse rejetee non geree'));
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});

// Page unique : la racine doit finir par "/" pour que les adresses relatives (api/...)
// fonctionnent aussi sous /cahier-malin.
app.get('/', (req, res, next) => {
  const [p, q] = req.originalUrl.split('?');
  if (!p.endsWith('/')) return res.redirect(301, p + '/' + (q ? '?' + q : ''));
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));

/* ---------------- API ---------------- */
const api = express.Router();
api.use(express.json({ limit: '1mb' }));
api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Profil = prenom choisi sur l'appareil (en-tete X-Profil) : pas de compte, ce sont
// des listes de mots, pas des donnees sensibles.
function profile(req, res, next) {
  const p = String(req.get('x-profil') || '').trim();
  if (!/^[\p{L}\p{N} _-]{1,30}$/u.test(p)) return res.status(400).json({ error: 'Profil invalide.' });
  req.profile = p.toLowerCase();
  next();
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function checkState(b) {
  if (!isObj(b) || !Array.isArray(b.lists) || b.lists.length > 200) return 'Données invalides.';
  for (const l of b.lists) {
    if (!isObj(l) || typeof l.id !== 'string' || typeof l.name !== 'string' || !Array.isArray(l.words) || l.words.length > 500) return 'Liste invalide.';
    if (l.id.length > 60 || l.name.length > 120) return 'Liste invalide.';
    for (const w of l.words) if (!isObj(w) || typeof w.w !== 'string' || w.w.length > 120 || (w.s !== undefined && typeof w.s !== 'string')) return 'Mot invalide.';
  }
  if (b.progress !== undefined && !isObj(b.progress)) return 'Progression invalide.';
  if (b.settings !== undefined && !isObj(b.settings)) return 'Réglages invalides.';
  if (b.gradeFloors !== undefined && !isObj(b.gradeFloors)) return 'Niveaux invalides.';
  if (b.stars !== undefined && !Number.isFinite(b.stars)) return 'Étoiles invalides.';
  return null;
}

api.get('/state', profile, (req, res) => res.json(db.getState(req.profile)));
api.put('/state', profile, (req, res) => {
  const err = checkState(req.body);
  if (err) return res.status(400).json({ error: err });
  db.saveState(req.profile, req.body);
  res.json({ ok: true });
});

api.get('/config', (req, res) => res.json({ gemini: forms.hasGemini(), temps: forms.TEMPS }));

// Limite simple : l'IA est payante, on borne les appels (global, par minute).
let window_ = { start: 0, n: 0 };
function limit(req, res, next) {
  const now = Date.now();
  if (now - window_.start > 60000) window_ = { start: now, n: 0 };
  if (++window_.n > 20) return res.status(429).json({ error: 'Trop de demandes, réessaie dans une minute.' });
  next();
}
api.post('/declinaisons', profile, limit, async (req, res, next) => {
  try {
    const b = req.body || {};
    res.json(await forms.decline(b.mots, b.options));
  } catch (e) { next(e); }
});

api.use((req, res) => res.status(404).json({ error: 'Adresse inconnue.' }));
api.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  if (status >= 500 && !err.expose) console.error(err);
  res.status(status).json({ error: status >= 500 && !err.expose ? 'Erreur interne du serveur.' : err.message });
});
app.use('/api', api);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Le Cahier Malin : http://localhost:${PORT}/`));
}
module.exports = app;
