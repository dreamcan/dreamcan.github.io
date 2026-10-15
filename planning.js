(function () {
  'use strict';
  var root = document.getElementById('planning-explorer');
  if (!root) return;
  var parentPanel = document.getElementById('experiments-panel-long-horizon');
  var panel = document.getElementById('planning-task-panel');
  var tabs = Array.from(root.querySelectorAll('[data-planning-task]'));
  var examples = Array.from(root.querySelectorAll('[data-planning-example]'));
  var methods = ['ours', 'dense', 'uniform', 'vlp'];
  var assetsRoot = 'assets/experiments/planning/';
  var manifest;
  var selectedTask = 'line';
  var selection = {};
  var inView = false;

  function el(id) { return document.getElementById('planning-' + id); }
  function task() { return manifest.tasks.find(function (item) { return item.id === selectedTask; }); }

  function playback() {
    methods.forEach(function (method) {
      var video = el('video-' + method);
      if (inView && !parentPanel.hidden && !document.hidden && !video.hidden && video.hasAttribute('src')) {
        video.play().catch(function () {});
      } else video.pause();
    });
  }

  function setVideo(method, media) {
    var video = el('video-' + method);
    if (method === 'vlp') {
      var temporary = !!(media && media.temporaryPlaceholder);
      video.setAttribute('aria-label', temporary ? 'Temporary Dense checkpoint planning result in the VLP slot' : 'VLP planning result');
    }
    var empty = video.parentElement.querySelector('.planning-video-empty');
    video.pause();
    video.hidden = !media;
    empty.hidden = !!media;
    empty.textContent = 'Video to be added';
    if (media) {
      video.muted = true;
      video.poster = assetsRoot + media.poster;
      video.src = assetsRoot + media.video;
      video.load();
    } else {
      video.removeAttribute('src');
      video.removeAttribute('poster');
      video.load();
    }
  }

  function showExample(index) {
    if (!manifest) return;
    var current = task();
    var sample = current.examples[index];
    selection[selectedTask] = index;
    examples.forEach(function (button, i) {
      button.setAttribute('aria-pressed', String(i === index));
      button.disabled = !current.examples[i];
    });
    el('instruction').textContent = sample.instruction;
    methods.forEach(function (method) { setVideo(method, sample.media[method]); });
    playback();
  }

  function showTask(id, focus) {
    selectedTask = id;
    tabs.forEach(function (button) {
      var active = button.dataset.planningTask === id;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    panel.setAttribute('aria-labelledby', 'planning-tab-' + id);
    if (!manifest) return;
    var current = task();
    ['dense', 'uniform', 'vlp', 'ours'].forEach(function (method) {
      var value = current.results[method];
      var cell = el('result-' + method);
      cell.textContent = value === null ? '—' : value + '%';
      if (value === null) {
        cell.setAttribute('aria-label', 'Not reported');
      } else cell.removeAttribute('aria-label');
    });
    showExample(selection[id] || 0);
  }

  tabs.forEach(function (button, index) {
    button.addEventListener('click', function () { showTask(button.dataset.planningTask, false); });
    button.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      showTask(tabs[next].dataset.planningTask, true);
    });
  });
  examples.forEach(function (button, index) {
    button.addEventListener('click', function () { showExample(index); });
  });
  methods.forEach(function (method) {
    var video = el('video-' + method);
    video.addEventListener('play', function () {
      if (!inView || parentPanel.hidden || document.hidden) video.pause();
    });
    video.addEventListener('loadeddata', playback);
    video.addEventListener('error', function () {
      if (video.hasAttribute('src')) {
        video.hidden = true;
        var empty = video.parentElement.querySelector('.planning-video-empty');
        empty.textContent = 'Video could not be loaded';
        empty.hidden = false;
      }
    });
  });
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    playback();
  }, { rootMargin: '100px' }).observe(root);
  new MutationObserver(playback).observe(parentPanel, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', playback);

  fetch(assetsRoot + 'manifest.json')
    .then(function (response) {
      if (!response.ok) throw new Error('Planning examples are unavailable.');
      return response.json();
    })
    .then(function (data) {
      manifest = data;
      showTask(selectedTask, false);
      root.setAttribute('aria-busy', 'false');
    })
    .catch(function () {
      el('instruction').textContent = 'Planning examples could not be loaded. Please reload the page.';
      root.setAttribute('aria-busy', 'false');
    });
})();
