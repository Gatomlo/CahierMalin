'use strict';
/* ---------------- navigation ---------------- */
function goto(screen){
  nav.screen = screen;
  $('.progress-cluster').style.display = GATE_SCREENS.indexOf(screen) !== -1 ? 'none' : '';
  $all('.page').forEach(function(p){ p.classList.toggle('active', p.dataset.screen===screen); });
  updateRankChip();
  window.scrollTo(0,0);
}
$all('[data-back]').forEach(function(b){
  b.addEventListener('click', function(){
    var target = b.getAttribute('data-back');
    if(target==='dashboard'){ renderDashboard(); }
    if(target==='home'){ renderHome(); }
    goto(target);
  });
});
$('#btnNewList').addEventListener('click', function(){ openEditor(null); });
$('#btnMistakesGlobal').addEventListener('click', function(){ renderMistakesBook(); goto('mistakesBook'); });
$('#btnResultsAgain').addEventListener('click', function(){ startMode(nav.mode, nav.kind); });
$('#btnResultsDone').addEventListener('click', function(){ openDashboard(nav.listId); });
$('#segLearn').addEventListener('click', function(){ nav.reviewAll = false; renderDashboard(); });
$('#segAll').addEventListener('click', function(){ nav.reviewAll = true; renderDashboard(); });


/* ---------------- connexion, profils ---------------- */
var GATE_SCREENS = ['login','profiles','parentLock','parent'];
function showLogin(needsSetup){
  $('#loginEyebrow').textContent = needsSetup ? 'Première utilisation' : 'Connexion';
  $('#loginTitle').textContent = needsSetup ? 'Crée le compte parent' : 'Compte parent';
  $('#loginBtn').textContent = needsSetup ? 'Créer le compte' : 'Se connecter';
  $('#loginPass2Row').hidden = !needsSetup;
  $('#loginPass').setAttribute('autocomplete', needsSetup ? 'new-password' : 'current-password');
  $('#loginForm').dataset.setup = needsSetup ? '1' : '';
  goto('login');
}
$('#loginForm').addEventListener('submit', function(ev){
  ev.preventDefault();
  var setup = !!$('#loginForm').dataset.setup, msg = $('#loginMsg');
  msg.textContent = '';
  if(setup && $('#loginPass').value !== $('#loginPass2').value){ msg.textContent = 'Les deux mots de passe sont différents.'; return; }
  apiFetch(setup ? 'api/setup' : 'api/login', { method:'POST', body: JSON.stringify({ username:$('#loginUser').value.trim(), password:$('#loginPass').value }) })
    .then(function(){ location.reload(); })
    .catch(function(e){ msg.textContent = e.message; });
});
function chooseProfile(id){
  try{ localStorage.setItem('cahierMalin_pid', String(id)); }catch(e){}
  location.reload();
}
function showProfiles(){
  var box = $('#profilesBox');
  box.innerHTML = '';
  me.profiles.forEach(function(p){
    var card = el('button',{class:'list-card', type:'button', style:'width:100%;text-align:left;cursor:pointer;'});
    card.innerHTML = '<div class="info"><h3>' + escapeHtml(p.name) + '</h3></div>';
    card.addEventListener('click', function(){ chooseProfile(p.id); });
    box.appendChild(card);
  });
  goto('profiles');
}
$('#btnProfile').addEventListener('click', function(){
  try{ localStorage.removeItem('cahierMalin_pid'); }catch(e){}
  location.reload();
});
$('#btnSounds').addEventListener('click', function(){
  soundsOn = !soundsOn;
  try{ localStorage.setItem('cahierMalin_sons', soundsOn ? '1' : '0'); }catch(e){}
  updateSoundsBtn();
  playSound('ok');
});
$('#btnParent').addEventListener('click', openParent);
$('#btnParentFromProfiles').addEventListener('click', openParent);

/* ---------------- espace parent ---------------- */
function parentErr(e){
  if(e.data && e.data.locked){ $('#lockPass').value = ''; $('#lockMsg').textContent = ''; goto('parentLock'); toast('Espace parent verrouillé : retape ton mot de passe.'); }
  else toast(e.message);
}
function openParent(){
  loadConfig();
  apiFetch('api/me').then(function(m){
    me = m;
    if(m.unlocked) renderParent();
    else { $('#lockPass').value = ''; $('#lockMsg').textContent = ''; goto('parentLock'); $('#lockPass').focus(); }
  }).catch(function(e){ toast(e.message); });
}
$('#lockForm').addEventListener('submit', function(ev){
  ev.preventDefault();
  apiFetch('api/unlock', { method:'POST', body: JSON.stringify({ password: $('#lockPass').value }) })
    .then(renderParent).catch(function(e){ $('#lockMsg').textContent = e.message; });
});
function leaveParent(){
  apiFetch('api/lock', { method:'POST', body:'{}' }).catch(function(){}).then(function(){
    if(appStarted) location.reload(); else boot();
  });
}
$('#parentBack').addEventListener('click', leaveParent);
$('#lockBack').addEventListener('click', function(){ if(appStarted) goto('home'); else boot(); });

function pcard(title){
  var d = el('div',{class:'p-card'});
  d.appendChild(el('h3',{class:'wg-title'}, escapeHtml(title)));
  return d;
}
function pbtn(label, cls, fn){
  var b = el('button',{type:'button', class:'btn ' + (cls || 'btn-ghost') + ' p-btn'}, escapeHtml(label));
  b.addEventListener('click', fn);
  return b;
}
function renderParent(){
  goto('parent');
  var box = $('#parentBox');
  box.innerHTML = '<p class="wg-empty">Chargement…</p>';
  Promise.all([apiFetch('api/parent/profiles'), apiFetch('api/me')]).then(function(res){
    var profiles = res[0].profiles; me = res[1];
    box.innerHTML = '';
    box.appendChild(parentProfiles(profiles));
    box.appendChild(el('div',{id:'suiviBox'}));
    if(profiles.some(function(p){ return p.lists.length; }) && profiles.length > 1) box.appendChild(parentCopy(profiles));
    box.appendChild(parentVoice());
    box.appendChild(parentAccount());
    if(me.user.isAdmin){ box.appendChild(parentServer()); box.appendChild(parentUsers()); }
  }).catch(parentErr);
}
function parentProfiles(profiles){
  var card = pcard('Profils des enfants');
  profiles.forEach(function(p){
    var row = el('div',{class:'p-profile'});
    var line1 = el('div',{class:'p-row'});
    var name = el('input',{type:'text', value:p.name, maxlength:'30', 'aria-label':'Prénom'});
    line1.appendChild(name);
    line1.appendChild(pbtn('Renommer', 'btn-ghost', function(){
      apiFetch('api/parent/profiles/' + p.id, { method:'PATCH', body: JSON.stringify({ name:name.value }) }).then(function(){ toast('Prénom modifié.'); }).catch(parentErr);
    }));
    row.appendChild(line1);
    var line2 = el('div',{class:'p-row'}, '<span>Un mot est acquis après</span>');
    line2.appendChild(stepperEl(p.target, 1, MODE_IDS.length, function(v){
      apiFetch('api/parent/profiles/' + p.id + '/settings', { method:'PUT', body: JSON.stringify({ target:v }) }).catch(parentErr);
    }));
    line2.appendChild(el('span',{}, 'jeux réussis'));
    row.appendChild(line2);
    row.appendChild(el('div',{class:'p-row'}, '<span style="color:var(--ink-soft)">' + p.lists.length + ' liste' + (p.lists.length>1?'s':'') + '</span>'));
    var line3 = el('div',{class:'p-row'});
    line3.appendChild(pbtn('Suivi', 'btn-primary', function(){ renderSuivi(p); }));
    line3.appendChild(pbtn('Exporter', 'btn-ghost', function(){ downloadExport(p); }));
    var file = el('input',{type:'file', accept:'application/json,.json', hidden:'true'});
    file.addEventListener('change', function(){ importFile(p, file.files[0]); });
    line3.appendChild(pbtn('Importer', 'btn-ghost', function(){ file.click(); }));
    line3.appendChild(file);
    line3.appendChild(pbtn('Supprimer', 'btn-danger', function(){
      if(!window.confirm('Supprimer le profil « ' + p.name + ' » avec toutes ses listes et sa progression ?')) return;
      apiFetch('api/parent/profiles/' + p.id, { method:'DELETE', body:'{}' }).then(function(){
        try{ if(currentPid() === p.id) localStorage.removeItem('cahierMalin_pid'); }catch(e){}
        renderParent();
      }).catch(parentErr);
    }));
    row.appendChild(line3);
    card.appendChild(row);
  });
  var add = el('div',{class:'p-row',style:'margin-top:8px;'});
  var nn = el('input',{type:'text', placeholder:'Nouveau profil (prénom)', maxlength:'30', 'aria-label':'Nouveau profil'});
  add.appendChild(nn);
  add.appendChild(pbtn('Ajouter', 'btn-primary', function(){
    apiFetch('api/parent/profiles', { method:'POST', body: JSON.stringify({ name:nn.value }) }).then(renderParent).catch(parentErr);
  }));
  card.appendChild(add);
  return card;
}
function downloadExport(p){
  fetch('api/parent/profiles/' + p.id + '/export').then(function(r){
    if(!r.ok) throw new Error('Export impossible.');
    return r.blob();
  }).then(function(b){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'cahier-malin-' + p.name.replace(/[^A-Za-z0-9À-ÿ_-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }).catch(function(e){ toast(e.message); });
}
function importFile(p, f){
  if(!f) return;
  f.text().then(function(txt){
    var data; try{ data = JSON.parse(txt); }catch(e){ throw new Error('Fichier illisible.'); }
    return apiFetch('api/parent/profiles/' + p.id + '/import', { method:'POST', body: JSON.stringify(data) });
  }).then(function(r){ toast(r.added + ' liste' + (r.added>1?'s ajoutées':' ajoutée') + ' à ' + p.name + '.'); renderParent(); })
    .catch(parentErr);
}
function parentCopy(profiles){
  var card = pcard('Copier une liste vers un autre profil');
  var row = el('div',{class:'p-row'});
  var from = el('select',{'aria-label':'Profil source'}), lst = el('select',{'aria-label':'Liste'}), to = el('select',{'aria-label':'Profil destinataire'});
  profiles.forEach(function(p){ from.appendChild(el('option',{value:p.id}, escapeHtml(p.name))); to.appendChild(el('option',{value:p.id}, escapeHtml(p.name))); });
  function fillLists(){
    var p = profiles.filter(function(x){ return String(x.id) === from.value; })[0];
    lst.innerHTML = '';
    p.lists.forEach(function(l){ lst.appendChild(el('option',{value:l.id}, escapeHtml(l.name) + ' (' + l.mots + ')')); });
  }
  from.addEventListener('change', fillLists);
  fillLists();
  if(profiles.length > 1) to.selectedIndex = 1;
  row.appendChild(from); row.appendChild(lst); row.appendChild(el('span',{}, '→')); row.appendChild(to);
  row.appendChild(pbtn('Copier', 'btn-primary', function(){
    apiFetch('api/parent/copy', { method:'POST', body: JSON.stringify({ from:from.value, to:to.value, listId:lst.value }) })
      .then(function(){ toast('Liste copiée.'); renderParent(); }).catch(parentErr);
  }));
  card.appendChild(row);
  return card;
}
function parentVoice(){
  var card = pcard('Voix de lecture');
  if(!serverCfg.tts){
    card.appendChild(el('p',{class:'wg-empty'}, 'La voix du serveur demande une clé Gemini (réglage de l\'administrateur, plus bas) : sans elle, la voix de l\'appareil est utilisée.'));
    return card;
  }
  var row = el('div',{class:'p-row'});
  var sel = el('select',{'aria-label':'Voix'});
  (me.voices || []).forEach(function(v){ var o = el('option',{value:v}, escapeHtml(v)); if(v === me.user.voice) o.selected = true; sel.appendChild(o); });
  row.appendChild(sel);
  row.appendChild(pbtn('Écouter', 'btn-ghost', function(){
    apiFetch('api/parent/voice', { method:'PUT', body: JSON.stringify({ voice:sel.value }) }).then(function(){
      me.user.voice = sel.value;
      speak('Bonjour, je vais lire les mots de la dictée.');
    }).catch(parentErr);
  }));
  card.appendChild(row);
  card.appendChild(el('p',{class:'wg-empty'}, 'La voix choisie est enregistrée en cliquant sur « Écouter ».'));
  return card;
}
function parentAccount(){
  var card = pcard('Compte « ' + me.user.username + ' »');
  var row = el('div',{class:'p-row'});
  var o = el('input',{type:'password', placeholder:'Mot de passe actuel', autocomplete:'current-password'});
  var n = el('input',{type:'password', placeholder:'Nouveau (8 car. min.)', autocomplete:'new-password'});
  row.appendChild(o); row.appendChild(n);
  row.appendChild(pbtn('Changer', 'btn-ghost', function(){
    apiFetch('api/parent/password', { method:'PUT', body: JSON.stringify({ old:o.value, password:n.value }) })
      .then(function(){ o.value = ''; n.value = ''; toast('Mot de passe modifié.'); }).catch(parentErr);
  }));
  card.appendChild(row);
  var out = el('div',{class:'p-row',style:'margin-top:8px;'});
  out.appendChild(pbtn('Se déconnecter de cet appareil', 'btn-danger', function(){
    apiFetch('api/logout', { method:'POST', body:'{}' }).then(function(){
      try{ localStorage.removeItem('cahierMalin_pid'); }catch(e){}
      location.reload();
    });
  }));
  card.appendChild(out);
  return card;
}
// Reglages du serveur (administrateur) : plus de variables d'environnement
function parentServer(){
  var card = pcard('Réglages du serveur · Gemini');
  var body = el('div');
  card.appendChild(body);
  function load(){ apiFetch('api/parent/admin/settings').then(draw).catch(parentErr); }
  function draw(s){
    body.innerHTML = '';
    body.appendChild(el('p',{class:'wg-empty'}, s.keySet
      ? 'Clé enregistrée (…' + escapeHtml(s.keyHint) + ')' + (s.keySource === 'app' ? '' : ' · ' + escapeHtml(s.keySource))
      : 'Aucune clé : la voix du serveur, la dictée-aventure, les phrases d\'exemple et les déclinaisons complètes sont désactivées.'));
    var row = el('div',{class:'p-row'});
    var key = el('input',{type:'password', placeholder:'Coller la clé Gemini', autocomplete:'off', 'aria-label':'Clé Gemini', style:'flex:1;min-width:200px;'});
    row.appendChild(key);
    row.appendChild(pbtn('Enregistrer', 'btn-primary', function(){ save({ geminiKey:key.value }, key.value ? 'Clé enregistrée.' : 'Réglages enregistrés.'); }));
    if(s.keySet) row.appendChild(pbtn('Tester', 'btn-ghost', function(){
      toast('Test en cours…');
      apiFetch('api/parent/admin/test-gemini', { method:'POST', body:'{}' }).then(function(r){ toast(r.ok ? 'La clé fonctionne.' : 'Réponse inattendue de Gemini.'); }).catch(parentErr);
    }));
    if(s.keySet && s.keySource === 'app') row.appendChild(pbtn('Supprimer la clé', 'btn-danger', function(){
      if(window.confirm('Supprimer la clé Gemini du serveur ?')) save({ clearKey:true }, 'Clé supprimée.');
    }));
    body.appendChild(row);
    body.appendChild(el('p',{class:'wg-empty'}, 'Une clé gratuite se crée sur aistudio.google.com/apikey. Elle est chiffrée sur le serveur et n\'est jamais renvoyée à l\'écran.'));
    var det = el('details',{style:'margin-top:8px;'}, '<summary style="cursor:pointer;font-size:.88rem;">Options avancées</summary>');
    var dlText = el('datalist',{id:'dlModelText'}), dlTts = el('datalist',{id:'dlModelTts'});
    var r2 = el('div',{class:'p-row',style:'margin-top:8px;'}, '<span>Modèle texte</span>');
    var model = el('input',{type:'text', value:s.model, placeholder:s.defaults.model, list:'dlModelText', 'aria-label':'Modèle texte'});
    r2.appendChild(model);
    var r3 = el('div',{class:'p-row',style:'margin-top:6px;'}, '<span>Modèle voix</span>');
    var tm = el('input',{type:'text', value:s.ttsModel, placeholder:s.defaults.ttsModel, list:'dlModelTts', 'aria-label':'Modèle voix'});
    r3.appendChild(tm);
    var r4 = el('div',{class:'p-row',style:'margin-top:6px;'}, '<span>Voix par défaut</span>');
    var voice = el('select',{'aria-label':'Voix par défaut'});
    s.voices.forEach(function(v){ var o = el('option',{value:v}, escapeHtml(v)); if(v === s.voice) o.selected = true; voice.appendChild(o); });
    r4.appendChild(voice);
    var r5 = el('div',{class:'p-row',style:'margin-top:8px;'});
    r5.appendChild(pbtn('Enregistrer les options', 'btn-ghost', function(){
      save({ model:model.value.trim() || s.defaults.model, ttsModel:tm.value.trim() || s.defaults.ttsModel, voice:voice.value }, 'Options enregistrées.');
    }));
    var status = el('p',{class:'wg-empty'}, s.keySet ? 'Clique dans un champ pour voir les modèles proposés par Gemini, ou tape un nom.' : 'Enregistre d\'abord une clé pour lister les modèles disponibles.');
    function fillModels(){
      if(!s.keySet) return;
      status.textContent = 'Chargement de la liste…';
      apiFetch('api/parent/admin/models').then(function(r){
        dlText.innerHTML = r.text.map(function(m){ return '<option value="' + escapeHtml(m.name) + '">' + escapeHtml(m.label) + '</option>'; }).join('');
        dlTts.innerHTML = r.tts.map(function(m){ return '<option value="' + escapeHtml(m.name) + '">' + escapeHtml(m.label) + '</option>'; }).join('');
        status.textContent = r.text.length + ' modèle' + (r.text.length>1?'s':'') + ' texte et ' + r.tts.length + ' modèle' + (r.tts.length>1?'s':'') + ' voix disponibles. Clique dans un champ pour choisir.';
      }).catch(function(e){ status.textContent = e.message; });
    }
    if(s.keySet) r5.appendChild(pbtn('Actualiser la liste', 'btn-ghost', fillModels));
    det.addEventListener('toggle', function(){ if(det.open && !dlText.children.length) fillModels(); });
    // Une liste n'affiche que les noms proches de la valeur saisie : on vide le champ a l'entree
    // (la valeur actuelle revient si rien n'est choisi).
    [model, tm].forEach(function(inp){
      inp.addEventListener('focus', function(){ inp.dataset.prev = inp.value; inp.value = ''; });
      inp.addEventListener('blur', function(){ if(!inp.value.trim()) inp.value = inp.dataset.prev || ''; });
    });
    det.appendChild(r2); det.appendChild(r3); det.appendChild(r4); det.appendChild(r5); det.appendChild(status); det.appendChild(dlText); det.appendChild(dlTts);
    body.appendChild(det);
  }
  function save(patch, msg){
    apiFetch('api/parent/admin/settings', { method:'PUT', body: JSON.stringify(patch) }).then(function(s){
      toast(msg); draw(s); loadConfig();
    }).catch(parentErr);
  }
  load();
  return card;
}
function parentUsers(){
  var card = pcard('Autres comptes parents (administrateur)');
  var list = el('div');
  card.appendChild(list);
  function load(){
    apiFetch('api/parent/users').then(function(r){
      list.innerHTML = '';
      r.users.forEach(function(u){
        var row = el('div',{class:'mini-row'});
        row.innerHTML = '<span class="nm">' + escapeHtml(u.username) + (u.isAdmin ? ' <small>administrateur</small>' : '') + ' <small>· ' + u.profiles + ' profil' + (u.profiles>1?'s':'') + '</small></span>';
        if(!u.isAdmin){
          row.appendChild(pbtn('Supprimer', 'btn-danger', function(){
            if(!window.confirm('Supprimer le compte « ' + u.username + ' » et tous ses profils ?')) return;
            apiFetch('api/parent/users/' + u.id, { method:'DELETE', body:'{}' }).then(load).catch(parentErr);
          }));
        }
        list.appendChild(row);
      });
    }).catch(parentErr);
  }
  load();
  var add = el('div',{class:'p-row',style:'margin-top:8px;'});
  var u = el('input',{type:'text', placeholder:'Identifiant', autocapitalize:'off', autocomplete:'off'});
  var p = el('input',{type:'password', placeholder:'Mot de passe (8 car. min.)', autocomplete:'new-password'});
  add.appendChild(u); add.appendChild(p);
  add.appendChild(pbtn('Créer le compte', 'btn-primary', function(){
    apiFetch('api/parent/users', { method:'POST', body: JSON.stringify({ username:u.value.trim(), password:p.value }) })
      .then(function(){ u.value = ''; p.value = ''; toast('Compte créé.'); load(); }).catch(parentErr);
  }));
  card.appendChild(add);
  return card;
}

/* ---------------- suivi ---------------- */
function modeTitle(id){ var d = MODE_DEFS.filter(function(m){ return m.id === id; })[0]; return d ? d.title : id; }
function pct(ok, n){ return n ? Math.round(ok / n * 100) : 0; }
function renderSuivi(p){
  apiFetch('api/parent/profiles/' + p.id + '/suivi').then(function(d){
    var box = $('#suiviBox');
    box.innerHTML = '';
    var card = pcard('Suivi de ' + p.name);
    if(!d.total.n){
      card.appendChild(el('p',{class:'wg-empty'}, 'Aucun exercice enregistré pour le moment.'));
      box.appendChild(card); box.scrollIntoView({ behavior:'smooth' });
      return;
    }
    var last = d.total.last ? new Date(d.total.last).toLocaleDateString('fr-FR', { day:'numeric', month:'long' }) : '';
    card.appendChild(el('p',{class:'wg-empty'}, d.total.n + ' réponses sur 90 jours, ' + pct(d.total.ok, d.total.n) + ' % de réussite. Dernière séance : ' + escapeHtml(last) + '.'));
    var max = Math.max.apply(null, d.days.map(function(x){ return x.n; })) || 1;
    var bars = el('div',{class:'bars', role:'img', 'aria-label':'Réponses des 14 derniers jours'});
    d.days.forEach(function(x){
      var b = el('div',{class:'bar', title: x.d + ' : ' + x.n + ' réponse' + (x.n>1?'s':'') + ', ' + x.ok + ' juste' + (x.ok>1?'s':'')});
      var h = Math.round(x.n / max * 100);
      b.innerHTML = '<span class="b-ko" style="height:' + Math.round(h * (x.n - x.ok) / (x.n || 1)) + '%"></span><span class="b-ok" style="height:' + Math.round(h * x.ok / (x.n || 1)) + '%"></span>';
      bars.appendChild(b);
    });
    card.appendChild(bars);
    card.appendChild(el('div',{class:'bar-labels'}, '<span>il y a 14 jours</span><span>aujourd\'hui</span>'));
    card.appendChild(el('h3',{class:'wg-title',style:'margin-top:14px;'}, 'Par jeu'));
    d.jeux.forEach(function(j){
      var r = pct(j.ok, j.n), row = el('div',{class:'mini-row'});
      row.innerHTML = '<span class="nm">' + escapeHtml(modeTitle(j.mode)) + '</span><span class="mini-track"><span style="width:' + r + '%"></span></span><span class="val">' + r + ' % · ' + j.n + '</span>';
      card.appendChild(row);
    });
    card.appendChild(el('h3',{class:'wg-title',style:'margin-top:14px;'}, 'Mots à revoir'));
    if(!d.mots.length) card.appendChild(el('p',{class:'wg-empty'}, 'Aucune erreur enregistrée.'));
    d.mots.forEach(function(m){
      var row = el('div',{class:'mini-row'});
      row.innerHTML = '<span class="nm">' + escapeHtml(m.word) + ' <small>' + escapeHtml(m.list) + '</small></span><span class="val">' + m.ko + ' erreur' + (m.ko>1?'s':'') + ' / ' + m.n + '</span>';
      card.appendChild(row);
    });
    card.appendChild(el('h3',{class:'wg-title',style:'margin-top:14px;'}, 'Listes (acquis après ' + d.target + ' jeux réussis)'));
    d.listes.forEach(function(l){
      var row = el('div',{class:'mini-row'});
      row.innerHTML = '<span class="nm">' + escapeHtml(l.name) + '</span><span class="mini-track"><span style="width:' + pct(l.acquis, l.mots) + '%"></span></span><span class="val">' + l.acquis + ' / ' + l.mots + '</span>';
      card.appendChild(row);
    });
    box.appendChild(card);
    box.scrollIntoView({ behavior:'smooth' });
  }).catch(parentErr);
}

/* ---------------- demarrage ---------------- */
function startApp(p){
  appStarted = true;
  $('#profileName').textContent = p.name;
  try{ localStorage.setItem('cahierMalin_pname', p.name); }catch(e){}
  updateSoundsBtn();
  updateStarStamp();
  renderHome();
  goto('home');
  loadConfig();
  syncFromServer();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
}
function boot(){
  apiFetch('api/me').then(function(m){
    me = m;
    if(!m.user){ showLogin(m.needsSetup); return; }
    var pid = currentPid();
    var p = m.profiles.filter(function(x){ return x.id === pid; })[0];
    if(!p && m.profiles.length === 1){ chooseProfile(m.profiles[0].id); return; }
    if(!p){ showProfiles(); return; }
    startApp(p);
  }).catch(function(e){
    if(e && e.status){ console.error(e); $('#loginMsg').textContent = e.message; showLogin(false); return; }
    // serveur injoignable : on reprend la copie de cet appareil si elle existe
    var cached = null;
    try{ cached = localStorage.getItem(STORAGE_KEY) && currentPid() ? localStorage.getItem('cahierMalin_pname') || 'Élève' : null; }catch(e){}
    if(cached) startApp({ id:currentPid(), name:cached });
    else { $('#loginMsg').textContent = 'Serveur injoignable.'; showLogin(false); }
  });
}
boot();
