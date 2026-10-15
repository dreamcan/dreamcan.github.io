(function () {
  'use strict';
  var root = document.getElementById('dp-explorer');
  if (!root) return;
  var panel = document.getElementById('method-panel-search');
  var $ = function (name) { return document.getElementById('dp-' + name); };
  var base = 'assets/dp/', manifest, task, trajectory, worker, data;
  var initialized = false, version = 0, timer;
  var cache = new Map(), remembered = new Map();
  var subgoalLimits = { 'libero-long':10, pusht:10, 'language-table':16, square:8 };
  var buttons = Array.from(root.querySelectorAll('[data-dp-task]'));
  function json(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function busy(hide) {
    root.setAttribute('aria-busy', 'true'); root.classList.add('is-computing'); $('retry').hidden = true;
    if (hide) { $('workspace').hidden = true; $('load-status').hidden = false; $('load-status').textContent = 'Loading demonstration frames and selecting subgoals…'; $('trajectory').disabled = true; }
    $('plan-count').textContent = 'Selecting…';
  }
  function failure(message) {
    root.setAttribute('aria-busy', 'false'); root.classList.remove('is-computing');
    $('workspace').hidden = true; $('load-status').hidden = false;
    $('load-status').textContent = 'Could not load subgoal selection. ' + message;
    $('retry').hidden = false; $('trajectory').disabled = false;
  }
  function parameters() {
    var d = manifest.defaults, k = Number($('k').value);
    return { k:k, wr:d.wr, wg:d.wg, ws:d.ws,
      gap:Math.min(Math.floor((trajectory.frameCount - 1) / k), Math.max(d.minimumGap, Math.round(d.gapFraction * trajectory.frameCount))) };
  }
  function frameCard(frame, label) {
    var card = document.createElement('div'); card.className = 'dp-frame-card'; card.dataset.frame = frame;
    var image = document.createElement('div'); image.className = 'dp-atlas-frame';
    image.setAttribute('role', 'img'); image.setAttribute('aria-label', 'Demonstration frame ' + frame);
    var cols = trajectory.atlasColumns, rows = trajectory.atlasRows;
    image.style.backgroundImage = 'url("' + base + trajectory.atlas + '")';
    image.style.backgroundSize = cols * 100 + '% ' + rows * 100 + '%';
    image.style.backgroundPosition = (frame % cols * 100 / (cols - 1)) + '% ' + (rows > 1 ? Math.floor(frame / cols) * 100 / (rows - 1) : 0) + '%';
    var caption = document.createElement('span'); caption.textContent = label;
    card.append(image, caption); return card;
  }
  function renderResult(result) {
    var fragment = document.createDocumentFragment();
    result.path.forEach(function (frame, i) { fragment.append(frameCard(frame, 'Subgoal ' + (i + 1) + ' · Frame ' + frame)); });
    $('plan').replaceChildren(fragment);
    var selected = new Set(result.path);
    Array.from($('frame-grid').children).forEach(function (card) { card.classList.toggle('is-selected', selected.has(Number(card.dataset.frame))); });
    $('plan-count').textContent = result.path.length + ' keyframes';
    root.setAttribute('aria-busy', 'false'); root.classList.remove('is-computing');
    $('workspace').hidden = false; $('load-status').hidden = true; $('trajectory').disabled = false;
  }
  function createWorker() {
    if (worker) worker.terminate();
    worker = new Worker('dp-worker.js?v=20261010-dp');
    worker.onmessage = function (event) {
      if (event.data.version !== version) return;
      if (event.data.error) failure(event.data.error); else renderResult(event.data.result);
    };
    worker.onerror = function () { failure('Dynamic programming could not start.'); };
  }
  function compute() {
    if (!data || !trajectory) return;
    clearTimeout(timer); busy(false); var request = ++version;
    timer = setTimeout(function () {
      if (request !== version) return;
      // Init each request so a rapid trajectory switch never reuses another video's values.
      worker.postMessage({type:'init', version:request, reachability:data.reachability, utility:data.utility,
        epsilon:manifest.defaults.epsilon, params:parameters()});
    }, 70);
  }
  function loadTrajectory(row) {
    clearTimeout(timer); var request = ++version; trajectory = row; data = null;
    remembered.set(task.id, row.id); $('trajectory').value = row.id; $('instruction').textContent = row.instruction;
    root.style.setProperty('--dp-frame-aspect', row.width / row.height);
    $('k').max = Math.min(subgoalLimits[task.id], row.frameCount - 1); $('k').value = Math.min(Number($('k').value), Number($('k').max));
    $('k-output').textContent = $('k').value; busy(true);
    if (!cache.has(row.id)) cache.set(row.id, Promise.all([json(base + row.reachability), json(base + row.utility)]).then(function (values) {
      var r = values[0], u = values[1];
      if (r.id !== row.id || u.id !== row.id || r.frameCount !== row.frameCount || u.frameCount !== row.frameCount) throw new Error('Values do not match the demonstration.');
      return {reachability:r.forwardReachability, utility:u.utility};
    }).catch(function (error) { cache.delete(row.id); throw error; }));
    cache.get(row.id).then(function (values) {
      if (request !== version) return;
      data = values;
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < row.frameCount; i++) fragment.append(frameCard(i, 'Frame ' + i));
      $('frame-grid').replaceChildren(fragment); $('frame-grid').scrollLeft = 0;
      $('frame-count').textContent = row.frameCount + ' frames';
      worker.postMessage({type:'init',version:request,reachability:data.reachability,utility:data.utility,
        epsilon:manifest.defaults.epsilon,params:parameters()});
    }).catch(function (error) { if (request === version) failure(error.message); });
  }
  function selectTask(id, first) {
    task = manifest.tasks.find(function (t) { return t.id === id; });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.dpTask === id)); });
    var selector = $('trajectory'); selector.replaceChildren(); var groups = new Map();
    task.trajectories.forEach(function (row) {
      var parent = selector;
      if (row.categoryLabel) {
        if (!groups.has(row.categoryLabel)) { var group = document.createElement('optgroup'); group.label = row.categoryLabel; groups.set(row.categoryLabel,group); selector.append(group); }
        parent = groups.get(row.categoryLabel);
      }
      var option = document.createElement('option'); option.value = row.id; option.textContent = row.label; parent.append(option);
    });
    var chosen = first ? manifest.defaultTrajectory : remembered.get(id);
    loadTrajectory(task.trajectories.find(function (r) { return r.id === chosen; }) || task.trajectories[0]);
  }
  function initialize() {
    initialized = true; busy(true);
    json(base + 'manifest.json').then(function (value) {
      manifest = value; $('k').value = value.defaults.k; $('k-output').textContent = $('k').value;
      createWorker(); selectTask('libero-long',true);
    }).catch(function (error) { failure(error.message); });
  }
  buttons.forEach(function (b) { b.addEventListener('click',function () { if (manifest) selectTask(b.dataset.dpTask,false); }); });
  $('trajectory').addEventListener('change',function () { loadTrajectory(task.trajectories.find(function (r) { return r.id === $('trajectory').value; })); });
  $('k').addEventListener('input',function () { $('k-output').textContent = $('k').value; compute(); });
  $('retry').addEventListener('click',function () { if (!manifest) initialize(); else { createWorker(); loadTrajectory(trajectory); } });
  new MutationObserver(function () { if (!panel.hidden && !initialized) initialize(); }).observe(panel,{attributes:true,attributeFilter:['hidden']});
  if (!panel.hidden) initialize();
})();
