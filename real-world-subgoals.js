(function () {
  'use strict';
  var panel = document.getElementById('experiments-panel-real-world');
  if (!panel) return;
  panel.querySelectorAll('[data-real-subgoals]').forEach(function (figure) {
    var video = figure.querySelector('video');
    var buttons = Array.from(figure.querySelectorAll('[data-subgoal-time]'));
    var status = figure.querySelector('[data-subgoal-status]');
    var strip = figure.querySelector('.real-subgoal-strip');
    var previous = -1;
    function update() {
      var index = buttons.findIndex(function (b) { return Number(b.dataset.subgoalTime) >= video.currentTime - 0.025; });
      if (index < 0) index = buttons.length - 1;
      if (index === previous) return;
      previous = index;
      buttons.forEach(function (button, i) { button.setAttribute('aria-current', i === index ? 'step' : 'false'); });
      status.textContent = 'Subgoal ' + (index + 1) + ' / ' + buttons.length;
      var active = buttons[index];
      // Keep the current target visible without scrolling the document.
      if (!panel.hidden && active) {
        var x = active.offsetLeft;
        if (x < strip.scrollLeft || x + active.offsetWidth > strip.scrollLeft + strip.clientWidth) {
          strip.scrollLeft = Math.max(0, x - (strip.clientWidth - active.offsetWidth) / 2);
        }
      }
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        video.pause();
        if (!video.getAttribute('src')) { video.src = video.dataset.expSrc; video.load(); }
        var target = Number(button.dataset.subgoalTime);
        function seek() {
          video.currentTime = Math.min(target, Math.max(0, video.duration - 0.01));
          previous = -1;
          update();
        }
        if (video.readyState >= 1) seek();
        else video.addEventListener('loadedmetadata', seek, {once: true});
      });
    });
    ['timeupdate', 'seeked', 'loadedmetadata', 'ended'].forEach(function (event) { video.addEventListener(event, update); });
    update();
  });
})();
