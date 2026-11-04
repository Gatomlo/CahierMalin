// Declinaisons d'un mot : pluriel/singulier, feminin/masculin, conjugaison.
// - Gemini (cle GEMINI_API_KEY ou data/gemini.key) : tous les cas, verbes compris.
// - Sans cle : regles locales pour les groupes nominaux precedes d'un article
//   (un/une/le/la/l'/des/les), a verifier par l'enfant ou le parent.
// Les resultats Gemini sont gardes en base : un mot n'est demande qu'une fois.
const fs = require('fs');
const path = require('path');
const db = require('./db');

const TEMPS = ['présent', 'imparfait', 'futur simple', 'passé composé', 'conditionnel présent'];
const TYPES = ['nombre', 'genre', 'conjugaison'];
const MAX_WORDS = 12;

function geminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try { return fs.readFileSync(path.join(db.DATA_DIR, 'gemini.key'), 'utf8').trim(); } catch (e) { return ''; }
}
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
  const base = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  let res;
  try {
    res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(words, opts) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(40000),
    });
  } catch (e) {
    throw Object.assign(new Error('Gemini ne répond pas, réessaie dans un instant.'), { status: 502, expose: true });
  }
  if (!res.ok) {
    console.warn('Gemini HTTP', res.status);
    throw Object.assign(new Error(res.status === 429 ? 'Trop de demandes à Gemini, réessaie plus tard.' : 'Gemini a refusé la demande (clé invalide ?).'), { status: 502, expose: true });
  }
  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts && data.candidates[0].content.parts.map((p) => p.text || '').join('');
  try { return JSON.parse(text).mots; } catch (e) {
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
      out.set(w, l ? { mot: w, nature: l.nature, formes: l.formes } : { mot: w, nature: 'autre', formes: [] });
    }
  }
  return { source, mots: words.map((w) => out.get(w)) };
}

module.exports = { decline, hasGemini, TEMPS, localForms };
