// Conjugaison locale (sans IA) des verbes reguliers du 1er groupe (-er) et d'une liste
// de verbes du 2e groupe (-ir comme finir), a 4 temps : present, imparfait, futur
// simple, conditionnel present, passe compose (auxiliaire avoir). Tout le reste
// (irregulier, auxiliaire etre...) retourne null : il faut alors Gemini.
const PERSONNES = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];

const GROUPE2 = new Set(['finir', 'choisir', 'grandir', 'réussir', 'remplir', 'grossir', 'maigrir', 'obéir', 'agir', 'réfléchir', 'guérir', 'punir', 'bâtir', 'rougir', 'applaudir', 'nourrir', 'saisir', 'établir', 'ralentir', 'rafraîchir', 'atterrir', 'fleurir', 'démolir', 'embellir', 'accomplir', 'avertir', 'définir', 'éclaircir', 'élargir', 'pâlir', 'jaunir', 'verdir', 'blanchir', 'noircir', 'ralentir', 'raccourcir', 'rétrécir', 'vieillir', 'durcir', 'divertir', 'réunir', 'unir', 'finir', 'subir', 'trahir', 'ravir', 'garantir', 'investir', 'affaiblir', 'alourdir', 'amincir', 'brunir', 'enrichir', 'envahir', 'gémir', 'haïr', 'languir', 'moisir', 'mûrir', 'rajeunir', 'rugir', 'salir', 'sévir', 'surgir', 'vomir']);
const ETRE = new Set(['arriver', 'entrer', 'rentrer', 'rester', 'tomber', 'monter', 'retourner', 'passer', 'naître', 'décéder', 'demeurer', 'rester', 'devenir']);
const DOUBLE = new Set(['appeler', 'jeter', 'rappeler', 'épeler', 'projeter', 'rejeter', 'étiqueter', 'renouveler', 'feuilleter', 'ficeler', 'harceler', 'cacheter']);
const E_GRAVE = new Set(['acheter', 'lever', 'mener', 'peser', 'geler', 'peler', 'modeler', 'semer', 'soulever', 'promener', 'amener', 'emmener', 'enlever', 'ramener', 'achever', 'crever', 'fouetter']);
// "harceler" se conjugue avec è, pas avec ll : on le retire de DOUBLE par securite
DOUBLE.delete('harceler'); DOUBLE.delete('renouveler'); DOUBLE.delete('étiqueter'); DOUBLE.delete('cacheter'); DOUBLE.delete('feuilleter'); DOUBLE.delete('ficeler');
E_GRAVE.delete('fouetter');

const elide = (pron, form) => (pron === 'je' && /^[aeiouyhàâéèêëîïôûœ]/i.test(form)) ? "j'" + form : pron + ' ' + form;

function supported(inf) {
  if (!/^[\p{L}-]+$/u.test(inf)) return null;
  if (inf === 'aller' || /^(envoyer|renvoyer)$/.test(inf)) return null;
  if (/er$/.test(inf) && inf.length >= 4) return 1;
  if (GROUPE2.has(inf)) return 2;
  return null;
}

// Radical d'un verbe en -er devant une terminaison muette (e, es, ent).
function stemEr(inf) {
  const s = inf.slice(0, -2);
  if (/(oy|uy|ay)$/.test(s)) return s.slice(0, -1) + 'i';
  if (DOUBLE.has(inf)) return s + s.slice(-1);
  if (E_GRAVE.has(inf)) return s.replace(/e([^e]*)$/, 'è$1');
  if (/é[^aeiouyéèêë]+$/.test(s)) return s.replace(/é([^é]*)$/, 'è$1'); // preferer : je prefere
  return s;
}

function conjugate(inf, temps) {
  inf = inf.trim().toLowerCase();
  const g = supported(inf);
  if (!g) return null;
  if (temps === 'passé composé' && ETRE.has(inf)) return null;
  const out = [];
  if (g === 1) {
    const r = inf.slice(0, -2);
    const nous = (suffix) => {
      // cer -> ç, ger -> ge devant a / o
      if (/c$/.test(r) && /^[ao]/.test(suffix)) return r.slice(0, -1) + 'ç' + suffix;
      if (/g$/.test(r) && /^[ao]/.test(suffix)) return r + 'e' + suffix;
      return r + suffix;
    };
    const futStem = (() => {
      if (DOUBLE.has(inf)) return r + r.slice(-1) + 'er';
      if (E_GRAVE.has(inf)) return r.replace(/e([^e]*)$/, 'è$1') + 'er';
      if (/(oy|uy|ay)$/.test(r)) return r.slice(0, -1) + 'ier';
      return inf;
    })();
    if (temps === 'présent') {
      const m = stemEr(inf), end = ['e', 'es', 'e', null, 'ez', 'ent'];
      PERSONNES.forEach((p, i) => out.push(elide(p, p === 'nous' ? nous('ons') : (p === 'vous' ? r + 'ez' : m + end[i]))));
    } else if (temps === 'imparfait') {
      const end = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
      PERSONNES.forEach((p, i) => out.push(elide(p, nous(end[i]))));
    } else if (temps === 'futur simple') {
      const end = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
      PERSONNES.forEach((p, i) => out.push(elide(p, futStem + end[i])));
    } else if (temps === 'conditionnel présent') {
      const end = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
      PERSONNES.forEach((p, i) => out.push(elide(p, futStem + end[i])));
    } else if (temps === 'passé composé') {
      const aux = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];
      PERSONNES.forEach((p, i) => out.push(elide(p, aux[i] + ' ' + r + 'é')));
    } else return null;
  } else {
    const r = inf.slice(0, -2);
    if (temps === 'présent') {
      const end = ['is', 'is', 'it', 'issons', 'issez', 'issent'];
      PERSONNES.forEach((p, i) => out.push(elide(p, r + end[i])));
    } else if (temps === 'imparfait') {
      const end = ['issais', 'issais', 'issait', 'issions', 'issiez', 'issaient'];
      PERSONNES.forEach((p, i) => out.push(elide(p, r + end[i])));
    } else if (temps === 'futur simple') {
      const end = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
      PERSONNES.forEach((p, i) => out.push(elide(p, inf + end[i])));
    } else if (temps === 'conditionnel présent') {
      const end = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];
      PERSONNES.forEach((p, i) => out.push(elide(p, inf + end[i])));
    } else if (temps === 'passé composé') {
      const aux = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];
      PERSONNES.forEach((p, i) => out.push(elide(p, aux[i] + ' ' + r + 'i')));
    } else return null;
  }
  return out;
}

// "j'ai chanté" -> "je" ; renvoie '' si la forme ne commence pas par un pronom connu.
const PRON = { "j'": 'je', 'j’': 'je', je: 'je', tu: 'tu', il: 'il', elle: 'il', nous: 'nous', vous: 'vous', ils: 'ils', elles: 'ils' };
function personneOf(texte) {
  const m = texte.toLowerCase().match(/^(j['’]|je |tu |il |elle |nous |vous |ils |elles )/);
  return m ? PRON[m[1].trim()] : '';
}

module.exports = { conjugate, personneOf, PERSONNES };
