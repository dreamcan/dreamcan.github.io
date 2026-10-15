(function () {
  'use strict';
  var root = document.getElementById('utility-explorer');
  if (!root) return;
  var panel = document.getElementById('method-panel-learning');
  var video = document.getElementById('utility-detection-video');
  var assetBase = 'assets/utility/';
  var $ = function (id) { return document.getElementById('utility-' + id); };
  var buttons = Array.from(root.querySelectorAll('[data-utility-task]'));
  var selector = $('trajectory'), chart = $('chart');
  var manifest, task, trajectory, data;
  var selected = 0, requestVersion = 0, initialized = false, pendingTask = 'libero-long';
  var values = new Map(), selections = new Map();
  var chartWidth = 600, chartHeight = 400;
  var bounds = { left: 64, right: 576, top: 30, bottom: 348 };

  function loadJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function loadValues(row) {
    if (!values.has(row.id)) {
      var promise = loadJson(assetBase + row.values).then(function (result) {
        if (result.id !== row.id || result.frameCount !== row.frameCount ||
            !Array.isArray(result.utility) || result.utility.length !== row.frameCount ||
            result.utility.some(function (value) { return !Number.isFinite(value) || value < 0 || value > 1; })) {
          throw new Error('Utility values do not match this trajectory.');
        }
        return result;
      }).catch(function (error) { values.delete(row.id); throw error; });
      values.set(row.id, promise);
    }
    return values.get(row.id);
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
    $('load-status').textContent = 'Task utility data could not be loaded. ' + error.message;
    $('retry').hidden = false;
    selector.disabled = false;
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
      var columns = trajectory.atlasColumns, rows = trajectory.atlasRows;
      image.style.backgroundImage = 'url("' + assetBase + trajectory.atlas + '")';
      image.style.backgroundSize = columns * 100 + '% ' + rows * 100 + '%';
      image.style.backgroundPosition = index % columns * 100 / (columns - 1) + '% ' +
        (rows > 1 ? Math.floor(index / columns) * 100 / (rows - 1) : 0) + '%';
      var caption = document.createElement('span');
      caption.className = 'reach-thumb-caption';
      var label = document.createElement('span');
      label.textContent = index;
      var role = document.createElement('span');
      role.className = 'reach-thumb-role';
      caption.append(label, role);
      button.append(image, caption);
      button.addEventListener('click', function () { chooseFrame(index); });
      grid.append(button);
    });
  }

  function chartX(frame) {
    return bounds.left + frame / (trajectory.frameCount - 1) * (bounds.right - bounds.left);
  }

  function chartY(value) {
    return bounds.bottom - value * (bounds.bottom - bounds.top);
  }

  function hideFocus() {
    $('chart-tooltip').hidden = true;
    var focus = $('chart-focus');
    if (focus) focus.setAttribute('visibility', 'hidden');
  }

  function drawChart() {
    var n = trajectory.frameCount, b = bounds;
    var parts = ['<title id="utility-chart-title">Task utility across trajectory frames</title>',
      '<desc id="utility-chart-description">Selected frame ' + selected + '. Task utility ' +
      data.utility[selected].toFixed(3) + '. The curve shows the normalized best progress so far toward the language instruction.</desc>'];
    [0, .25, .5, .75, 1].forEach(function (value) {
      var y = chartY(value);
      parts.push('<line x1="' + b.left + '" x2="' + b.right + '" y1="' + y + '" y2="' + y + '" stroke="var(--front-border)"/>');
      parts.push('<text x="' + (b.left - 12) + '" y="' + (y + 4) + '" text-anchor="end">' +
        (value % 1 === 0 ? value.toFixed(1) : value) + '</text>');
    });
    Array.from(new Set([0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((n - 1) * 3 / 4), n - 1])).forEach(function (frame) {
      var x = chartX(frame);
      parts.push('<line x1="' + x + '" x2="' + x + '" y1="' + b.bottom + '" y2="' + (b.bottom + 5) + '" stroke="var(--front-axis)"/>');
      parts.push('<text x="' + x + '" y="' + (b.bottom + 23) + '" text-anchor="middle">' + frame + '</text>');
    });
    parts.push('<text x="' + ((b.left + b.right) / 2) + '" y="' + (chartHeight - 10) + '" text-anchor="middle">Trajectory frame t</text>');
    parts.push('<text transform="translate(15 ' + ((b.top + b.bottom) / 2) + ') rotate(-90)" text-anchor="middle">Task utility U</text>');
    parts.push('<line x1="' + b.left + '" x2="' + b.right + '" y1="' + b.bottom + '" y2="' + b.bottom + '" stroke="var(--front-axis)"/>');
    var path = data.utility.map(function (value, frame) {
      return (frame === 0 ? 'M' : 'L') + chartX(frame).toFixed(2) + ',' + chartY(value).toFixed(2);
    }).join('');
    parts.push('<path class="utility-curve" d="' + path + '" fill="none" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>');
    parts.push('<line x1="' + chartX(selected) + '" x2="' + chartX(selected) + '" y1="' + b.top + '" y2="' + b.bottom + '" stroke="var(--front-red)" stroke-width="1.2" stroke-dasharray="3 4"/>');
    parts.push('<circle class="utility-selected-point" cx="' + chartX(selected) + '" cy="' + chartY(data.utility[selected]) + '" r="4.5" fill="var(--front-red)" stroke="white" stroke-width="2"/>');
    parts.push('<text x="' + chartX(selected) + '" y="18" text-anchor="' +
      (selected / (n - 1) < .1 ? 'start' : selected / (n - 1) > .9 ? 'end' : 'middle') +
      '" style="fill:var(--front-red);font-weight:600">Frame t: ' + selected + '</text>');
    parts.push('<g id="utility-chart-focus" visibility="hidden" aria-hidden="true" pointer-events="none">' +
      '<line id="utility-focus-vertical" class="utility-focus-line"/>' +
      '<line id="utility-focus-horizontal" class="utility-focus-line"/>' +
      '<circle id="utility-focus-point" class="utility-focus-point" r="4"/></g>');
    chart.setAttribute('viewBox', '0 0 ' + chartWidth + ' ' + chartHeight);
    chart.innerHTML = parts.join('');
    hideFocus();
  }

  function updateSelection() {
    $('frame-range').value = selected;
    $('frame-index').textContent = selected;
    Array.from($('frame-grid').children).forEach(function (button) {
      var frame = Number(button.dataset.frame), active = frame === selected;
      button.classList.toggle('is-initial', active);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', 'Frame ' + frame + ', task utility ' + data.utility[frame].toFixed(3) + (active ? ', selected.' : '. Select this frame.'));
      button.lastElementChild.lastElementChild.textContent = active ? 't' : '';
    });
    selections.set(trajectory.id, selected);
    drawChart();
  }

  function chooseFrame(frame) {
    if (!data || root.getAttribute('aria-busy') === 'true') return;
    selected = Math.max(0, Math.min(trajectory.frameCount - 1, Math.round(frame)));
    updateSelection();
  }

  async function selectTrajectory(id) {
    var version = ++requestVersion;
    var row = task.trajectories.find(function (item) { return item.id === id; });
    if (!row) return;
    loading('Loading ' + task.label + ' · ' + row.label + '…');
    $('task-instruction').textContent = row.instruction;
    selector.value = row.id;
    try {
      var result = await loadValues(row);
      if (version !== requestVersion) return;
      trajectory = row;
      data = result;
      selected = selections.has(row.id) ? selections.get(row.id) : 0;
      root.style.setProperty('--reach-frame-aspect', row.width + ' / ' + row.height);
      $('frame-count').textContent = row.frameCount + ' frames · ' + row.episode;
      $('frame-range').max = row.frameCount - 1;
      makeThumbnails();
      updateSelection();
      $('workspace').hidden = false;
      $('load-status').hidden = true;
      selector.disabled = false;
      root.setAttribute('aria-busy', 'false');
    } catch (error) { if (version === requestVersion) showError(error); }
  }

  function selectTask(id) {
    pendingTask = id;
    if (!manifest) return;
    task = manifest.tasks.find(function (item) { return item.id === id; });
    if (!task) return;
    buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.utilityTask === id)); });
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
    if (initialized) return;
    initialized = true;
    loading('Loading task utility data…');
    try {
      manifest = await loadJson(assetBase + 'manifest.json?v=20261010-task-utility');
      if (!Array.isArray(manifest.tasks) || manifest.tasks.length !== 4 || manifest.tasks.some(function (item) {
        return !Array.isArray(item.trajectories) || item.trajectories.length < 1;
      })) throw new Error('Incomplete task utility manifest.');
      selectTask(pendingTask);
    } catch (error) { initialized = false; showError(error); }
  }

  function position(event) {
    var point = chart.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(chart.getScreenCTM().inverse());
  }

  function frameAt(point) {
    return Math.round(Math.max(0, Math.min(1, (point.x - bounds.left) / (bounds.right - bounds.left))) * (trajectory.frameCount - 1));
  }

  new ResizeObserver(function (entries) {
    var size = entries[0].contentRect;
    if (size.width < 1 || size.height < 1 ||
        (Math.abs(size.width - chartWidth) < .5 && Math.abs(size.height - chartHeight) < .5)) return;
    chartWidth = size.width;
    chartHeight = size.height;
    bounds = { left: chartWidth < 400 ? 58 : 64, right: chartWidth - 20, top: 30, bottom: chartHeight - 44 };
    if (data) drawChart();
  }).observe(chart.parentElement);

  buttons.forEach(function (button) { button.addEventListener('click', function () { selectTask(button.dataset.utilityTask); }); });
  selector.addEventListener('change', function () { selectTrajectory(selector.value); });
  $('frame-range').addEventListener('input', function () { chooseFrame(Number(this.value)); });
  $('reset').addEventListener('click', function () { chooseFrame(0); });
  $('retry').addEventListener('click', function () { if (manifest && task) selectTrajectory(selector.value); else initialize(); });
  chart.addEventListener('click', function (event) { if (data) chooseFrame(frameAt(position(event))); });
  chart.addEventListener('pointermove', function (event) {
    if (!data || root.getAttribute('aria-busy') === 'true') return;
    var point = position(event), b = bounds;
    if (point.x < b.left || point.x > b.right || point.y < b.top || point.y > b.bottom) { hideFocus(); return; }
    var frame = frameAt(point), value = data.utility[frame], x = chartX(frame), y = chartY(value);
    var vertical = $('focus-vertical'), horizontal = $('focus-horizontal'), dot = $('focus-point');
    vertical.setAttribute('x1', x); vertical.setAttribute('x2', x);
    vertical.setAttribute('y1', b.top); vertical.setAttribute('y2', b.bottom);
    horizontal.setAttribute('x1', b.left); horizontal.setAttribute('x2', b.right);
    horizontal.setAttribute('y1', y); horizontal.setAttribute('y2', y);
    dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    $('chart-focus').setAttribute('visibility', 'visible');
    var tooltip = $('chart-tooltip');
    tooltip.textContent = 'Frame ' + frame + '\nTask utility U: ' + value.toFixed(3);
    tooltip.hidden = false;
    var svgPoint = chart.createSVGPoint(); svgPoint.x = x; svgPoint.y = y;
    var screen = svgPoint.matrixTransform(chart.getScreenCTM()), box = chart.parentElement.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(screen.x - box.left + 12, box.width - tooltip.offsetWidth - 8)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(screen.y - box.top - tooltip.offsetHeight - 10, box.height - tooltip.offsetHeight - 8)) + 'px';
  });
  chart.addEventListener('pointerleave', hideFocus);

  function syncPanel() {
    if (panel.hidden) { video.pause(); hideFocus(); return; }
    initialize();
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    video.play().catch(function () {});
  }
  // The detection clip loads only on the utility tab and pauses when hidden.
  video.addEventListener('play', function () { if (panel.hidden) video.pause(); });
  new MutationObserver(syncPanel).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  syncPanel();
})();
