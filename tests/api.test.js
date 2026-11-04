// API sur donnees temporaires + faux serveur Gemini. Les variables d'environnement
// doivent etre posees avant de charger server.js (la base s'ouvre au chargement).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

process.env.CAHIER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cahier-'));
delete process.env.GEMINI_API_KEY;

const dbm = require('../lib/db');
// Profil libre d'avant les comptes : doit etre repris par le premier compte
dbm.saveState('lea', { lists: [{ id: 'old', name: 'Ancienne', words: [{ w: 'maison', s: '' }] }], stars: 7 });
const app = require('../server');
let base, cookie = '', PID_OLD, PID_NEW, fake, srv, fakeCalls = 0, ttsCalls = 0;

test.before(async () => {
  fake = http.createServer((req, res) => {
    fakeCalls++;
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method === 'GET' && req.url.includes('/models')) {
        res.setHeader('content-type', 'application/json');
        const m = (name, methods = ['generateContent']) => ({ name: 'models/' + name, displayName: name, supportedGenerationMethods: methods });
        return res.end(JSON.stringify({ models: [m('gemini-2.5-flash'), m('gemini-2.5-pro'), m('gemini-2.5-flash-preview-tts'), m('gemini-2.5-flash-image'), m('text-embedding-004', ['embedContent']), m('gemma-3-27b-it')] }));
      }
      const prompt = JSON.parse(body).contents[0].parts[0].text;
      res.setHeader('content-type', 'application/json');
      if (req.url.includes('tts')) {
        ttsCalls++;
        return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(4800).toString('base64') } }] } }] }));
      }
      if (prompt.includes('courte aventure')) {
        const chapitres = [{ decor: 'La forêt', phrase: 'Lina marche beaucoup dans la forêt.' }, { decor: 'Le pont', phrase: 'Tout à coup, une hirondelle passe.' }, { decor: 'Fin', phrase: 'Elle rentre à la maison.' }];
        return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ titre: 'Lina', chapitres }) }] } }] }));
      }
      const mots = [{ mot: 'finir', nature: 'verbe', formes: [
        { texte: 'nous finissons', type: 'conjugaison', libelle: 'présent', phrase: 'Nous finissons le travail.' },
        { texte: 'je finis', type: 'conjugaison', libelle: 'présent', phrase: 'Phrase sans la forme.' },
        { texte: 'finir', type: 'conjugaison', libelle: 'infinitif', phrase: '' },
        { texte: 'pirate', type: 'inconnu', libelle: 'x', phrase: '' },
      ] }];
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ mots }) }] } }] }));
    });
  });
  await new Promise((r) => fake.listen(0, r));
  await new Promise((r) => { srv = app.listen(0, () => { base = `http://127.0.0.1:${srv.address().port}`; r(); }); });
  // premier compte (administrateur), puis espace parent et un profil neuf
  const setup = await fetch(base + '/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'parent', password: 'motdepasse1' }) });
  assert.equal(setup.status, 200);
  cookie = setup.headers.get('set-cookie').split(';')[0];
  const me = await (await call('/api/me', { headers: { 'x-profil': '0' } })).json();
  PID_OLD = me.profiles[0].id;
  await call('/api/unlock', { method: 'POST', body: JSON.stringify({ password: 'motdepasse1' }) });
  PID_NEW = (await (await call('/api/parent/profiles', { method: 'POST', body: JSON.stringify({ name: 'Neuf' }) })).json()).id;
});
test.after(() => { if (fake) fake.close(); if (srv) srv.close(); });

const call = (p, opts = {}) => fetch(base + p, { ...opts, headers: { 'content-type': 'application/json', cookie, 'x-profil': String(PID_NEW), ...(opts.headers || {}) } });

test('racine sans slash redirigee, page servie', async () => {
  const r = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Cahier Malin/);
});

test('connexion obligatoire, profil du compte obligatoire', async () => {
  assert.equal((await fetch(base + '/api/state', { headers: { 'x-profil': String(PID_NEW) } })).status, 401);
  assert.equal((await call('/api/state', { headers: { 'x-profil': '9999' } })).status, 400);
  assert.equal((await fetch(base + '/api/state', { method: 'PUT', headers: { cookie, 'x-profil': String(PID_NEW) }, body: '{}' })).status, 415);
});

test('etat : vide puis sauvegarde puis relecture, par profil', async () => {
  let s = await (await call('/api/state')).json();
  assert.equal(s.exists, false);
  const body = { lists: [{ id: 'a', name: 'Dictée 1', words: [{ w: 'maison', s: 'Ma maison.' }] }], progress: { a: { maison: { modes: { quiz: 1 } } } }, stars: 5, settings: { target: 2 }, gradeFloors: {} };
  assert.equal((await call('/api/state', { method: 'PUT', body: JSON.stringify(body) })).status, 200);
  s = await (await call('/api/state')).json();
  assert.equal(s.exists, true);
  assert.equal(s.lists[0].words[0].w, 'maison');
  assert.equal(s.stars, 5);
  assert.equal(s.settings.target, 2);
  const old = await (await call('/api/state', { headers: { 'x-profil': String(PID_OLD) } })).json();
  assert.equal(old.lists[0].name, 'Ancienne'); // profil d'avant les comptes repris
  assert.equal(old.stars, 7);
  const bad = await call('/api/state', { method: 'PUT', body: JSON.stringify({ lists: [{ id: 1 }] }) });
  assert.equal(bad.status, 400);
});

test('declinaisons sans cle : regles locales pour les groupes nominaux', async () => {
  const r = await call('/api/declinaisons', { method: 'POST', body: JSON.stringify({ mots: ['une hirondelle', "l'animal", 'des chevaux', 'beaucoup'], options: { nombre: true } }) });
  const d = await r.json();
  assert.equal(d.source, 'regles');
  assert.equal(d.mots[0].formes[0].texte, 'des hirondelles');
  assert.equal(d.mots[1].formes[0].texte, 'les animaux');
  assert.equal(d.mots[2].formes[0].texte, 'un cheval');
  assert.equal(d.mots[3].formes.length, 0);
});

test('declinaisons : au moins un type, mots bornes', async () => {
  assert.equal((await call('/api/declinaisons', { method: 'POST', body: JSON.stringify({ mots: ['a'], options: {} }) })).status, 400);
  const many = Array.from({ length: 30 }, (_, i) => 'mot' + i);
  assert.equal((await call('/api/declinaisons', { method: 'POST', body: JSON.stringify({ mots: many, options: { nombre: true } }) })).status, 400);
});

test('declinaisons avec Gemini : nettoyage, cache', async () => {
  process.env.GEMINI_API_KEY = 'cle-test';
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  const req = { mots: ['finir'], options: { conjugaison: true, temps: ['présent'] } };
  const d = await (await call('/api/declinaisons', { method: 'POST', body: JSON.stringify(req) })).json();
  assert.equal(d.source, 'gemini');
  const f = d.mots[0].formes;
  assert.equal(f.length, 2); // "finir" (mot d'origine) et le type inconnu sont ecartes
  assert.equal(f[0].phrase, 'Nous finissons le travail.');
  assert.equal(f[1].phrase, ''); // phrase sans la forme : retiree
  const again = await (await call('/api/declinaisons', { method: 'POST', body: JSON.stringify(req) })).json();
  assert.equal(again.source, 'cache');
  assert.equal(fakeCalls, 1);
  delete process.env.GEMINI_API_KEY;
});

test('conjugaison sans cle : verbes reguliers, personnes choisies', async () => {
  const post = (verbes) => call('/api/conjugaison', { method: 'POST', body: JSON.stringify({ verbes }) });
  let d = await (await post([{ verbe: 'chanter', temps: 'présent' }])).json();
  assert.deepEqual(d.verbes[0].formes.map((f) => f.texte), ['je chante', 'tu chantes', 'il chante', 'nous chantons', 'vous chantez', 'ils chantent']);
  d = await (await post([{ verbe: 'finir', temps: 'passé composé', personnes: ['nous', 'je'] }])).json();
  assert.deepEqual(d.verbes[0].formes.map((f) => f.texte), ["j'ai fini", 'nous avons fini']);
  const bad = await post([{ verbe: 'aller', temps: 'présent' }]);
  assert.equal(bad.status, 422);
  assert.equal((await post([{ verbe: 'chanter', temps: 'inconnu' }])).status, 400);
});

test('phrases : cle Gemini requise', async () => {
  const r = await call('/api/phrases', { method: 'POST', body: JSON.stringify({ mots: ['maison'] }) });
  assert.equal(r.status, 400);
});

test('aventure : sans cle refusee, avec cle histoire validee', async () => {
  const body = JSON.stringify({ mots: ['beaucoup', 'une hirondelle', 'tout à coup', 'maison'], anciens: ['forêt'], chapitres: 3, theme: 'pirates' });
  assert.equal((await call('/api/aventure', { method: 'POST', body })).status, 400);
  process.env.GEMINI_API_KEY = 'cle-test';
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  const d = await (await call('/api/aventure', { method: 'POST', body })).json();
  assert.equal(d.chapitres.length, 3);
  assert.deepEqual(d.mots.sort(), ['beaucoup', 'maison', 'tout à coup', 'une hirondelle'].sort());
  assert.deepEqual(d.anciens, ['forêt']);
  delete process.env.GEMINI_API_KEY;
});

test('voix : cache disque, WAV valide, repli sans cle', async () => {
  assert.equal((await call('/api/tts?text=bonjour')).status, 503);
  process.env.GEMINI_API_KEY = 'cle-test';
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  const r = await call('/api/tts?text=' + encodeURIComponent('Bonjour les enfants'));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /wav/);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.slice(0, 4).toString(), 'RIFF');
  assert.equal(buf.length, 44 + 4800);
  await (await call('/api/tts?text=' + encodeURIComponent('Bonjour les enfants'))).arrayBuffer();
  assert.equal(ttsCalls, 1); // la seconde lecture vient du cache
  delete process.env.GEMINI_API_KEY;
});

test('comptes : connexion, mauvais mot de passe, espace parent verrouille', async () => {
  const login = (u, p) => fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  assert.equal((await login('parent', 'faux')).status, 401);
  const ok = await login('PARENT', 'motdepasse1');
  assert.equal(ok.status, 200);
  const ck = ok.headers.get('set-cookie').split(';')[0];
  assert.match(ok.headers.get('set-cookie'), /HttpOnly/);
  const h = { 'content-type': 'application/json', cookie: ck };
  assert.equal((await fetch(base + '/api/parent/profiles', { headers: h })).status, 403); // verrouille
  assert.equal((await fetch(base + '/api/unlock', { method: 'POST', headers: h, body: JSON.stringify({ password: 'faux' }) })).status, 401);
  assert.equal((await fetch(base + '/api/unlock', { method: 'POST', headers: h, body: JSON.stringify({ password: 'motdepasse1' }) })).status, 200);
  assert.equal((await fetch(base + '/api/parent/profiles', { headers: h })).status, 200);
  assert.equal((await fetch(base + '/api/setup', { method: 'POST', headers: h, body: JSON.stringify({ username: 'autre', password: 'motdepasse1' }) })).status, 409);
});

test('parent : reglage cible protege, suivi, copie, export/import', async () => {
  const r = await call('/api/parent/profiles/' + PID_NEW + '/settings', { method: 'PUT', body: JSON.stringify({ target: 5 }) });
  assert.equal(r.status, 200);
  const st = await (await call('/api/state')).json();
  st.settings = { target: 1 };
  await call('/api/state', { method: 'PUT', body: JSON.stringify(st) });
  assert.equal((await (await call('/api/state')).json()).settings.target, 5); // l'enfant ne le change pas
  const events = [{ word: 'maison', mode: 'quiz', list: 'Dictée 1', ok: false }, { word: 'maison', mode: 'flash', list: 'Dictée 1', ok: true }, { word: 'maison', mode: 'zzz', list: 'x', ok: true }];
  assert.equal((await call('/api/events', { method: 'POST', body: JSON.stringify({ events }) })).status, 200);
  const sv = await (await call('/api/parent/profiles/' + PID_NEW + '/suivi')).json();
  assert.equal(sv.total.n, 2); // le mode inconnu est ecarte
  assert.equal(sv.mots[0].word, 'maison');
  assert.equal(sv.days.length, 14);
  assert.equal(sv.days[13].n, 2);
  const lid = st.lists[0].id;
  assert.equal((await call('/api/parent/copy', { method: 'POST', body: JSON.stringify({ from: PID_NEW, to: PID_OLD, listId: lid }) })).status, 200);
  const old = await (await call('/api/state', { headers: { 'x-profil': String(PID_OLD) } })).json();
  assert.equal(old.lists.length, 2);
  const exp = await (await call('/api/parent/profiles/' + PID_OLD + '/export')).json();
  assert.equal(exp.format, 'cahier-malin');
  const imp = await (await call('/api/parent/profiles/' + PID_NEW + '/import', { method: 'POST', body: JSON.stringify(exp) })).json();
  assert.equal(imp.added, 2);
  assert.equal((await call('/api/parent/profiles/' + PID_NEW + '/import', { method: 'POST', body: JSON.stringify({ format: 'x' }) })).status, 400);
});

test('administrateur : autre famille isolee', async () => {
  const r = await call('/api/parent/users', { method: 'POST', body: JSON.stringify({ username: 'famille2', password: 'motdepasse2' }) });
  assert.equal(r.status, 200);
  const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'famille2', password: 'motdepasse2' }) });
  const h = { 'content-type': 'application/json', cookie: login.headers.get('set-cookie').split(';')[0] };
  const me = await (await fetch(base + '/api/me', { headers: h })).json();
  assert.equal(me.profiles.length, 1);
  assert.equal((await fetch(base + '/api/state', { headers: { ...h, 'x-profil': String(PID_NEW) } })).status, 400); // pas ses profils
  await fetch(base + '/api/unlock', { method: 'POST', headers: h, body: JSON.stringify({ password: 'motdepasse2' }) });
  assert.equal((await fetch(base + '/api/parent/users', { headers: h })).status, 403); // pas administrateur
  const users = (await (await call('/api/parent/users')).json()).users;
  assert.equal((await call('/api/parent/users/' + users.find((u) => u.username === 'famille2').id, { method: 'DELETE' })).status, 200);
});

test('voix : choix par le parent', async () => {
  assert.equal((await call('/api/parent/voice', { method: 'PUT', body: JSON.stringify({ voice: 'Puck' }) })).status, 200);
  assert.equal((await call('/api/parent/voice', { method: 'PUT', body: JSON.stringify({ voice: 'Inconnue' }) })).status, 400);
  const me = await (await call('/api/me')).json();
  assert.equal(me.user.voice, 'Puck');
});

test('reglages admin : cle chiffree, jamais renvoyee, test, voix par defaut', async () => {
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  const KEY = 'AIzaSyFAKEFAKEFAKEFAKE1234567890';
  let s = await (await call('/api/parent/admin/settings')).json();
  assert.equal(s.keySet, false);
  assert.equal((await call('/api/parent/admin/settings', { method: 'PUT', body: JSON.stringify({ geminiKey: 'trop court' }) })).status, 400);
  assert.equal((await call('/api/parent/admin/test-gemini', { method: 'POST', body: '{}' })).status, 400); // pas de cle
  s = await (await call('/api/parent/admin/settings', { method: 'PUT', body: JSON.stringify({ geminiKey: KEY, voice: 'Aoede', model: 'gemini-test' }) })).json();
  assert.equal(s.keySet, true);
  assert.equal(s.keyHint, KEY.slice(-4));
  assert.equal(JSON.stringify(s).includes(KEY), false); // la cle n'est jamais renvoyee
  assert.equal(s.model, 'gemini-test');
  // chiffree dans la base
  const raw = dbm.db.prepare("SELECT value FROM settings WHERE key = 'gemini_key'").get().value;
  assert.match(raw, /^v1:/);
  assert.equal(raw.includes(KEY), false);
  // config : Gemini disponible sans variable d'environnement
  assert.equal((await (await call('/api/config')).json()).gemini, true);
  const ok = await (await call('/api/parent/admin/test-gemini', { method: 'POST', body: '{}' })).json();
  assert.equal(typeof ok.ok, 'boolean');
  // liste des modeles : texte et voix separes, embeddings et images ecartes
  const models = await (await call('/api/parent/admin/models')).json();
  assert.deepEqual(models.text.map((m) => m.name), ['gemini-2.5-flash', 'gemini-2.5-pro']);
  assert.deepEqual(models.tts.map((m) => m.name), ['gemini-2.5-flash-preview-tts']);
  // un parent non administrateur n'y a pas acces
  await call('/api/parent/users', { method: 'POST', body: JSON.stringify({ username: 'famille3', password: 'motdepasse3' }) });
  const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'famille3', password: 'motdepasse3' }) });
  const h = { 'content-type': 'application/json', cookie: login.headers.get('set-cookie').split(';')[0] };
  await fetch(base + '/api/unlock', { method: 'POST', headers: h, body: JSON.stringify({ password: 'motdepasse3' }) });
  assert.equal((await fetch(base + '/api/parent/admin/settings', { headers: h })).status, 403);
  assert.equal((await fetch(base + '/api/parent/admin/models', { headers: h })).status, 403);
  // suppression de la cle
  s = await (await call('/api/parent/admin/settings', { method: 'PUT', body: JSON.stringify({ clearKey: true }) })).json();
  assert.equal(s.keySet, false);
  assert.equal((await (await call('/api/config')).json()).gemini, false);
});
