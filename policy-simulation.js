(function () {
  'use strict';
  var root = document.querySelector('[data-policy-simulation]');
  if (!root) return;
  Array.from(root.querySelectorAll('[data-sim-group]')).forEach(function (group) {
    var execution = group.querySelector('[data-sim-execution]');
    var planner = group.querySelector('[data-sim-planner]');
    var buttons = Array.from(group.querySelectorAll('[data-sim-choice]'));
    var changing = false;

    function alignPlanner() {
      if (changing || planner.readyState < 1 || !isFinite(planner.duration)) return;
      if (Math.abs(planner.currentTime - execution.currentTime) > .16) {
        var target = Math.min(execution.currentTime, planner.duration);
        for (var i = 0; i < planner.seekable.length; i++) {
          if (target >= planner.seekable.start(i) && target <= planner.seekable.end(i)) {
            planner.currentTime = target;
            break;
          }
        }
      }
      planner.playbackRate = execution.playbackRate;
    }
    function followExecution() {
      alignPlanner();
      if (execution.paused || group.closest('[hidden]') || document.hidden) planner.pause();
      else if (planner.readyState >= 2) planner.play().catch(function () {});
    }
    execution.addEventListener('timeupdate', alignPlanner);
    execution.addEventListener('seeking', alignPlanner);
    execution.addEventListener('seeked', alignPlanner);
    execution.addEventListener('ratechange', alignPlanner);
    execution.addEventListener('play', followExecution);
    execution.addEventListener('pause', function () { planner.pause(); });
    planner.addEventListener('loadeddata', followExecution);
    planner.addEventListener('play', function () { if (execution.paused) planner.pause(); });

    function select(button) {
      changing = true;
      [execution, planner].forEach(function (video) {
        video.pause();
        video.hidden = false;
        video.removeAttribute('src');
        video.load();
      });
      Array.from(group.querySelectorAll('.exp-media-error')).forEach(function (error) { error.remove(); });
      execution.dataset.expSrc = button.dataset.executionSrc;
      execution.poster = button.dataset.executionPoster;
      planner.dataset.expSrc = button.dataset.plannerSrc;
      planner.poster = button.dataset.plannerPoster;
      var strip = group.querySelector('.sim-planner-scroll');
      if (strip) strip.scrollLeft = 0;
      execution.muted = planner.muted = true;
      group.querySelector('[data-sim-instruction]').textContent = button.dataset.instruction;
      var outcome = group.querySelector('[data-sim-outcome]');
      outcome.textContent = button.dataset.result === 'success' ? 'Completed' : 'Not completed';
      outcome.dataset.result = button.dataset.result;
      buttons.forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
      changing = false;
      // The experiment video observer loads the new sources only while visible.
    }
    buttons.forEach(function (button) { button.addEventListener('click', function () { select(button); }); });
  });
})();
