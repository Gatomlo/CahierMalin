// Pont avec la connexion centralisee de node-gateway : req.gateway (pose par la passerelle) ouvre une
// session locale COURTE pour le compte de meme identifiant, sans jamais creer de compte ni deverrouiller
// l'espace parent. Sans req.gateway (mode autonome), rien ne change.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

process.env.CAHIER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cahier-gw-'));
delete process.env.GEMINI_API_KEY;
const express = require('express');
const app = require('../server');

let srv, base;
const gw = (login, role = 'member') => ({ 'x-test-gateway': JSON.stringify({ app: 'cahier-malin', role, user: { login, name: login, email: null, isSuper: false } }) });
const json = { 'content-type': 'application/json' };
const get = (p, headers = {}) => fetch(base + p, { headers });

test.before(async () => {
  const outer = express();
  // Simule la passerelle : pose req.gateway depuis un en-tete reserve aux tests (le vrai le pose cote serveur).
  outer.use((req, res, next) => { const h = req.get('x-test-gateway'); if (h) req.gateway = JSON.parse(h); next(); });
  outer.use('/cm', app);
  srv = http.createServer(outer);
  await new Promise((r) => srv.listen(0, r));
  base = `http://127.0.0.1:${srv.address().port}/cm`;
  const setup = await fetch(base + '/api/setup', { method: 'POST', headers: json, body: JSON.stringify({ username: 'parent', password: 'motdepasse1' }) });
  assert.equal(setup.status, 200);
});
test.after(() => srv.close());

test('identite de la passerelle -> compte local de meme identifiant', async () => {
  const r = await get('/api/me', gw('parent'));
  const j = await r.json();
  assert.equal(j.user.username, 'parent');
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /Path=\/cm\//, 'cookie limite au chemin de montage');
  assert.match(cookie, /Max-Age=7200\b/, 'session courte (2 h)');
  assert.match(cookie, /HttpOnly/);
});

test('l\'espace parent reste verrouille (mot de passe requis)', async () => {
  const j = await (await get('/api/me', gw('parent', 'admin'))).json();
  assert.equal(j.unlocked, false);
});

test('aucun compte cree : identifiant inconnu, anonyme, ou sans droit => pas connecte', async () => {
  assert.equal((await (await get('/api/me', gw('inconnu'))).json()).user, null);
  assert.equal((await (await get('/api/me')).json()).user, null);
  const noRole = { 'x-test-gateway': JSON.stringify({ app: 'cahier-malin', role: null, user: { login: 'parent' } }) };
  assert.equal((await (await get('/api/me', noRole)).json()).user, null);
  const users = require('../lib/db').db.prepare('SELECT COUNT(*) n FROM users').get().n;
  assert.equal(users, 1);
});

test('mode autonome (sans passerelle) : inchange', async () => {
  const standalone = http.createServer(app);
  await new Promise((r) => standalone.listen(0, r));
  const j = await (await fetch(`http://127.0.0.1:${standalone.address().port}/api/me`)).json();
  standalone.close();
  assert.equal(j.user, null);
});
