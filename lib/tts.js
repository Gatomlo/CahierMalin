// Voix du serveur (Gemini TTS) : le texte est lu une seule fois par Gemini, le son est
// garde sur disque (data/tts/<empreinte>.wav) et resservi ensuite. Utile quand la
// synthese vocale de l'appareil est mauvaise (vieux PC sous Linux...).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const forms = require('./forms');

const DIR = path.join(db.DATA_DIR, 'tts');
const MAX_CHARS = 600;
const VOICES = ['Kore', 'Aoede', 'Leda', 'Puck', 'Charon', 'Zephyr', 'Fenrir', 'Orus'];
const MAX_FILES = 3000; // au-dela, les plus anciens sont supprimes

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function prune() {
  try {
    const files = fs.readdirSync(DIR).map((f) => ({ f, t: fs.statSync(path.join(DIR, f)).mtimeMs })).sort((a, b) => a.t - b.t);
    files.slice(0, Math.max(0, files.length - MAX_FILES)).forEach((x) => fs.unlinkSync(path.join(DIR, x.f)));
  } catch (e) { /* nettoyage facultatif */ }
}

// Renvoie le chemin du fichier son (genere si besoin).
async function audioFor(rawText, slow, overLimit, userVoice) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!text) throw Object.assign(new Error('Texte vide.'), { status: 400, expose: true });
  if (text.length > MAX_CHARS) throw Object.assign(new Error('Texte trop long.'), { status: 400, expose: true });
  if (!forms.hasGemini()) throw Object.assign(new Error('Voix du serveur indisponible (pas de clé Gemini).'), { status: 503, expose: true });
  const voice = VOICES.includes(userVoice) ? userVoice : (process.env.GEMINI_VOICE || 'Kore');
  const model = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
  const key = crypto.createHash('sha1').update([model, voice, slow ? 's' : 'n', text].join('\u0000')).digest('hex');
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, key + '.wav');
  if (fs.existsSync(file)) return file;
  if (overLimit && overLimit()) throw Object.assign(new Error('Trop de voix demandées, réessaie dans une minute.'), { status: 429, expose: true });

  const base = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const style = slow
    ? 'Lis ce texte en français, lentement, avec une diction très claire, comme pour une dictée à un enfant'
    : 'Lis ce mot ou cette phrase en français, d\'une voix claire et posée';
  let res;
  try {
    res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': forms.geminiKey() },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${style} : ${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    throw Object.assign(new Error('La voix ne répond pas.'), { status: 502, expose: true });
  }
  if (!res.ok) {
    console.warn('Gemini TTS HTTP', res.status);
    throw Object.assign(new Error('La voix a refusé la demande.'), { status: 502, expose: true });
  }
  const data = await res.json();
  const part = data && data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts && data.candidates[0].content.parts.find((p) => p.inlineData && p.inlineData.data);
  if (!part) throw Object.assign(new Error('Réponse vocale vide.'), { status: 502, expose: true });
  const pcm = Buffer.from(part.inlineData.data, 'base64');
  const rate = parseInt((/rate=(\d+)/.exec(part.inlineData.mimeType || '') || [])[1], 10) || 24000;
  fs.writeFileSync(file + '.tmp', wav(pcm, rate));
  fs.renameSync(file + '.tmp', file);
  prune();
  return file;
}

module.exports = { audioFor, VOICES };
