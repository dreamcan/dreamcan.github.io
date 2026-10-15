// Benchmark gallery: thumbnails of every scene; a click opens the input video large on the left and every
// model's render on the right, best first by the leaderboard's VLM Elo. The input video is the clock and every render
// follows it, the way the comparison page does.
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var IDX = null, MODELS = [], ONTO = {}, TAGS = {}, META = {}, tab = 'all', cur = null, playing = true, clock = $('clock'), vids = [];
  var FAMILY = {rigidfam: 'Rigid and articulated', softfam: 'Deformable solid', codimfam: 'Co-dimensional', flowfam: 'Flowing'};

  // Start the embedded animation on load and restart it after each full run.
  var demo = $('demo');
  var demoUrl = demo.getAttribute('src'), demoRun = 0;
  addEventListener('message', function(e){
    if (!e.data) return;
    var metrics = $('metrics-frame');
    if (metrics && e.source === metrics.contentWindow && e.data.metricsHeight) {
      metrics.style.height = e.data.metricsHeight + 'px';
    }
    if (e.source !== demo.contentWindow) return;
    if (typeof e.data.demoHeight === 'number' && e.data.demoHeight > 0) {
      demo.style.height = e.data.demoHeight + 'px';
    }
    if (e.data.demoDone) {
      demoRun += 1;
      demo.src = demoUrl + (demoUrl.indexOf('?') >= 0 ? '&' : '?') + 'loop=' + demoRun;
    }
  });
  // The project page may omit the benchmark gallery while retaining the demo.
  if (!$('gallery')) return;
  // the "gallery below" pill leaves once the gallery is on screen (the pill is commented out in index.html for now)
  // new IntersectionObserver(function(es){
  //   es.forEach(function(en){ $('to-gallery').classList.toggle('gone', en.isIntersecting || en.boundingClientRect.top < 0); });
  // }).observe($('gallery'));

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // scenes with geometry to inspect come first, under their own heading
  var CUBE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z M4 7.5 12 12l8-4.5M12 12v9" stroke-linejoin="round"/></svg>';
  function hasGeo(k){ return !!(IDX[k].looks && IDX[k].looks.length); }
  var CURATE = location.search.indexOf('curate') >= 0, SEL = [], PROG = {}, dirty = false;
  var geoOnly = false, roboOnly = false, showAll = false, PAGE = 12;   // four rows of each kind until asked for more
  var famSel = {};                    // matter families to show; empty means all of them
  // a task contains every family the ontology gives it. matter_family is only the
  // headline one -- a robot folding cloth is filed under cloth though rigid arms drive
  // it -- so counting by that understates what is in the benchmark.
  function famsOf(k){ return (ONTO[k] && ONTO[k].families) || []; }
  function inFam(k){
    var f = famsOf(k);
    for (var i = 0; i < f.length; i++) if (famSel[f[i]]) return true;
    return false;
  }
  // the shorter names, over the ontology's own
  var FAMLABEL = {rigidfam: 'Rigid & articulated', softfam: 'Deformable solids',
                  codimfam: 'Cloth & rope', flowfam: 'Fluids & grains'};
  var FAMORDER = ['rigidfam', 'softfam', 'codimfam', 'flowfam'];
  function drawStrip(){
    if (!$('cs-row') || !IDX) return;
    // counted off the same list the grid filters, so the two cannot disagree
    var n = {};
    FAMORDER.forEach(function(k){ n[k] = {r: 0, s: 0}; });
    Object.keys(IDX).forEach(function(k){
      var half = k.indexOf('real/') === 0 ? 'r' : 's';
      famsOf(k).forEach(function(f){ if (n[f]) n[f][half]++; });
    });
    var max = Math.max.apply(null, FAMORDER.map(function(k){ return n[k].r + n[k].s; }));
    $('cs-row').innerHTML = FAMORDER.map(function(k){
      var t = n[k].r + n[k].s;
      return '<button type="button" class="cf" data-fam="' + esc(k) + '" aria-pressed="'
        + (famSel[k] ? 'true' : 'false') + '">'
        + '<span class="cf-lab">' + esc(FAMLABEL[k] || k) + '</span>'
        + '<span class="cf-n">' + t + '<small> tasks</small></span>'
        + '<span class="cf-split"><b class="real">' + n[k].r + '</b> real'
        + '<b class="synth">' + n[k].s + '</b> simulated</span>'
        + '<span class="cf-bar"><i class="real" style="width:' + (100 * n[k].r / max)
        + '%"></i><i class="synth" style="width:' + (100 * n[k].s / max) + '%"></i></span>'
        + '</button>';
    }).join('');
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.cf'); if (!b) return;
    var f = b.dataset.fam;
    if (famSel[f]) delete famSel[f]; else famSel[f] = 1;
    showAll = false; drawStrip(); renderThumbs();
  });
  var TOP = 4, topOnly = true;        // an open task leads with its best four agents
  var MONOLOGO = {gpt: 1, glm: 1};    // the marks drawn in black rather than a brand colour
  // the datasets that are robot recordings throughout; elsewhere the ontology's own
  // description says whether a robot does the work
  var ROBOT_SRC = {'ABC-130K': 1, 'Robo360': 1, 'AgiBotWorld': 1, 'RoboCook': 1, 'RoboCraft': 1,
                   'ALOHA-unleashed': 1, 'ManipArena': 1, 'TaskLevel-ILC': 1};
  function isRobo(k){
    var o = ONTO[k]; if (!o) return false;
    return !!ROBOT_SRC[o.source] || /robot/i.test(o.description || '');
  }
  var TICK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function chip(k){
    var p = PROG[k];
    if (SEL.indexOf(k) < 0) return '';
    if (!p) return '<span class="chip">' + (dirty ? 'unsaved' : 'queued') + '</span>';
    if (p.state === 'ready') return '<span class="chip ready">ready</span>';
    if (p.state === 'awaiting review') return '<span class="chip">needs review</span>';
    return '<span class="chip">' + (p.state === 'rendering' ? 'rendering ' + p.done + './' + p.total : 'queued') + '</span>';
  }
  function renderThumbs(){
    if (CURATE) return renderCurate();
    var names = Object.keys(IDX).filter(function(k){
      var fams = Object.keys(famSel);
      return (tab === 'all' || k.split('./')[0] === tab)
        && (!geoOnly || hasGeo(k)) && (!roboOnly || isRobo(k))
        && (!fams.length || inFam(k));
    });
    // the ones with geometry lead: they are what the geometry view is for, and the
    // rest keep index.json's order behind them
    names.sort(function(a, b){ return (hasGeo(b) ? 1 : 0) - (hasGeo(a) ? 1 : 0); });
    var thumb = function(k){
      var g = hasGeo(k), kd = k.split('./')[0], m = META[k] || {};
      return '<button type="button" class="thumb" data-scene="' + esc(k) + '"'
        + (cur === k ? ' aria-current="true"' : '')
        + ' aria-label="' + esc((m.description || IDX[k].description || k)
            + (g ? ', with geometry' : '')) + '">'
        + '<img src="thumbs/' + esc(k) + '.jpg" alt="" loading="lazy">'
        + '<video muted playsinline loop preload="none" data-src="' + esc(IDX[k].gt) + '"></video>'
        + '<span class="kind ' + kd + '">' + (kd === 'real' ? 'real' : 'sim') + '</span>'
        + (g ? '<span class="geo-mark" title="Geometry to inspect">' + CUBE + '</span>' : '')
        + '<span class="thumb-cta">See ' + Object.keys(IDX[k].models).length
        + ' reconstructions</span>'
        + '</button>';
    };
    // one column per kind, each cut to PAGE rows until the reader asks for the rest
    var kinds = tab === 'all' ? ['real', 'synthetic'] : [tab];
    var cap = showAll ? 1e9 : (kinds.length > 1 ? PAGE : PAGE * 2);
    var hidden = 0;
    $('thumbs').className = 'thumbs grouped';
    $('thumbs').innerHTML = '<section class="tgroup"><div class="tsplit'
      + (kinds.length > 1 ? ' two' : '') + '">' + kinds.map(function(kd){
        var part = names.filter(function(k){ return k.split('./')[0] === kd; });
        hidden += Math.max(0, part.length - cap);
        return '<div class="tcol"><h4 class="k-' + kd + '">' + (kd === 'real' ? 'Real' : 'Synthetic')
          + ' <span>' + part.length + '</span></h4><div class="tgrid">'
          + part.slice(0, cap).map(thumb).join('') + '</div></div>';
      }).join('') + '</div></section>';
    $('more-row').hidden = !hidden && !showAll;
    $('thumbs').classList.toggle('cut', !showAll && hidden > 0);
    $('show-more').textContent = showAll ? 'Show fewer'
      : 'Show all ' + names.length + ' tasks (' + hidden + ' more)';
  }

  // a thumbnail plays its own input video while the pointer is on it, so the grid
  // reads as footage rather than as stills. One at a time: 200 at once is a stall.
  var hoverV = null;
  function hoverPlay(btn, on){
    var v = btn.querySelector('video'); if (!v) return;
    if (on){
      if (hoverV && hoverV !== v) hoverPlay(hoverV.parentNode, false);
      if (!v.src) v.src = v.dataset.src;
      hoverV = v; btn.classList.add('playing');
      var r = v.play(); if (r && r.catch) r.catch(function(){});
    } else {
      btn.classList.remove('playing'); v.pause();
      if (hoverV === v) hoverV = null;
    }
  }
  ['mouseenter', 'mouseleave', 'focusin', 'focusout'].forEach(function(ev){
    $('thumbs').addEventListener(ev, function(e){
      var b = e.target.closest && e.target.closest('.thumb');
      if (b) hoverPlay(b, ev === 'mouseenter' || ev === 'focusin');
    }, true);
  });

  function renderCurate(){
    $('thumbs').className = 'thumbs';
    var names = Object.keys(IDX).filter(function(k){ return tab === 'all' || k.split('./')[0] === tab; });
    var thumb = function(k){
      var on = SEL.indexOf(k) >= 0;
      return '<div class="thumb" data-scene="' + esc(k) + '" role="button" tabindex="0"' + (cur === k ? ' aria-current="true"' : '') + '><img src="thumbs/' + esc(k) + '.jpg" alt="" loading="lazy">' +
        '<button type="button" class="pick" aria-pressed="' + on + '" aria-label="Show geometry for ' + esc(IDX[k].description || k) + '">' + TICK + '</button>' + chip(k) + '</div>';
    };
    var picked = SEL.filter(function(k){ return names.indexOf(k) >= 0; }), rest = names.filter(function(k){ return SEL.indexOf(k) < 0; });
    $('thumbs').innerHTML = '<h3 class="thumbs-head">Selected for geometry <span>' + picked.length + '</span></h3>' + picked.map(thumb).join('') +
      '<h3 class="thumbs-head">Other scenes <span>' + rest.length + '</span></h3>' + rest.map(thumb).join('');
    $('cur-n').textContent = SEL.length;
    $('cur-note').textContent = dirty ? 'unsaved changes' : '';
  }
  function loadCurate(){
    var nc = '?t=' + Date.now();
    return Promise.all([fetch('geometry_scenes.json' + nc).then(function(r){ return r.json(); }),
                        fetch('geometry_progress.json' + nc).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; })])
      .then(function(r){ if (!dirty) SEL = r[0]; PROG = r[1]; renderThumbs(); });
  }
  if (CURATE){
    $('curate-bar').hidden = false;
    $('cur-save').addEventListener('click', function(){
      $('cur-save').disabled = true;
      fetch('api/geometry-scenes', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(SEL)})
        .then(function(r){ if (!r.ok) throw 0; dirty = false; $('cur-note').textContent = 'saved; rendering starts shortly'; return loadCurate(); })
        .catch(function(){ $('cur-note').textContent = 'could not save'; })
        .then(function(){ $('cur-save').disabled = false; });
    });
    setInterval(function(){ loadCurate(); }, 20000);
  }
  $('thumbs').addEventListener('click', function(e){
    var p = e.target.closest('.pick');
    if (p){
      var k = p.closest('.thumb').dataset.scene, i = SEL.indexOf(k);
      if (i >= 0) SEL.splice(i, 1); else SEL.push(k);
      dirty = true; renderThumbs(); return;
    }
    var b = e.target.closest('.thumb'); if (b) select(b.dataset.scene, true);
  });
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      tab = t.dataset.tab;
      document.querySelectorAll('.tab').forEach(function(u){
        u.setAttribute('aria-selected', u === t); u.classList.toggle('is-on', u === t); });
      showAll = false; renderThumbs();
    });
  });

  // Robotics is off the page for now; isRobo and the predicate stay, so putting the
  // button back is markup alone.
  if ($('robo-only')) $('robo-only').addEventListener('click', function(){
    roboOnly = !roboOnly;
    $('robo-only').setAttribute('aria-pressed', roboOnly);
    showAll = false; renderThumbs();
  });
  $('geo-only').addEventListener('click', function(){
    geoOnly = !geoOnly;
    $('geo-only').setAttribute('aria-pressed', geoOnly);
    showAll = false; renderThumbs();
  });
  $('show-more').addEventListener('click', function(){ showAll = !showAll; renderThumbs(); });

  // the nudge stands down once a task has been opened, and comes back on a fresh load:
  // most readers arrive once, and remembering it forever means never seeing it again
  function dropNudge(){
    var n = $('grid-nudge'); if (n) n.classList.add('done');
  }
  try { localStorage.removeItem('nudged'); } catch (e) {}

  function select(scene, scroll){
    var s = IDX[scene]; if (!s) return;
    dropNudge();
    setPlaying(false); loadingFor = null; sweeping = null; lastClockTime = null; clockMoving = false;
    all().forEach(release); vids = []; manage(clock);
    showPane('gallery', false);
    cur = scene;
    if (decodeURIComponent(location.hash.slice(1)) !== scene) history.replaceState(null, '', '#' + scene);
    document.querySelectorAll('.thumb').forEach(function(b){ if (b.dataset.scene === scene) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    $('stage').hidden = false;
    $('st-title').textContent = s.description || scene;
    // every model made for the scene, in rank order; one whose render is missing or broken shows as failed
    var fail = s.failed || {}, runs = MODELS.filter(function(m){ return s.models[m.key] || fail[m.key]; });
    clock.src = s.gt;
    // the reference world's geometry, where it has been rendered; it follows the clock like the models do
    if (!s.looks || s.looks.indexOf(curLook) < 0) curLook = s.looks ? s.looks[0] : null;
    $('geo-pane').hidden = !s.orbit;
    $('stage').classList.toggle('has-geo', !!s.orbit);   // the two panes go side by side
    setupWipe(s);
    renderInfo(scene);
    $('mgrid').innerHTML = runs.map(function(m, i){
      // the rank is the leaderboard's, over all 200 tasks, not a placing on this one,
      // so it reads as a reference rather than a podium
      var rk = m.rank ? '<span class="prk">#' + m.rank + '</span>'
        : '<span class="prk">&ndash;</span>';
      // gpt and glm are the two marks drawn in black, so they invert on a medal
      var lg = m.logo ? '<img class="plogo' + (MONOLOGO[m.logo] ? ' mono' : '')
        + '" src="logos/' + esc(m.logo) + '.svg" alt="" loading="lazy">' : '';
      var body = fail[m.key] ? failed(fail[m.key]) : '<video muted playsinline preload="metadata" data-i="' + i + '"></video>';
      // the name rides the render rather than sitting under it, so a row of them reads
      // without matching each caption back to the frame above it
      return '<figure class="pane"><div class="frame media">' + body
        + '<span class="plabel">' + rk + lg
        + '<span class="lbl"><span class="nm-l">' + esc(m.label) + '</span><span class="nm-s">' + esc(m.short) + '</span></span></span>'
        + '</div></figure>';
    }).join('');
    topOnly = true; $('mgrid').classList.toggle('top', runs.length > TOP);
    if ($('mgrid-more')){
      $('mgrid-more').hidden = runs.length <= TOP;
      $('mgrid-more').textContent = 'Show all ' + runs.length + ' agents';
    }
    vids = runs.filter(function(m){ return s.models[m.key]; }).map(function(m){
      var v = $('mgrid').querySelector('video[data-i="' + runs.indexOf(m) + '"]'); v.src = s.models[m.key]; return watch(v); });
    curRuns = runs; setGeo(!!s.model_geo);   // geometry is the point; there is nothing to turn off
    if (s.orbit) vids.push(watch($('geo')));
    if (s.wipe) vids.push(watch($('wipev')));
    // every frame takes the input video's aspect once it is known
    clock.onloadedmetadata = function(){
      var ar = clock.videoWidth + ' / ' + clock.videoHeight;
      document.querySelectorAll('#stage .frame.media').forEach(function(f){ f.style.aspectRatio = ar; });
    };
    startTogether(scene);
    if (scroll) $('stage').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  // One divider controls the geometry overlay in every model pane.
  var curRuns = [], geoOn = false;
  // a failed run: the whole pane (cls "failed"), or only its geometry laid over the render (cls "nogeo")
  function failed(why, cls, head){ return '<div class="' + (cls || 'failed') + '"><strong>'
    + (head || 'FAILED') + '</strong><span>' + esc(why) + '</span></div>'; }
  function setGeo(on){
    var s = IDX[cur]; geoOn = on && !!(s && s.model_geo);
    $('geo-hint').hidden = !geoOn;
    vids = vids.filter(function(v){ if (!v.classList.contains('pgeo')) return true; release(v); return false; });
    $('mgrid').querySelectorAll('.wipe,.nogeo,.geo-full').forEach(function(el){ el.remove(); });
    if (!geoOn) return;
    var auto = s.model_geo_autocam || [];
    curRuns.forEach(function(m, i){
      if (!s.models[m.key]) return;                     // already shown as failed
      var fr = $('mgrid').querySelector('video[data-i="' + i + '"]').parentNode, src = (s.model_geo[curLook] || {})[m.key];
      if (!src){
        // a note says why a world could not be drawn; a model added after the geometry
        // was rendered has neither a clip nor a note, and nothing failed for it
        var note = (s.model_geo_note || {})[m.key];
        fr.insertAdjacentHTML('beforeend', note ? failed(note, 'nogeo')
          : failed('This agent was added after the geometry was rendered.',
                   'nogeo notyet', 'NO GEOMETRY'));
        return;
      }
      if (auto.indexOf(m.key) >= 0){
        // its camera.json does not see what it rendered: show the geometry on its own, framed automatically
        fr.insertAdjacentHTML('beforeend', '<div class="geo-full"><video class="pgeo" muted playsinline preload="metadata"></video>' +
          '<span class="flag">Camera doesn\u2019t match its render</span></div>');
      } else {
        fr.insertAdjacentHTML('beforeend', '<div class="wipe"><video class="pgeo" muted playsinline preload="metadata"></video>' +
          '<span class="wipe-rule"><span class="wipe-grip"></span></span></div>');
      }
      var v = fr.querySelector('video.pgeo'); v.src = src; vids.push(watch(v));
    });
  }
  // the rest of the field, on request: the grid keeps every agent, the class hides them
  if ($('mgrid-more')) $('mgrid-more').addEventListener('click', function(){
    var n = curRuns.length;
    topOnly = !topOnly;
    $('mgrid').classList.toggle('top', topOnly && n > TOP);
    $('mgrid-more').textContent = topOnly ? 'Show all ' + n + ' agents' : 'Show the top ' + TOP;
  });
  (function(){
    var g = $('mgrid'), pane = null;              // the pane the drag started on sets the fraction for all
    var at = function(e){ var r = pane.getBoundingClientRect(); g.style.setProperty('--mx', Math.max(0, Math.min(100, (e.clientX - r.left)/r.width*100)) + '%'); };
    g.addEventListener('pointerdown', function(e){ pane = e.target.closest('.wipe'); if (!pane) return; g.setPointerCapture(e.pointerId); at(e); });
    g.addEventListener('pointermove', function(e){ if (pane) at(e); });
    g.addEventListener('pointerup', function(){ pane = null; });
  })();

  // one choice of colours for every geometry clip on the page: the reference wipe, its orbit, each agent's
  var LOOKNAME = {periwinkle: 'Periwinkle', wheel: 'Per part', blob__g_yellow: 'Yellow (blob)', 'wheel@outline': 'Per part, outlined', 'blob__g_yellow@outline': 'Yellow, outlined'}, curLook = null;
  // one set of colours for every geometry clip. The others are still rendered and still
  // in index.json; showing one keeps the choice off the page.
  var KEEP_LOOK = 'wheel';
  function setupWipe(s){
    var all = s.looks || [];
    var looks = all.filter(function(k){ return k === KEEP_LOOK; });
    if (!looks.length) looks = all.slice(0, 1);
    $('wipe').hidden = !s.wipe; $('wipe-set').hidden = looks.length < 2;
    $('ref-note').textContent = s.wipe ? 'drag across to see the ground-truth geometry' : '';
    if (!s.wipe) $('wipev').removeAttribute('src');
    if (!s.orbit) $('geo').removeAttribute('src');
    $('wipe-set').innerHTML = looks.map(function(k){ return '<button type="button" data-look="' + esc(k) + '">' + esc(LOOKNAME[k] || k) + '</button>'; }).join('');
    if (looks.length) pickLook(curLook || looks[0], true);
  }
  function swap(v, src){
    release(v); watch(v); v.src = src;
  }
  function pickLook(k, fresh){
    var s = IDX[cur]; curLook = k;
    if (s.wipe) swap($('wipev'), s.wipe[k]);
    if (s.orbit) swap($('geo'), s.orbit[k]);
    if (!fresh && geoOn) setGeo(true);
    $('wipe-set').querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.look === k); });
  }
  $('wipe-set').addEventListener('click', function(e){ var b = e.target.closest('button'); if (b && cur) pickLook(b.dataset.look); });
  (function(){
    var w = $('wipe'), drag = false;
    var at = function(e){ var r = w.getBoundingClientRect(); w.style.setProperty('--x', Math.max(0, Math.min(100, (e.clientX - r.left)/r.width*100)) + '%'); };
    w.addEventListener('pointerdown', function(e){ drag = true; w.setPointerCapture(e.pointerId); at(e); });
    w.addEventListener('pointermove', function(e){ if (drag) at(e); });
    w.addEventListener('pointerup', function(){ drag = false; });
  })();

  // what the scene is: source or simulator, then the ontology
  function renderInfo(scene){
    // the card metadata is the same table the gallery cards read, so a task says the same
    // thing in both places; ontology/tags.json is only the fallback for its tooltips
    var m = META[scene], o = ONTO[scene];
    if (!m && !o){ $('info').innerHTML = ''; return; }
    m = m || {};
    var pill = function(text, cls, title){
      return '<span class="tagp ' + (cls || '') + '"' + (title ? ' title="' + esc(title) + '"' : '')
        + '>' + esc(text) + '</span>';
    };
    var rows = [];
    rows.push(m.kind === 'synthetic' || (o && o.kind === 'synthetic')
      ? ['Simulator', pill(m.simulator || (o && o.simulator) || 'unknown')]
      : ['Source dataset', pill(m.source || (o && o.source) || 'unknown')]);
    rows.push(['Matter', (m.families || []).map(function(f){ return pill(f, 'cat'); }).join('')]);
    rows.push(['Materials', (m.materials || []).map(function(x){ return pill(x, 'cat'); }).join('')]);
    rows.push(['Moving bodies', pill(m.bodies === 'one' ? 'One' : 'Several', 'dyn')]);
    rows.push(['Dynamics', pill(m.driven ? 'Driven' : 'Passive', 'dyn',
      m.driven ? 'Something is scripted from outside: a hand, an arm, a press.'
               : 'Nothing is scripted after the start.')]);
    if ((m.flags || []).length)
      rows.push(['Also', m.flags.map(function(f){
        return pill(f.replace(/_/g, ' '), 'dyn'); }).join('')]);
    var dl = function(rs){
      return '<dl>' + rs.map(function(r){ return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>';
    };
    // the categorization folds away: open on a desk, closed on a phone, and once the
    // reader opens or closes it, it stays that way from task to task
    $('info').innerHTML = '<details class="icat"' + (catOpen ? ' open' : '') + '><summary class="ihead">Categorization</summary>'
      + dl(rows) + '</details>';
    $('info').querySelector('.icat').addEventListener('toggle', function(e){ catOpen = e.target.open; });
  }
  var catOpen = !matchMedia('(max-width:640px)').matches;

  // Newly loaded sources start at zero. Only visible videos participate in the startup wait.
  var loadingFor = null;
  function startTogether(scene){
    setPlaying(false);
    var request = {}; loadingFor = request;
    var list = all(), t0 = Date.now();
    (function wait(){
      if (loadingFor !== request || cur !== scene) return;
      list = all().filter(function(v){ return !v.__off; });
      var ready = list.filter(function(v){ return v.readyState >= 4 || (v.readyState >= 3 && Date.now() - t0 > 2500); }).length;
      $('fnum').textContent = 'loading ' + ready + './' + list.length; $('fnum').classList.add('loading');
      if (ready < list.length && Date.now() - t0 < 7000){ setTimeout(wait, 120); return; }
      loadingFor = null; $('fnum').classList.remove('loading');
      setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (geoOn && !matchMedia('(prefers-reduced-motion: reduce)').matches) sweepWipe(scene);
    })();
  }

  // once per opened scene, the agents' divider shows what it does: from the middle to the left edge, across
  // to the right, back to the middle, ~7 s, eased. Touching a divider (or turning geometry off) stops it.
  var sweeping = null;
  function sweepWipe(scene){
    var keys = [50, 6, 94, 50], seg = [1800, 3400, 1800], t0 = performance.now(), me = {};
    sweeping = me;
    (function step(now){
      if (sweeping !== me || cur !== scene || !geoOn) return;
      var e = now - t0, i = 0;
      while (i < seg.length && e > seg[i]){ e -= seg[i]; i++; }
      if (i >= seg.length){ $('mgrid').style.setProperty('--mx', '50%'); sweeping = null; return; }
      var u = e/seg[i], k = u*u*(3 - 2*u);
      $('mgrid').style.setProperty('--mx', (keys[i] + (keys[i + 1] - keys[i])*k) + '%');
      requestAnimationFrame(step);
    })(t0);
  }
  $('mgrid').addEventListener('pointerdown', function(){ sweeping = null; }, true);

  // the three panes: gallery | metrics | score versus cost. The release page has no
  // switcher and loads the metrics section itself, so every element here is optional.
  function showPane(which, scroll){
    var sw = document.querySelectorAll('.sw[data-pane]');   // the switcher page's own; this page's carry data-tab
    if (!sw.length){                 // the release page: every section is laid out in the open
      if (scroll && $('gallery')) $('gallery').scrollIntoView({behavior: 'smooth', block: 'start'});
      return;
    }
    sw.forEach(function(b){ b.setAttribute('aria-selected', b.dataset.pane === which); });
    ['gallery', 'metrics', 'leaderboard'].forEach(function(n){
      var el = $('pane-' + n); if (el) el.hidden = n !== which;
    });
    var fr = $('metrics-frame');
    if (which === 'metrics' && fr && !fr.src) fr.src = 'metrics/?embed';
    if (which !== 'gallery' && cur){ setPlaying(false); }
    if (scroll && $('gallery')) $('gallery').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  document.querySelectorAll('.sw').forEach(function(b){ b.addEventListener('click', function(){ showPane(b.dataset.pane, false); }); });
  document.querySelectorAll('.page-nav [data-pane]').forEach(function(a){
    a.addEventListener('click', function(e){ e.preventDefault(); showPane(a.dataset.pane, true); });
  });

  function backToGallery(){
    var was = cur;
    $('stage').hidden = true; setPlaying(false); cur = null; loadingFor = null;
    sweeping = null; all().forEach(release); vids = [];
    history.replaceState(null, '', location.pathname + location.search + '#gallery'); renderThumbs();
    var t = was && document.querySelector('.thumb[data-scene="' + was.replace(/"./g, '') + '"]');
    (t || $('gallery')).scrollIntoView({behavior: 'smooth', block: t ? 'center' : 'start'});
  }
  $('st-close').addEventListener('click', backToGallery);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && cur) backToGallery(); });

  // --- transport: the input video is the clock -------------------------------------
  function all(){ return [clock].concat(vids); }
  function setPlaying(p){
    playing = p;
    $('ico-play').style.display = p ? 'none' : ''; $('ico-pause').style.display = p ? '' : 'none';
    $('play').setAttribute('aria-label', p ? 'Pause' : 'Play');
    all().forEach(function(v){ if (p) resume(v); else v.pause(); });
  }
  function seek(t){
    loadingFor = null; $('fnum').classList.remove('loading');
    queuedSeeks.clear(); queuedSeeks.set(clock, t);
    vids.forEach(function(v){ if (!v.__off) queuedSeeks.set(v, t); });
    drainSeeks();
  }
  $('play').addEventListener('click', function(){ setPlaying(!playing); });
  $('scrub').addEventListener('input', function(){ setPlaying(false); if (clock.duration) seek($('scrub').value / 1000 * clock.duration); });
  document.addEventListener('keydown', function(e){
    if ($('stage').hidden || e.target.closest('input,button')) return;
    if (e.key === ' '){ e.preventDefault(); setPlaying(!playing); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
      e.preventDefault(); setPlaying(false);
      var t = queuedSeeks.has(clock) ? queuedSeeks.get(clock) : clock.currentTime;
      seek(Math.max(0, Math.min(clock.duration || 0, t + (e.key === 'ArrowRight' ? 1 : -1)/24)));
    }
  });
  var DRIFT = 0.3, COOL = 2000, MAX_SEEKS = 2, lastClockTime = null, clockMoving = false;
  var players = new Map(), queuedSeeks = new Map(), activeSeeks = new Map();

  function manage(v){
    players.set(v, {lastSeek: -Infinity, lag: 0});
    v.addEventListener('loadedmetadata', updateLoops);
    v.addEventListener('canplay', mediaReady);
    v.addEventListener('seeked', seekFinished);
    v.addEventListener('error', mediaError);
  }
  function release(v){
    seen.unobserve(v); queuedSeeks.delete(v); activeSeeks.delete(v); players.delete(v);
    v.removeEventListener('loadedmetadata', updateLoops);
    v.removeEventListener('canplay', mediaReady);
    v.removeEventListener('seeked', seekFinished);
    v.removeEventListener('error', mediaError);
    v.pause(); v.removeAttribute('src'); v.load();
  }
  function updateLoops(){
    players.forEach(function(state, v){
      if (v !== clock) v.loop = Math.abs(v.duration - clock.duration) <= DRIFT;
    });
  }
  function resume(v){
    if (!playing || loadingFor || document.hidden || stageAway || v.__off || v.seeking ||
        queuedSeeks.has(v) || activeSeeks.has(v) || v.readyState < 2 || !v.paused) return;
    if (v !== clock && (clock.paused || (!v.loop && clock.currentTime >= v.duration - 0.05))) return;
    v.play().catch(function(e){ if (e.name !== 'AbortError') console.error('Video playback failed:', v.currentSrc, e); });
  }
  function mediaReady(){ resume(clock); follow(); }
  function mediaError(e){
    var v = e.target;
    queuedSeeks.delete(v); activeSeeks.delete(v);
    console.error('Video failed:', v.currentSrc, v.error);
    drainSeeks();
  }
  function difference(v, target, circular){
    var delta = target - v.currentTime;
    if (circular && v.loop) delta -= Math.round(delta / clock.duration) * clock.duration;
    return Math.abs(delta);
  }
  // A queued automatic correction uses the clock at dispatch, so time spent in the queue is not drift.
  // Explicit scrubs replace queued targets; an in-flight seek always finishes before the next starts.
  function drainSeeks(){
    if (!cur || loadingFor || document.hidden || stageAway) return;
    for (var entry of queuedSeeks){
      if (activeSeeks.size >= MAX_SEEKS) break;
      var v = entry[0], automatic = entry[1] === null;
      if (v.__off || v.error){ queuedSeeks.delete(v); continue; }
      if (v.seeking || activeSeeks.has(v) || v.readyState < 1 || !v.duration) continue;
      if (automatic && (clock.seeking || queuedSeeks.has(clock) || activeSeeks.has(clock) ||
          clock.readyState < 2 || (playing && !clockMoving))) continue;
      var target = Math.min(automatic ? clock.currentTime : entry[1], v.duration - 1e-3);
      var running = automatic && playing && !clock.paused;
      queuedSeeks.delete(v);
      if (difference(v, target, running) <= (running ? DRIFT : 0.5/24)){ resume(v); continue; }
      if (running){
        target += players.get(v).lag;
        target = v.loop ? target % v.duration : Math.min(target, v.duration - 1e-3);
      }
      activeSeeks.set(v, {at: performance.now(), automatic: automatic});
      v.currentTime = target;
    }
  }
  function seekFinished(e){
    var v = e.target, request = activeSeeks.get(v), state = players.get(v);
    if (!state || v.seeking) return;
    if (request){
      state.lastSeek = performance.now();
      state.lag = request.automatic ? Math.min(1, (state.lastSeek - request.at)/1000) : 0;
      activeSeeks.delete(v);
    }
    resume(v); drainSeeks();
  }
  function follow(){
    var t = clock.currentTime;
    clockMoving = !clock.paused && t !== lastClockTime;
    lastClockTime = t;
    if (!cur || loadingFor || document.hidden || stageAway || !clock.duration || clock.seeking || clock.readyState < 2) return;
    if (playing && (!clockMoving || clock.readyState < 3)) return;
    var now = performance.now();
    vids.forEach(function(v){
      if (v.__off || v.error || v.seeking || v.readyState < 2 || !v.duration ||
          queuedSeeks.has(v) || activeSeeks.has(v)) return;
      var target = Math.min(t, v.duration - 1e-3), state = players.get(v);
      if (difference(v, target, playing) > (playing ? DRIFT : 0.5/24) &&
          (!playing || now - state.lastSeek >= COOL)) queuedSeeks.set(v, null);
      resume(v);
    });
    drainSeeks();
  }
  setInterval(follow, 250);
  var seen = new IntersectionObserver(function(es){
    es.forEach(function(en){
      var v = en.target; if (!players.has(v)) return;
      v.__off = !en.isIntersecting;
      if (v.__off){ v.pause(); queuedSeeks.delete(v); }
      else { v.preload = 'auto'; players.get(v).lastSeek = -Infinity; }
    });
  });
  function watch(v){
    if (!players.has(v)){ manage(v); v.__off = true; v.preload = 'metadata'; seen.observe(v); }
    return v;
  }
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) all().forEach(function(v){ v.pause(); });
    else { setPlaying(playing); follow(); }
  });
  // the open scene scrolled out of view: everything pauses, the input video too, as on a hidden tab
  var stageAway = false;
  new IntersectionObserver(function(es){
    stageAway = !es[es.length - 1].isIntersecting;
    if (stageAway) all().forEach(function(v){ v.pause(); });
    else if (cur){ setPlaying(playing); follow(); }
  }).observe($('stage'));
  (function loop(){
    if (cur && clock.duration){
      var t = clock.currentTime;
      if (document.activeElement !== $('scrub')) $('scrub').value = Math.round(t / clock.duration * 1000);
      if (!loadingFor) $('fnum').textContent = t.toFixed(2) + ' s / ' + clock.duration.toFixed(2) + ' s';
    }
    requestAnimationFrame(loop);
  })();

  // every model with a render or a failed run on the page, named from the registry (models.json) and ranked as the
  // leaderboard ranks them: by VLM Elo, out of data/leaderboard.json
  function ranked(registry, board){
    var reg = {}, keys = {};
    registry.forEach(function(m){ reg[m.key] = m; });
    var rows = (board && board.models ? board.models : []).slice().sort(function(a, b){
      return (a.rank || Infinity) - (b.rank || Infinity) || (b.elo || 0) - (a.elo || 0);
    });
    var order = rows.map(function(r){ return r.run; });
    Object.keys(IDX).forEach(function(k){
      Object.keys(IDX[k].models).concat(Object.keys(IDX[k].failed || {})).forEach(function(m){ keys[m] = true; });
    });
    return Object.keys(keys).map(function(k){
      var m = reg[k];
      if (!m) throw new Error('index.json names ' + k + ', which models.json does not');
      return {key: k, label: m.effort ? m.name + ' [' + m.effort + ']' : m.name,
              short: m.effort ? m.short + ' [' + (m.effort === 'Default' ? 'Def' : m.effort) + ']' : m.short,
              logo: m.logo, rank: order.indexOf(k) + 1};
    }).sort(function(a, b){ return (a.rank || Infinity) - (b.rank || Infinity) || (a.label < b.label ? -1 : 1); });
  }
  Promise.all([fetch('index.json').then(function(r){ return r.json(); }), fetch('models.json').then(function(r){ return r.json(); }),
               fetch('data/leaderboard.json').then(function(r){ return r.json(); }).catch(function(){ return null; }),
               fetch('ontology/scenes.jsonl').then(function(r){ return r.text(); }), fetch('ontology/tags.json').then(function(r){ return r.json(); }),
               fetch('data/scenes.json').then(function(r){ return r.json(); }).catch(function(){ return {}; })])
    .then(function(res){
      IDX = res[0]; MODELS = ranked(res[1].models, res[2]);
      res[3].split('\n').forEach(function(l){ if (l.trim()){ var o = JSON.parse(l); ONTO[o.case] = o; } });
      res[4].forEach(function(t){ TAGS[t.key] = t; });
      META = res[5] || {};
      drawStrip();
      var keys = Object.keys(IDX), real = keys.filter(function(k){ return k.indexOf('real/') === 0; }).length;
      // the headline counts the renders of the agents the leaderboard ranks
      var LBK = null;
      fetch('data/leaderboard.json').then(function(r){ return r.json(); }).then(function(lb){
        LBK = {}; lb.models.forEach(function(m){ LBK[m.video_key] = 1; });
        var scored = keys.reduce(function(a, k){
          return a + Object.keys(IDX[k].models).filter(function(m){ return LBK[m]; }).length; }, 0);
        $('summary').innerHTML = '<strong>' + keys.length + ' tasks</strong>, '
          + '<span class="hl-real">' + real + ' real</span> and '
          + '<span class="hl-synth">' + (keys.length - real) + ' simulated</span>. '
          + 'We evaluate <strong>' + lb.models.length + ' models</strong>, producing a '
          + 'total of <strong>' + scored.toLocaleString() + ' reconstructions</strong>.';
      });
      renderThumbs(); if (CURATE) loadCurate();
      var h = decodeURIComponent(location.hash.slice(1));
      if (IDX[h]) select(h, true);
    })
    .catch(function(e){
      $('summary').textContent = 'The gallery could not be loaded.';
      $('thumbs').innerHTML = '<p class="load-error" role="alert">' + esc(e.message) + '</p>';
    });
})();
