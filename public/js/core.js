'use strict';

var STORAGE_KEY = 'cahierMalin_v2_' + (function(){ try{ return localStorage.getItem('cahierMalin_pid') || '0'; }catch(e){ return '0'; } })();
var ROUND_SIZE = 10;
var MIN_LIST_WORDS = 6;

var ICON_SPEAKER = '<svg viewBox="0 0 20 20" fill="none"><path d="M4 8v4a1 1 0 0 0 1 1h2l4 3V4L7 7H5a1 1 0 0 0-1 1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 7.5c.9.7.9 4.3 0 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
var ICON_REPLAY = '<svg viewBox="0 0 20 20" fill="none"><path d="M15 10a5 5 0 1 1-1.6-3.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M15 4v3.5H11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_CHECK = '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5 8 14l8-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_CROSS = '<svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
var ICON_FLASH = '<svg viewBox="0 0 20 20" fill="none"><path d="M4 6h12v9H4z" stroke="currentColor" stroke-width="1.6"/><path d="M4 6l6 4 6-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_QUIZ = '<svg viewBox="0 0 20 20" fill="none"><path d="M10 13v-.5c0-1 .6-1.4 1.3-1.9.7-.5 1.2-1 1.2-1.9A2.5 2.5 0 0 0 10 6.2 2.5 2.5 0 0 0 7.5 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="15.5" r=".9" fill="currentColor"/></svg>';
var ICON_SCRAMBLE = '<svg viewBox="0 0 20 20" fill="none"><path d="M3 6h3l8 8h3M3 14h3l3-3M14 6h3M17 6l-2.3-2M17 6l-2.3 2M17 14l-2.3-2M17 14l-2.3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_CLOCK = '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="11" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="M10 7.5V11l2.5 1.5M8 2.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_HANGMAN = '<svg viewBox="0 0 20 20" fill="none"><path d="M4 17h5M6.5 17V3M6.5 3h6.5v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="13" cy="8.3" r="1.7" stroke="currentColor" stroke-width="1.6"/><path d="M13 10v3.5M11.2 12l1.8.8 1.8-.8M11.6 17l1.4-2 1.4 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
var ICON_SAFE = '<svg viewBox="0 0 20 20" fill="none"><rect x="3" y="3.5" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="9.5" r="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M6 15.5V17M14 15.5V17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
var ICON_MEMORY ='<svg viewBox="0 0 20 20" fill="none"><rect x="2.5" y="5.5" width="8" height="11" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="9.5" y="3.5" width="8" height="11" rx="1.6" stroke="currentColor" stroke-width="1.6" fill="var(--surface)"/><path d="M13.5 7.5v3M12 9h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
var ICON_WORDSEARCH = '<svg viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M12.3 12.3 17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 8.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
var ICON_CLOZE = '<svg viewBox="0 0 20 20" fill="none"><path d="M3 6h14M3 10h4M13 10h4M3 14h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8.5 11.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
var ICON_ADVENTURE = '<svg viewBox="0 0 20 20" fill="none"><path d="M2.5 16.5 7.5 6l3.5 6 2-3 4.5 7.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 3v4M13 3.5h3l-.8 1.2.8 1.2h-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_RIBBON = '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 11 6 18l4-2 4 2-1.5-7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/* ---------------- default data ---------------- */
function defaultLists(){
  return [{
    id:'exemple',
    name:"Liste d'exemple (CE2-CM1)",
    words:[
      {w:"aujourd'hui", s:"Aujourd'hui, nous allons visiter le musée."},
      {w:"beaucoup", s:"Il y avait beaucoup de monde sur la plage."},
      {w:"toujours", s:"Elle arrive toujours en avance à l'école."},
      {w:"quelquefois", s:"Quelquefois, il neige encore en avril."},
      {w:"difficile", s:"Cet exercice de mathématiques est difficile."},
      {w:"une hirondelle", s:"Une hirondelle a fait son nid sous le toit."},
      {w:"intéressant", s:"Ce livre est vraiment intéressant."},
      {w:"environ", s:"Le village se trouve à environ dix kilomètres."},
      {w:"ensemble", s:"Nous avons préparé le gâteau ensemble."},
      {w:"tout à coup", s:"Tout à coup, le ciel est devenu noir."},
      {w:"un exercice", s:"Le maître a distribué un nouvel exercice."},
      {w:"longtemps", s:"Nous avons attendu longtemps sous la pluie."}
    ]
  }];
}

function loadState(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      var s = JSON.parse(raw);
      s.lists = s.lists || defaultLists();
      s.progress = s.progress || {};
      s.stars = s.stars || 0;
      s.settings = s.settings || {};
      if(!s.settings.target) s.settings.target = 3;
      s.gradeFloors = s.gradeFloors || {};
      return s;
    }
  }catch(e){}
  return { lists:defaultLists(), progress:{}, stars:0, settings:{ target:3 }, gradeFloors:{} };
}
/* Le serveur (SQLite) garde les listes et la progression par profil ; le navigateur
   en garde une copie pour fonctionner hors ligne. */
var serverLoaded = false, saveTimer = null;
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  if(!serverLoaded) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(pushState, 400);
}
function currentPid(){
  try{ return parseInt(localStorage.getItem('cahierMalin_pid'), 10) || 0; }catch(e){ return 0; }
}
var me = null, appStarted = false;
function apiFetch(path, opts){
  opts = opts || {};
  opts.headers = Object.assign({ 'Content-Type':'application/json', 'X-Profil': String(currentPid()) }, opts.headers || {});
  return fetch(path, opts).then(function(r){
    if(!r.ok) return r.json().catch(function(){ return {}; }).then(function(j){
      var e = new Error(j.error || 'Erreur serveur'); e.status = r.status; e.data = j;
      if(r.status === 401 && j.login && appStarted) location.reload(); // session expiree
      throw e;
    });
    return r.json();
  });
}
/* Fusion quand un autre appareil a enregistre entre-temps : listes du serveur + listes locales
   absentes du serveur ; progression et etoiles : on garde le plus avance de chaque cote. */
function mergeMax(a, b){
  if(typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if(a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)){
    var out = {}; Object.keys(b).forEach(function(k){ out[k] = b[k]; });
    Object.keys(a).forEach(function(k){ out[k] = k in b ? mergeMax(a[k], b[k]) : a[k]; });
    return out;
  }
  return a !== undefined ? a : b;
}
function mergeWithServer(local, server){
  var ids = {}; server.lists.forEach(function(l){ ids[l.id] = true; });
  return {
    lists: server.lists.concat(local.lists.filter(function(l){ return !ids[l.id]; })),
    progress: mergeMax(local.progress || {}, server.progress || {}),
    stars: Math.max(local.stars || 0, server.stars || 0),
    settings: Object.assign({}, local.settings, server.settings),
    gradeFloors: mergeMax(local.gradeFloors || {}, server.gradeFloors || {}),
    rev: server.rev || 0
  };
}
var syncStatus = 'ok';
function setSyncStatus(s){
  syncStatus = s;
  var b = document.getElementById('syncBadge');
  if(b){ b.textContent = s === 'ok' ? 'Synchronisé' : (s === 'pending' ? 'En attente de synchro' : 'Hors ligne'); b.className = 'sync-badge ' + s; }
}
function pushState(retry){
  setSyncStatus('pending');
  return apiFetch('api/state', { method:'PUT', body: JSON.stringify(state) }).then(function(r){
    state.rev = r.rev; try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
    setSyncStatus('ok');
  }).catch(function(e){
    if(e.status === 409 && e.data && e.data.state && !retry){
      state = mergeWithServer(state, e.data.state);
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(x){}
      toast('Un autre appareil avait enregistré : les données ont été fusionnées.');
      renderHome();
      return pushState(true);
    }
    setSyncStatus('offline');
    toast('Enregistré sur cet appareil seulement (serveur injoignable).');
  });
}
function syncFromServer(){
  serverLoaded = false;
  return apiFetch('api/state').then(function(s){
    if(s.exists){
      state = { lists:s.lists, progress:s.progress || {}, stars:s.stars || 0, settings:s.settings || {}, gradeFloors:s.gradeFloors || {}, rev:s.rev || 0 };
      if(!state.settings.target) state.settings.target = 3;
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
    }
    serverLoaded = true;
    if(!s.exists) return pushState();
  }).then(function(){
    updateStarStamp(); renderHome();
    if(nav.screen !== 'home') goto('home');
  }).catch(function(){});
}

var state = loadState();
var nav = { screen:'home', listId:null, mode:null, kind:'learn', reviewAll:false, round:[], idx:0, results:[], stage:'look', startGradeIdx:0 };

/* ---------------- grades & progression ---------------- */
/* Chaque liste a son propre score en % et son propre grade : 100 % seulement
   quand chaque mot de la liste est acquis. Un grade atteint n'est jamais perdu,
   même si l'on ajoute des mots à la liste ensuite. */
var MODE_IDS = ['flash','quiz','memory','wordsearch','scramble','safe','hangman','dictee','cloze','aventure','race'];
var GRADES = [
  { key:'cp', label:'CP', pct:0 },
  { key:'ce1', label:'CE1', pct:12 },
  { key:'ce2', label:'CE2', pct:28 },
  { key:'cm1', label:'CM1', pct:45 },
  { key:'cm2', label:'CM2', pct:65 },
  { key:'6e', label:'6ème', pct:85 },
  { key:'diplome', label:'Champion de dictée', pct:100 }
];
var MODE_DEFS = [
  { id:'flash', title:'Cache-cache', desc:"Regarde le mot, cache-le, écris-le de mémoire.", icon:ICON_FLASH },
  { id:'quiz', title:'Quiz éclair', desc:"Choisis la bonne orthographe parmi 4 propositions.", icon:ICON_QUIZ },
  { id:'memory', title:'Memory', desc:"Retrouve chaque mot écrit et sa version audio.", icon:ICON_MEMORY },
  { id:'wordsearch', title:'Mots mêlés', desc:"Retrouve les mots cachés dans la grille de lettres.", icon:ICON_WORDSEARCH },
  { id:'scramble', title:'Lettres mêlées', desc:"Remets les lettres mélangées dans le bon ordre.", icon:ICON_SCRAMBLE },
  { id:'safe', title:'Le Coffre-fort', desc:"Écoute le mot, tourne les molettes pour composer le code et ouvre le coffre.", icon:ICON_SAFE },
  { id:'hangman', title:'Le Pendu', desc:"Devine le mot lettre par lettre avant la fin du dessin.", icon:ICON_HANGMAN },
  { id:'aventure', title:'Dictée-aventure', desc:"Une histoire écrite pour toi avec tes mots : avance de chapitre en chapitre pour trouver le trésor.", icon:ICON_ADVENTURE },
  { id:'cloze', title:'Phrase à trous', desc:"Retrouve le mot qui manque dans une phrase simple et écris-le.", icon:ICON_CLOZE },
  { id:'race', title:'Course contre la montre', desc:"60 secondes pour écrire un maximum de mots entendus. Bats ton record !", icon:ICON_CLOCK },
  { id:'dictee', title:'Dictée audio', desc:"Écoute le mot puis écris-le, sans aucune aide visuelle : la vraie dictée.", icon:ICON_SPEAKER }
];
function targetCount(){
  var t = parseInt(state.settings && state.settings.target, 10) || 3;
  return Math.max(1, Math.min(MODE_IDS.length, t));
}
function peekProgress(listId, word){
  return (state.progress[listId] && state.progress[listId][word]) || null;
}
function successCount(listId, word){
  var p = peekProgress(listId, word);
  return p && p.modes ? Object.keys(p.modes).length : 0;
}
function isAcquired(listId, word){ return successCount(listId, word) >= targetCount(); }
function scoreOfLists(lists){
  var X = targetCount(), pts = 0, max = 0;
  lists.forEach(function(l){
    max += l.words.length * X;
    l.words.forEach(function(w){ pts += Math.min(successCount(l.id, w.w), X); });
  });
  return { pts:pts, max:max, pct: max ? Math.floor(pts / max * 100) : 0 };
}
function currentGradeIdx(listId){
  var list = getList(listId);
  if(!list) return 0;
  var pct = scoreOfLists([list]).pct, idx = 0;
  for(var i=0;i<GRADES.length;i++){ if(pct >= GRADES[i].pct) idx = i; }
  var floor = state.gradeFloors[listId] || 0;
  if(idx > floor){ state.gradeFloors[listId] = idx; saveState(); floor = idx; }
  return Math.max(idx, floor);
}
var LIST_SCREENS = ['dashboard','flash','dictee','cloze','aventure','quiz','memory','wordsearch','scramble','safe','hangman','race','results'];
function updateRankChip(){
  var chip = $('#rankChip');
  var list = getList(nav.listId);
  if(!list || LIST_SCREENS.indexOf(nav.screen) === -1){ chip.style.display = 'none'; return; }
  chip.style.display = '';
  var pct = scoreOfLists([list]).pct;
  var idx = currentGradeIdx(list.id);
  $('#rankLabel').textContent = GRADES[idx].label;
  if(idx + 1 < GRADES.length){
    var cur = GRADES[idx].pct, nxt = GRADES[idx+1].pct;
    var bar = Math.max(0, Math.min(100, Math.round((pct - cur) / Math.max(1, nxt - cur) * 100)));
    $('#rankBar').style.width = bar + '%';
    $('#rankNext').textContent = pct + ' % · ' + GRADES[idx+1].label + ' à ' + nxt + ' %';
  } else {
    $('#rankBar').style.width = '100%';
    $('#rankNext').textContent = 'Niveau maximum !';
  }
}

/* ---------------- helpers ---------------- */
function $(sel, root){ return (root||document).querySelector(sel); }
function $all(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function el(tag, attrs, html){
  var e = document.createElement(tag);
  if(attrs) for(var k in attrs){ e.setAttribute(k, attrs[k]); }
  if(html !== undefined) e.innerHTML = html;
  return e;
}
function shuffle(arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function getList(id){ return state.lists.find(function(l){ return l.id===id; }); }
function wordProgress(listId, word){
  if(!state.progress[listId]) state.progress[listId] = {};
  if(!state.progress[listId][word]) state.progress[listId][word] = { attempts:0, lastWrong:false, wrongCount:0, modes:{} };
  var p = state.progress[listId][word];
  if(!p.modes) p.modes = {};
  return p;
}
function wordStatus(listId, word){
  if(isAcquired(listId, word)) return 'mastered';
  var p = peekProgress(listId, word);
  if(p && p.lastWrong) return 'practice';
  return successCount(listId, word) > 0 ? 'progress' : 'new';
}
function wsClean(w){ return deaccent(w.toLowerCase()).replace(/[^a-z]/g, '').toUpperCase(); }
function canPlay(mode, w){
  if(mode === 'cloze') return hasSentence(w);
  if(mode !== 'wordsearch') return true;
  var n = wsClean(w.w).length;
  return n >= 3 && n <= 12;
}
function roundSizeFor(mode){ if(mode === 'aventure') return 8; if(mode === 'race') return 60; return (mode === 'memory' || mode === 'wordsearch' || mode === 'safe') ? 6 : ROUND_SIZE; }
function eligibleWords(list, mode){
  return list.words.filter(function(w){
    if(!canPlay(mode, w)) return false;
    if(isAcquired(list.id, w.w)) return false;
    var p = peekProgress(list.id, w.w);
    return !(p && p.modes && p.modes[mode]);
  });
}
function toast(msg){
  var t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

/* ---------------- speech ---------------- */
var frVoice = null;
function refreshVoices(){
  if(!window.speechSynthesis) return;
  var voices = speechSynthesis.getVoices();
  frVoice = voices.find(function(v){ return v.lang && v.lang.toLowerCase().indexOf('fr')===0; }) || null;
}
if(window.speechSynthesis){
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;
}
function browserSpeak(text, slow){
  if(!window.speechSynthesis){ toast("La lecture audio n'est pas disponible sur ce navigateur."); return; }
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.rate = slow ? 0.7 : 0.85;
  if(frVoice) u.voice = frVoice;
  speechSynthesis.speak(u);
}
/* Voix du serveur (Gemini, son mis en cache) quand elle existe ; sinon voix du navigateur. */
var serverCfg = { gemini:false, tts:false, themes:[] };
var audioCache = {}, currentAudio = null;
function fetchAudio(text, slow){
  var k = (slow ? 's|' : 'n|') + text;
  if(audioCache[k]) return audioCache[k];
  var p = fetch('api/tts?text=' + encodeURIComponent(text) + (slow ? '&slow=1' : ''))
    .then(function(r){ if(!r.ok) throw new Error('voix'); return r.blob(); })
    .then(function(b){ return URL.createObjectURL(b); });
  audioCache[k] = p;
  p.catch(function(){ delete audioCache[k]; });
  return p;
}
function speak(text, slow){
  if(currentAudio){ currentAudio.pause(); currentAudio = null; }
  if(window.speechSynthesis) speechSynthesis.cancel();
  if(!serverCfg.tts){ browserSpeak(text, slow); return; }
  fetchAudio(text, slow).then(function(url){
    currentAudio = new Audio(url);
    return currentAudio.play();
  }).catch(function(){ browserSpeak(text, slow); });
}
// Prepare les sons d'une manche en arriere-plan (un a la fois, on s'arrete au premier echec).
function prefetchSpeech(items){
  if(!serverCfg.tts) return;
  var i = 0;
  (function next(){
    if(i >= items.length) return;
    var it = items[i++];
    fetchAudio(it.text, it.slow).then(next, function(){});
  })();
}

// Pre-genere les sons de toute la liste (mots et phrases) : ils restent en cache sur le serveur,
// la dictée du jour J n'attend plus l'IA. Un son a la fois ; on s'arrete au premier echec.
function prepareVoices(listId){
  var list = getList(listId), items = [], seen = {};
  list.words.forEach(function(w){
    [w.w, w.s].forEach(function(t){ if(t && !seen[t]){ seen[t] = true; items.push(t); } });
  });
  var st = $('#voiceStatus'), btn = $('#btnVoices'), i = 0, failed = 0;
  btn.setAttribute('disabled','true');
  (function next(){
    if(i >= items.length || failed >= 3){
      btn.removeAttribute('disabled');
      st.textContent = failed >= 3 ? 'Voix interrompue (le serveur ne répond pas) : ' + i + '/' + items.length + ' sons prêts. Tu peux relancer.' : 'Voix prêtes : ' + items.length + ' sons gardés sur le serveur.';
      return;
    }
    st.textContent = 'Préparation des voix… ' + i + '/' + items.length;
    fetchAudio(items[i++]).then(next, function(){ failed++; next(); });
  })();
}

$('#btnVoices').addEventListener('click', function(){ prepareVoices(nav.listId); });

/* ---------------- diff (LCS-based) ---------------- */
function diffWords(correct, typed){
  var a = correct.split(''), b = typed.split('');
  var n=a.length, m=b.length;
  var dp = [];
  for(var i=0;i<=n;i++){ dp.push(new Array(m+1).fill(0)); }
  for(i=n-1;i>=0;i--){
    for(var j=m-1;j>=0;j--){
      if(a[i].toLowerCase()===b[j].toLowerCase()) dp[i][j]=dp[i+1][j+1]+1;
      else dp[i][j]=Math.max(dp[i+1][j],dp[i][j+1]);
    }
  }
  var ops=[]; i=0; var jj=0;
  while(i<n && jj<m){
    if(a[i].toLowerCase()===b[jj].toLowerCase()){ ops.push({t:'equal',c:a[i]}); i++; jj++; }
    else if(dp[i+1][jj] >= dp[i][jj+1]){ ops.push({t:'insert',c:a[i]}); i++; }
    else { ops.push({t:'delete',c:b[jj]}); jj++; }
  }
  while(i<n){ ops.push({t:'insert',c:a[i]}); i++; }
  while(jj<m){ ops.push({t:'delete',c:b[jj]}); jj++; }
  return ops;
}
function renderDiff(ops){
  return ops.map(function(op){
    var cls = op.t==='equal' ? 'diff-equal' : (op.t==='insert' ? 'diff-insert' : 'diff-delete');
    var ch = op.c===' ' ? ' ' : op.c;
    return '<span class="'+cls+'">'+escapeHtml(ch)+'</span>';
  }).join('');
}
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ---------------- distractor generation ---------------- */
var ACCENTS = {'é':'e','è':'e','ê':'e','à':'a','â':'a','ù':'u','û':'u','î':'i','ï':'i','ô':'o','ç':'c'};
function letterIdxs(word){
  var idxs = [];
  for(var i=0;i<word.length;i++){ if(/[a-zàâçéèêëîïôùûü]/i.test(word[i])) idxs.push(i); }
  return idxs;
}
function mutateRemoveAccent(word){
  for(var i=0;i<word.length;i++){
    var lower = word[i].toLowerCase();
    if(ACCENTS[lower]){
      var repl = word[i]===lower ? ACCENTS[lower] : ACCENTS[lower].toUpperCase();
      return word.slice(0,i)+repl+word.slice(i+1);
    }
  }
  return null;
}
function mutateDoubleLetter(word){
  var idxs = letterIdxs(word);
  for(var k=0;k<idxs.length;k++){
    var i = idxs[Math.floor(Math.random()*idxs.length)];
    if(word[i+1] && word[i+1].toLowerCase()===word[i].toLowerCase()){
      return word.slice(0,i)+word.slice(i+1); // undouble
    }
  }
  var i2 = idxs[Math.floor(Math.random()*idxs.length)];
  return word.slice(0,i2+1)+word[i2]+word.slice(i2+1); // double
}
function mutateDropLastLetter(word){
  var m = word.match(/([a-zàâéèêç])$/i);
  if(m && word.length>3) return word.slice(0,-1);
  return null;
}
function mutateSwapAdjacent(word){
  var idxs = letterIdxs(word);
  if(idxs.length<2) return null;
  var pos = Math.floor(Math.random()*(idxs.length-1));
  var i = idxs[pos], j = idxs[pos+1];
  var chars = word.split('');
  var t = chars[i]; chars[i]=chars[j]; chars[j]=t;
  return chars.join('');
}
function makeDistractors(word, count){
  var pool = [];
  var mutators = [mutateRemoveAccent, mutateDoubleLetter, mutateDropLastLetter, mutateSwapAdjacent, mutateSwapAdjacent];
  var tries = 0;
  while(pool.length < count && tries < 30){
    tries++;
    var fn = mutators[Math.floor(Math.random()*mutators.length)];
    var cand = fn(word);
    if(cand && cand.toLowerCase() !== word.toLowerCase() && pool.indexOf(cand) === -1){
      pool.push(cand);
    }
  }
  var fallbackTries = 0;
  while(pool.length < count && fallbackTries < 20){
    fallbackTries++;
    var cand2 = mutateSwapAdjacent(word + (fallbackTries%2? 's':''));
    if(cand2 && cand2.toLowerCase()!==word.toLowerCase() && pool.indexOf(cand2)===-1) pool.push(cand2);
  }
  return pool.slice(0, count);
}

/* ---------------- rendering: HOME ---------------- */
// Relance les lignes de conjugaison restees en attente (IA indisponible a l'enregistrement).
function retryPending(list, btn){
  btn.setAttribute('disabled','true'); btn.textContent = '...';
  buildWords(list.pending, list).then(function(words){
    var have = {};
    list.words.forEach(function(w){ have[w.w.toLowerCase()] = true; });
    words.forEach(function(w){ if(!have[w.w.toLowerCase()]) list.words.push(w); });
    if(words.skipped.length) list.pending = words.skipped; else delete list.pending;
    saveState();
    toast(words.skipped.length ? 'L’IA ne répond toujours pas pour ' + words.skipped.length + ' ligne(s).' : 'Déclinaisons ajoutées à la liste !');
    renderHome();
  }).catch(function(e){ toast(e.message); btn.removeAttribute('disabled'); btn.textContent = 'Relancer'; });
}
/* Serie quotidienne : jours consecutifs avec au moins une manche terminee (gardee dans settings). */
function dayStr(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function streakInfo(){
  var s = state.settings.streak || { last:'', count:0, best:0 };
  var today = dayStr(new Date()), yest = dayStr(new Date(Date.now() - 86400000));
  return { count: (s.last === today || s.last === yest) ? s.count : 0, doneToday: s.last === today, best: s.best || 0 };
}
function touchStreak(){
  var s = state.settings.streak || { last:'', count:0, best:0 };
  var today = dayStr(new Date()), yest = dayStr(new Date(Date.now() - 86400000));
  if(s.last === today) return s.count;
  s = { last: today, count: s.last === yest ? s.count + 1 : 1, best: s.best || 0 };
  if(s.count > s.best) s.best = s.count;
  state.settings.streak = s;
  saveState();
  return s.count;
}
// Jours restants avant la dictee (null si pas de date ou date passee).
function daysUntil(due){
  if(!due) return null;
  var p = due.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]), t = new Date();
  t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  var n = Math.round((d - t) / 86400000);
  return n >= 0 ? n : null;
}
function renderHome(){
  var hint = $('#todayHint'), sk = streakInfo();
  if(state.lists.length){
    hint.hidden = false;
    hint.textContent = sk.doneToday
      ? 'Séance du jour faite' + (sk.count > 1 ? ' : ' + sk.count + ' jours de suite' : '') + ', bravo !'
      : (sk.count ? 'Cinq minutes aujourd’hui pour garder ta série de ' + sk.count + ' jour' + (sk.count>1?'s':'') + ' !' : 'Cinq minutes par jour, c’est le meilleur entraînement.');
  } else hint.hidden = true;
  var box = $('#listsContainer');
  box.innerHTML = '';
  if(state.lists.length === 0){
    box.appendChild(el('div',{class:'empty'}, "Tu n'as pas encore de liste. Crée ta première liste de mots pour commencer à t'entraîner !"));
    return;
  }
  state.lists.forEach(function(list){
    var total = list.words.length;
    var mastered = list.words.filter(function(w){ return isAcquired(list.id, w.w); }).length;
    var pct = scoreOfLists([list]).pct;
    var card = el('div',{class:'list-card'});
    var info = el('div',{class:'info'});
    info.appendChild(el('h3',{}, escapeHtml(list.name)));
    var meta = el('div',{class:'meta'});
    meta.appendChild(document.createTextNode(total+' mot'+(total>1?'s':'')+' · '+mastered+'/'+total+' acquis · '+pct+' % · '+GRADES[currentGradeIdx(list.id)].label));
    var bar = el('div',{class:'mastery-bar'}); var span = el('span',{style:'width:'+pct+'%'}); bar.appendChild(span);
    meta.appendChild(bar);
    info.appendChild(meta);
    var dleft = daysUntil(list.due);
    if(dleft !== null){
      var rest = total - mastered;
      info.appendChild(el('div',{class:'meta countdown'}, escapeHtml('Dictée ' + (dleft === 0 ? "aujourd'hui" : (dleft === 1 ? 'demain' : 'dans ' + dleft + ' jours')) + ' · ' + rest + ' mot' + (rest > 1 ? 's' : '') + ' à revoir')));
    }
    if(list.pending && list.pending.length){
      var pend = el('div',{class:'meta', style:'color:var(--red)'}, escapeHtml(list.pending.length+' déclinaison'+(list.pending.length>1?'s':'')+' en attente de l’IA '));
      var retry = el('button',{type:'button', class:'btn btn-secondary'}, 'Relancer');
      retry.addEventListener('click', function(){ retryPending(list, retry); });
      pend.appendChild(retry);
      info.appendChild(pend);
    }
    card.appendChild(info);
    var actions = el('div',{class:'actions'});
    var studyBtn = el('button',{class:'icon-btn', title:'Étudier'}, '<svg viewBox="0 0 20 20" fill="none"><path d="M6 4l9 6-9 6V4z" fill="currentColor"/></svg>');
    studyBtn.addEventListener('click', function(){ openDashboard(list.id); });
    var editBtn = el('button',{class:'icon-btn', title:'Modifier'}, '<svg viewBox="0 0 20 20" fill="none"><path d="M4 16l.7-3L13 4.7a1.5 1.5 0 0 1 2.1 0l.2.2a1.5 1.5 0 0 1 0 2.1L7 15.3 4 16Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>');
    editBtn.addEventListener('click', function(){ openEditor(list.id); });
    actions.appendChild(studyBtn);
    actions.appendChild(editBtn);
    card.appendChild(actions);
    box.appendChild(card);
  });
}

/* ---------------- dashboard ---------------- */
function openDashboard(listId){
  nav.listId = listId;
  var list = getList(listId);
  $('#dashTitle').textContent = list.name;
  $('#dashCount').textContent = list.words.length + ' mot' + (list.words.length>1?'s':'');
  renderDashboard();
  goto('dashboard');
}

function renderDashboard(){
  var list = getList(nav.listId);
  $('#btnVoices').hidden = !serverCfg.tts; $('#voiceStatus').textContent = '';
  var X = targetCount();
  var sc = scoreOfLists([list]);
  var acquiredN = list.words.filter(function(w){ return isAcquired(list.id, w.w); }).length;
  $('#dashScorePct').textContent = sc.pct + ' %';
  $('#dashScoreBar').style.width = sc.pct + '%';
  $('#dashScoreDetail').textContent = acquiredN + ' mot' + (acquiredN>1?'s':'') + ' acquis sur ' + list.words.length + '. Un mot est acquis quand il est réussi dans ' + X + ' exercice' + (X>1?'s':'') + ' différent' + (X>1?'s':'') + '.';
  $('#segLearn').setAttribute('aria-pressed', nav.reviewAll ? 'false' : 'true');
  $('#segAll').setAttribute('aria-pressed', nav.reviewAll ? 'true' : 'false');
  $('#dashModeHint').textContent = nav.reviewAll
    ? 'Tous les mots sont proposés, même ceux déjà acquis. Ta progression ne change pas.'
    : 'Seuls les mots pas encore réussis dans chaque exercice sont proposés.';
  renderModesGrid(list.id);
  renderWordsPanel(list);
}

function renderModesGrid(listId){
  var list = getList(listId);
  var box = $('#modesContainer');
  box.innerHTML = '';
  MODE_DEFS.forEach(function(def){
    var disabled, meta;
    if(nav.reviewAll){
      var playN = list.words.filter(function(w){ return canPlay(def.id, w); }).length;
      disabled = playN === 0;
      meta = playN ? ('Tous les mots (' + playN + ')') : (def.id === 'cloze' ? "Ajoute des phrases d'exemple" : 'Mots trop longs pour la grille');
    } else {
      var n = eligibleWords(list, def.id).length;
      disabled = n === 0;
      meta = n ? (n + ' mot' + (n>1?'s':'') + ' à faire') : (def.id === 'cloze' && !list.words.some(hasSentence) ? "Ajoute des phrases d'exemple" : 'Tout réussi ici !');
    }
    if(def.id === 'aventure' && !serverCfg.gemini){ disabled = true; meta = 'Demande une clé Gemini (administrateur)'; }
    var card = el('button',{class:'mode-card', type:'button'});
    if(disabled) card.setAttribute('disabled','true');
    card.innerHTML = '<div class="ic">'+def.icon+'</div><h4>'+escapeHtml(def.title)+'</h4><p>'+escapeHtml(def.desc)+'</p><span class="mode-meta">'+escapeHtml(meta)+'</span>';
    if(!disabled){
      card.addEventListener('click', function(){ startMode(def.id, nav.reviewAll ? 'review' : 'learn'); });
    }
    box.appendChild(card);
  });
}

function renderWordsPanel(list){
  var X = targetCount();
  var panel = $('#wordsPanel');
  panel.innerHTML = '';
  var todo = [], done = [];
  list.words.forEach(function(w){ (isAcquired(list.id, w.w) ? done : todo).push(w); });
  function addGroup(title, words, emptyText){
    var group = el('div');
    group.appendChild(el('h3',{class:'wg-title'}, escapeHtml(title)+' <span class="wg-count">'+words.length+'</span>'));
    if(!words.length){ group.appendChild(el('p',{class:'wg-empty'}, emptyText)); }
    var chips = el('div',{class:'word-chips'});
    words.forEach(function(w){
      var status = wordStatus(list.id, w.w);
      var count = Math.min(successCount(list.id, w.w), X);
      var p = peekProgress(list.id, w.w);
      var doneModes = MODE_DEFS.filter(function(m){ return p && p.modes && p.modes[m.id]; }).map(function(m){ return m.title; });
      var chip = el('button',{class:'chip'+(status==='mastered'?' is-acquired':'')+(status==='practice'?' is-practice':''), type:'button'});
      chip.title = doneModes.length ? 'Réussi dans : ' + doneModes.join(', ') : 'Pas encore réussi';
      chip.setAttribute('aria-label', w.w + ', réussi dans ' + count + ' exercice' + (count>1?'s':'') + ' sur ' + X);
      var pips = '';
      for(var i=0;i<X;i++){ pips += '<span class="pip'+(i<count?' on':'')+'"></span>'; }
      chip.innerHTML = (status==='mastered' ? ICON_CHECK.replace('<svg','<svg class="check"') : '') + '<span>'+escapeHtml(w.w)+'</span><span class="pips">'+pips+'</span>';
      chip.addEventListener('click', function(){ speak(w.s || w.w); });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    panel.appendChild(group);
  }
  addGroup('À apprendre', todo, 'Bravo, tous les mots sont acquis !');
  addGroup('Acquis', done, "Aucun mot acquis pour l'instant.");
}

/* ---------------- round setup ---------------- */
function pickRound(listId, mode, kind){
  var list = getList(listId);
  if(kind === 'review'){
    return shuffle(list.words.filter(function(w){ return canPlay(mode, w); })).slice(0, roundSizeFor(mode));
  }
  var words = eligibleWords(list, mode);
  var order = {practice:0, new:1, progress:1, mastered:2};
  words.sort(function(a,b){ return order[wordStatus(listId,a.w)] - order[wordStatus(listId,b.w)]; });
  return shuffle(words.slice(0, roundSizeFor(mode)));
}

function startMode(mode, kind){
  nav.mode = mode;
  nav.kind = kind;
  nav.round = pickRound(nav.listId, mode, kind);
  if(!nav.round.length){ toast('Plus aucun mot à travailler ici.'); openDashboard(nav.listId); return; }
  nav.idx = 0;
  nav.results = [];
  nav.startGradeIdx = currentGradeIdx(nav.listId);
  if(mode !== 'aventure'){
    var seen = {}, queue = [];
    nav.round.forEach(function(it){
      [it.w, it.s].forEach(function(tx){ if(tx && !seen[tx]){ seen[tx] = true; queue.push({ text:tx, slow:false }); } });
    });
    prefetchSpeech(queue);
  }
  if(mode==='flash') { goto('flash'); renderFlash(); }
  else if(mode==='dictee') { goto('dictee'); renderDictee(); }
  else if(mode==='cloze') { goto('cloze'); renderCloze(); }
  else if(mode==='aventure') { goto('aventure'); renderAventureSetup(); }
  else if(mode==='quiz') { goto('quiz'); renderQuiz(); }
  else if(mode==='scramble') { goto('scramble'); renderScramble(); }
  else if(mode==='hangman') { goto('hangman'); renderHangman(); }
  else if(mode==='memory') { goto('memory'); renderMemory(); }
  else if(mode==='wordsearch') { goto('wordsearch'); renderWordsearch(); }
  else if(mode==='safe') { goto('safe'); renderSafe(); }
  else if(mode==='race') { goto('race'); renderRaceIntro(); }
}

/* ---------------- sons de reussite (Web Audio, rien a telecharger) ---------------- */
var soundsOn = (function(){ try{ return localStorage.getItem('cahierMalin_sons') !== '0'; }catch(e){ return true; } })();
var actx = null;
function tone(freq, at, dur, type, vol){
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, actx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(vol || 0.15, actx.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + at + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(actx.currentTime + at); o.stop(actx.currentTime + at + dur + 0.05);
}
function playSound(kind){
  if(!soundsOn) return;
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === 'suspended') actx.resume();
    if(kind === 'ok'){ tone(660, 0, .12); tone(880, .1, .18); }
    else if(kind === 'no'){ tone(260, 0, .18, 'triangle', .12); tone(200, .14, .25, 'triangle', .12); }
    else if(kind === 'win'){ [523, 659, 784, 1047].forEach(function(f, i){ tone(f, i*.12, .22); }); }
  }catch(e){}
}
function updateSoundsBtn(){
  var b = $('#btnSounds');
  b.textContent = 'Sons : ' + (soundsOn ? 'oui' : 'non');
  b.setAttribute('aria-pressed', soundsOn ? 'true' : 'false');
}

/* ---------------- journal des essais (suivi des parents) ---------------- */
var evQueue = [], evTimer = null;
function logEvent(word, ok){
  var l = getList(nav.listId);
  if(!l) return;
  evQueue.push({ at:Date.now(), kind:nav.kind, list:l.name, mode:nav.mode, word:word, ok:!!ok });
  if(evQueue.length > 200) evQueue.shift();
  clearTimeout(evTimer);
  evTimer = setTimeout(flushEvents, 2000);
}
function flushEvents(keepalive){
  if(!evQueue.length || !serverLoaded) return;
  var batch = evQueue.splice(0, 50);
  var opts = { method:'POST', body: JSON.stringify({ events: batch }) };
  if(keepalive === true) opts.keepalive = true;
  apiFetch('api/events', opts).then(function(){ if(evQueue.length) flushEvents(); }).catch(function(){ evQueue = batch.concat(evQueue); });
}
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') flushEvents(true); });

function recordAttempt(word, correct){
  var p = wordProgress(nav.listId, word);
  var rescued = correct && p.lastWrong === true && nav.kind === 'learn';
  var wasAcquired = isAcquired(nav.listId, word);
  if(nav.kind === 'learn'){
    p.attempts++;
    if(correct){ p.lastWrong = false; p.modes[nav.mode] = true; }
    else { p.lastWrong = true; p.wrongCount = (p.wrongCount||0)+1; }
  }
  if(correct){ state.stars++; }
  playSound(correct ? 'ok' : 'no');
  logEvent(word, correct);
  nav.results.push({ word:word, correct:correct, rescued:rescued, acquired: !wasAcquired && isAcquired(nav.listId, word) });
  saveState();
  updateStarStamp();
}

function updateStarStamp(){
  $('#starStamp').innerHTML = '★ ' + state.stars;
  updateRankChip();
}

function finishRound(){
  var okCount = nav.results.filter(function(r){ return r.correct; }).length;
  var bonus = (okCount === nav.results.length && nav.results.length>0) ? 2 : 0;
  if(bonus){ state.stars += bonus; updateStarStamp(); saveState(); playSound('win'); }
  var rescuedN = nav.results.filter(function(r){ return r.rescued; }).length;
  $('#resultsTitle').textContent = rescuedN ? (rescuedN === 1 ? 'Un mot rattrapé, bravo !' : rescuedN + ' mots rattrapés, bravo !') : (okCount===nav.results.length ? 'Sans faute, bravo !' : 'Bien joué !');
  var streakN = nav.kind === 'learn' ? touchStreak() : streakInfo().count;
  $('#resultsTally').textContent = '+' + (okCount+bonus) + ' étoile' + ((okCount+bonus)>1?'s':'');
  var list = $('#resultsList'); list.innerHTML = '';
  nav.results.forEach(function(r){
    var row = el('div',{class:'results-row '+(r.correct?'ok':'no')});
    row.innerHTML = '<span class="w">'+escapeHtml(r.word)+'</span><span class="row-right">' + (r.rescued ? '<span class="tag-acq">rattrapé</span>' : '') + (r.acquired ? '<span class="tag-acq">acquis</span>' : '') + (r.correct ? ICON_CHECK : ICON_CROSS) + '</span>';
    list.appendChild(row);
  });
  var sc = scoreOfLists([getList(nav.listId)]);
  $('#resultsScore').textContent = nav.kind === 'learn'
    ? 'Progression de la liste : ' + sc.pct + ' %' + (streakN > 1 ? ' · Série : ' + streakN + ' jours de suite' : '')
    : 'Manche de révision : ta progression n\'a pas changé (' + sc.pct + ' %).';
  var newGradeIdx = currentGradeIdx(nav.listId);
  var banner = $('#levelupBanner');
  if(newGradeIdx > nav.startGradeIdx){
    var newGrade = GRADES[newGradeIdx];
    banner.hidden = false;
    banner.innerHTML = ICON_RIBBON + '<span>Bravo, tu passes en <strong>'+escapeHtml(newGrade.label)+'</strong> !</span>';
  } else {
    banner.hidden = true;
  }
  goto('results');
}

