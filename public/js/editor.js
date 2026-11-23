'use strict';
/* ---------------- editor ---------------- */
var editingListId = null;
var CONJ_TEMPS = { 'present':'présent', 'imparfait':'imparfait', 'futur':'futur simple', 'futur simple':'futur simple', 'passe compose':'passé composé', 'conditionnel':'conditionnel présent', 'conditionnel present':'conditionnel présent' };
var CONJ_PERS = ['je','tu','il','nous','vous','ils'];
function stripAccents(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
// "chanter (présent : je, nous)" -> { verbe, temps, personnes } ; null si ce n'est pas une conjugaison
function parseConjLine(line){
  var m = /^([A-Za-zÀ-ÿ-]+)\s*\(\s*([^:)]+?)\s*(?::\s*([^)]*))?\)\s*$/.exec(line);
  if(!m) return null;
  var temps = CONJ_TEMPS[stripAccents(m[2].toLowerCase()).replace(/\s+/g,' ')];
  if(!temps) return null;
  var pers = [];
  if(m[3]){
    m[3].split(/[,;\s]+/).forEach(function(p){
      p = stripAccents(p.toLowerCase());
      if(p === 'elle') p = 'il';
      if(p === 'elles') p = 'ils';
      if(CONJ_PERS.indexOf(p) !== -1 && pers.indexOf(p) === -1) pers.push(p);
    });
    if(!pers.length) return null;
  }
  return { verbe:m[1].toLowerCase(), temps:temps, personnes:pers.length ? pers : CONJ_PERS.slice() };
}
function lineKey(line){ var c = parseConjLine(line); return c ? c.verbe + ' (' + c.temps + (c.personnes.length < 6 ? ' : ' + c.personnes.join(', ') : '') + ')' : null; }
function listToText(list){
  var out = [], lastG = null;
  list.words.forEach(function(w){
    if(w.g){ if(w.g !== lastG){ out.push(w.g); lastG = w.g; } return; }
    lastG = null;
    out.push(w.s ? (w.w+' ; '+w.s) : w.w);
  });
  (list.pending || []).forEach(function(l){ out.push(l); });
  return out.join('\n');
}
function updateWordCountHint(){
  var raw = $('#listWords').value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  var n = raw.reduce(function(sum, l){ var c = parseConjLine(l); return sum + (c ? c.personnes.length : 1); }, 0);
  var hint = $('#wordCountHint');
  if(n < MIN_LIST_WORDS){
    hint.textContent = n + ' mot' + (n>1?'s':'') + ' — encore ' + (MIN_LIST_WORDS-n) + ' pour atteindre le minimum de ' + MIN_LIST_WORDS + '.';
    hint.style.color = 'var(--red)';
  } else {
    hint.textContent = n + ' mot' + (n>1?'s':'') + ' dans cette liste.';
    hint.style.color = '';
  }
}
$('#listWords').addEventListener('input', updateWordCountHint);
function openEditor(listId){
  editingListId = listId || null;
  var form = $('#editorForm');
  if(listId){
    var list = getList(listId);
    $('#editorEyebrow').textContent = 'Modifier la liste';
    $('#listName').value = list.name;
    $('#listWords').value = listToText(list);
    $('#btnDeleteList').style.display = 'inline-flex';
  } else {
    $('#editorEyebrow').textContent = 'Nouvelle liste';
    $('#listName').value = '';
    $('#listWords').value = '';
    $('#btnDeleteList').style.display = 'none';
  }
  updateWordCountHint();
  goto('editor');
}
// Lignes -> mots. Les lignes "verbe (temps)" deviennent une forme par personne (mots
// ordinaires, avec g = la ligne d'origine) ; celles d'une liste existante sont reprises
// telles quelles (progression et phrases conservees), les autres demandees au serveur.
function buildWords(raw, existing){
  var known = {};
  (existing ? existing.words : []).forEach(function(w){ if(w.g){ (known[w.g] = known[w.g] || []).push(w); } });
  var jobs = [];
  var plan = raw.map(function(line){
    var c = parseConjLine(line);
    if(!c) { var parts = line.split(';'); return { word:{ w: parts[0].trim(), s: parts[1] ? parts[1].trim() : '' } }; }
    var key = lineKey(line);
    if(known[key]) return { forms: known[key] };
    jobs.push({ verbe:c.verbe, temps:c.temps, personnes:c.personnes, key:key, line:line });
    return { key:key };
  });
  // lots de 12 verbes (limite du serveur) ; un lot en echec laisse ses lignes en attente
  var ask = Promise.resolve({ verbes:[] });
  if(jobs.length){
    var all = new Array(jobs.length);
    var chunks = [];
    for(var ci = 0; ci < jobs.length; ci += 12) chunks.push(ci);
    ask = chunks.reduce(function(chain, start){
      return chain.then(function(){
        var part = jobs.slice(start, start + 12);
        return apiFetch('api/conjugaison', { method:'POST', body: JSON.stringify({ verbes: part.map(function(j){ return { verbe:j.verbe, temps:j.temps, personnes:j.personnes }; }) }) })
          .then(function(r){ (r.verbes || []).forEach(function(v, k){ all[start + k] = v; }); })
          .catch(function(){});
      });
    }, Promise.resolve()).then(function(){ return { verbes:all }; });
  }
  // si l'IA echoue, la liste s'enregistre quand meme (sans les lignes de conjugaison non resolues)
  var skipped = [];
  return ask.catch(function(){ return { verbes:[] }; }).then(function(r){
    var byKey = {};
    jobs.forEach(function(j, i){
      var v = r.verbes && r.verbes[i];
      if(v && v.formes && v.formes.length) byKey[j.key] = v.formes.map(function(f){ return { w:f.texte, s:f.phrase || '', g:j.key }; });
      else skipped.push(j.line);
    });
    var words = [], seen = {};
    plan.forEach(function(p){
      (p.word ? [p.word] : (p.forms || byKey[p.key] || [])).forEach(function(w){
        var k = w.w.toLowerCase();
        if(seen[k]) return;
        seen[k] = true; words.push(w);
      });
    });
    words.skipped = skipped;
    return words;
  });
}
$('#editorForm').addEventListener('submit', function(ev){
  ev.preventDefault();
  var name = $('#listName').value.trim();
  var raw = $('#listWords').value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  if(!name){ toast('Ajoute un nom à ta liste.'); return; }
  var submit = $('#editorForm button[type=submit]');
  submit.setAttribute('disabled','true');
  buildWords(raw, editingListId ? getList(editingListId) : null).then(function(words){
    if(words.length < MIN_LIST_WORDS){
      toast('Il faut au moins ' + MIN_LIST_WORDS + ' mots (encore ' + (MIN_LIST_WORDS - words.length) + ' à ajouter).' + (words.skipped.length ? ' L’IA n’a pas répondu pour ' + words.skipped.length + ' ligne(s) de conjugaison.' : ''));
      return;
    }
    if(editingListId){
      var list = getList(editingListId);
      list.name = name; list.words = words;
      if(words.skipped.length) list.pending = words.skipped; else delete list.pending;
    } else {
      var nl = { id: 'list_'+Date.now(), name: name, words: words };
      if(words.skipped.length) nl.pending = words.skipped;
      state.lists.push(nl);
    }
    saveState();
    toast(words.skipped.length ? 'Liste enregistrée. L’IA n’a pas répondu : ' + words.skipped.length + ' déclinaison(s) en attente (bouton « Relancer » sur la liste).' : 'Liste enregistrée !');
    renderHome();
    goto('home');
  }).catch(function(e){ toast(e.message); }).then(function(){ submit.removeAttribute('disabled'); });
});
$('#btnDeleteList').addEventListener('click', function(){
  if(!editingListId) return;
  state.lists = state.lists.filter(function(l){ return l.id !== editingListId; });
  delete state.progress[editingListId];
  delete state.gradeFloors[editingListId];
  saveState();
  renderHome();
  goto('home');
});

/* ---------------- declinaisons ---------------- */
var declTemps = ['présent','imparfait','futur simple','passé composé','conditionnel présent'];
$('#declTemps').innerHTML = declTemps.map(function(t,i){
  return '<label class="decl-check"><input type="checkbox" data-temps="'+escapeHtml(t)+'"'+(i===0?' checked':'')+'> '+escapeHtml(t)+'</label>';
}).join('');
$('#declConj').addEventListener('change', function(){ $('#declTemps').hidden = !this.checked; });

function loadConfig(){
  return apiFetch('api/config').then(function(c){
    serverCfg = c;
    if(c.gemini) $('#btnPhrases').hidden = false;
    if(nav.screen === 'dashboard') renderDashboard();
  }).catch(function(){});
}
$('#btnPhrases').addEventListener('click', function(){
  var lines = currentLines();
  var need = lines.filter(function(l){ return !parseConjLine(l) && l.indexOf(';') === -1; });
  var status = $('#declStatus');
  if(!need.length){ status.textContent = 'Tous les mots ont déjà une phrase.'; return; }
  if(need.length > 25){ status.textContent = '25 mots au maximum à la fois.'; return; }
  var btn = $('#btnPhrases'); btn.setAttribute('disabled','true');
  status.textContent = 'Écriture des phrases…';
  apiFetch('api/phrases', { method:'POST', body: JSON.stringify({ mots:need }) }).then(function(r){
    var n = 0;
    $('#listWords').value = lines.map(function(l){
      if(r.phrases[l]){ n++; return l + ' ; ' + r.phrases[l]; }
      return l;
    }).join('\n');
    status.textContent = n + ' phrase' + (n>1?'s ajoutées':' ajoutée') + (n < need.length ? ' (' + (need.length - n) + ' sans résultat)' : '') + '. Relis-les avant d\'enregistrer.';
  }).catch(function(e){ status.textContent = e.message; }).then(function(){ btn.removeAttribute('disabled'); });
});

var declData = [];
function currentLines(){ return $('#listWords').value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean); }
function lineWord(line){ return line.split(';')[0].trim(); }

$('#btnDecline').addEventListener('click', function(){
  var words = currentLines().filter(function(l){ return !parseConjLine(l); }).map(lineWord);
  var status = $('#declStatus'), results = $('#declResults');
  results.innerHTML = '';
  if(!words.length){ status.textContent = "Écris d'abord quelques mots dans la liste."; return; }
  var temps = Array.prototype.map.call(document.querySelectorAll('#declTemps input:checked'), function(i){ return i.getAttribute('data-temps'); });
  var options = { nombre:$('#declNombre').checked, genre:$('#declGenre').checked, conjugaison:$('#declConj').checked, temps:temps };
  if(!options.nombre && !options.genre && !options.conjugaison){ status.textContent = 'Coche au moins un type de forme.'; return; }
  if(options.conjugaison && !temps.length){ status.textContent = 'Coche au moins un temps.'; return; }
  var btn = $('#btnDecline'); btn.setAttribute('disabled','true');
  // le serveur accepte 12 mots a la fois : envoi par lots, resultats cumules
  var batches = [];
  for(var i = 0; i < words.length; i += 12) batches.push(words.slice(i, i + 12));
  declData = [];
  var source = null, failure = null;
  batches.reduce(function(chain, batch, bi){
    return chain.then(function(){
      if(failure) return;
      status.textContent = 'Recherche en cours… (' + (bi + 1) + '/' + batches.length + ')';
      return apiFetch('api/declinaisons', { method:'POST', body: JSON.stringify({ mots:batch, options:options }) }).then(function(d){
        declData = declData.concat(d.mots);
        source = source || d.source;
      }).catch(function(e){ failure = e; });
    });
  }, Promise.resolve()).then(function(){
    if(declData.length) renderDecl(source);
    if(failure) status.textContent = failure.message + (declData.length ? ' Les mots suivants n’ont pas été traités : relance pour les compléter.' : '');
  }).then(function(){ btn.removeAttribute('disabled'); });
});

function renderDecl(source){
  var status = $('#declStatus'), results = $('#declResults');
  var total = declData.reduce(function(n,m){ return n + m.formes.length; }, 0);
  if(source){
    status.textContent = total
      ? (source === 'regles' ? 'Règles automatiques (sans IA) : vérifie les formes. Pour les verbes et les mots sans article, il faut une clé Gemini sur le serveur.' : 'Coche les formes à ajouter à la liste.')
      : (source === 'regles' ? "Aucune forme trouvée sans IA (seuls les groupes avec article, comme « une hirondelle », sont gérés). Une clé Gemini sur le serveur permet de décliner tous les mots et les verbes." : 'Aucune forme trouvée pour ces mots.');
  }
  var existing = {};
  currentLines().forEach(function(l){ existing[lineWord(l).toLowerCase()] = true; });
  results.innerHTML = '';
  declData.forEach(function(m, mi){
    if(!m.formes.length) return;
    var g = el('div',{class:'decl-group'});
    g.appendChild(el('h4',{}, escapeHtml(m.mot)+' <small>'+escapeHtml(m.nature)+'</small>'));
    var lastLabel = null;
    m.formes.forEach(function(f, fi){
      var label = f.type === 'conjugaison' ? f.libelle : (f.type === 'nombre' ? 'pluriel / singulier' : 'féminin / masculin');
      if(label !== lastLabel){ g.appendChild(el('div',{class:'decl-sub'}, escapeHtml(label))); lastLabel = label; }
      var already = existing[f.texte.toLowerCase()];
      var row = el('label',{class:'decl-form'});
      row.innerHTML = '<input type="checkbox" data-m="'+mi+'" data-f="'+fi+'"'+(f.type !== 'conjugaison' && !already ? ' checked' : '')+(already ? ' disabled' : '')+'> <span>'+escapeHtml(f.texte)+'</span>'
        + (already ? ' <em>déjà dans la liste</em>' : (f.type !== 'conjugaison' ? ' <em>'+escapeHtml(f.libelle)+'</em>' : ''));
      g.appendChild(row);
    });
    results.appendChild(g);
  });
  if(total){
    var add = el('button',{type:'button',class:'btn btn-primary',style:'margin-top:10px;'}, 'Ajouter les formes cochées');
    add.addEventListener('click', addCheckedForms);
    results.appendChild(add);
  }
}
function addCheckedForms(){
  var lines = [];
  document.querySelectorAll('#declResults input[type=checkbox]:checked:not(:disabled)').forEach(function(c){
    var f = declData[+c.getAttribute('data-m')].formes[+c.getAttribute('data-f')];
    lines.push(f.phrase ? f.texte+' ; '+f.phrase : f.texte);
  });
  if(!lines.length){ toast('Aucune forme cochée.'); return; }
  var area = $('#listWords');
  area.value = (area.value.replace(/\s+$/,'') + '\n' + lines.join('\n')).replace(/^\n/,'');
  updateWordCountHint();
  renderDecl('');
  $('#declStatus').textContent = lines.length + (lines.length>1 ? ' formes ajoutées' : ' forme ajoutée') + ' à la liste. Pense à enregistrer.';
  toast(lines.length + (lines.length>1 ? ' mots ajoutés' : ' mot ajouté'));
}

/* ---------------- mistakes notebook ---------------- */
function renderMistakesBook(){
  var rows = [];
  state.lists.forEach(function(list){
    list.words.forEach(function(w){
      var p = state.progress[list.id] && state.progress[list.id][w.w];
      if(p && p.wrongCount){
        rows.push({ word:w.w, count:p.wrongCount, listName:list.name });
      }
    });
  });
  rows.sort(function(a,b){ return b.count - a.count; });
  var box = $('#mistakesBookList');
  box.innerHTML = '';
  if(rows.length===0){
    box.appendChild(el('div',{class:'empty'}, "Ton carnet d'erreurs est vide pour le moment. Continue à t'entraîner !"));
    return;
  }
  rows.forEach(function(r){
    var row = el('div',{class:'mistake-row'});
    row.innerHTML = '<span class="w">'+escapeHtml(r.word)+'</span><span class="count">'+r.count+' erreur'+(r.count>1?'s':'')+' · '+escapeHtml(r.listName)+'</span>';
    box.appendChild(row);
  });
}

