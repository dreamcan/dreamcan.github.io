(function () {
  'use strict';
  var root = document.getElementById('reachability-explorer');
  if (!root) return;
  var assetBase = 'assets/reachability/';
  var $ = function (id) { return document.getElementById('reach-' + id); };
  var taskButtons = Array.from(root.querySelectorAll('[data-reach-task]'));
  var modeButtons = Array.from(root.querySelectorAll('[data-reach-mode]'));
  var selector = $('trajectory');
  var chart = $('chart');
  var manifest, task, trajectory, data;
  var initial = 0, goal = 1, mode = 'initial', requestVersion = 0;
  var curves = new Map();
  var rememberedSelections = new Map();
  var pendingTask = 'libero-long';
  var chartWidth = 600, chartHeight = 400;
  var chartBounds = { left: 64, right: 576, top: 30, bottom: 348 };

  function loadJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Unable to load ' + url + ' (HTTP ' + response.status + ').');
      return response.json();
    });
  }

  function loadCurves(row) {
    if (!curves.has(row.id)) {
      var promise = loadJson(assetBase + row.curves).then(function (result) {
        if (result.id !== row.id || result.frameCount !== row.frameCount ||
            !Array.isArray(result.forwardReachability) || result.forwardReachability.length !== row.frameCount) {
          throw new Error('The curve data does not match this trajectory.');
        }
        result.forwardReachability.forEach(function (values, index) {
          if (values.length !== row.frameCount - index - 1 || values.some(function (v) {
            return !Number.isFinite(v) || v < 0 || v > 1;
          })) throw new Error('Invalid learned reachability values.');
        });
        return result;
      }).catch(function (error) { curves.delete(row.id); throw error; });
      curves.set(row.id, promise);
    }
    return curves.get(row.id);
  }

  function loading(message) {
    root.setAttribute('aria-busy', 'true');
    $('load-status').hidden = false;
    $('load-status').textContent = message;
    $('workspace').hidden = true;
    $('retry').hidden = true;
    selector.disabled = true;
  }

  function showError(error) {
    root.setAttribute('aria-busy', 'false');
    $('load-status').textContent = 'Reachability data could not be loaded. ' + error.message;
    $('retry').hidden = false;
    selector.disabled = false;
  }

  function setAtlasFrame(element, index) {
    var columns = trajectory.atlasColumns, rows = trajectory.atlasRows;
    var column = index % columns, row = Math.floor(index / columns);
    element.style.backgroundImage = 'url("' + assetBase + trajectory.atlas + '")';
    element.style.backgroundSize = (columns * 100) + '% ' + (rows * 100) + '%';
    element.style.backgroundPosition = (column * 100 / (columns - 1)) + '% ' + (rows > 1 ? row * 100 / (rows - 1) : 0) + '%';
  }

  function reachability(from, to) {
    if (from === to) return 1;
    if (from > to) return null;
    return data.forwardReachability[from][to - from - 1];
  }

  function setMode(nextMode) {
    mode = nextMode;
    modeButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.reachMode === mode));
    });
    updateThumbnailStates();
  }

  function updateThumbnailStates() {
    if (!trajectory) return;
    Array.from($('frame-grid').children).forEach(function (button) {
      var index = Number(button.dataset.frame);
      button.classList.toggle('is-initial', index === initial);
      button.classList.toggle('is-goal', index === goal);
      button.disabled = mode === 'initial' ? index === trajectory.frameCount - 1 : index === 0;
      button.setAttribute('aria-pressed', String(index === (mode === 'initial' ? initial : goal)));
      button.setAttribute('aria-label', 'Frame ' + index +
        (index === initial ? ', selected frame i' : index === goal ? ', selected frame j' : '') +
        '. Set as frame ' + (mode === 'initial' ? 'i' : 'j') + '.');
      button.lastElementChild.lastElementChild.textContent = index === initial ? 'i' : index === goal ? 'j' : '';
    });
  }

  function makeThumbnails() {
    var grid = $('frame-grid');
    grid.replaceChildren();
    trajectory.sampledFrames.forEach(function (index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'reach-thumb';
      button.dataset.frame = index;
      var image = document.createElement('div');
      image.className = 'reach-atlas-frame';
      image.setAttribute('aria-hidden', 'true');
      setAtlasFrame(image, index);
      var caption = document.createElement('span');
      caption.className = 'reach-thumb-caption';
      var frameLabel = document.createElement('span');
      frameLabel.textContent = index;
      var roleLabel = document.createElement('span');
      roleLabel.className = 'reach-thumb-role';
      caption.append(frameLabel, roleLabel);
      button.append(image, caption);
      button.addEventListener('click', function () { chooseFrame(index); });
      grid.append(button);
    });
  }

  function remember() {
    if (trajectory && data) rememberedSelections.set(trajectory.id, { initial: initial, goal: goal });
  }

  function chooseFrame(index) {
    if (!data || root.getAttribute('aria-busy') === 'true') return;
    if (mode === 'initial') {
      initial = Math.max(0, Math.min(trajectory.frameCount - 2, Math.round(index)));
      if (initial >= goal) goal = initial + 1;
    } else {
      goal = Math.max(1, Math.min(trajectory.frameCount - 1, Math.round(index)));
      if (goal <= initial) initial = goal - 1;
    }
    updateSelection();
  }

  function chartX(frame) {
    return chartBounds.left + frame / (trajectory.frameCount - 1) * (chartBounds.right - chartBounds.left);
  }

  function chartY(value) {
    return chartBounds.bottom - value * (chartBounds.bottom - chartBounds.top);
  }

  function hideChartFocus() {
    $('chart-tooltip').hidden = true;
    var focus = $('chart-focus');
    if (focus) focus.setAttribute('visibility', 'hidden');
  }

  function drawChart() {
    var n = trajectory.frameCount;
    var b = chartBounds;
    var x = chartX, y = chartY;
    function path(from, to, getter) {
      var result = '';
      var connected = false;
      for (var frame = from; frame <= to; frame++) {
        var value = getter(frame);
        if (value === null || !Number.isFinite(value)) { connected = false; continue; }
        result += (connected ? 'L' : 'M') + x(frame).toFixed(2) + ',' + y(value).toFixed(2);
        connected = true;
      }
      return result;
    }
    var score = reachability(initial, goal);
    var parts = ['<title id="reach-chart-title">Learned reachability across trajectory frames</title>',
      '<desc id="reach-chart-description">Frame i is ' + initial + ', frame j is ' + goal +
      '. Selected pair reachability ' + score.toFixed(3) +
      '. The curve shows reachability from frame i to later frames. The filled marker selects frame j on this curve.</desc>',
      '<rect x="' + x(initial).toFixed(2) + '" y="' + b.top + '" width="' + (x(goal) - x(initial)).toFixed(2) + '" height="' + (b.bottom - b.top) + '" fill="var(--front-blue-tint)" opacity=".55"/>'];
    [0, 0.25, 0.5, 0.75, 1].forEach(function (value) {
      parts.push('<line x1="' + b.left + '" x2="' + b.right + '" y1="' + y(value) + '" y2="' + y(value) + '" stroke="var(--front-border)"/>');
      parts.push('<text x="' + (b.left - 12) + '" y="' + (y(value) + 4) + '" text-anchor="end">' + (value % 1 === 0 ? value.toFixed(1) : value) + '</text>');
    });
    var ticks = Array.from(new Set([0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((n - 1) * 3 / 4), n - 1]));
    ticks.forEach(function (frame) {
      parts.push('<line x1="' + x(frame) + '" x2="' + x(frame) + '" y1="' + b.bottom + '" y2="' + (b.bottom + 5) + '" stroke="var(--front-axis)"/>');
      parts.push('<text x="' + x(frame) + '" y="' + (b.bottom + 23) + '" text-anchor="middle">' + frame + '</text>');
    });
    parts.push('<text x="' + ((b.left + b.right) / 2) + '" y="' + (chartHeight - 10) + '" text-anchor="middle">Trajectory frame t</text>');
    parts.push('<text transform="translate(15 ' + ((b.top + b.bottom) / 2) + ') rotate(-90)" text-anchor="middle">Reachability R</text>');
    parts.push('<line x1="' + b.left + '" x2="' + b.right + '" y1="' + b.bottom + '" y2="' + b.bottom + '" stroke="var(--front-axis)"/>');
    // The cache contains strict forward pairs. Show the theoretical diagonal
    // as separate hollow markers so it is not mistaken for a network output.
    parts.push('<path class="reach-curve-initial" d="' + path(initial + 1, n - 1, function (t) { return reachability(initial, t); }) + '" fill="none" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>');
    parts.push('<line x1="' + x(initial) + '" x2="' + x(initial) + '" y1="' + b.top + '" y2="' + b.bottom + '" stroke="var(--front-blue)" stroke-width="1.5" stroke-dasharray="3 4"/>');
    parts.push('<circle cx="' + x(initial) + '" cy="' + y(1) + '" r="3.5" fill="white" stroke="var(--front-blue)" stroke-width="1.5"/>');
    parts.push('<text x="' + x(initial) + '" y="18" text-anchor="' + (initial / (n - 1) < 0.1 ? 'start' : initial / (n - 1) > 0.9 ? 'end' : 'middle') + '" style="fill:var(--front-blue);font-weight:600">Frame i: ' + initial + '</text>');
    parts.push('<circle class="reach-selected-point" cx="' + x(goal) + '" cy="' + y(score) + '" r="4.5" fill="var(--front-blue)" stroke="white" stroke-width="2"/>');
    var labelLeft = goal / (n - 1) > 0.8;
    parts.push('<text x="' + (x(goal) + (labelLeft ? -8 : 8)) + '" y="' + Math.max(b.top + 18, y(score) - 10) + '" text-anchor="' + (labelLeft ? 'end' : 'start') + '" style="fill:var(--front-blue);font-weight:600">j: ' + goal + '</text>');
    parts.push('<g id="reach-chart-focus" visibility="hidden" aria-hidden="true" pointer-events="none">' +
      '<line id="reach-focus-vertical" class="reach-focus-line"/>' +
      '<line id="reach-focus-horizontal" class="reach-focus-line"/>' +
      '<circle id="reach-focus-point" class="reach-focus-point" r="4"/></g>');
    chart.setAttribute('viewBox', '0 0 ' + chartWidth + ' ' + chartHeight);
    chart.innerHTML = parts.join('');
    hideChartFocus();
  }

  function updateSelection() {
    $('initial-range').value = initial;
    $('goal-range').value = goal;
    $('initial-index').textContent = initial;
    $('goal-index').textContent = goal;
    updateThumbnailStates();
    drawChart();
    remember();
  }

  async function selectTrajectory(id) {
    var version = ++requestVersion;
    remember();
    var row = task.trajectories.find(function (item) { return item.id === id; });
    if (!row) return;
    loading('Loading ' + task.label + ' · ' + row.label + '…');
    $('task-instruction').textContent = row.instruction;
    selector.value = row.id;
    try {
      var result = await loadCurves(row);
      if (version !== requestVersion) return;
      trajectory = row;
      data = result;
      var saved = rememberedSelections.get(row.id);
      initial = saved ? saved.initial : 0;
      goal = saved ? saved.goal : row.frameCount - 1;
      root.style.setProperty('--reach-frame-aspect', row.width + ' / ' + row.height);
      $('frame-count').textContent = row.frameCount + ' frames · ' + row.episode;
      $('initial-range').max = row.frameCount - 2;
      $('goal-range').max = row.frameCount - 1;
      makeThumbnails();
      updateSelection();
      $('workspace').hidden = false;
      $('load-status').hidden = true;
      selector.disabled = false;
      root.setAttribute('aria-busy', 'false');
    } catch (error) {
      if (version === requestVersion) showError(error);
    }
  }

  function selectTask(id) {
    pendingTask = id;
    if (!manifest) return;
    task = manifest.tasks.find(function (item) { return item.id === id; });
    if (!task) return;
    taskButtons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.reachTask === id)); });
    $('trajectory-label').textContent = id === 'libero-long' ? 'Task' : id === 'language-table' ? 'Instruction' : 'Trajectory';
    selector.replaceChildren();
    var groups = new Map();
    task.trajectories.forEach(function (row) {
      var parent = selector;
      if (row.category) {
        if (!groups.has(row.category)) {
          var group = document.createElement('optgroup');
          group.label = row.categoryLabel;
          selector.append(group);
          groups.set(row.category, group);
        }
        parent = groups.get(row.category);
      }
      var option = document.createElement('option');
      option.value = row.id;
      option.textContent = row.label;
      option.title = row.instruction;
      parent.append(option);
    });
    selectTrajectory(task.trajectories[0].id);
  }

  async function initialize() {
    loading('Loading learned reachability data…');
    try {
      manifest = await loadJson(assetBase + 'manifest.json?v=20261010-instruction-complete');
      if (!Array.isArray(manifest.tasks) || manifest.tasks.length !== 4 || manifest.tasks.some(function (item) {
        return !Array.isArray(item.trajectories) || item.trajectories.length < 1;
      })) throw new Error('Incomplete trajectory manifest.');
      selectTask(pendingTask);
    } catch (error) { showError(error); }
  }

  function chartPosition(event) {
    var point = chart.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(chart.getScreenCTM().inverse());
  }

  function chartFrame(position) {
    return Math.round(Math.max(0, Math.min(1, (position.x - chartBounds.left) / (chartBounds.right - chartBounds.left))) * (trajectory.frameCount - 1));
  }

  new ResizeObserver(function (entries) {
    var size = entries[0].contentRect;
    if (size.width < 1 || size.height < 1 ||
        (Math.abs(size.width - chartWidth) < .5 && Math.abs(size.height - chartHeight) < .5)) return;
    chartWidth = size.width;
    chartHeight = size.height;
    chartBounds = { left: chartWidth < 400 ? 58 : 64, right: chartWidth - 20, top: 30, bottom: chartHeight - 44 };
    if (data) drawChart();
  }).observe(chart.parentElement);

  taskButtons.forEach(function (button) {
    button.addEventListener('click', function () { selectTask(button.dataset.reachTask); });
  });
  modeButtons.forEach(function (button) {
    button.addEventListener('click', function () { setMode(button.dataset.reachMode); });
  });
  selector.addEventListener('change', function () { selectTrajectory(selector.value); });
  $('initial-range').addEventListener('input', function () { setMode('initial'); chooseFrame(Number(this.value)); });
  $('goal-range').addEventListener('input', function () { setMode('goal'); chooseFrame(Number(this.value)); });
  $('reset').addEventListener('click', function () {
    if (!data) return;
    initial = 0;
    goal = trajectory.frameCount - 1;
    setMode('initial');
    updateSelection();
  });
  $('retry').addEventListener('click', function () {
    if (manifest && task) selectTrajectory(selector.value);
    else initialize();
  });
  chart.addEventListener('click', function (event) {
    if (data) chooseFrame(chartFrame(chartPosition(event)));
  });
  chart.addEventListener('pointermove', function (event) {
    if (!data || root.getAttribute('aria-busy') === 'true') return;
    var position = chartPosition(event);
    var b = chartBounds;
    if (position.x < b.left || position.x > b.right || position.y < b.top || position.y > b.bottom) {
      hideChartFocus();
      return;
    }
    var frame = chartFrame(position);
    var from = reachability(initial, frame);
    if (from === null) { hideChartFocus(); return; }
    var x = chartX(frame), y = chartY(from);
    var vertical = $('focus-vertical'), horizontal = $('focus-horizontal'), point = $('focus-point');
    vertical.setAttribute('x1', x);
    vertical.setAttribute('x2', x);
    vertical.setAttribute('y1', b.top);
    vertical.setAttribute('y2', b.bottom);
    horizontal.setAttribute('x1', b.left);
    horizontal.setAttribute('x2', b.right);
    horizontal.setAttribute('y1', y);
    horizontal.setAttribute('y2', y);
    point.setAttribute('cx', x);
    point.setAttribute('cy', y);
    $('chart-focus').setAttribute('visibility', 'visible');
    var tooltip = $('chart-tooltip');
    tooltip.textContent = 'Frame ' + frame + '\nFrom frame i: ' + from.toFixed(3) +
      (frame === initial ? '\nSame-state boundary: 1' : '');
    tooltip.hidden = false;
    var svgPoint = chart.createSVGPoint();
    svgPoint.x = x;
    svgPoint.y = y;
    var screenPoint = svgPoint.matrixTransform(chart.getScreenCTM());
    var box = chart.parentElement.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(screenPoint.x - box.left + 12, box.width - tooltip.offsetWidth - 8)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(screenPoint.y - box.top - tooltip.offsetHeight - 10, box.height - tooltip.offsetHeight - 8)) + 'px';
  });
  chart.addEventListener('pointerleave', hideChartFocus);
  initialize();
})();
