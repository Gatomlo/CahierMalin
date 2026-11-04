// Declinaisons d'un mot : pluriel/singulier, feminin/masculin, conjugaison.
// - Gemini (cle GEMINI_API_KEY ou data/gemini.key) : tous les cas, verbes compris.
// - Sans cle : regles locales pour les groupes nominaux precedes d'un article
//   (un/une/le/la/l'/des/les), a verifier par l'enfant ou le parent.
// Les resultats Gemini sont gardes en base : un mot n'est demande qu'une fois.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const settings = require('./settings');
const conj = require('./conjugaison');

const TEMPS = ['présent', 'imparfait', 'futur simple', 'passé composé', 'conditionnel présent'];
const TYPES = ['nombre', 'genre', 'conjugaison'];
const MAX_WORDS = 12;

const { geminiKey } = settings;
const hasGemini = () => !!geminiKey();

/* ---------------- regles locales (sans IA) ---------------- */
const PLURAL_IRREG = { oeil: 'yeux', œil: 'yeux', ciel: 'cieux', travail: 'travaux', animal: 'animaux', cheval: 'chevaux', journal: 'journaux', 'bijou': 'bijoux', caillou: 'cailloux', chou: 'choux', genou: 'genoux', hibou: 'hiboux', joujou: 'joujoux', pou: 'poux', 'bal': 'bals', carnaval: 'carnavals', festival: 'festivals', récital: 'récitals' };
const SING_IRREG = Object.fromEntries(Object.entries(PLURAL_IRREG).map(([s, p]) => [p, s]));
SING_IRREG.yeux = 'œil';

function pluralOf(n) {
  const low = n.toLowerCase();
  if (PLURAL_IRREG[low]) return PLURAL_IRREG[low];
  if (/[sxz]$/.test(low)) return n;
  if (/(eau|au|eu)$/.test(low)) return n + 'x';
  if (/al$/.test(low)) return n.slice(0, -2) + 'aux';
  return n + 's';
}
function singularOf(n) {
  const low = n.toLowerCase();
  if (SING_IRREG[low]) return SING_IRREG[low];
  if (/eaux$/.test(low)) return n.slice(0, -1);
  if (/aux$/.test(low)) return n.slice(0, -3) + 'al';
  if (/[sx]$/.test(low) && low.length > 2) return n.slice(0, -1);
  return n;
}
const ART_SING = { un: 'des', une: 'des', le: 'les', la: 'les', "l'": 'les', "l’": 'les', mon: 'mes', ma: 'mes', ton: 'tes', ta: 'tes', son: 'ses', sa: 'ses', ce: 'ces', cette: 'ces' };
const ART_PLUR = { des: ['un', 'une'], les: ['le', 'la'], mes: ['mon', 'ma'], tes: ['ton', 'ta'], ses: ['son', 'sa'], ces: ['ce', 'cette'] };

function localForms(raw) {
  const m = raw.trim().match(/^(l['’]|[\p{L}]+\s)\s*(.+)$/u);
  if (!m) return null;
  const art = m[1].trim().toLowerCase();
  const noun = m[2].trim();
  if (noun.includes(' ')) return null; // groupes plus longs : trop incertain sans IA
  if (ART_SING[art]) {
    const text = ART_SING[art] + ' ' + pluralOf(noun);
    return { nature: 'nom', formes: [{ texte: text, type: 'nombre', libelle: 'pluriel', phrase: '' }] };
  }
  if (ART_PLUR[art]) {
    const sing = singularOf(noun);
    const a = ART_PLUR[art][0];
    const a2 = /^[aeiouyhàâéèêëîïôûœ]/i.test(sing) && (art === 'les') ? "l'" : a;
    return { nature: 'nom', formes: [{ texte: (a2 === "l'" ? a2 : a2 + ' ') + sing, type: 'nombre', libelle: 'singulier', phrase: '' }] };
  }
  return null;
}

/* ---------------- Gemini ---------------- */
const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function buildPrompt(words, opts) {
  const wants = [];
  if (opts.nombre) wants.push('le pluriel pour un mot au singulier, le singulier pour un mot au pluriel (type "nombre", libelle "pluriel" ou "singulier")');
  if (opts.genre) wants.push('le féminin ou le masculin quand il existe (noms de personnes ou d\'animaux, adjectifs), au singulier et au pluriel (type "genre", libelle "féminin" ou "masculin")');
  if (opts.conjugaison) wants.push(`si le mot est un verbe (même conjugué, ramène-le à l'infinitif), sa conjugaison complète aux temps suivants : ${opts.temps.join(', ')} ; une forme par personne (je, tu, il, nous, vous, ils), "texte" avec le pronom (ex. « nous finissons », « j'ai fini »), type "conjugaison", libelle = « <temps> » en minuscules`);
  return `Tu aides un enseignant du primaire francophone à préparer des listes de mots de dictée.
Pour chaque mot ou expression de la liste, donne ses formes déclinées :
- ${wants.join('\n- ')}
Règles : orthographe française correcte et vérifiée ; ne reprends jamais le mot d'origine ; ne propose rien si la forme n'existe pas ou si le mot est invariable (adverbe, préposition...). Pour chaque forme, ajoute une phrase d'exemple courte (niveau primaire) qui contient EXACTEMENT le texte de la forme.
"nature" vaut : nom, adjectif, verbe ou autre. Garde le mot tel qu'il est fourni dans "mot".
Réponds uniquement en JSON : {"mots":[{"mot":"...","nature":"...","formes":[{"texte":"...","type":"nombre|genre|conjugaison","libelle":"...","phrase":"..."}]}]}

Mots : ${JSON.stringify(words)}`;
}

async function askGemini(words, opts) {
  const r = await askGeminiJson(buildPrompt(words, opts));
  return r && r.mots;
}

// Gemini repond parfois 503 "modele surcharge" : on reessaie 3 fois (1,5 s puis 3 s) avant d'abandonner.
const TRANSIENT = new Set([500, 502, 503, 504]);
async function fetchRetry(url, init, tries = 3) {
  let res;
  for (let i = 0; i < tries; i++) {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(40000) });
    if (!TRANSIENT.has(res.status) || i === tries - 1) return res;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return res;
}

// Erreur lisible a partir d'une reponse HTTP de Gemini : cle refusee, modele disparu, quota...
async function geminiHttpError(res, model) {
  let detail = '';
  try { const j = await res.json(); detail = clean(j && j.error && j.error.message, 160); } catch (e) { /* corps absent */ }
  console.warn('Gemini HTTP', res.status, model || '', detail);
  let msg;
  if (TRANSIENT.has(res.status)) msg = 'Gemini est surchargé en ce moment (c’est temporaire, même après plusieurs essais) : réessaie dans quelques minutes, ou choisis un autre modèle dans les options avancées des réglages.';
  else if (res.status === 404) msg = `Modèle « ${model} » introuvable (Google a pu le retirer) : choisis-en un autre dans les options avancées des réglages.`;
  else if (res.status === 429) msg = 'Quota Gemini atteint, réessaie plus tard.';
  else if (res.status === 401 || res.status === 403 || /api key/i.test(detail)) msg = 'Gemini refuse la clé' + (detail ? ' : ' + detail : '.');
  else msg = `Gemini a refusé la demande (HTTP ${res.status})` + (detail ? ' : ' + detail : '.');
  return Object.assign(new Error(msg), { status: 502, expose: true });
}

async function askGeminiJson(prompt) {
  const { base, model } = settings.gemini();
  let res;
  try {
    res = await fetchRetry(`${base}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(40000),
    });
  } catch (e) {
    throw Object.assign(new Error('Gemini ne répond pas, réessaie dans un instant.'), { status: 502, expose: true });
  }
  if (!res.ok) throw await geminiHttpError(res, model);
  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts && data.candidates[0].content.parts.map((p) => p.text || '').join('');
  try { return JSON.parse(text); } catch (e) {
    throw Object.assign(new Error('Réponse de Gemini illisible, réessaie.'), { status: 502, expose: true });
  }
}

function sanitize(entry, original, opts) {
  const allowed = TYPES.filter((t) => opts[t]);
  const seen = new Set([original.toLowerCase()]);
  const formes = [];
  for (const f of Array.isArray(entry && entry.formes) ? entry.formes : []) {
    const texte = clean(f && f.texte, 80);
    if (!texte || seen.has(texte.toLowerCase()) || !allowed.includes(f.type)) continue;
    seen.add(texte.toLowerCase());
    let phrase = clean(f.phrase, 200);
    if (phrase && !phrase.toLowerCase().includes(texte.toLowerCase())) phrase = '';
    formes.push({ texte, type: f.type, libelle: clean(f.libelle, 40), phrase });
    if (formes.length >= 40) break;
  }
  const nature = ['nom', 'adjectif', 'verbe', 'autre'].includes(entry && entry.nature) ? entry.nature : 'autre';
  return { mot: original, nature, formes };
}

/* ---------------- point d'entree ---------------- */
function normalizeOpts(o) {
  o = o || {};
  const temps = (Array.isArray(o.temps) ? o.temps : []).filter((t) => TEMPS.includes(t));
  const opts = { nombre: !!o.nombre, genre: !!o.genre, conjugaison: !!o.conjugaison && temps.length > 0, temps: [...new Set(temps)].sort() };
  if (!opts.nombre && !opts.genre && !opts.conjugaison) {
    throw Object.assign(new Error('Choisis au moins un type de forme.'), { status: 400, expose: true });
  }
  return opts;
}

async function decline(rawWords, rawOpts) {
  const opts = normalizeOpts(rawOpts);
  const words = [...new Set((Array.isArray(rawWords) ? rawWords : []).map((w) => clean(w, 60)).filter(Boolean))];
  if (!words.length) throw Object.assign(new Error('Aucun mot à décliner.'), { status: 400, expose: true });
  if (words.length > MAX_WORDS) throw Object.assign(new Error(`${MAX_WORDS} mots au maximum à la fois.`), { status: 400, expose: true });

  const optKey = `${+opts.nombre}${+opts.genre}${+opts.conjugaison}:${opts.temps.join(',')}`;
  const keyOf = (w) => `${w.toLowerCase()}|${optKey}`;
  const out = new Map();
  const missing = [];
  for (const w of words) {
    const cached = hasGemini() ? db.getCache(keyOf(w)) : null;
    if (cached) out.set(w, cached); else missing.push(w);
  }

  let source = 'cache';
  if (missing.length && hasGemini()) {
    source = 'gemini';
    const answer = await askGemini(missing, opts);
    const byWord = new Map((Array.isArray(answer) ? answer : []).map((e) => [clean(e && e.mot, 60).toLowerCase(), e]));
    for (const w of missing) {
      const res = sanitize(byWord.get(w.toLowerCase()), w, opts);
      out.set(w, res);
      db.setCache(keyOf(w), res);
    }
  } else if (missing.length) {
    source = 'regles';
    for (const w of missing) {
      const l = opts.nombre ? localForms(w) : null;
      const res = l ? { mot: w, nature: l.nature, formes: [...l.formes] } : { mot: w, nature: 'autre', formes: [] };
      if (opts.conjugaison) {
        for (const t of opts.temps) {
          const c = conj.conjugate(w, t);
          if (!c) continue;
          res.nature = 'verbe';
          c.forEach((texte) => res.formes.push({ texte, type: 'conjugaison', libelle: t, phrase: '' }));
        }
      }
      out.set(w, res);
    }
  }
  return { source, mots: words.map((w) => out.get(w)) };
}

// Conjugaisons demandees par la syntaxe "infinitif (temps : personnes)" des listes.
async function conjugateEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) throw Object.assign(new Error('Aucun verbe à conjuguer.'), { status: 400, expose: true });
  if (entries.length > MAX_WORDS) throw Object.assign(new Error(`${MAX_WORDS} verbes au maximum à la fois.`), { status: 400, expose: true });
  let source = 'regles';
  const verbes = [];
  for (const e of entries) {
    const verbe = clean(e && e.verbe, 40).toLowerCase();
    const temps = e && e.temps;
    if (!verbe || !TEMPS.includes(temps)) throw Object.assign(new Error('Verbe ou temps invalide.'), { status: 400, expose: true });
    const wanted = Array.isArray(e.personnes) && e.personnes.length ? e.personnes.filter((p) => conj.PERSONNES.includes(p)) : conj.PERSONNES;
    const r = await decline([verbe], { conjugaison: true, temps: [temps] });
    if (r.source === 'gemini') source = 'gemini';
    const byPers = new Map();
    for (const f of r.mots[0].formes) {
      const p = conj.personneOf(f.texte);
      if (p && !byPers.has(p)) byPers.set(p, f);
    }
    const formes = conj.PERSONNES.filter((p) => wanted.includes(p) && byPers.has(p))
      .map((p) => ({ personne: p, texte: byPers.get(p).texte, phrase: byPers.get(p).phrase || '' }));
    if (!formes.length) {
      throw Object.assign(new Error(hasGemini()
        ? `Impossible de conjuguer « ${verbe} » au ${temps}.`
        : `Impossible de conjuguer « ${verbe} » sans Gemini : seuls les verbes réguliers en -er et quelques verbes en -ir (finir, choisir...) sont gérés.`), { status: 422, expose: true });
    }
    verbes.push({ verbe, temps, formes });
  }
  return { source, verbes };
}

// Une phrase d'exemple simple par mot (Gemini seulement).
async function phrases(rawWords) {
  const words = [...new Set((Array.isArray(rawWords) ? rawWords : []).map((w) => clean(w, 60)).filter(Boolean))];
  if (!words.length) throw Object.assign(new Error('Aucun mot.'), { status: 400, expose: true });
  if (words.length > 25) throw Object.assign(new Error('25 mots au maximum à la fois.'), { status: 400, expose: true });
  if (!hasGemini()) throw Object.assign(new Error('Générer des phrases demande une clé Gemini (réglage de l’administrateur).'), { status: 400, expose: true });
  const prompt = `Tu aides un enseignant du primaire francophone. Pour chaque mot ou expression, écris UNE phrase d'exemple simple (niveau CE1-CM2, 6 à 12 mots) qui contient EXACTEMENT ce texte, sans le modifier, et dont le sens fait comprendre le mot.
Réponds uniquement en JSON : {"phrases":[{"mot":"...","phrase":"..."}]}
Mots : ${JSON.stringify(words)}`;
  const answer = await askGeminiJson(prompt);
  const res = {};
  for (const e of Array.isArray(answer && answer.phrases) ? answer.phrases : []) {
    const mot = clean(e && e.mot, 60);
    const phrase = clean(e && e.phrase, 200);
    if (words.includes(mot) && phrase.toLowerCase().includes(mot.toLowerCase())) res[mot] = phrase;
  }
  return { phrases: res };
}

const THEMES = ['libre', 'pirates', 'forêt enchantée', 'espace', 'ferme', 'château', 'enquête mystère', 'dinosaures'];
const norm = (s) => s.toLowerCase().replace(/’/g, "'");

// Petite aventure en chapitres qui emploie les mots de la liste (Gemini seulement).
async function adventure(rawWords, rawOld, rawScenes, rawTheme) {
  const clean2 = (arr, max) => [...new Set((Array.isArray(arr) ? arr : []).map((w) => clean(w, 60)).filter(Boolean))].slice(0, max);
  const mots = clean2(rawWords, 10);
  const anciens = clean2(rawOld, 6).filter((w) => !mots.includes(w));
  const scenes = Math.max(2, Math.min(10, parseInt(rawScenes, 10) || 5));
  const theme = THEMES.includes(rawTheme) ? rawTheme : 'libre';
  if (!mots.length) throw Object.assign(new Error('Aucun mot pour la dictée.'), { status: 400, expose: true });
  if (!hasGemini()) throw Object.assign(new Error('La dictée-aventure demande une clé Gemini (réglage de l’administrateur).'), { status: 400, expose: true });
  const all = [...mots, ...anciens];
  const prompt = `Tu écris une courte aventure pour une dictée d'enfant francophone (primaire).
Thème : ${theme === 'libre' ? 'au choix, joyeux et un peu mystérieux' : theme}. Un héros ou une héroïne (donne-lui un prénom simple), un petit problème à résoudre, une fin heureuse.
Écris EXACTEMENT ${scenes} chapitres. Chaque chapitre = un "decor" (3 à 5 mots, ex. « La forêt sombre ») et UNE phrase de 6 à 16 mots, vocabulaire simple et courant, histoire cohérente d'un chapitre à l'autre.
Les mots ou expressions suivants doivent apparaître chacun au moins une fois, EXACTEMENT tels qu'écrits (même accents, même article, pas d'accord modifié) : ${JSON.stringify(all)}.
Complète avec des mots courants et simples pour que l'histoire se tienne. Un mot de la liste ne doit pas être expliqué.
Réponds uniquement en JSON : {"titre":"...","chapitres":[{"decor":"...","phrase":"..."}]}`;
  const answer = await askGeminiJson(prompt);
  const chapitres = (Array.isArray(answer && answer.chapitres) ? answer.chapitres : [])
    .map((c) => ({ decor: clean(c && c.decor, 50), phrase: clean(c && c.phrase, 220) }))
    .filter((c) => c.phrase).slice(0, 10);
  if (chapitres.length < 2) throw Object.assign(new Error('Gemini n’a pas écrit d’histoire exploitable, réessaie.'), { status: 502, expose: true });
  const text = norm(chapitres.map((c) => c.phrase).join(' '));
  const utilises = all.filter((w) => text.includes(norm(w)));
  if (utilises.filter((w) => mots.includes(w)).length < Math.ceil(mots.length / 2)) {
    throw Object.assign(new Error('L’histoire n’emploie pas assez de mots de la liste, réessaie.'), { status: 502, expose: true });
  }
  return { titre: clean(answer.titre, 80) || 'Une aventure', chapitres, mots: utilises.filter((w) => mots.includes(w)), anciens: utilises.filter((w) => anciens.includes(w)) };
}

// Verifie la cle et le modele du texte (bouton "Tester" de l'administrateur).
async function testGemini() {
  if (!hasGemini()) throw Object.assign(new Error('Aucune clé Gemini enregistrée.'), { status: 400, expose: true });
  const r = await askGeminiJson('Réponds uniquement par ce JSON : {"ok":true}');
  return !!(r && r.ok);
}

// Modeles disponibles pour cette cle : texte (generateContent) et voix (nom en "tts").
async function listModels() {
  if (!hasGemini()) throw Object.assign(new Error('Aucune clé Gemini enregistrée.'), { status: 400, expose: true });
  const { base, key } = settings.gemini();
  const all = [];
  let token = '';
  for (let page = 0; page < 5; page++) {
    let res;
    try {
      res = await fetch(`${base}/v1beta/models?pageSize=100${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, {
        headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000),
      });
    } catch (e) { throw Object.assign(new Error('Gemini ne répond pas, réessaie dans un instant.'), { status: 502, expose: true }); }
    if (!res.ok) throw await geminiHttpError(res);
    const data = await res.json();
    all.push(...(Array.isArray(data.models) ? data.models : []));
    token = data.nextPageToken || '';
    if (!token) break;
  }
  const usable = all.filter((m) => m && typeof m.name === 'string' && (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({ name: m.name.replace(/^models\//, ''), label: clean(m.displayName, 80) }));
  const byName = (a, b) => a.name.localeCompare(b.name);
  return {
    text: usable.filter((m) => /^gemini/.test(m.name) && !/(tts|image|live|audio|embedding|robotics|computer)/.test(m.name)).sort(byName),
    tts: usable.filter((m) => /tts/.test(m.name)).sort(byName),
  };
}

module.exports = { fetchRetry, geminiHttpError, decline, conjugateEntries, phrases, adventure, testGemini, listModels, geminiKey, hasGemini, THEMES, TEMPS, localForms };
