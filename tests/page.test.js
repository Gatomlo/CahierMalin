// Controle de la page : chaque script reference par index.html existe et est syntaxiquement valide,
// les fichiers charges ensemble ne redeclarent pas les memes fonctions et le CSS est present.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PUBLIC = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);

test('index.html charge ses scripts et sa feuille de style', () => {
  assert.ok(scripts.length >= 4, 'scripts attendus');
  assert.ok(/<link rel="stylesheet" href="style\.css">/.test(html));
  assert.ok(fs.existsSync(path.join(PUBLIC, 'style.css')));
  for (const s of scripts) assert.ok(fs.existsSync(path.join(PUBLIC, s)), `${s} introuvable`);
});

test('les scripts de la page sont syntaxiquement valides', () => {
  for (const s of scripts) {
    const code = fs.readFileSync(path.join(PUBLIC, s), 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename: s }), `${s} : erreur de syntaxe`);
  }
  // scripts en ligne eventuels
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    assert.doesNotThrow(() => new vm.Script(m[1], { filename: 'index.html' }));
  }
});

test('pas de fonction ou variable globale declaree deux fois entre fichiers', () => {
  const seen = new Map();
  for (const s of scripts) {
    const code = fs.readFileSync(path.join(PUBLIC, s), 'utf8');
    for (const m of code.matchAll(/^(?:function|var|let|const)\s+([A-Za-z_$][\w$]*)/gm)) {
      const name = m[1];
      if (seen.has(name) && seen.get(name) !== s) assert.fail(`${name} declare dans ${seen.get(name)} et ${s}`);
      seen.set(name, s);
    }
  }
});
