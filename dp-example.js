(function () {
  'use strict';
  var root = document.getElementById('dp-example');
  if (!root) return;
  var panel = document.getElementById('method-panel-search');
  var $ = function (id) { return document.getElementById('dp-example-' + id); };
  var base = 'assets/dp/example-ep000002/', ns = 'http://www.w3.org/2000/svg';
  var data, atlas, curve, stage = 0, initialized = false, lastIndex = -1;
  var box = { left:54, right:505, top:15, bottom:246 };
  function svg(tag, attrs, value) {
    var e = document.createElementNS(ns, tag);
    Object.keys(attrs || {}).forEach(function (key) { e.setAttribute(key, attrs[key]); });
    if (value !== undefined) e.textContent = value;
    return e;
  }
  function json(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function x(frame) { return box.left + frame / (data.frameCount - 1) * (box.right - box.left); }
  function y(score) { return box.bottom - score / 1.08 * (box.bottom - box.top); }
  function setFrame(id, frame, label) {
    var image = $(id + '-image');
    image.style.backgroundImage = 'url("' + base + atlas.atlas + '")';
    image.style.backgroundSize = atlas.atlasColumns * 100 + '% ' + atlas.atlasRows * 100 + '%';
    image.style.backgroundPosition = frame % atlas.atlasColumns * 100 / (atlas.atlasColumns - 1) + '% ' + Math.floor(frame / atlas.atlasColumns) * 100 / (atlas.atlasRows - 1) + '%';
    image.dataset.frame = frame;
    image.setAttribute('aria-label', label + ', frame ' + frame);
    $(id + '-caption').textContent = label + ' · Frame ' + frame;
  }
  function clearFocus() {
    lastIndex = -1;
    setFrame('candidate', curve.selectedFrame, curve.fixedTerminal ? 'Final subgoal' : 'Next subgoal');
    var focus = document.getElementById('dp-example-focus'); if (focus) focus.setAttribute('visibility','hidden');
    var selectedScore = curve.normalizedScores[curve.candidateFrames.indexOf(curve.selectedFrame)];
    $('readout').textContent = 'Selected frame ' + curve.selectedFrame + ' · Score ' + selectedScore.toFixed(3);
  }
  function focus(index) {
    index = Math.max(0, Math.min(curve.candidateFrames.length - 1, index));
    if (index === lastIndex) return;
    lastIndex = index;
    var frame = curve.candidateFrames[index], score = curve.normalizedScores[index], px = x(frame), py = y(score);
    var group = document.getElementById('dp-example-focus'); group.setAttribute('visibility','visible');
    var vertical = document.getElementById('dp-example-focus-x');
    vertical.setAttribute('x1',px); vertical.setAttribute('x2',px); vertical.setAttribute('y1',box.top); vertical.setAttribute('y2',box.bottom);
    var horizontal = document.getElementById('dp-example-focus-y');
    horizontal.setAttribute('x1',box.left); horizontal.setAttribute('x2',box.right); horizontal.setAttribute('y1',py); horizontal.setAttribute('y2',py);
    var dot = document.getElementById('dp-example-focus-dot'); dot.setAttribute('cx',px); dot.setAttribute('cy',py);
    setFrame('candidate', frame, 'Candidate');
    $('readout').textContent = 'Frame ' + frame + ' · Score ' + score.toFixed(3);
    $('chart').dataset.focusFrame = frame;
  }
  function renderStage() {
    Array.from($('stages').children).forEach(function (button,i) { button.setAttribute('aria-pressed',String(i === stage)); });
    $('chart').parentElement.hidden = false;
    curve = stage === data.curves.length ? data.appendedTerminalCurve : data.curves[stage];
    clearFocus();
    setFrame('source', curve.startFrame, 'Initial frame');
    Array.from($('stages').children).forEach(function (button,i) { button.setAttribute('aria-pressed',String(i === stage)); });
    $('step').textContent = 'From frame ' + curve.startFrame + (curve.fixedTerminal ? '' : ' · ' + curve.remaining + ' subgoals remaining');
    var chart = $('chart'); chart.replaceChildren(); chart.dataset.stage = curve.stage;
    chart.append(svg('title',{},'Subgoal ' + curve.stage + ': DP selection score from frame ' + curve.startFrame));
    for (var score = 0; score <= 1.001; score += .25) {
      chart.append(svg('line',{x1:box.left,x2:box.right,y1:y(score),y2:y(score),class:'dp-example-gridline'}));
      chart.append(svg('text',{x:box.left-9,y:y(score)+4,'text-anchor':'end'},score.toFixed(2)));
    }
    var ticks = [], finalFrame = data.frameCount - 1;
    for (var tick = 0; tick < finalFrame; tick += 50) ticks.push(tick);
    ticks.push(finalFrame);
    ticks.forEach(function (frame) { chart.append(svg('text',{x:x(frame),y:box.bottom+20,'text-anchor':'middle'},frame)); });
    chart.append(svg('line',{x1:box.left,x2:box.left,y1:box.top,y2:box.bottom,class:'dp-example-axis'}));
    chart.append(svg('line',{x1:box.left,x2:box.right,y1:box.bottom,y2:box.bottom,class:'dp-example-axis'}));
    chart.append(svg('text',{x:(box.left+box.right)/2,y:284,'text-anchor':'middle'},'Candidate frame j'));
    chart.append(svg('text',{transform:'translate(15 130) rotate(-90)','text-anchor':'middle'},'Selection score'));
    var path = curve.candidateFrames.map(function (frame,i) { return (i?'L':'M') + x(frame).toFixed(3) + ',' + y(curve.normalizedScores[i]).toFixed(3); }).join(' ');
    chart.append(svg('path',{d:path,class:'dp-example-curve',fill:'none'}));
    // Mark the actual selected frame; an appended terminal need not maximize the score.
    var points = [], selectedScore = curve.normalizedScores[curve.candidateFrames.indexOf(curve.selectedFrame)];
    for (var n = 0; n < 10; n++) { var a = n*Math.PI/5-Math.PI/2, r = n%2?3.3:8; points.push((x(curve.selectedFrame)+Math.cos(a)*r)+','+(y(selectedScore)+Math.sin(a)*r)); }
    chart.append(svg('polygon',{points:points.join(' '),class:'dp-example-star'}));
    if (curve.fixedTerminal) {
      var annotation = svg('text',{x:260,y:35,'text-anchor':'middle',class:'dp-example-terminal-note'});
      annotation.append(svg('tspan',{x:260,dy:0},'Final frame appended after '),svg('tspan',{x:260,dy:19},'the DP-selected subgoals.'));
      chart.append(annotation);
    }
    var group = svg('g',{id:'dp-example-focus',visibility:'hidden','pointer-events':'none'});
    group.append(svg('line',{id:'dp-example-focus-x',class:'dp-example-focus-line'}),svg('line',{id:'dp-example-focus-y',class:'dp-example-focus-line'}),svg('circle',{id:'dp-example-focus-dot',r:4,class:'dp-example-focus-dot'})); chart.append(group);
  }
  function makeButtons() {
    $('stages').replaceChildren();
    Array.from({length:data.curves.length + 1}).forEach(function (_, i) {
      var c = {stage:i + 1};
      var button = document.createElement('button'); button.type = 'button';
      button.textContent = c.stage; button.dataset.stage = i;
      button.setAttribute('aria-label', 'Subgoal ' + c.stage);
      button.addEventListener('click',function () { stage = i; renderStage(); });
      button.addEventListener('keydown',function (event) {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        var count = data.curves.length + 1;
        stage = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (i + (event.key === 'ArrowRight' ? 1 : count - 1)) % count;
        renderStage(); $('stages').children[stage].focus();
      });
      $('stages').append(button);
    });
  }
  function initialize() {
    initialized = true; root.setAttribute('aria-busy','true'); $('status').hidden=false; $('retry').hidden=true;
    Promise.all([json(base+'curves.json?v=20261011-terminal-curve'),json(base+'frames.json')]).then(function (values) {
      data=values[0];atlas=values[1];
      if (data.frameCount!==atlas.frameCount || data.curves.length!==data.K) throw new Error('The frames and DP curves do not match.');
      root.style.setProperty('--dp-stage-count', data.K + 1);
      makeButtons(); stage = 0; renderStage(); root.setAttribute('aria-busy','false'); $('status').hidden=true;
    }).catch(function (e) {root.setAttribute('aria-busy','false');$('status').textContent='Could not load the DP example. '+e.message;$('retry').hidden=false;});
  }
  $('retry').addEventListener('click',initialize);
  $('chart').addEventListener('pointermove',function (event) {
    if (!curve) return;
    var point = new DOMPoint(event.clientX,event.clientY).matrixTransform($('chart').getScreenCTM().inverse());
    var frame = (point.x-box.left)/(box.right-box.left)*(data.frameCount-1);
    // All valid candidate frame indices are contiguous; snap to the closest actual sample.
    focus(Math.round(frame)-curve.candidateFrames[0]);
  });
  $('chart').addEventListener('pointerleave',function () {if(curve)clearFocus();});
  $('chart').addEventListener('keydown',function (event) {
    if (!curve || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();var index=lastIndex<0?curve.candidateFrames.indexOf(curve.selectedFrame):lastIndex;
    focus(event.key==='Home'?0:event.key==='End'?curve.candidateFrames.length-1:index+(event.key==='ArrowRight'?1:-1));
  });
  new MutationObserver(function () {if(!panel.hidden&&!initialized)initialize();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
  if(!panel.hidden)initialize();
})();
