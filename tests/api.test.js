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

const app = require('../server');
let base, fake, srv, fakeCalls = 0;

test.before(async () => {
  fake = http.createServer((req, res) => {
    fakeCalls++;
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      assert.ok(JSON.parse(body).contents);
      const mots = [{ mot: 'finir', nature: 'verbe', formes: [
        { texte: 'nous finissons', type: 'conjugaison', libelle: 'présent', phrase: 'Nous finissons le travail.' },
        { texte: 'je finis', type: 'conjugaison', libelle: 'présent', phrase: 'Phrase sans la forme.' },
        { texte: 'finir', type: 'conjugaison', libelle: 'infinitif', phrase: '' },
        { texte: 'pirate', type: 'inconnu', libelle: 'x', phrase: '' },
      ] }];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ mots }) }] } }] }));
    });
  });
  await new Promise((r) => fake.listen(0, r));
  await new Promise((r) => { srv = app.listen(0, () => { base = `http://127.0.0.1:${srv.address().port}`; r(); }); });
});
test.after(() => { if (fake) fake.close(); if (srv) srv.close(); });

const call = (p, opts = {}) => fetch(base + p, { ...opts, headers: { 'content-type': 'application/json', 'x-profil': 'Léa', ...(opts.headers || {}) } });

test('racine sans slash redirigee, page servie', async () => {
  const r = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Cahier Malin/);
});

test('profil obligatoire', async () => {
  const r = await fetch(base + '/api/state');
  assert.equal(r.status, 400);
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
  const autre = await (await call('/api/state', { headers: { 'x-profil': 'Tom' } })).json();
  assert.equal(autre.exists, false);
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
