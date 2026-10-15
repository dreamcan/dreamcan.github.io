(function () {
  'use strict';
  function setupSection(sectionId) {
    var root = document.getElementById(sectionId);
    if (!root) return;
    var tabList = root.querySelector(':scope > .method-tabs');
    var tabs = tabList ? Array.from(tabList.querySelectorAll('[role="tab"]')) : [];
    var panels = Array.from(root.querySelectorAll(':scope > .method-panel[role="tabpanel"]'));
    if (!tabs.length) return;
    var previous = document.getElementById(sectionId + '-previous');
    var next = document.getElementById(sectionId + '-next');
    var progress = document.getElementById(sectionId + '-progress');
    var names = tabs.map(function (tab) { return tab.lastElementChild.textContent.trim(); });
    var selectedIndex = 0;

    function select(tab, focus) {
      tabs.forEach(function (item) {
        var active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.id !== tab.getAttribute('aria-controls');
        panel.querySelectorAll('video').forEach(function (video) {
          if (panel.hidden || video.closest('[hidden]')) video.pause();
          else if (video.autoplay) video.play().catch(function () {});
        });
      });
      selectedIndex = tabs.indexOf(tab);
      progress.textContent = sectionId === 'method'
        ? 'Step ' + (selectedIndex + 1) + ' of ' + tabs.length
        : 'Experiment Suite ' + (selectedIndex + 1) + ' of ' + tabs.length;
      previous.disabled = selectedIndex === 0;
      next.disabled = selectedIndex === tabs.length - 1;
      previous.textContent = selectedIndex > 0 ? '← ' + names[selectedIndex - 1] : 'Previous';
      next.textContent = selectedIndex < tabs.length - 1 ? 'Next: ' + names[selectedIndex + 1] + ' →' : 'Final option';
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        select(tabs[next], true);
      });
    });
    previous.addEventListener('click', function () {
      if (selectedIndex > 0) select(tabs[selectedIndex - 1], true);
    });
    next.addEventListener('click', function () {
      if (selectedIndex < tabs.length - 1) select(tabs[selectedIndex + 1], true);
    });
    select(tabs[0], false);
  }
  ['method', 'experiments'].forEach(setupSection);
})();
