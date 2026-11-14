// Derriere node-gateway, c'est elle qui authentifie : le premier visiteur (anonyme ou simple membre) ne peut plus creer
// le premier compte et s'approprier l'outil ; l'admin de la passerelle le peut. Hors passerelle : comportement inchange.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

process.env.CAHIER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cahier-setup-'));
delete process.env.GEMINI_API_KEY;
const express = require('express');
const app = require('../server');
const gw = (role, user) => ({ 'x-test-gateway': JSON.stringify({ app: 'cahier-malin', role, user: user === undefined ? { login: 'anim', name: 'Anim', email: 'anim@exemple.be', isSuper: false } : user }) });

test('creation du premier compte derriere la passerelle', async () => {
  const outer = express();
  outer.use((req, res, next) => { const h = req.get('x-test-gateway'); if (h) req.gateway = JSON.parse(h); next(); });
  outer.use('/cm', app);
  const srv = http.createServer(outer);
  await new Promise((r) => srv.listen(0, r));
  const setup = (h) => fetch(`http://127.0.0.1:${srv.address().port}/cm/api/setup`, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify({ username: 'parent', password: 'motdepasse1' }) });
  try {
    assert.equal((await setup(gw(null, null))).status, 403, 'anonyme');
    assert.equal((await setup(gw('member'))).status, 403, 'simple membre');
    assert.equal(require('../lib/db').db.prepare('SELECT COUNT(*) n FROM users').get().n, 0, 'rien cree');
    assert.equal((await setup(gw('admin'))).status, 200, 'admin de la passerelle');
    assert.equal((await setup(gw('admin'))).status, 409, 'un seul premier compte');
  } finally { srv.close(); }
});
