// Logique du front (core.js + editor.js) executee dans un contexte vm avec un faux DOM :
// analyse des lignes de conjugaison, texte de liste, enregistrement quand l'IA echoue,
// regle facultative, planning de revision espacee.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PUBLIC = path.join(__dirname, '..', 'public', 'js');

function makeCtx(apiFetch) {
  const els = new Map();
  const stub = (sel) => {
    if (!els.has(sel)) {
      const e = new Proxy({ value: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, children: [], hidden: false }, {
        get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? () => stub('child') : undefined)),
        set: (t, k, v) => { t[k] = v; return true; },
      });
      els.set(sel, e);
    }
    return els.get(sel);
  };
  const store = {};
  const ctx = {
    console, setTimeout, clearTimeout, Promise, Date, Math, JSON, Object, Array, String, Number, parseInt, isNaN, RegExp, Error, Set, Map,
    document: { querySelector: stub, querySelectorAll: () => [], getElementById: stub, createElement: () => stub('new'), body: stub('body'), addEventListener() {}, documentElement: stub('html') },
    window: { addEventListener() {}, confirm: () => true, prompt: () => '', speechSynthesis: undefined, AudioContext: undefined },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: {}, location: { reload() {} }, fetch: () => Promise.reject(new Error('hors ligne')),
    apiFetch, els,
  };
  ctx.window.localStorage = ctx.localStorage;
  vm.createContext(ctx);
  for (const f of ['core.js', 'editor.js']) {
    vm.runInContext(fs.readFileSync(path.join(PUBLIC, f), 'utf8'), ctx, { filename: f });
  }
  ctx.apiFetch = apiFetch;   // remplace le vrai apiFetch charge par core.js
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);

test('analyse des lignes de conjugaison', () => {
  const c = makeCtx(() => Promise.reject(new Error('x')));
  assert.deepEqual(JSON.parse(run(c, `JSON.stringify(parseConjLine('chanter (présent)'))`)), { verbe: 'chanter', temps: 'présent', personnes: ['je', 'tu', 'il', 'nous', 'vous', 'ils'] });
  assert.deepEqual(JSON.parse(run(c, `JSON.stringify(parseConjLine('finir (imparfait : je, nous)').personnes)`)), ['je', 'nous']);
  assert.equal(run(c, `parseConjLine('maison ; Ma maison est grande.')`), null);
  assert.equal(run(c, `parseConjLine('chanter (temps inconnu)')`), null);
  assert.equal(run(c, `lineKey('chanter (présent : je, nous)')`), 'chanter (présent : je, nous)');
});

test('texte de liste : phrases, lignes de conjugaison et lignes en attente', () => {
  const c = makeCtx(() => Promise.reject(new Error('x')));
  const txt = run(c, `listToText({ words: [{ w:'maison', s:'Ma maison.' }, { w:'je chante', g:'chanter (présent)' }, { w:'tu chantes', g:'chanter (présent)' }, { w:'arbre' }], pending: ['finir (futur)'] })`);
  assert.equal(txt, 'maison ; Ma maison.\nchanter (présent)\narbre\nfinir (futur)');
});

test('enregistrement quand l\'IA echoue : mots simples gardes, conjugaisons en attente', async () => {
  const c = makeCtx(() => Promise.reject(new Error('IA indisponible')));
  const words = await run(c, `buildWords(['maison', 'chat ; Le chat dort.', 'chanter (présent)'], null)`);
  assert.deepEqual(JSON.parse(JSON.stringify(words.map((w) => w.w))), ['maison', 'chat']);
  assert.equal(words.find((w) => w.w === 'chat').s, 'Le chat dort.');
  assert.deepEqual(JSON.parse(JSON.stringify(words.skipped)), ['chanter (présent)']);
});

test('enregistrement quand l\'IA repond : formes conjuguees avec leur ligne d\'origine', async () => {
  const c = makeCtx((url) => Promise.resolve({ verbes: [{ formes: [{ texte: 'je chante', phrase: 'Je chante.' }, { texte: 'tu chantes', phrase: '' }] }] }));
  const words = await run(c, `buildWords(['chanter (présent : je, tu)'], null)`);
  assert.deepEqual(JSON.parse(JSON.stringify(words.map((w) => [w.w, w.g]))), [['je chante', 'chanter (présent : je, tu)'], ['tu chantes', 'chanter (présent : je, tu)']]);
  assert.equal(words.skipped.length, 0);
});

test('regle de grammaire : absente = rien, presente = nom et rappel', () => {
  const c = makeCtx(() => Promise.reject(new Error('x')));
  assert.equal(run(c, `readRule()`), null);
  c.els.get('#listRule').value = '  Accord de l’adjectif ';
  assert.deepEqual(JSON.parse(run(c, `JSON.stringify(readRule())`)), { nom: 'Accord de l’adjectif' });
  c.els.get('#listRuleMemo').value = 'On accorde.';
  assert.deepEqual(JSON.parse(run(c, `JSON.stringify(readRule())`)), { nom: 'Accord de l’adjectif', memo: 'On accorde.' });
});

test('revision espacee : rate = demain, reussite a la date = palier suivant, pas deux fois le meme jour', () => {
  const c = makeCtx(() => Promise.reject(new Error('x')));
  const out = run(c, `JSON.stringify((function(){
    var p = { modes:{} };
    scheduleWord(p, true);
    var a = p.next === undefined;
    scheduleWord(p, false);
    var b = [p.box, p.next === addDays(1)];
    scheduleWord(p, true);
    var c1 = [p.box, p.next === addDays(1)];
    p.next = dayStr(new Date()); scheduleWord(p, true);
    var d = [p.box, p.next === addDays(3)];
    for (var i = 0; i < 6; i++){ p.next = dayStr(new Date()); scheduleWord(p, true); }
    return { a:a, b:b, c1:c1, d:d, max:p.box, maxNext: p.next === addDays(30) };
  })())`);
  const o = JSON.parse(out);
  assert.equal(o.a, true);
  assert.deepEqual(o.b, [0, true]);
  assert.deepEqual(o.c1, [0, true]);
  assert.deepEqual(o.d, [1, true]);
  assert.equal(o.max, 4);
  assert.equal(o.maxNext, true);
});
