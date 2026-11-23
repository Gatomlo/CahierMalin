'use strict';
/* ---------------- FLASHCARDS ---------------- */
function renderFlash(){
  var stage = $('#flashStage');
  if(nav.idx >= nav.round.length){ finishRound(); return; }
  var item = nav.round[nav.idx];
  updateProgress('flash');
  nav.stage = 'look';
  paintFlashLook(item);
}
function paintFlashLook(item){
  var stage = $('#flashStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'word-display'}, escapeHtml(item.w)));
  if(item.s) stage.appendChild(el('div',{class:'sentence-display'}, escapeHtml(item.s)));
  var btn = el('button',{class:'btn btn-primary btn-lg'}, 'Je suis prêt, cache le mot');
  btn.addEventListener('click', function(){ paintFlashWrite(item); });
  stage.appendChild(btn);
}
function paintFlashWrite(item){
  var stage = $('#flashStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'hidden-word'}, '• '.repeat(item.w.replace(/\s/g,'').length).trim()));
  if(item.s) stage.appendChild(el('div',{class:'sentence-display'}, escapeHtml(item.s.replace(new RegExp(escapeRegex(item.w),'i'), '_____'))));
  var input = el('input',{class:'answer-input', type:'text', autocomplete:'off', autocapitalize:'off', spellcheck:'false', placeholder:'Écris le mot ici', 'aria-label':'Ta réponse'});
  stage.appendChild(input);
  var btn = el('button',{class:'btn btn-primary btn-lg'}, 'Vérifier');
  btn.addEventListener('click', function(){ paintFlashCheck(item, input.value); });
  input.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ paintFlashCheck(item, input.value); } });
  stage.appendChild(btn);
  input.focus();
}
function paintFlashCheck(item, typed){
  typed = (typed||'').trim();
  var correct = typed.toLowerCase() === item.w.toLowerCase();
  recordAttempt(item.w, correct);
  var stage = $('#flashStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'feedback-banner '+(correct?'ok':'no')}, (correct?ICON_CHECK:ICON_CROSS) + (correct? 'Exact !' : 'Pas tout à fait')));
  stage.appendChild(el('div',{class:'diff-line'}, renderDiff(diffWords(item.w, typed || ' '))));
  if(!correct) stage.appendChild(el('div',{class:'sentence-display'}, 'Le mot correct : ' + escapeHtml(item.w)));
  var next = el('button',{class:'btn btn-primary btn-lg'}, nav.idx+1 < nav.round.length ? 'Mot suivant' : 'Voir le résultat');
  next.addEventListener('click', function(){ nav.idx++; renderFlash(); });
  stage.appendChild(next);
}

/* ---------------- DICTEE AUDIO ---------------- */
function renderDictee(){
  if(nav.idx >= nav.round.length){ finishRound(); return; }
  var item = nav.round[nav.idx];
  updateProgress('dictee');
  paintDicteePrompt(item);
}
function paintDicteePrompt(item){
  var stage = $('#dicteeStage');
  stage.innerHTML = '';
  stage.appendChild(el('p',{class:'sentence-display'}, "Écoute bien et écris ce que tu entends."));
  var listenBtn = el('button',{class:'speak-btn'}, ICON_SPEAKER + 'Écouter');
  var toSpeak = item.s || item.w;
  listenBtn.addEventListener('click', function(){ speak(toSpeak); });
  stage.appendChild(listenBtn);
  var replayBtn = el('button',{class:'speak-btn replay'}, ICON_REPLAY + 'Réécouter');
  replayBtn.addEventListener('click', function(){ speak(toSpeak); });
  stage.appendChild(replayBtn);
  var input = el('input',{class:'answer-input', type:'text', autocomplete:'off', autocapitalize:'off', spellcheck:'false', placeholder:'Écris le mot ici', 'aria-label':'Ta réponse'});
  stage.appendChild(input);
  var check = el('button',{class:'btn btn-primary btn-lg'}, 'Vérifier');
  check.addEventListener('click', function(){ paintDicteeCheck(item, input.value); });
  input.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ paintDicteeCheck(item, input.value); } });
  stage.appendChild(check);
  speak(toSpeak);
  setTimeout(function(){ input.focus(); }, 300);
}
function paintDicteeCheck(item, typed){
  typed = (typed||'').trim();
  var correct = typed.toLowerCase() === item.w.toLowerCase();
  recordAttempt(item.w, correct);
  var stage = $('#dicteeStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'feedback-banner '+(correct?'ok':'no')}, (correct?ICON_CHECK:ICON_CROSS) + (correct? 'Exact !' : 'Pas tout à fait')));
  stage.appendChild(el('div',{class:'diff-line'}, renderDiff(diffWords(item.w, typed || ' '))));
  if(item.s) stage.appendChild(el('div',{class:'sentence-display'}, escapeHtml(item.s)));
  var next = el('button',{class:'btn btn-primary btn-lg'}, nav.idx+1 < nav.round.length ? 'Mot suivant' : 'Voir le résultat');
  next.addEventListener('click', function(){ nav.idx++; renderDictee(); });
  stage.appendChild(next);
}

/* ---------------- PHRASE A TROUS ---------------- */
function sentenceRegex(w){ return new RegExp(escapeRegex(w).replace(/['’]/g, "['’]"), 'i'); }
function hasSentence(w){ return !!(w.s && sentenceRegex(w.w).test(w.s)); }
function sameWord(a, b){ return a.trim().toLowerCase().replace(/’/g, "'") === b.trim().toLowerCase().replace(/’/g, "'"); }
function renderCloze(){
  if(nav.idx >= nav.round.length){ finishRound(); return; }
  var item = nav.round[nav.idx];
  updateProgress('cloze');
  paintClozePrompt(item);
}
/* Verbes conjugues : le pronom reste ecrit dans la phrase, seul le verbe est a trouver. */
function clozeSplit(item){
  var m = item.g ? /^(j['’]|je |tu |il |elle |nous |vous |ils |elles )(.+)$/i.exec(item.w) : null;
  return m ? { pron:m[1], rest:m[2] } : { pron:'', rest:item.w };
}
function paintClozePrompt(item){
  var stage = $('#clozeStage');
  stage.innerHTML = '';
  stage.appendChild(el('p',{class:'sentence-display'}, 'Complète la phrase avec le mot qui manque.'));
  if(item.g) stage.appendChild(el('p',{class:'sentence-display'}, 'Verbe : ' + escapeHtml(item.g.replace(/\s*:[^)]*\)/, ')'))));
  var m = sentenceRegex(item.w).exec(item.s);
  var cs = clozeSplit(item), cut = m.index + cs.pron.length;
  var html = escapeHtml(item.s.slice(0, cut)) + '<span class="blank" style="min-width:'+Math.max(2.4, cs.rest.length*0.6)+'em"></span>' + escapeHtml(item.s.slice(m.index + m[0].length));
  stage.appendChild(el('div',{class:'sentence-display', style:'font-size:1.25rem;color:var(--ink);line-height:1.8;'}, html));
  var input = el('input',{class:'answer-input', type:'text', autocomplete:'off', autocapitalize:'off', spellcheck:'false', placeholder: cs.pron ? 'Écris le verbe (le pronom est déjà écrit)' : 'Écris le mot qui manque', 'aria-label':'Ta réponse'});
  stage.appendChild(input);
  var check = el('button',{class:'btn btn-primary btn-lg'}, 'Vérifier');
  check.addEventListener('click', function(){ paintClozeCheck(item, input.value); });
  input.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ paintClozeCheck(item, input.value); } });
  stage.appendChild(check);
  setTimeout(function(){ input.focus(); }, 200);
}
function paintClozeCheck(item, typed){
  typed = (typed||'').trim();
  var cs = clozeSplit(item);
  var full = sameWord(typed, item.w);          // l'enfant a aussi retape le pronom : accepte
  var correct = full || sameWord(typed, cs.rest);
  var target = full ? item.w : cs.rest;
  recordAttempt(item.w, correct);
  var stage = $('#clozeStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'feedback-banner '+(correct?'ok':'no')}, (correct?ICON_CHECK:ICON_CROSS) + (correct? 'Exact !' : 'Pas tout à fait')));
  stage.appendChild(el('div',{class:'diff-line'}, renderDiff(diffWords(target, typed || ' '))));
  var rl = getList(nav.listId).rule;
  if(!correct && rl) stage.appendChild(el('div',{class:'rule-card small'}, '<strong>À retenir : ' + escapeHtml(rl.nom) + '</strong>' + (rl.memo ? escapeHtml(rl.memo) : '')));
  var m = sentenceRegex(item.w).exec(item.s);
  stage.appendChild(el('div',{class:'sentence-display', style:'color:var(--ink);'}, escapeHtml(item.s.slice(0, m.index)) + '<strong>' + escapeHtml(m[0]) + '</strong>' + escapeHtml(item.s.slice(m.index + m[0].length))));
  var listen = el('button',{class:'speak-btn replay'}, ICON_SPEAKER + 'Écouter la phrase');
  listen.addEventListener('click', function(){ speak(item.s); });
  stage.appendChild(listen);
  var next = el('button',{class:'btn btn-primary btn-lg'}, nav.idx+1 < nav.round.length ? 'Mot suivant' : 'Voir le résultat');
  next.addEventListener('click', function(){ nav.idx++; renderCloze(); });
  stage.appendChild(next);
}

/* ---------------- DICTEE-AVENTURE ---------------- */
var ADV_THEMES = ['libre','pirates','forêt enchantée','espace','ferme','château','enquête mystère','dinosaures'];
function advCfg(){
  var c = state.settings.aventure || {};
  return { theme: c.theme || 'libre', chapitres: Math.max(2, Math.min(10, parseInt(c.chapitres, 10) || 5)), anciens: Math.max(0, Math.min(5, parseInt(c.anciens, 10) || 0)) };
}
// Mots des autres listes (ceux ou l'enfant a fait des erreurs d'abord)
function pickOldWords(n){
  if(!n) return [];
  var here = {}; getList(nav.listId).words.forEach(function(w){ here[w.w.toLowerCase()] = true; });
  var pool = [];
  state.lists.forEach(function(l){
    if(l.id === nav.listId) return;
    l.words.forEach(function(w){
      if(w.g || here[w.w.toLowerCase()]) return;
      var p = peekProgress(l.id, w.w);
      pool.push({ w:w.w, bad:(p && p.wrongCount) ? 1 : 0 });
    });
  });
  var bad = shuffle(pool.filter(function(x){ return x.bad; })), ok = shuffle(pool.filter(function(x){ return !x.bad; }));
  return bad.concat(ok).slice(0, n).map(function(x){ return x.w; });
}
function oldWordsAvailable(){
  return state.lists.some(function(l){ return l.id !== nav.listId && l.words.length; });
}
function advProgress(label, pct){
  $('#aventureProgressLabel').textContent = label;
  $('#aventureProgressBar').style.width = pct + '%';
}
function stepperEl(value, min, max, onChange){
  var box = el('div',{class:'stepper'});
  var minus = el('button',{type:'button','aria-label':'Diminuer'}, '−');
  var out = el('output',{}, String(value));
  var plus = el('button',{type:'button','aria-label':'Augmenter'}, '+');
  function set(v){ v = Math.max(min, Math.min(max, v)); out.textContent = String(v); onChange(v); }
  minus.addEventListener('click', function(){ set(parseInt(out.textContent, 10) - 1); });
  plus.addEventListener('click', function(){ set(parseInt(out.textContent, 10) + 1); });
  box.appendChild(minus); box.appendChild(out); box.appendChild(plus);
  return box;
}
function renderAventureSetup(){
  var stage = $('#aventureStage');
  var cfg = advCfg();
  advProgress('Prêt', 0);
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'adv-title'}, "Dictée-aventure"));
  stage.appendChild(el('p',{class:'sentence-display'}, "Une histoire va s'écrire avec tes mots. Écoute chaque chapitre, écris la phrase et avance jusqu'au trésor !"));
  var form = el('div',{class:'adv-setup'});
  var rowTheme = el('div',{class:'adv-row'}, '<span>Univers</span>');
  var sel = el('select',{'aria-label':'Univers de l\'histoire'});
  (serverCfg.themes && serverCfg.themes.length ? serverCfg.themes : ADV_THEMES).forEach(function(th){
    var o = el('option',{value:th}, escapeHtml(th === 'libre' ? 'Surprise' : th));
    if(th === cfg.theme) o.selected = true;
    sel.appendChild(o);
  });
  rowTheme.appendChild(sel);
  var rowLen = el('div',{class:'adv-row'}, '<span>Chapitres (une phrase chacun)</span>');
  rowLen.appendChild(stepperEl(cfg.chapitres, 2, 10, function(v){ cfg.chapitres = v; }));
  form.appendChild(rowTheme); form.appendChild(rowLen);
  if(oldWordsAvailable()){
    var rowOld = el('div',{class:'adv-row'}, '<span>Mots de mes anciennes listes</span>');
    rowOld.appendChild(stepperEl(cfg.anciens, 0, 5, function(v){ cfg.anciens = v; }));
    form.appendChild(rowOld);
  }
  stage.appendChild(form);
  var go = el('button',{class:'btn btn-primary btn-lg'}, 'Partir à l\'aventure');
  go.addEventListener('click', function(){
    cfg.theme = sel.value;
    state.settings.aventure = cfg;
    saveState();
    startAventure(cfg);
  });
  stage.appendChild(go);
}
function startAventure(cfg){
  var stage = $('#aventureStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'adv-title'}, "L'histoire s'écrit…"));
  stage.appendChild(el('p',{class:'sentence-display'}, 'Cela peut prendre quelques secondes.'));
  apiFetch('api/aventure', { method:'POST', body: JSON.stringify({
    mots: nav.round.map(function(w){ return w.w; }), anciens: pickOldWords(cfg.anciens), chapitres: cfg.chapitres, theme: cfg.theme
  }) }).then(function(r){
    nav.story = r; nav.chap = 0; nav.recorded = {}; nav.wrote = [];
    prefetchSpeech(r.chapitres.map(function(c){ return { text:c.phrase, slow:true }; }));
    renderChapter();
  }).catch(function(e){ toast(e.message); renderAventureSetup(); });
}
function trailEl(current, total, finished){
  var tr = el('div',{class:'trail', role:'img', 'aria-label':'Chapitre ' + Math.min(current+1, total) + ' sur ' + total});
  for(var i=0;i<total;i++){
    var done = finished || i < current;
    tr.appendChild(el('span',{class:'trail-node'+(done?' done':(i===current?' now':''))}, done ? ICON_CHECK : String(i+1)));
    tr.appendChild(el('span',{class:'trail-link'+(done?' done':'')}));
  }
  tr.appendChild(el('span',{class:'trail-node goal'+(finished?' done':'')}, ICON_RIBBON));
  return tr;
}
// Comparaison mot a mot (LCS) entre la phrase attendue et ce que l'enfant a ecrit
function normTok(s){ return s.replace(/’/g, "'").toLowerCase().replace(/^[.,;:!?«»"()–—…\- ]+|[.,;:!?«»"()–—…\- ]+$/g, ''); }
function compareSentence(expected, typed){
  var raw = expected.trim().split(/\s+/), E = raw.map(normTok);
  var T = typed.trim().split(/\s+/).map(normTok).filter(Boolean);
  var n = E.length, m = T.length, dp = [], i, j;
  for(i=0;i<=n;i++) dp.push(new Array(m+1).fill(0));
  for(i=n-1;i>=0;i--) for(j=m-1;j>=0;j--) dp[i][j] = E[i] === T[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  var ok = new Array(n).fill(false);
  i = 0; j = 0;
  while(i<n && j<m){
    if(E[i] === T[j]){ ok[i] = true; i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]) i++;
    else j++;
  }
  return { raw:raw, norm:E, ok:ok };
}
// true / false si le mot est dans la phrase, null s'il n'y est pas
function wordResult(cmp, w){
  var W = w.trim().split(/\s+/).map(normTok);
  for(var s=0; s+W.length <= cmp.norm.length; s++){
    var hit = true, k;
    for(k=0;k<W.length;k++) if(cmp.norm[s+k] !== W[k]){ hit = false; break; }
    if(hit){
      for(k=0;k<W.length;k++) if(!cmp.ok[s+k]) return false;
      return true;
    }
  }
  return null;
}
function renderChapter(){
  var stage = $('#aventureStage'), story = nav.story, total = story.chapitres.length;
  if(nav.chap >= total){ renderAventureEnd(); return; }
  var c = story.chapitres[nav.chap];
  advProgress('Chapitre ' + (nav.chap+1) + ' / ' + total, Math.round(nav.chap/total*100));
  stage.innerHTML = '';
  stage.appendChild(trailEl(nav.chap, total, false));
  stage.appendChild(el('div',{class:'adv-title'}, escapeHtml(story.titre)));
  stage.appendChild(el('div',{class:'adv-chapter'}, 'Chapitre ' + (nav.chap+1) + (c.decor ? ' · ' + escapeHtml(c.decor) : '')));
  if(nav.chap > 0){
    stage.appendChild(el('div',{class:'adv-journal'}, '<strong>Carnet de bord</strong> ' + story.chapitres.slice(0, nav.chap).map(function(x){ return escapeHtml(x.phrase); }).join(' ')));
  }
  var listen = el('button',{class:'speak-btn'}, ICON_SPEAKER + 'Écouter le chapitre');
  listen.addEventListener('click', function(){ speak(c.phrase, true); });
  var replay = el('button',{class:'speak-btn replay'}, ICON_REPLAY + 'Réécouter');
  replay.addEventListener('click', function(){ speak(c.phrase, true); });
  stage.appendChild(listen); stage.appendChild(replay);
  var area = el('textarea',{class:'adv-text', autocomplete:'off', autocapitalize:'off', spellcheck:'false', placeholder:'Écris la phrase que tu entends', 'aria-label':'Ta phrase'});
  stage.appendChild(area);
  var check = el('button',{class:'btn btn-primary btn-lg'}, 'Valider ma phrase');
  check.addEventListener('click', function(){ checkChapter(c, area.value); });
  stage.appendChild(check);
  setTimeout(function(){ speak(c.phrase, true); area.focus(); }, 350);
}
function checkChapter(c, typed){
  typed = (typed || '').trim();
  var stage = $('#aventureStage'), story = nav.story, total = story.chapitres.length;
  var cmp = compareSentence(c.phrase, typed);
  story.mots.forEach(function(w){
    if(nav.recorded[w]) return;
    var r = wordResult(cmp, w);
    if(r !== null){ nav.recorded[w] = true; recordAttempt(w, r); }
  });
  var perfect = cmp.ok.every(function(v){ return v; });
  stage.innerHTML = '';
  stage.appendChild(trailEl(nav.chap + 1, total, false));
  stage.appendChild(el('div',{class:'feedback-banner '+(perfect?'ok':'no')}, (perfect?ICON_CHECK:ICON_CROSS) + (perfect ? 'Chapitre réussi, tu avances !' : 'Un obstacle… mais tu continues !')));
  stage.appendChild(el('div',{class:'adv-sentence'}, cmp.raw.map(function(tok, i){
    return '<span class="'+(cmp.ok[i] ? 'tk-ok' : 'tk-bad')+'">'+escapeHtml(tok)+'</span>';
  }).join(' ')));
  if(!perfect) stage.appendChild(el('div',{class:'adv-wrote'}, 'Tu as écrit : ' + escapeHtml(typed || '(rien)')));
  var listen = el('button',{class:'speak-btn replay'}, ICON_SPEAKER + 'Écouter la phrase');
  listen.addEventListener('click', function(){ speak(c.phrase, false); });
  stage.appendChild(listen);
  var last = nav.chap + 1 >= total;
  var next = el('button',{class:'btn btn-primary btn-lg'}, last ? 'Découvrir le trésor' : 'Chapitre suivant');
  next.addEventListener('click', function(){ nav.chap++; renderChapter(); });
  stage.appendChild(next);
}
function renderAventureEnd(){
  var stage = $('#aventureStage'), story = nav.story;
  advProgress('Trésor trouvé', 100);
  stage.innerHTML = '';
  stage.appendChild(trailEl(story.chapitres.length, story.chapitres.length, true));
  stage.appendChild(el('div',{class:'adv-title'}, 'Fin de l\'aventure !'));
  var won = nav.results.filter(function(r){ return r.correct; }).length;
  stage.appendChild(el('p',{class:'sentence-display'}, 'Tu rapportes ' + won + ' mot' + (won>1?'s':'') + ' sur ' + nav.results.length + '. Voici toute l\'histoire :'));
  var box = el('div',{class:'adv-story'}, '<h4>' + escapeHtml(story.titre) + '</h4>');
  story.chapitres.forEach(function(c, i){
    box.appendChild(el('h4',{}, 'Chapitre ' + (i+1) + (c.decor ? ' · ' + escapeHtml(c.decor) : '')));
    box.appendChild(el('p',{}, escapeHtml(c.phrase)));
  });
  stage.appendChild(box);
  var read = el('button',{class:'speak-btn replay'}, ICON_SPEAKER + "Écouter l'histoire");
  read.addEventListener('click', function(){ speak(story.chapitres.map(function(c){ return c.phrase; }).join(' '), true); });
  stage.appendChild(read);
  var done = el('button',{class:'btn btn-primary btn-lg'}, 'Voir le résultat');
  done.addEventListener('click', function(){ finishRound(); });
  stage.appendChild(done);
}

/* ---------------- QUIZ ---------------- */
function renderQuiz(){
  if(nav.idx >= nav.round.length){ finishRound(); return; }
  var item = nav.round[nav.idx];
  updateProgress('quiz');
  var stage = $('#quizStage');
  stage.innerHTML = '';
  // Variante « Trouve l'erreur » : 3 mots de la liste bien ecrits + 1 mot mal ecrit, a repérer.
  var others = shuffle(getList(nav.listId).words.filter(function(w){ return w.w !== item.w && w.w.indexOf(' ') === -1; })).slice(0, 3);
  var canErr = others.length === 3 && item.w.indexOf(' ') === -1;
  if(canErr){
    var tog = el('button',{class:'btn btn-ghost', type:'button', style:'padding:4px 12px;font-size:.8rem;margin-bottom:8px;', 'aria-pressed': state.settings.quizErreur ? 'true' : 'false'}, 'Trouve l’erreur : ' + (state.settings.quizErreur ? 'oui' : 'non'));
    tog.addEventListener('click', function(){ state.settings.quizErreur = !state.settings.quizErreur; saveState(); renderQuiz(); });
    stage.appendChild(tog);
  }
  if(canErr && state.settings.quizErreur){ renderQuizErreur(item, others, stage); return; }
  if(item.s){
    var blanked = item.s.replace(new RegExp(escapeRegex(item.w),'i'), '<span class="blank">&nbsp;</span>');
    stage.appendChild(el('div',{class:'sentence-display'}, blanked));
  } else {
    stage.appendChild(el('p',{class:'sentence-display'}, 'Quelle est la bonne orthographe ?'));
  }
  var listenBtn = el('button',{class:'speak-btn replay'}, ICON_SPEAKER + 'Écouter le mot');
  listenBtn.addEventListener('click', function(){ speak(item.w); });
  stage.appendChild(listenBtn);

  var distractors = makeDistractors(item.w, 3);
  var options = shuffle([item.w].concat(distractors));
  var grid = el('div',{class:'quiz-options'});
  var answered = false;
  options.forEach(function(opt){
    var b = el('button',{class:'quiz-opt', type:'button'}, escapeHtml(opt));
    b.addEventListener('click', function(){
      if(answered) return;
      answered = true;
      var correct = opt === item.w;
      recordAttempt(item.w, correct);
      $all('.quiz-opt', grid).forEach(function(o){
        o.setAttribute('disabled','true');
        if(o.textContent === item.w) o.classList.add('correct');
        else if(o === b) o.classList.add('wrong');
      });
      var next = el('button',{class:'btn btn-primary btn-lg', style:'margin-top:16px;'}, nav.idx+1 < nav.round.length ? 'Question suivante' : 'Voir le résultat');
      next.addEventListener('click', function(){ nav.idx++; renderQuiz(); });
      stage.appendChild(next);
    });
    grid.appendChild(b);
  });
  stage.appendChild(grid);
}

function updateProgress(mode){
  var label = $('#'+mode+'ProgressLabel');
  var bar = $('#'+mode+'ProgressBar');
  label.textContent = (nav.idx+1) + ' / ' + nav.round.length;
  bar.style.width = Math.round((nav.idx)/nav.round.length*100) + '%';
}

/* ---------------- LETTRES MÊLÉES ---------------- */
function renderScramble(){
  if(nav.idx >= nav.round.length){ finishRound(); return; }
  var item = nav.round[nav.idx];
  updateProgress('scramble');
  paintScramble(item);
}
function scrambleLetters(letters){
  if(letters.length<=1) return letters.slice();
  var attempt, tries=0, original=letters.map(function(l){return l.ch;}).join('');
  do{
    attempt = shuffle(letters);
    tries++;
  } while(attempt.map(function(l){return l.ch;}).join('')===original && tries<10);
  return attempt;
}
function paintScramble(item){
  var stage = $('#scrambleStage');
  stage.innerHTML = '';
  if(item.s) stage.appendChild(el('div',{class:'sentence-display'}, escapeHtml(item.s.replace(new RegExp(escapeRegex(item.w),'i'), '_____'))));
  else stage.appendChild(el('p',{class:'sentence-display'}, 'Remets les lettres dans le bon ordre.'));

  var tokens = item.w.split(' ');
  var tokenStates = tokens.map(function(tok){
    var letters = tok.split('').map(function(ch, i){ return { ch:ch, id:tok+'_'+i+'_'+Math.random(), used:false }; });
    return { slots: new Array(letters.length).fill(null), tiles: scrambleLetters(letters) };
  });

  var wrap = el('div',{class:'scramble-wrap'});
  stage.appendChild(wrap);
  var checkBtn = el('button',{class:'btn btn-primary btn-lg'}, 'Vérifier');
  checkBtn.setAttribute('disabled','true');
  checkBtn.addEventListener('click', function(){
    var typed = tokenStates.map(function(ts){ return ts.slots.map(function(s){ return s.ch; }).join(''); }).join(' ');
    paintScrambleCheck(item, typed);
  });

  function checkComplete(){
    var complete = tokenStates.every(function(ts){ return ts.slots.every(function(s){ return s!==null; }); });
    if(complete) checkBtn.removeAttribute('disabled'); else checkBtn.setAttribute('disabled','true');
  }
  function renderBlocks(){
    wrap.innerHTML = '';
    tokenStates.forEach(function(ts){
      var block = el('div',{class:'scramble-block'});
      var slotsRow = el('div',{class:'scramble-slots'});
      ts.slots.forEach(function(val, i){
        var slot = el('button',{class:'scramble-slot'+(val?' filled':''), type:'button'}, val ? escapeHtml(val.ch) : '');
        if(val){
          slot.addEventListener('click', function(){
            var tile = ts.tiles.find(function(t){ return t.id===val.id; });
            tile.used = false;
            ts.slots[i] = null;
            renderBlocks();
            checkComplete();
          });
        }
        slotsRow.appendChild(slot);
      });
      var trayRow = el('div',{class:'scramble-tray'});
      ts.tiles.forEach(function(tile){
        var tileBtn = el('button',{class:'scramble-tile'+(tile.used?' used':''), type:'button'}, escapeHtml(tile.ch));
        tileBtn.addEventListener('click', function(){
          if(tile.used) return;
          var freeIdx = ts.slots.indexOf(null);
          if(freeIdx===-1) return;
          ts.slots[freeIdx] = tile;
          tile.used = true;
          renderBlocks();
          checkComplete();
        });
        trayRow.appendChild(tileBtn);
      });
      block.appendChild(slotsRow);
      block.appendChild(trayRow);
      wrap.appendChild(block);
    });
  }
  renderBlocks();
  stage.appendChild(checkBtn);
}
function paintScrambleCheck(item, typed){
  var correct = typed.toLowerCase() === item.w.toLowerCase();
  recordAttempt(item.w, correct);
  var stage = $('#scrambleStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'feedback-banner '+(correct?'ok':'no')}, (correct?ICON_CHECK:ICON_CROSS) + (correct? 'Exact !' : 'Pas tout à fait')));
  stage.appendChild(el('div',{class:'diff-line'}, renderDiff(diffWords(item.w, typed))));
  if(!correct) stage.appendChild(el('div',{class:'sentence-display'}, 'Le mot correct : ' + escapeHtml(item.w)));
  var next = el('button',{class:'btn btn-primary btn-lg'}, nav.idx+1 < nav.round.length ? 'Mot suivant' : 'Voir le résultat');
  next.addEventListener('click', function(){ nav.idx++; renderScramble(); });
  stage.appendChild(next);
}

/* ---------------- LE COFFRE-FORT ---------------- */
var SAFE_ITEM = 34;
var SAFE_MAX_TRIES = 3;
var SAFE_BASE = 'aàâbcçdeéèêëfghiîïjklmnoôpqrstuùûüvwxyz'.split('');
var SAFE_SVG = '<svg viewBox="0 0 120 96" class="safe-svg" aria-hidden="true">'+
  '<rect x="8" y="8" width="104" height="80" rx="10" fill="var(--surface)" stroke="currentColor" stroke-width="3"/>'+
  '<rect x="18" y="18" width="84" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="2"/>'+
  '<g class="dial" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none">'+
    '<circle cx="60" cy="48" r="14"/><path d="M60 34v6M60 56v6M46 48h6M68 48h6"/></g>'+
  '<path class="treasure" d="M60 28l5.5 12.6 13.5 1.2-10.2 9 3.1 13.4L60 57.2 48.1 64.2l3.1-13.4-10.2-9 13.5-1.2z" fill="var(--gold)" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>'+
  '</svg>';
var ICON_CHEVRON_UP = '<svg viewBox="0 0 20 20" fill="none"><path d="M5 12.5 10 7.5l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var ICON_CHEVRON_DOWN = '<svg viewBox="0 0 20 20" fill="none"><path d="M5 7.5 10 12.5l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function isWheelChar(ch){ return /[a-zàâäçéèêëîïôöùûüÿœæ]/i.test(ch); }
function renderSafe(){
  if(nav.idx >= nav.round.length){ finishRound(); return; }
  updateProgress('safe');
  paintSafe(nav.round[nav.idx]);
}
function paintSafe(item){
  var stage = $('#safeStage');
  stage.innerHTML = '';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var noSpeech = !window.speechSynthesis;
  var tries = 0, done = false;

  var figure = el('div',{class:'safe-figure'}, SAFE_SVG);
  stage.appendChild(figure);
  var triesBox = el('div',{class:'safe-tries', role:'img'});
  stage.appendChild(triesBox);
  function paintTries(){
    triesBox.innerHTML = '';
    triesBox.setAttribute('aria-label', (SAFE_MAX_TRIES - tries) + ' essai(s) restant(s)');
    for(var i=0;i<SAFE_MAX_TRIES;i++){ triesBox.appendChild(el('span',{class:'try'+(i<tries?' used':'')})); }
  }
  paintTries();

  if(item.s){
    stage.appendChild(el('div',{class:'sentence-display'}, escapeHtml(item.s).replace(new RegExp(escapeRegex(escapeHtml(item.w)),'i'), '<span class="blank">&nbsp;</span>')));
  } else {
    stage.appendChild(el('p',{class:'sentence-display'}, 'Compose le code : le mot à trouver.'));
  }
  if(noSpeech){
    stage.appendChild(el('div',{class:'sentence-display'}, 'Audio indisponible. Le code est : <strong>' + escapeHtml(item.w) + '</strong>'));
  } else {
    var row = el('div',{class:'row-actions'});
    var listen = el('button',{class:'speak-btn', type:'button'}, ICON_SPEAKER + 'Écouter le mot');
    listen.addEventListener('click', function(){ speak(item.w); });
    row.appendChild(listen);
    if(item.s){
      var listenS = el('button',{class:'speak-btn replay', type:'button'}, ICON_SPEAKER + 'Écouter la phrase');
      listenS.addEventListener('click', function(){ speak(item.s); });
      row.appendChild(listenS);
    }
    stage.appendChild(row);
  }

  var wheels = [];
  var box = el('div',{class:'safe-wheels'});
  var group = null;
  function newGroup(){ group = el('div',{class:'wheel-group'}); box.appendChild(group); }
  newGroup();
  item.w.split('').forEach(function(ch){
    if(ch === ' '){ newGroup(); return; }
    if(!isWheelChar(ch)){ group.appendChild(el('span',{class:'wheel-static'}, escapeHtml(ch))); return; }
    var want = ch.toLowerCase();
    var options = SAFE_BASE.slice();
    if(options.indexOf(want) === -1) options.push(want);
    var w = { options:options, want:want, idx:Math.floor(Math.random()*options.length) };
    var col = el('div',{class:'wheel'});
    var up = el('button',{class:'wheel-btn', type:'button', tabindex:'-1', 'aria-label':'Lettre précédente'}, ICON_CHEVRON_UP);
    var down = el('button',{class:'wheel-btn', type:'button', tabindex:'-1', 'aria-label':'Lettre suivante'}, ICON_CHEVRON_DOWN);
    var frame = el('div',{class:'wheel-frame'});
    var view = el('div',{class:'wheel-view', tabindex:'0', 'aria-label':'Molette de lettres'});
    var list = el('div',{class:'wheel-list'});
    options.forEach(function(o){ list.appendChild(el('div',{class:'wheel-item'}, escapeHtml(o))); });
    view.appendChild(list);
    frame.appendChild(view);
    var light = el('span',{class:'wheel-light'});
    col.appendChild(up); col.appendChild(frame); col.appendChild(down); col.appendChild(light);
    group.appendChild(col);
    w.view = view; w.light = light; w.items = list.children;
    function currentIdx(){ return Math.max(0, Math.min(options.length-1, Math.round(view.scrollTop / SAFE_ITEM))); }
    function markSel(){
      for(var j=0;j<w.items.length;j++){ w.items[j].classList.toggle('sel', j === w.idx); }
    }
    w.read = function(){ w.idx = currentIdx(); markSel(); return options[w.idx]; };
    view.addEventListener('scroll', function(){
      var i = currentIdx();
      if(i !== w.idx){ w.idx = i; markSel(); light.className = 'wheel-light'; }
    });
    up.addEventListener('click', function(){ view.scrollBy({ top:-SAFE_ITEM, behavior: reduce ? 'auto' : 'smooth' }); });
    down.addEventListener('click', function(){ view.scrollBy({ top:SAFE_ITEM, behavior: reduce ? 'auto' : 'smooth' }); });
    wheels.push(w);
  });
  stage.appendChild(box);
  wheels.forEach(function(w){ w.view.scrollTop = w.idx * SAFE_ITEM; w.read(); });

  var msg = el('p',{class:'safe-msg', 'aria-live':'polite'}, 'Tourne les molettes pour écrire le mot, puis ouvre le coffre.');
  stage.appendChild(msg);
  var actions = el('div',{class:'row-actions'});
  var openBtn = el('button',{class:'btn btn-primary btn-lg', type:'button'}, 'Ouvrir le coffre');
  actions.appendChild(openBtn);
  stage.appendChild(actions);

  function end(win){
    done = true;
    recordAttempt(item.w, win);
    wheels.forEach(function(w){ w.view.style.pointerEvents = 'none'; w.view.tabIndex = -1; });
    figure.classList.toggle('open', win);
    msg.remove();
    stage.insertBefore(el('div',{class:'feedback-banner '+(win?'ok':'no')}, (win?ICON_CHECK:ICON_CROSS) + (win ? 'Coffre ouvert, bravo !' : 'Coffre verrouillé')), box);
    if(!win) stage.insertBefore(el('div',{class:'sentence-display'}, 'Le code était : <strong>' + escapeHtml(item.w) + '</strong>'), box);
    actions.innerHTML = '';
    var next = el('button',{class:'btn btn-primary btn-lg', type:'button'}, nav.idx+1 < nav.round.length ? 'Mot suivant' : 'Voir le résultat');
    next.addEventListener('click', function(){ nav.idx++; renderSafe(); });
    actions.appendChild(next);
  }
  openBtn.addEventListener('click', function(){
    if(done) return;
    var allOk = true;
    wheels.forEach(function(w){
      var ok = w.read() === w.want;
      if(!ok) allOk = false;
      w.light.className = 'wheel-light ' + (ok ? 'ok' : 'bad');
    });
    tries++;
    paintTries();
    if(allOk){ end(true); }
    else if(tries >= SAFE_MAX_TRIES){ end(false); }
    else {
      var left = SAFE_MAX_TRIES - tries;
      msg.textContent = 'Pas encore ! Vert = bonne lettre, rouge = à changer. Il reste ' + left + ' essai' + (left>1?'s':'') + '.';
    }
  });
  if(!noSpeech) setTimeout(function(){ if(!done) speak(item.w); }, 250);
}

/* ---------------- MEMORY ---------------- */
var memoryToken = 0;
function setGameProgress(mode, done, total, unit){
  $('#'+mode+'ProgressLabel').textContent = done + ' / ' + total + ' ' + unit;
  $('#'+mode+'ProgressBar').style.width = Math.round(done / Math.max(1, total) * 100) + '%';
}
function renderMemory(){
  var token = ++memoryToken;
  var stage = $('#memoryStage');
  stage.innerHTML = '';
  var words = nav.round;
  var total = words.length, matched = 0, open = [], locked = false;
  var strikes = {};
  words.forEach(function(w){ strikes[w.w] = 0; });
  var noSpeech = !window.speechSynthesis;
  var cards = [];
  words.forEach(function(w, i){
    cards.push({ pair:i, type:'word', item:w });
    cards.push({ pair:i, type:'audio', item:w });
  });
  cards = shuffle(cards);
  setGameProgress('memory', 0, total, 'paires');
  stage.appendChild(el('p',{class:'sentence-display'}, 'Retourne deux cartes : un mot écrit et sa version audio forment une paire.'));
  var grid = el('div',{class:'memory-grid'});
  stage.appendChild(grid);

  function finishMemory(){
    words.forEach(function(w){ recordAttempt(w.w, strikes[w.w] <= 2); });
    var weak = words.filter(function(w){ return strikes[w.w] > 2; });
    stage.appendChild(el('div',{class:'feedback-banner ok'}, ICON_CHECK + 'Toutes les paires sont trouvées !'));
    if(weak.length){
      stage.appendChild(el('div',{class:'sentence-display'}, 'À revoir : ' + escapeHtml(weak.map(function(w){ return w.w; }).join(', '))));
    }
    var next = el('button',{class:'btn btn-primary btn-lg'}, 'Voir le résultat');
    next.addEventListener('click', function(){ finishRound(); });
    stage.appendChild(next);
  }
  function onFlip(c){
    if(token !== memoryToken) return;
    if(c.matched){ if(c.type==='audio') speak(c.item.w); return; }
    if(locked || open.indexOf(c) !== -1) return;
    c.el.classList.add('up');
    c.el.setAttribute('aria-label', c.type==='word' ? c.item.w : 'Audio');
    if(c.type==='audio') speak(c.item.w);
    open.push(c);
    if(open.length < 2) return;
    var a = open[0], b = open[1];
    if(a.pair === b.pair){
      a.matched = b.matched = true;
      a.el.classList.add('matched'); b.el.classList.add('matched');
      open = [];
      matched++;
      setGameProgress('memory', matched, total, 'paires');
      if(matched === total) finishMemory();
    } else {
      strikes[a.item.w]++; strikes[b.item.w]++;
      locked = true;
      setTimeout(function(){
        if(token !== memoryToken) return;
        a.el.classList.remove('up'); b.el.classList.remove('up');
        open = []; locked = false;
      }, 1000);
    }
  }
  cards.forEach(function(c){
    var front = c.type==='word' ? escapeHtml(c.item.w) : (noSpeech ? '<em>' + escapeHtml(c.item.w) + '</em>' : ICON_SPEAKER);
    var b = el('button',{class:'mem-card', type:'button', 'aria-label':'Carte cachée'});
    b.innerHTML = '<span class="mem-back">?</span><span class="mem-front">' + front + '</span>';
    c.el = b;
    b.addEventListener('click', function(){ onFlip(c); });
    grid.appendChild(b);
  });
}

/* ---------------- MOTS MÊLÉS ---------------- */
var WS_DIRS = [[0,1],[1,0],[1,1],[-1,1]];
var WS_FILL = 'AAAEEEIIOOUUBCDFGHLMNPRSTV';
function buildWordsearch(words){
  var maxLen = Math.max.apply(null, words.map(function(w){ return wsClean(w.w).length; }));
  var n = Math.max(8, maxLen);
  var grid = [];
  for(var r=0;r<n;r++){ grid.push(new Array(n).fill('')); }
  var placed = [];
  words.slice().sort(function(a,b){ return wsClean(b.w).length - wsClean(a.w).length; }).forEach(function(w){
    var s = wsClean(w.w), ok = false;
    for(var t=0; t<300 && !ok; t++){
      var d = WS_DIRS[Math.floor(Math.random()*WS_DIRS.length)];
      var r0 = Math.floor(Math.random()*n), c0 = Math.floor(Math.random()*n);
      var r1 = r0 + d[0]*(s.length-1), c1 = c0 + d[1]*(s.length-1);
      if(r1<0 || r1>=n || c1<0 || c1>=n) continue;
      var fits = true, i;
      for(i=0;i<s.length;i++){
        var ch = grid[r0+d[0]*i][c0+d[1]*i];
        if(ch !== '' && ch !== s[i]){ fits = false; break; }
      }
      if(!fits) continue;
      var cells = [];
      for(i=0;i<s.length;i++){ grid[r0+d[0]*i][c0+d[1]*i] = s[i]; cells.push([r0+d[0]*i, c0+d[1]*i]); }
      placed.push({ item:w, str:s, cells:cells, found:false });
      ok = true;
    }
  });
  for(var rr=0;rr<n;rr++){
    for(var cc=0;cc<n;cc++){
      if(grid[rr][cc] === '') grid[rr][cc] = WS_FILL.charAt(Math.floor(Math.random()*WS_FILL.length));
    }
  }
  return { n:n, grid:grid, placed:placed };
}
function renderWordsearch(){
  var stage = $('#wordsearchStage');
  stage.innerHTML = '';
  var built = buildWordsearch(nav.round);
  var n = built.n, placed = built.placed;
  if(!placed.length){ toast('Impossible de créer la grille.'); openDashboard(nav.listId); return; }
  var foundCount = 0, done = false, start = null, cur = null, dragging = false, anchor = null;
  setGameProgress('wordsearch', 0, placed.length, 'mots');
  stage.appendChild(el('p',{class:'sentence-display'}, "Glisse le doigt de la première à la dernière lettre d'un mot (ou touche ces deux lettres). Les mots peuvent aller en ligne, en colonne ou en diagonale."));
  var wordsBox = el('div',{class:'ws-words'});
  placed.forEach(function(p){ p.chip = el('span',{class:'ws-word'}, escapeHtml(p.item.w)); wordsBox.appendChild(p.chip); });
  stage.appendChild(wordsBox);
  var grid = el('div',{class:'ws-grid'});
  grid.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
  var cellEls = [];
  for(var r=0;r<n;r++){
    var row = [];
    for(var c=0;c<n;c++){
      var cell = el('div',{class:'ws-cell'}, built.grid[r][c]);
      cell.dataset.r = r; cell.dataset.c = c;
      grid.appendChild(cell);
      row.push(cell);
    }
    cellEls.push(row);
  }
  stage.appendChild(grid);
  var actions = el('div',{class:'row-actions'});
  var giveUp = el('button',{class:'btn btn-ghost', type:'button'}, 'Je passe');
  actions.appendChild(giveUp);
  stage.appendChild(actions);

  function posOf(cell){ return [parseInt(cell.dataset.r,10), parseInt(cell.dataset.c,10)]; }
  function cellFrom(e){
    var t = document.elementFromPoint(e.clientX, e.clientY);
    var cell = t && t.closest ? t.closest('.ws-cell') : null;
    return cell && grid.contains(cell) ? cell : null;
  }
  function lineCells(a, b){
    var dr = b[0]-a[0], dc = b[1]-a[1];
    if(!(dr===0 || dc===0 || Math.abs(dr)===Math.abs(dc))) return null;
    var steps = Math.max(Math.abs(dr), Math.abs(dc));
    var sr = dr===0 ? 0 : dr/Math.abs(dr), sc = dc===0 ? 0 : dc/Math.abs(dc);
    var out = [];
    for(var i=0;i<=steps;i++){ out.push([a[0]+sr*i, a[1]+sc*i]); }
    return out;
  }
  function clearSel(){
    for(var i=0;i<n;i++){ for(var j=0;j<n;j++){ cellEls[i][j].classList.remove('sel'); } }
  }
  function paintSel(a, b){
    clearSel();
    var cells = lineCells(a, b) || [a];
    cells.forEach(function(p){ cellEls[p[0]][p[1]].classList.add('sel'); });
  }
  function finishGame(allFound){
    done = true;
    clearSel();
    placed.forEach(function(p){
      if(!p.found){
        recordAttempt(p.item.w, false);
        p.chip.classList.add('missed');
        p.cells.forEach(function(q){ cellEls[q[0]][q[1]].className = 'ws-cell f3'; });
      }
    });
    actions.innerHTML = '';
    stage.insertBefore(el('div',{class:'feedback-banner '+(allFound?'ok':'no')}, (allFound?ICON_CHECK:ICON_CROSS) + (allFound ? 'Tous les mots sont trouvés !' : 'Voici les mots que tu as manqués')), wordsBox);
    var next = el('button',{class:'btn btn-primary btn-lg'}, 'Voir le résultat');
    next.addEventListener('click', function(){ finishRound(); });
    actions.appendChild(next);
  }
  function tryWord(a, b){
    var cells = lineCells(a, b);
    clearSel();
    if(!cells || cells.length < 2) return;
    var str = cells.map(function(p){ return built.grid[p[0]][p[1]]; }).join('');
    var rev = str.split('').reverse().join('');
    var hit = placed.find(function(p){ return !p.found && (p.str === str || p.str === rev); });
    if(!hit) return;
    hit.found = true;
    var tone = 'f' + (foundCount % 6);
    cells.forEach(function(p){ cellEls[p[0]][p[1]].className = 'ws-cell ' + tone; });
    hit.chip.classList.add('found');
    foundCount++;
    recordAttempt(hit.item.w, true);
    setGameProgress('wordsearch', foundCount, placed.length, 'mots');
    if(foundCount === placed.length) finishGame(true);
  }
  grid.addEventListener('pointerdown', function(e){
    if(done) return;
    var cell = cellFrom(e);
    if(!cell) return;
    e.preventDefault();
    if(anchor){
      var a = anchor; anchor = null;
      tryWord(a, posOf(cell));
      return;
    }
    dragging = true; start = posOf(cell); cur = start;
    paintSel(start, cur);
  });
  grid.addEventListener('pointermove', function(e){
    if(!dragging || done) return;
    var cell = cellFrom(e);
    if(!cell) return;
    var p = posOf(cell);
    if(p[0] !== cur[0] || p[1] !== cur[1]){ cur = p; paintSel(start, cur); }
  });
  function endDrag(){
    if(!dragging) return;
    dragging = false;
    if(cur[0] === start[0] && cur[1] === start[1]){ anchor = start; return; }
    tryWord(start, cur);
  }
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', function(){ dragging = false; anchor = null; clearSel(); });
  giveUp.addEventListener('click', function(){ if(!done) finishGame(false); });
}

/* ---------------- LE PENDU ---------------- */
var HANGMAN_MAX = 6;
var HANGMAN_SVG = '<svg viewBox="0 0 120 140" class="hangman-svg" aria-hidden="true">'+
  '<line x1="10" y1="130" x2="90" y2="130" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<line x1="30" y1="130" x2="30" y2="10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<line x1="30" y1="10" x2="80" y2="10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<line x1="80" y1="10" x2="80" y2="25" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<circle class="part p1" cx="80" cy="38" r="13" stroke="currentColor" stroke-width="3" fill="none"/>'+
  '<line class="part p2" x1="80" y1="51" x2="80" y2="90" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<line class="part p3" x1="80" y1="60" x2="65" y2="75" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<line class="part p4" x1="80" y1="60" x2="95" y2="75" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<line class="part p5" x1="80" y1="90" x2="68" y2="115" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '<line class="part p6" x1="80" y1="90" x2="92" y2="115" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'+
  '</svg>';
var DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');
function deaccent(s){ return s.normalize('NFD').replace(DIACRITICS_RE, ''); }
function renderHangman(){
  if(nav.idx >= nav.round.length){ finishRound(); return; }
  var item = nav.round[nav.idx];
  updateProgress('hangman');
  paintHangman(item);
}
function paintHangman(item){
  var stage = $('#hangmanStage');
  stage.innerHTML = '';
  var normalized = deaccent(item.w.toLowerCase());
  var revealed = item.w.split('').map(function(ch){ return !/[a-zàâçéèêëîïôùûü]/i.test(ch); });
  var guessed = {};
  var wrong = 0;

  var wrap = el('div',{class:'hangman-wrap'});
  var svgHolder = el('div',{class:'hangman-figure'}, HANGMAN_SVG);
  wrap.appendChild(svgHolder);
  var wordRow = el('div',{class:'hangman-word'});
  wrap.appendChild(wordRow);
  stage.appendChild(wrap);
  if(item.s) stage.appendChild(el('p',{class:'sentence-display'}, 'Astuce : ' + escapeHtml(item.s.replace(new RegExp(escapeRegex(item.w),'i'), '...'))));
  stage.appendChild(el('p',{class:'sentence-display'}, 'Les accents apparaissent automatiquement.'));
  var keys = el('div',{class:'hangman-keys'});
  stage.appendChild(keys);

  function renderWord(){
    wordRow.innerHTML = '';
    item.w.split('').forEach(function(ch, i){
      var box = el('span',{class:'hangman-letterbox'+(ch===' '?' is-space':'')}, revealed[i] ? escapeHtml(ch) : '');
      wordRow.appendChild(box);
    });
  }
  function updateFigure(){
    for(var i=1;i<=HANGMAN_MAX;i++){
      var part = svgHolder.querySelector('.p'+i);
      if(part) part.classList.toggle('visible', i<=wrong);
    }
  }
  renderWord(); updateFigure();

  var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  var keyButtons = {};
  alphabet.forEach(function(letter){
    var b = el('button',{class:'key-btn', type:'button'}, letter.toUpperCase());
    b.addEventListener('click', function(){ guessLetter(letter, b); });
    keys.appendChild(b);
    keyButtons[letter] = b;
  });

  function guessLetter(letter, btn){
    if(guessed[letter]) return;
    guessed[letter] = true;
    btn.setAttribute('disabled','true');
    var found = false;
    for(var i=0;i<normalized.length;i++){
      if(normalized[i]===letter){ revealed[i]=true; found=true; }
    }
    if(found){ btn.classList.add('used-correct'); }
    else { btn.classList.add('used-wrong'); wrong++; updateFigure(); }
    renderWord();
    if(revealed.every(function(v){return v;})){ endHangman(true); }
    else if(wrong>=HANGMAN_MAX){ endHangman(false); }
  }

  function endHangman(win){
    recordAttempt(item.w, win);
    alphabet.forEach(function(l){ keyButtons[l].setAttribute('disabled','true'); });
    revealed = revealed.map(function(){ return true; });
    renderWord();
    var banner = el('div',{class:'feedback-banner '+(win?'ok':'no')}, (win?ICON_CHECK:ICON_CROSS) + (win?'Sauvé, bravo !':'Oh non...'));
    stage.appendChild(banner);
    if(!win) stage.appendChild(el('div',{class:'sentence-display'}, 'Le mot était : ' + escapeHtml(item.w)));
    var next = el('button',{class:'btn btn-primary btn-lg'}, nav.idx+1 < nav.round.length ? 'Mot suivant' : 'Voir le résultat');
    next.addEventListener('click', function(){ nav.idx++; renderHangman(); });
    stage.appendChild(next);
  }
}


/* ---------------- COURSE CONTRE LA MONTRE ---------------- */
var RACE_SECONDS = 60;
function raceBest(){ return ((state.settings.race || {})[nav.listId]) || 0; }
function renderRaceIntro(){
  var stage = $('#raceStage');
  stage.innerHTML = '';
  stage.appendChild(el('div',{class:'adv-title'}, 'Course contre la montre'));
  stage.appendChild(el('p',{class:'sentence-display'}, RACE_SECONDS + ' secondes : écoute chaque mot et écris-le le plus vite possible. Entrée pour valider.'));
  stage.appendChild(el('p',{class:'hint'}, raceBest() ? 'Ton record sur cette liste : ' + raceBest() + ' mot' + (raceBest()>1?'s':'') + '.' : 'Pas encore de record sur cette liste.'));
  var go = el('button',{class:'btn btn-primary btn-lg'}, 'Partir !');
  go.addEventListener('click', startRace);
  stage.appendChild(go);
}
function startRace(){
  nav.race = { score:0, left:RACE_SECONDS, pool:[], over:false };
  nav.results = [];
  var stage = $('#raceStage');
  stage.innerHTML = '';
  var clock = el('div',{class:'race-clock'}, String(RACE_SECONDS));
  var score = el('div',{class:'hint'}, '0 mot juste');
  stage.appendChild(clock); stage.appendChild(score);
  var area = el('div');
  stage.appendChild(area);
  var timer = setInterval(function(){
    if(nav.screen !== 'race' || nav.mode !== 'race'){ clearInterval(timer); return; }
    nav.race.left--;
    clock.textContent = String(Math.max(0, nav.race.left));
    if(nav.race.left <= 0){ clearInterval(timer); endRace(); }
  }, 1000);
  function nextWord(){
    if(nav.race.over) return;
    if(!nav.race.pool.length) nav.race.pool = shuffle(nav.round.slice());
    var item = nav.race.pool.pop();
    area.innerHTML = '';
    var replay = el('button',{class:'speak-btn replay'}, ICON_REPLAY + 'Réécouter');
    replay.addEventListener('click', function(){ speak(item.w); });
    area.appendChild(replay);
    var input = el('input',{class:'answer-input', type:'text', autocomplete:'off', autocapitalize:'off', spellcheck:'false', placeholder:'Écris le mot', 'aria-label':'Ta réponse'});
    area.appendChild(input);
    var busy = false;
    function validate(){
      if(busy || nav.race.over) return;
      busy = true;
      var ok = input.value.trim().toLowerCase() === item.w.toLowerCase();
      recordAttempt(item.w, ok);
      if(ok){ nav.race.score++; score.textContent = nav.race.score + ' mot' + (nav.race.score>1?'s':'') + ' juste' + (nav.race.score>1?'s':''); nextWord(); }
      else {
        area.appendChild(el('div',{class:'feedback-banner no'}, ICON_CROSS + 'C’était : ' + escapeHtml(item.w)));
        setTimeout(nextWord, 900);
      }
    }
    input.addEventListener('keydown', function(ev){ if(ev.key === 'Enter') validate(); });
    var ok = el('button',{class:'btn btn-primary btn-lg'}, 'Valider');
    ok.addEventListener('click', validate);
    area.appendChild(ok);
    speak(item.w);
    setTimeout(function(){ input.focus(); }, 50);
  }
  nextWord();
}
function endRace(){
  if(!nav.race || nav.race.over) return;
  nav.race.over = true;
  var sc = nav.race.score, best = raceBest(), record = sc > best;
  if(record){ state.settings.race = state.settings.race || {}; state.settings.race[nav.listId] = sc; saveState(); }
  if(!nav.results.length){ openDashboard(nav.listId); return; }
  finishRound();
  var line = 'Course : ' + sc + ' mot' + (sc>1?'s':'') + ' en ' + RACE_SECONDS + ' s' + (record ? ' — nouveau record !' : ' (record : ' + best + ')');
  $('#resultsScore').textContent = line + ' · ' + $('#resultsScore').textContent;
}

function renderQuizErreur(item, others, stage){
  var wrong = makeDistractors(item.w, 1)[0];
  stage.appendChild(el('p',{class:'sentence-display'}, 'Quel mot est mal écrit ?'));
  var options = shuffle(others.map(function(w){ return w.w; }).concat([wrong]));
  var grid = el('div',{class:'quiz-options'});
  var answered = false;
  options.forEach(function(opt){
    var b = el('button',{class:'quiz-opt', type:'button'}, escapeHtml(opt));
    b.addEventListener('click', function(){
      if(answered) return;
      answered = true;
      var correct = opt === wrong;
      recordAttempt(item.w, correct);
      $all('.quiz-opt', grid).forEach(function(o){
        o.setAttribute('disabled','true');
        if(o.textContent === wrong) o.classList.add('correct');
        else if(o === b) o.classList.add('wrong');
      });
      stage.appendChild(el('p',{class:'hint'}, 'Le bon mot : ' + escapeHtml(item.w) + '.'));
      var next = el('button',{class:'btn btn-primary btn-lg', style:'margin-top:16px;'}, nav.idx+1 < nav.round.length ? 'Question suivante' : 'Voir le résultat');
      next.addEventListener('click', function(){ nav.idx++; renderQuiz(); });
      stage.appendChild(next);
    });
    grid.appendChild(b);
  });
  stage.appendChild(grid);
}
