// The release page's own sections: the leaderboard in three views, the dataset
// breakdown, and the metric list inside the questions. The gallery is app.js.
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

  // run -> its mark, read from the logo field of models.json. That field is per model,
  // not per vendor, which matters for Google: Gemini and Gemma carry different marks.
  var LOGO = {};
  // run -> its models.json entry: name, effort, open weights
  var REG = {};

  // the six capability columns, shortened for a table head
  var SHORT = {'VQA':'VQA', 'Perceptual':'Percep.', '2D Dynamics':'2D dyn.',
               '2.5D Geometry':'2.5D geo.', '3D Geometry':'3D geo.', '3D Dynamics':'3D dyn.'};

  var LB = null, ONTO = null, view = 'materials';   // Families is the task strip now

  function num(v, dp){ return v === null || v === undefined ? null : v.toFixed(dp); }
  function cell(v, dp){
    return v === null || v === undefined ? '<td class="dash">&ndash;</td>'
      : '<td class="num">' + v.toFixed(dp) + '</td>';
  }
  // these two marks are drawn in black, so they vanish on the dark theme and get
  // inverted; the rest carry their own brand colour and are left alone
  var MONO = {gpt: 1, glm: 1};
  // a model's name as the tables print it: the full label, and the paper's short one
  // (Table A5) that a phone shows instead, without the logo
  function names(r){
    var m = REG[r.run], eff = m.effort ? ' <span class="eff">[' + esc(m.effort === 'Default' ? 'Def' : m.effort) + ']</span>' : '';
    // the short name never breaks inside itself; a line breaks, if it must, before the effort
    return '<span class="nm-l">' + esc(r.label) + '</span><span class="nm-s"><span class="nb">' + esc(m.short) + '</span>' + eff + '</span>';
  }
  function logo(run){
    var f = LOGO[run];
    return f ? '<img class="' + (MONO[f] ? 'mono' : '') + '" src="logos/' + f
      + '.svg" alt="" loading="lazy">' : '';
  }

  // a reading a model has no value for yet (a model added after the judgements) shows as a dash
  function num(v, dp){ return v === null || v === undefined ? '–' : v.toFixed(dp); }

  // ---------------------------------------------------------------- the table
  // Sortable, with the summary score and each family drawn as a share of the
  // column behind its number. Default order is the summary score, which is what
  // `rank` in the data already is.
  var COLS = [
    {k:'rank',    lab:'#',        cls:'c-rank',    get:function(r){ return r.rank; }, dp:0, sort:false},
    {k:'label',   lab:'Model',    cls:'c-model',   get:function(r){ return r.label; }, text:true},
    {k:'harness', lab:'Harness',  cls:'c-harness', get:function(r){ return r.harness; }, text:true},
    {k:'elo',     lab:'Elo',      get:function(r){ return r.elo; }, dp:0, sep:true},
    {k:'overall', lab:'Overall',  get:function(r){ return r.overall; }, dp:3, bar:true, strong:true},
    {k:'vqa',     lab:'VQA',      get:function(r){ return r.vqa; }, dp:3, bar:true},
    {k:'cost',    lab:'$ / task', get:function(r){ return r.cost_usd; }, dp:2, sep:true},
    {k:'tokens',  lab:'Tokens / task', get:function(r){ return r.tokens; }, dp:0, tok:true}
  ];
  var sortKey = 'overall', sortDir = -1;

  // on a phone the harness, the least read column, moves to the end, so the scores sit by the names
  var PHONE = matchMedia('(max-width:640px)');
  function cols(){
    return PHONE.matches ? COLS.filter(function(c){ return c.k !== 'harness'; }).concat(COLS.filter(function(c){ return c.k === 'harness'; })) : COLS;
  }
  function head(){
    var h = '<tr>';
    cols().forEach(function(c){
      var on = c.k === sortKey, cls = (c.cls || 'num') + (c.sort === false ? '' : ' sortable')
        + (c.sep ? ' sep' : '');
      h += '<th class="' + cls + '" data-k="' + c.k + '"'
        + (on ? ' aria-sort="' + (sortDir < 0 ? 'descending' : 'ascending') + '"' : '')
        + '>' + esc(c.lab) + '<span class="arr">' + (sortDir < 0 ? '▾' : '▴') + '</span></th>';
    });
    return h + '</tr>';
  }

  function rows(){
    var rs = LB.models.slice();
    var col = COLS.filter(function(c){ return c.k === sortKey; })[0];
    rs.sort(function(a, b){
      var x = col.get(a), y = col.get(b);
      if (col.text) return String(x || '').localeCompare(String(y || '')) * -sortDir;
      // a model with no reading sorts last whichever way the column is pointing
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x - y) * sortDir;
    });
    // each bar column is drawn against the largest value present, not against 1,
    // so a column where nothing exceeds 0.8 still uses the width
    var max = {};
    COLS.forEach(function(c){
      if (!c.bar) return;
      max[c.k] = Math.max.apply(null, LB.models.map(function(r){ return c.get(r) || 0; }));
    });
    return rs.map(function(r, i){
      var tr = '<tr' + (r.rank <= 3 ? ' class="r' + r.rank + '"' : '') + '>';
      cols().forEach(function(c){
        var v = c.get(r);
        if (c.k === 'rank'){
          // the top three get a medal; the rest are plain, so the eye stops at three
          tr += '<td class="c-rank">' + (r.rank <= 3
            ? '<span class="medal m' + r.rank + '">' + r.rank + '</span>' : r.rank) + '</td>';
        } else if (c.k === 'label'){
          tr += '<td class="c-model"><span class="mname">' + logo(r.run)
             + '<span>' + names(r) + '</span></span></td>';
        } else if (c.text){
          tr += '<td class="' + (c.cls || '') + '">' + (v ? esc(v) : '<span class="dash">&ndash;</span>') + '</td>';
        } else if (v === null || v === undefined){
          tr += '<td class="num dash' + (c.sep ? ' sep' : '') + '">'
             + (c.k === 'cost' ? 'self-hosted' : '&ndash;') + '</td>';
        } else if (c.bar){
          // the rule spans at most the number's own column width, so it never
          // reads as a bar running across the neighbouring columns
          var w = Math.max(0, Math.min(1, v / (max[c.k] || 1))) * 3.2;
          tr += '<td class="num barcell"><span class="fill f-' + c.k + '" style="width:'
             + w.toFixed(2) + 'rem"></span>' + v.toFixed(c.dp) + '</td>';
        } else if (c.tok){
          tr += '<td class="num tok">' + (v / 1e6).toFixed(1) + 'M</td>';
        } else {
          tr += '<td class="num' + (c.sep ? ' sep' : '') + '">' + v.toFixed(c.dp) + '</td>';
        }
      });
      return tr + '</tr>';
    }).join('');
  }

  PHONE.addEventListener('change', function(){ if (LB) drawTable(); });
  function drawTable(){
    var t = $('lb-table');
    if (!t) return;
    t.tHead.innerHTML = head();
    t.tBodies[0].innerHTML = rows();
    t.tHead.querySelectorAll('th.sortable').forEach(function(th){
      th.addEventListener('click', function(){
        var k = th.dataset.k;
        if (k === sortKey) sortDir = -sortDir;
        else { sortKey = k; sortDir = -1; }
        drawTable();
      });
    });
    $('lb-note').innerHTML = [
      ['Overall', 'The mean of the five reconstruction families, each weighted equally.'],
      ['Scales', 'Every metric is on a fixed 0\u20131 scale, not rescaled to the models, so '
        + 'scores do not shift when a model is added.'],
      ['Coverage', 'Each family is averaged over the tasks it applies to; a task a model '
        + 'failed to render counts at a fixed penalty rather than being skipped.'],
      ['VQA', 'Shown for reference but not part of Overall, since it judges semantics '
        + 'rather than reconstruction.']
    ].map(function(r){
      return '<li><span class="mfam">' + esc(r[0]) + '</span><span class="mwhat">'
        + esc(r[1]) + '</span></li>';
    }).join('');
  }


  // The paper's two ramps (hf_figures/main_leaderboard), sampled at even steps: the
  // diverging score ramp, orange through white at 0.5 to blue, and the grey ramp the
  // two Elo columns share, normalised over both columns together.
  var SCORE_STOPS = ['#d46012', '#d96212', '#de6413', '#e26713', '#e76914', '#ec6c15', '#ee853e', '#efa06a', '#f1bc97', '#f2d8c3', '#f3f1ee', '#dcdfeb', '#c4cbe9', '#abb7e6', '#92a3e3', '#7b90e1', '#778bd9', '#7286d1', '#6e80c8', '#697bc0', '#6576b8'];
  var ELO_STOPS = ['#f9f6ea','#eae8df','#dad9d4','#cbcbc9','#b7b7b7','#a2a2a2','#8d8d8d',
    '#777777','#636363','#4d4d4d','#383838'];
  function rgbOf(h){ return [1, 3, 5].map(function(i){ return parseInt(h.slice(i, i + 2), 16); }); }
  // [css colour, whether the text on it is white], as the paper picks it (luminance < .55)
  function ramp(stops, v){
    var t = Math.max(0, Math.min(1, v)) * (stops.length - 1), i = Math.min(Math.floor(t), stops.length - 2);
    var lo = rgbOf(stops[i]), hi = rgbOf(stops[i + 1]), f = t - i;
    var rgb = lo.map(function(c, k){ return Math.round(c + (hi[k] - c) * f); });
    var lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    return ['rgb(' + rgb.join(',') + ')', lum < .55];
  }
  function key(stops, title, ticks){
    return '<div class="cap-key"><div class="cap-key-t">' + esc(title) + '</div><div class="cap-key-b">'
      + '<div class="cap-key-bar" style="background:linear-gradient(to top,' + stops.join(',') + ')"></div>'
      + '<div class="cap-key-ticks">' + ticks.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('')
      + '</div></div></div>';
  }

  // ------------------------------------------------------- the capability view
  // The paper's leaderboard figure: the two Elo columns in grey, the six families and
  // Overall on the score ramp, one black-ruled block with its drop shadow, a key per ramp.
  // Pointing at a cell lifts it, frames its row and column without touching a colour, and
  // marks its value on its key; a column name sorts the rows by it, the rows sliding to
  // their new places.
  var capSort = {k: 'Overall', dir: -1}, capE = null;
  function capCols(){
    return [{k: 'Human Elo', elo: true, get: function(r){ return r.human_elo; }},
            {k: 'Elo', elo: true, get: function(r){ return r.elo; }}]
      .concat(LB.columns.map(function(c, j){ return {k: c, get: function(r){ return r.families[c]; }, rule: !j}; }))
      .concat([{k: 'Overall', get: function(r){ return r.overall; }, rule: true, strong: true}]);
  }
  function capT(col, v){ return col.elo ? (v - capE[0]) / (capE[1] - capE[0]) : v; }

  function drawCaps(){
    if (!$('lbv-caps')) return;
    var cols = capCols();
    var elos = [];
    LB.models.forEach(function(r){ [r.human_elo, r.elo].forEach(function(v){ if (v !== null && v !== undefined) elos.push(v); }); });
    capE = [Math.min.apply(null, elos), Math.max.apply(null, elos)];
    $('cap-heads').innerHTML = cols.map(function(c, j){
      return '<button type="button" data-c="' + j + '"><span class="nm-l">' + esc(c.k) + '</span><span class="nm-s">'
        + esc(SHORT[c.k] || c.k) + '</span><span class="arr"></span></button>';
    }).join('');
    $('cap-keys').innerHTML = key(ELO_STOPS, 'Elo', [capE[1].toFixed(0), ((capE[0] + capE[1]) / 2).toFixed(0), capE[0].toFixed(0)])
      + key(SCORE_STOPS, 'score', ['1.00', '0.50', '0.00']);
    $('cap-keys').querySelectorAll('.cap-key-b').forEach(function(k){ k.insertAdjacentHTML('beforeend', '<i class="cap-mark"></i>'); });
    renderCaps(false);
    wireCaps(cols);
    $('caps-note').innerHTML = LB.columns.map(function(c){
      return '<li><span class="mfam">' + esc(c) + '</span><span class="mwhat">'
        + esc(LB.family_notes[c]) + '</span></li>';
    }).join('') + '<li><span class="mfam">Reading it</span><span class="mwhat">Scores run from '
      + 'orange at 0 through white at 0.5 to blue at 1. The two Elo columns share one grey ramp, '
      + 'darker is higher. Rows start sorted by Overall; a column name sorts them by that column.</span></li>';
  }

  function renderCaps(animate){
    var cols = capCols(), sc = cols.filter(function(c){ return c.k === capSort.k; })[0];
    var rs = LB.models.slice().sort(function(a, b){
      var x = sc.get(a), y = sc.get(b);
      if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
      if (y === null || y === undefined) return -1;
      return capSort.dir * (x - y);
    });
    var before = {};
    if (animate) $('cap-names').querySelectorAll('.cap-n').forEach(function(n){
      before[n.getAttribute('data-run')] = n.getBoundingClientRect().top; });
    $('cap-names').innerHTML = rs.map(function(r){
      return '<div class="cap-n" data-run="' + r.run + '">' + logo(r.run) + '<span>' + names(r) + '</span></div>';
    }).join('');
    $('cap-box').innerHTML = rs.map(function(r){
      return cols.map(function(c, j){
        var v = c.get(r);
        if (v === null || v === undefined)
          return '<div class="cap-c' + (c.strong ? ' strong' : '') + '" data-run="' + r.run + '" data-c="' + j + '" style="background:#f2f2f2;color:#4a4a4a">&ndash;</div>';
        var f = ramp(c.elo ? ELO_STOPS : SCORE_STOPS, capT(c, v));
        return '<div class="cap-c' + (f[1] ? ' w' : '') + (c.strong ? ' strong' : '')
          + '" data-run="' + r.run + '" data-c="' + j + '" style="background:' + f[0] + '">'
          + v.toFixed(c.elo ? 0 : 2) + '</div>';
      }).join('');
    }).join('')
      // the two thick rules and the row and column frames sit over the cells, so a cell
      // never carries a rule of its own and every cell lifts as the same square
      + cols.map(function(c, j){ return c.rule ? '<i class="cap-rule" style="--j:' + j + '"></i>' : ''; }).join('')
      + '<i class="cap-frame row"></i><i class="cap-frame col"></i>';
    $('cap-heads').querySelectorAll('button').forEach(function(b){
      var on = cols[+b.dataset.c].k === capSort.k;
      b.classList.toggle('on', on);
      b.querySelector('.arr').textContent = on ? (capSort.dir < 0 ? ' ▾' : ' ▴') : '';
    });
    if (!animate) return;
    // the rows slide from where they were: each element starts at its old height and eases home
    var moved = [];
    document.querySelectorAll('#lbv-caps [data-run]').forEach(function(el){
      var run = el.getAttribute('data-run'), now = $('cap-names').querySelector('[data-run="' + run + '"]').getBoundingClientRect().top;
      var d = before[run] - now;
      if (!d) return;
      el.style.transition = 'none'; el.style.transform = 'translateY(' + d + 'px)'; moved.push(el);
    });
    void document.body.offsetHeight;
    moved.forEach(function(el){ el.style.transition = ''; el.style.transform = ''; });
  }

  function wireCaps(cols){
    var fig = document.querySelector('#lbv-caps .capfig'), marks = $('cap-keys').querySelectorAll('.cap-mark');
    function clear(){
      fig.classList.remove('focus');
      fig.querySelectorAll('.hl,.lift').forEach(function(el){ el.classList.remove('hl', 'lift'); });
      marks.forEach(function(m){ m.classList.remove('on'); });
    }
    fig.addEventListener('mouseover', function(e){
      var cell = e.target.closest('.cap-c');
      if (!cell) return;
      clear();
      var run = cell.getAttribute('data-run'), j = cell.getAttribute('data-c'), col = cols[+j];
      // the row and the column are framed, never recoloured: the colours are the values
      var i = Array.prototype.indexOf.call($('cap-names').children, fig.querySelector('.cap-n[data-run="' + run + '"]'));
      var box = $('cap-box');
      var row = box.querySelector('.cap-frame.row'), column = box.querySelector('.cap-frame.col');
      row.style.setProperty('--i', i);
      row.classList.toggle('first', i === 0);
      row.classList.toggle('last', i === $('cap-names').children.length - 1);
      column.style.setProperty('--j', j);
      column.classList.toggle('first', +j === 0);
      column.classList.toggle('last', +j === cols.length - 1);
      fig.classList.add('focus');
      fig.querySelector('.cap-n[data-run="' + run + '"]').classList.add('hl');
      fig.querySelector('.cap-heads [data-c="' + j + '"]').classList.add('hl');
      cell.classList.add('lift');
      var r = LB.models.filter(function(m){ return m.run === run; })[0], m = marks[col.elo ? 0 : 1], v = col.get(r);
      if (v === null || v === undefined) return;
      m.style.top = (1 - Math.max(0, Math.min(1, capT(col, v)))) * 100 + '%';
      m.classList.add('on');
    });
    fig.addEventListener('mouseleave', clear);
    $('cap-heads').addEventListener('click', function(e){
      var b = e.target.closest('button');
      if (!b) return;
      var k = cols[+b.dataset.c].k;
      capSort = {k: k, dir: capSort.k === k ? -capSort.dir : -1};
      clear();
      renderCaps(true);
    });
  }


  // ------------------------------------------------- the two juries compared
  // The paper's human-VLM agreement panel (Figure 2, right) beside a slope chart of
  // the two rankings, linked: pointing at a model in either lights it in both. The
  // colours, rings, intervals, fit and diagonal are the paper's
  // (hf_figures/figure_style/alignment_logos.py); the table sits folded below.
  var PROP = '#7b90e1', OPENW = '#ec6b14';          // Original periwinkle and orange pair
  function licence(run){ return REG[run].open ? OPENW : PROP; }
  function nameSvg(run, x, y, anchor){
    var m = REG[run];
    return '<text class="nm" x="' + x + '" y="' + y + '" text-anchor="' + anchor + '">' + esc(m.name)
      + (m.effort ? '<tspan class="eff"> [' + esc(m.effort) + ']</tspan>' : '') + '</text>';
  }
  function logoSvg(run, x, y){
    var f = LOGO[run];
    return f ? '<image class="' + (MONO[f] ? 'mono' : '') + '" href="logos/' + f + '.svg" x="' + x
      + '" y="' + (y - 7) + '" width="14" height="14"/>' : '';
  }
  function spearman(x, y){
    function ranks(v){
      var ix = v.map(function(_, i){ return i; }).sort(function(a, b){ return v[a] - v[b]; }), r = [];
      ix.forEach(function(k, i){ r[k] = i + 1; });
      return r;
    }
    return pearson(ranks(x), ranks(y));
  }
  function pearson(x, y){
    var n = x.length, mx = 0, my = 0, sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++){ mx += x[i] / n; my += y[i] / n; }
    for (i = 0; i < n; i++){
      sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my);
    }
    return {r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx, icpt: my - sxy / sxx * mx};
  }

  function drawScatter(rs){
    var S = 520, L = 58, R = 14, T = 34, B = 50, W = S - L - R, H = S - T - B;
    var labelScale = parseFloat(getComputedStyle($('align-scatter')).getPropertyValue('--label-size')) / 12;
    var X = function(v){ return L + v / 2000 * W; }, Y = function(v){ return T + H - v / 2000 * H; };
    var hx = rs.map(function(r){ return r.human_elo; }), vy = rs.map(function(r){ return r.elo; });
    var fit = pearson(hx, vy), rho = spearman(hx, vy).r;
    var s = '<svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="VLM Elo against human Elo">'
      + '<defs><filter id="dotshadow" x="-50%" y="-50%" width="200%" height="200%">'
      + '<feDropShadow dx="1.2" dy="1.2" stdDeviation=".9" flood-color="#262626" flood-opacity=".6"/></filter></defs>';
    s += '<text class="stat" x="' + (L + W) + '" y="14" text-anchor="end">ρ = ' + rho.toFixed(3)
      + ' r = ' + fit.r.toFixed(3) + ' R² = ' + (fit.r * fit.r).toFixed(3)
      + ' slope = ' + fit.slope.toFixed(2) + '</text>';
    for (var g = 0; g <= 2000; g += 500){
      s += '<line class="grid" x1="' + X(g) + '" y1="' + T + '" x2="' + X(g) + '" y2="' + (T + H) + '"/>'
        + '<line class="grid" x1="' + L + '" y1="' + Y(g) + '" x2="' + (L + W) + '" y2="' + Y(g) + '"/>'
        + '<text class="tick" x="' + X(g) + '" y="' + (T + H + 18) + '" text-anchor="middle">' + g + '</text>'
        + '<text class="tick" x="' + (L - 8) + '" y="' + (Y(g) + 4) + '" text-anchor="end">' + g + '</text>';
    }
    s += '<line class="axis" x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (T + H) + '"/>'
      + '<line class="axis" x1="' + L + '" y1="' + (T + H) + '" x2="' + (L + W) + '" y2="' + (T + H) + '"/>'
      + '<text class="axt" x="' + (L + W / 2) + '" y="' + (S - 8) + '" text-anchor="middle">Human Elo</text>'
      + '<text class="axt" x="16" y="' + (T + H / 2) + '" text-anchor="middle" transform="rotate(-90 16 '
      + (T + H / 2) + ')">VLM Elo</text>';
    s += '<line class="diag" x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(2000) + '" y2="' + Y(2000) + '"/>';
    var x0 = Math.min.apply(null, hx) - 110, x1 = Math.max.apply(null, hx) + 110;
    s += '<line class="fit" x1="' + X(x0) + '" y1="' + Y(fit.slope * x0 + fit.icpt) + '" x2="' + X(x1)
      + '" y2="' + Y(fit.slope * x1 + fit.icpt) + '"/>';
    // intervals first, then every dot above every interval
    rs.forEach(function(r){
      var c = licence(r.run), x = X(r.human_elo), y = Y(r.elo), cap = 3;
      var hl = X(r.human_elo_ci[0]), hh = X(r.human_elo_ci[1]), vl = Y(r.elo_ci[0]), vh = Y(r.elo_ci[1]);
      s += '<g class="ci" data-run="' + r.run + '" stroke="' + c + '">'
        + '<line x1="' + hl + '" y1="' + y + '" x2="' + hh + '" y2="' + y + '"/>'
        + '<line x1="' + x + '" y1="' + vl + '" x2="' + x + '" y2="' + vh + '"/>'
        + '<line x1="' + hl + '" y1="' + (y - cap) + '" x2="' + hl + '" y2="' + (y + cap) + '"/>'
        + '<line x1="' + hh + '" y1="' + (y - cap) + '" x2="' + hh + '" y2="' + (y + cap) + '"/>'
        + '<line x1="' + (x - cap) + '" y1="' + vl + '" x2="' + (x + cap) + '" y2="' + vl + '"/>'
        + '<line x1="' + (x - cap) + '" y1="' + vh + '" x2="' + (x + cap) + '" y2="' + vh + '"/></g>';
    });
    // the paper's labels: proprietary stacked top left, open weights down the right,
    // each on a grey leader to its dot
    // a label is logo then name; `lx` is its left edge ('start') or right edge ('end')
    function stack(group, lx, ly0, anchor){
      var out = '';
      group.slice().sort(function(a, b){ return b.elo - a.elo; }).forEach(function(r, i){
        var ly = ly0 + i * 22, w = textW(r.run) * labelScale;
        var left = anchor === 'start' ? lx : lx - w - 18;
        var from = anchor === 'start' ? left + 18 + w + 6 : left - 4;
        out += '<g class="lab" data-run="' + r.run + '">'
          + '<line class="lead" x1="' + from + '" y1="' + (ly - 4) + '" x2="' + X(r.human_elo) + '" y2="' + Y(r.elo) + '"/>'
          + logoSvg(r.run, left, ly - 4) + nameSvg(r.run, left + 18, ly, 'start') + '</g>';
      });
      return out;
    }
    var prop = rs.filter(function(r){ return !REG[r.run].open; }), open = rs.filter(function(r){ return REG[r.run].open; });
    s += stack(prop, L + 12, T + 22, 'start');
    s += stack(open, L + W - 6, Y(1030), 'end');
    rs.forEach(function(r){
      s += '<g class="dot" data-run="' + r.run + '" filter="url(#dotshadow)">'
        + '<circle cx="' + X(r.human_elo) + '" cy="' + Y(r.elo) + '" r="6.6" fill="#000"/>'
        + '<circle cx="' + X(r.human_elo) + '" cy="' + Y(r.elo) + '" r="6.3" fill="#fff"/>'
        + '<circle cx="' + X(r.human_elo) + '" cy="' + Y(r.elo) + '" r="5" fill="' + licence(r.run) + '"/></g>';
    });
    $('align-scatter').innerHTML = s + '</svg>';
  }
  // the width a label takes, measured once in the page's own face
  var textW = (function(){
    var cache = {}, cv = document.createElement('canvas').getContext('2d');
    return function(run){
      if (cache[run] !== undefined) return cache[run];
      var m = REG[run], fam = getComputedStyle(document.body).fontFamily;
      cv.font = '12px ' + fam;
      return (cache[run] = cv.measureText(m.name + (m.effort ? ' [' + m.effort + ']' : '')).width);
    };
  })();

  function drawAlign(){
    if (!$('align-scatter')) return;
    var rs = LB.models.filter(function(r){ return r.elo !== null && r.human_elo !== null; });
    drawScatter(rs);
  }

  // ---------------------------------------------------------------- usage
  // The paper's Figure 2, left: each model's score against what it uses per task, the
  // Pareto frontier through the models nothing beats on both. Any score on y, mean
  // tokens or mean dollars on x (log). Marks are the provider logos in a ring of the
  // licence colour, as in the paper; switching an axis moves them rather than redrawing.
  var USE_Y = [['elo', 'Elo'], ['human_elo', 'Human Elo'], ['overall', 'Overall']];
  var USE_X = {tokens: {name: 'Mean tokens per task (M, log scale)', get: function(r){ return r.tokens / 1e6; },
                        fmt: function(v){ return v.toLocaleString('en', {maximumSignificantDigits: 3}) + 'M'; }},
               cost: {name: 'Mean cost per task (USD, log scale)', get: function(r){ return r.cost_usd; },
                      fmt: function(v){ return '$' + v.toLocaleString('en', {maximumSignificantDigits: 3}); }}};
  var use = {x: 'tokens', y: 'elo', hide: {}, split: null};
  // The split keys: with one split off, every reading is the other split's alone,
  // refitted or reaveraged on its tasks (tools/export_splits.py). Only the readings
  // defined the same way on both splits are offered there.
  var SPLIT_Y = {elo: 1, human_elo: 1};
  function useRows(){
    if (!use.split) return LB.models;
    return LB.models.map(function(r){
      var s = r.by_split[use.split];
      return {run: r.run, label: r.label, elo: s.elo, elo_ci: s.elo_ci, human_elo: s.human_elo,
              human_elo_ci: s.human_elo_ci, vqa: s.vqa, families: {VQA: s.vqa},
              cost_usd: s.cost_usd, tokens: s.tokens};
    });
  }
  var UW = 1000, UH = 560, UL = 64, UR = 24, UT = 16, UB = 58;
  function yOf(r, k){ return k === 'elo' || k === 'human_elo' || k === 'overall' ? r[k] : r.families[k]; }
  function isEloKey(k){ return k === 'elo' || k === 'human_elo'; }
  function ciOf(r, k){ return k === 'elo' ? r.elo_ci : k === 'human_elo' ? r.human_elo_ci : null; }
  function mixWhite(hex, t){
    return 'rgb(' + rgbOf(hex).map(function(c){ return Math.round(c + (255 - c) * t); }).join(',') + ')';
  }

  function useScales(rs){
    var xs = rs.map(function(r){ return USE_X[use.x].get(r); });
    var lx0 = Math.log10(Math.min.apply(null, xs)), lx1 = Math.log10(Math.max.apply(null, xs));
    var pad = (lx1 - lx0) * .06; lx0 -= pad; lx1 += pad;
    var y0, y1, step;
    if (isEloKey(use.y)){ y0 = 0; y1 = 2000; step = 500; }
    else {
      var ys = rs.map(function(r){ return yOf(r, use.y); });
      y0 = Math.max(0, Math.floor((Math.min.apply(null, ys) - .05) * 10) / 10);
      y1 = Math.min(1, Math.ceil((Math.max.apply(null, ys) + .05) * 10) / 10); step = .1;
    }
    return {lx0: lx0, lx1: lx1, y0: y0, y1: y1, step: step,
            X: function(v){ return UL + (Math.log10(v) - lx0) / (lx1 - lx0) * (UW - UL - UR); },
            Y: function(v){ return UT + (1 - (v - y0) / (y1 - y0)) * (UH - UT - UB); }};
  }

  // Names beside their marks. Each label weighs a ring of spots around its mark and takes
  // the cheapest: running into a mark or a placed label costs most, crossing the frontier
  // less, leaving the frame is ruled out, and the nearer spots win a tie.
  function segHitsBox(p, q, b){                   // Liang-Barsky: does segment pq enter box b
    var t0 = 0, t1 = 1, dx = q[0] - p[0], dy = q[1] - p[1];
    var P = [-dx, dx, -dy, dy], Q = [p[0] - b.x0, b.x1 - p[0], p[1] - b.y0, b.y1 - p[1]];
    for (var i = 0; i < 4; i++){
      if (P[i] === 0){ if (Q[i] < 0) return false; continue; }
      var t = Q[i] / P[i];
      if (P[i] < 0){ if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  function placeLabels(pts, line){
    var boxes = pts.map(function(p){ return {x0: p.x - 13, y0: p.y - 13, x1: p.x + 13, y1: p.y + 13}; });
    var over = function(b, o){ return b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0; };
    var out = {};
    pts.slice().sort(function(a, b){ return a.y - b.y; }).forEach(function(p){
      var w = textW(p.run) + 4, h = 15, spots = [];
      [16, 26, 40].forEach(function(d, ring){
        [[d, -h / 2], [-d - w, -h / 2], [-w / 2, -d - h], [-w / 2, d],
         [d - 2, -h - d / 2], [d - 2, d / 2], [-d + 2 - w, -h - d / 2], [-d + 2 - w, d / 2]]
          .forEach(function(o){ spots.push([o[0], o[1], ring]); });
      });
      var best = null, bestCost = Infinity;
      spots.forEach(function(sp, k){
        var b = {x0: p.x + sp[0], y0: p.y + sp[1]}; b.x1 = b.x0 + w; b.y1 = b.y0 + h;
        if (b.x0 < UL + 2 || b.x1 > UW - 2 || b.y0 < 0 || b.y1 > UH - UB) return;
        var cost = sp[2] * 3 + k * .01;
        boxes.forEach(function(o){ if (over(b, o)) cost += 100; });
        for (var i = 1; i < line.length; i++) if (segHitsBox(line[i - 1], line[i], b)){ cost += 20; break; }
        if (cost < bestCost){ bestCost = cost; best = b; }
      });
      if (!best){ best = {x0: p.x + 16, y0: p.y - h / 2}; best.x1 = best.x0 + w; best.y1 = best.y0 + h; }
      boxes.push(best);
      out[p.run] = {dx: best.x0 - p.x + 2, dy: best.y1 - p.y - 4};
    });
    return out;
  }

  function drawUsage(){
    var root = $('usage-plot'), rs = LB.models;
    if (!root.firstChild){
      root.innerHTML = '<svg viewBox="0 0 ' + UW + ' ' + UH + '" role="img" aria-label="Score against usage per task">'
        + '<defs><filter id="ushadow" x="-50%" y="-50%" width="200%" height="200%">'
        + '<feDropShadow dx="1.5" dy="1.5" stdDeviation="1" flood-color="#262626" flood-opacity=".6"/></filter></defs>'
        + '<g class="u-axes"></g><path class="u-front"/><g class="u-marks">'
        + rs.map(function(r){
            var c = licence(r.run), f = LOGO[r.run];
            return '<g class="um" data-run="' + r.run + '">'
              + '<path class="u-ci" stroke="' + mixWhite(c, .45) + '"/>'
              + '<line class="u-lead"/>'
              + '<g filter="url(#ushadow)"><circle r="12.5" fill="#000"/><circle r="12" fill="#fff" stroke="' + c
              + '" stroke-width="2.4"/></g>'
              + (f ? '<image class="' + (MONO[f] ? 'mono' : '') + '" href="logos/' + f
                  + '.svg" x="-7" y="-7" width="14" height="14"/>' : '')
              + '<text class="nm u-lab">' + esc(REG[r.run].name)
              + (REG[r.run].effort ? '<tspan class="eff"> [' + esc(REG[r.run].effort) + ']</tspan>' : '') + '</text></g>';
          }).join('')
        + '</g></svg>';
      wireUsageControls();
    }
    var cur = useRows(), byRun = {};
    cur.forEach(function(r){ byRun[r.run] = r; });
    var shown = cur.filter(function(r){
      var y = yOf(r, use.y);
      return !use.hide[REG[r.run].open ? 'open' : 'prop'] && y !== null && y !== undefined;
    });
    var sc = useScales(shown.length ? shown : rs), X = sc.X, Y = sc.Y;

    // axes: log decades with 1-2-5 ticks on x, even steps on y
    var ax = '', yx = UH - UB;
    for (var d = Math.floor(sc.lx0); d <= Math.ceil(sc.lx1); d++){
      [1, 2, 5].forEach(function(m){
        var v = m * Math.pow(10, d), lv = Math.log10(v);
        if (lv < sc.lx0 || lv > sc.lx1) return;
        ax += '<line class="grid" x1="' + X(v) + '" y1="' + UT + '" x2="' + X(v) + '" y2="' + yx + '"/>'
          + '<text class="tick" x="' + X(v) + '" y="' + (yx + 18) + '" text-anchor="middle">'
          + (use.x === 'cost' ? '$' + (v < 1 ? v.toFixed(v < .1 ? 2 : 1) : v) : (v < 1 ? v.toFixed(1) : v)) + '</text>';
      });
    }
    for (var g = sc.y0; g <= sc.y1 + 1e-9; g += sc.step){
      ax += '<line class="grid" x1="' + UL + '" y1="' + Y(g) + '" x2="' + (UW - UR) + '" y2="' + Y(g) + '"/>'
        + '<text class="tick" x="' + (UL - 8) + '" y="' + (Y(g) + 4) + '" text-anchor="end">'
        + (isEloKey(use.y) ? g.toFixed(0) : g.toFixed(1)) + '</text>';
    }
    ax += '<line class="axis" x1="' + UL + '" y1="' + UT + '" x2="' + UL + '" y2="' + yx + '"/>'
      + '<line class="axis" x1="' + UL + '" y1="' + yx + '" x2="' + (UW - UR) + '" y2="' + yx + '"/>'
      + '<text class="axt" x="' + ((UL + UW - UR) / 2) + '" y="' + (UH - 12) + '" text-anchor="middle">'
      + USE_X[use.x].name + '</text>'
      + '<text class="axt" x="16" y="' + ((UT + yx) / 2) + '" text-anchor="middle" transform="rotate(-90 16 '
      + ((UT + yx) / 2) + ')">' + USE_Y.filter(function(k){ return k[0] === use.y; })[0][1] + '</text>';
    root.querySelector('.u-axes').innerHTML = ax;

    // the frontier over the models shown: nothing that uses less scores more
    var pts = shown.map(function(r){ return {run: r.run, u: USE_X[use.x].get(r), v: yOf(r, use.y)}; });
    var front = pts.filter(function(p){ return !pts.some(function(q){ return q.u <= p.u && q.v > p.v; }); })
      .sort(function(a, b){ return a.u - b.u; });
    var fd = front.length ? 'M' + X(front[0].u) + ' ' + yx + ' L' + front.map(function(p){ return X(p.u) + ' ' + Y(p.v); }).join(' L')
      + ' L' + (UW - UR) + ' ' + Y(front[front.length - 1].v) : '';
    root.querySelector('.u-front').setAttribute('d', fd);
    // the same polyline, as points, for the labels to keep clear of
    var fline = front.length ? [[X(front[0].u), yx]].concat(front.map(function(p){ return [X(p.u), Y(p.v)]; }),
      [[UW - UR, Y(front[front.length - 1].v)]]) : [];

    var at = {};
    shown.forEach(function(r){ at[r.run] = {run: r.run, x: X(USE_X[use.x].get(r)), y: Y(yOf(r, use.y))}; });
    var lab = placeLabels(shown.map(function(r){ return at[r.run]; }), fline);
    root.querySelectorAll('.um').forEach(function(g){
      var run = g.getAttribute('data-run'), r = byRun[run], p = at[run];
      g.classList.toggle('off', !p);
      if (!p) return;
      g.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
      var ci = ciOf(r, use.y), l = g.querySelector('.u-ci');
      if (ci){
        var c0 = Y(ci[0]) - p.y, c1 = Y(ci[1]) - p.y;
        l.setAttribute('d', 'M0 ' + c0 + 'V' + c1 + 'M-4 ' + c0 + 'H4M-4 ' + c1 + 'H4');
      }
      l.style.display = ci ? '' : 'none';
      var t = g.querySelector('.u-lab'), o = lab[run];
      t.setAttribute('x', o.dx); t.setAttribute('y', o.dy);
      var ld = g.querySelector('.u-lead');
      // a leader to the nearest point of the label's box, when the label sits off its mark
      var bx0 = o.dx - 2, bx1 = bx0 + textW(run) + 4, by0 = o.dy - 11, by1 = o.dy + 4;
      var ex = Math.max(bx0, Math.min(0, bx1)), ey = Math.max(by0, Math.min(0, by1));
      var far = Math.sqrt(ex * ex + ey * ey) > 17;
      ld.style.display = far ? '' : 'none';
      if (far){ ld.setAttribute('x1', 0); ld.setAttribute('y1', 0); ld.setAttribute('x2', ex); ld.setAttribute('y2', ey); }
    });
    root._scales = sc;
  }

  function wireUsageControls(){
    var box = $('lbv-usage');
    var sel = $('usage-y');
    sel.innerHTML = USE_Y.map(function(k){ return '<option value="' + esc(k[0]) + '">' + esc(k[1]) + '</option>'; }).join('');
    sel.value = use.y;
    sel.addEventListener('change', function(){ use.y = sel.value; drawUsage(); });
    box.querySelectorAll('[data-x]').forEach(function(b){
      b.addEventListener('click', function(){
        use.x = b.dataset.x;
        box.querySelectorAll('[data-x]').forEach(function(u){ u.classList.toggle('is-on', u === b); u.setAttribute('aria-pressed', u === b); });
        drawUsage();
      });
    });
    box.querySelectorAll('[data-split]').forEach(function(b){
      b.addEventListener('click', function(){
        var k = b.dataset.split, other = k === 'real' ? 'synthetic' : 'real';
        if (use.split === k) return;                         // never hide both
        use.split = use.split === null ? other : null;
        box.querySelectorAll('[data-split]').forEach(function(u){
          var on = use.split === null || use.split === u.dataset.split;
          u.classList.toggle('muted', !on); u.setAttribute('aria-pressed', on);
        });
        [].forEach.call(sel.options, function(o){ o.disabled = !!use.split && !SPLIT_Y[o.value]; });
        if (use.split && !SPLIT_Y[use.y]){ use.y = 'elo'; sel.value = 'elo'; }
        drawUsage();
      });
    });
    box.querySelectorAll('[data-lic]').forEach(function(b){
      b.addEventListener('click', function(){
        var k = b.dataset.lic, other = k === 'open' ? 'prop' : 'open';
        if (!use.hide[k] && use.hide[other]) return;          // never hide both
        use.hide[k] = !use.hide[k];
        b.classList.toggle('muted', use.hide[k]); b.setAttribute('aria-pressed', !use.hide[k]);
        drawUsage();
      });
    });
  }

  // ------------------------------------------------------------- the dataset
  // The shape of the paper's Figure 3: one bar per row in the family's own
  // colour, the solid half real and the washed half simulated, the count inside
  // each half and the total past the end, over a shared axis.
  var FAMCOL = {rigidfam: 'var(--fam-rigid)', softfam: 'var(--fam-soft)',
                codimfam: 'var(--fam-codim)', flowfam: 'var(--fam-flow)'};

  function bar(name, real, synth, max, col, group){
    var tot = real + synth;
    // a segment narrower than this cannot hold its own number legibly
    var room = function(v){ return v / max * 100 > 4.5; };
    // the simulated half is the family colour washed 55% toward white, the paper's rule
    var seg = function(v, light){
      if (!v) return '';
      return '<span class="bseg" style="width:' + (v / tot * 100).toFixed(2) + '%;background:'
        + (light ? 'color-mix(in srgb, ' + col + ' 45%, #fff)' : col)
        + '">' + (room(v) ? v : '') + '</span>';
    };
    return '<div class="bar' + (group ? ' leaf' : '') + '"><span class="bname">' + esc(name)
      + '</span><span class="btrack"><span class="bcard" style="width:' + (tot / max * 100).toFixed(2) + '%">'
      + seg(real, false) + seg(synth, true) + '</span>'
      + '<span class="btotal">' + tot + '<i>' + Math.round(tot / ONTO.splits.all.n_scenes * 100) + '%</i></span></span><span></span></div>';
  }

  function axis(max, caption){
    var step = max > 120 ? 50 : max > 60 ? 25 : max > 24 ? 10 : 5;
    var h = '<div class="oaxis"><span></span><span class="track">';
    for (var v = 0; v <= max; v += step)
      h += '<span class="tick" style="left:' + (v / max * 100).toFixed(2) + '%">' + v + '</span>';
    h += '</span><span></span>';
    return h + '</div><div class="oaxis"><span class="cap">' + esc(caption) + '</span></div>';
  }

  function drawOnto(){
    if (!$('onto')) return;
    var R = ONTO.splits.real, S = ONTO.splits.synthetic, A = ONTO.splits.all;
    var key = '<p class="key"><span><i class="real"></i>real</span>'
            + '<span><i class="synth"></i>simulated</span></p>';
    var round10 = function(v){ return Math.ceil(v / 10) * 10; };
    var h = '';

    {
      var matMax = round10(Math.max.apply(null, ONTO.materials.map(function(m){
        return A.materials[m.key]; })));
      h = '<div class="opanel wide"><p class="osub">' + esc(ONTO.notes.multi_label)
        + '</p>' + key + '<div class="bars">';
      ONTO.families.forEach(function(f){
        h += '<div class="bar group"><span class="bname">' + esc(f.label) + '</span></div>';
        f.materials.forEach(function(k2){
          var m = ONTO.materials.filter(function(x){ return x.key === k2; })[0];
          if (!m) return;
          h += bar(m.label, R.materials[k2], S.materials[k2], matMax, FAMCOL[f.key], true);
        });
      });
      h += '</div>' + axis(matMax, 'tasks containing the material') + '</div>';
    }
    {
      var facMax = round10(Math.max.apply(null, ONTO.factors.map(function(f){
        return f.counts.real + f.counts.synthetic; })));
      h += '<div class="opanel wide"><p class="osub">The properties a task can also be '
        + 'sorted on, beside what it is made of.</p>' + key + '<div class="bars">'
        + ONTO.factors.map(function(f){
            return bar(f.label, f.counts.real, f.counts.synthetic, facMax, 'var(--orange)');
          }).join('')
        + '</div>' + axis(facMax, 'tasks with the property') + '</div>';
    }
    $('onto').innerHTML = h;
  }


  // ------------------------------------------------ static against dynamic
  // The two families that judge a single frame against the two that judge motion, as the paper pairs them.
  // Both are means of families already on the leaderboard, so this figure and the
  // table under it are the same numbers read two ways.
  var STATIC_FAM = ['Perceptual', '3D Geometry'];
  var DYN_FAM = ['2D Dynamics', '3D Dynamics'];

  function famMean(r, fam){
    var v = fam.map(function(f){ return r.families[f]; })
               .filter(function(x){ return x !== null && x !== undefined; });
    return v.length ? v.reduce(function(a, b){ return a + b; }, 0) / v.length : null;
  }

  function drawGap(){
    var host = $('gap-fig'); if (!host || !LB) return;
    // the field thins out below GLM-5.3 and the last rows only lengthen the figure;
    // the full eighteen are in the leaderboard
    var GAP_TOP = 13;
    var all = LB.models.slice()
      .filter(function(r){ return famMean(r, STATIC_FAM) !== null; })
      .sort(function(a, b){ return (b.overall || 0) - (a.overall || 0); });
    var rs = all.slice(0, GAP_TOP);
    var pc = function(v){ return (v * 100).toFixed(2) + '%'; };
    var rows = rs.map(function(r){
      var st = famMean(r, STATIC_FAM), dy = famMean(r, DYN_FAM);
      var lo = Math.min(st, dy), hi = Math.max(st, dy);
      return '<div class="gap-row">'
        + '<span class="gap-name">' + logo(r.run) + '<span>' + names(r) + '</span></span>'
        + '<span class="gap-track">'
        +   '<i class="gap-line" style="left:' + pc(lo) + ';width:' + pc(hi - lo) + '"></i>'
        +   '<i class="gap-dot dyn" style="left:' + pc(dy) + '"></i>'
        +   '<i class="gap-dot sta" style="left:' + pc(st) + '"></i>'
        +   '<b class="gap-v lo" style="left:' + pc(dy) + '">' + dy.toFixed(2) + '</b>'
        +   '<b class="gap-v hi" style="left:' + pc(st) + '">' + st.toFixed(2) + '</b>'
        + '</span></div>';
    }).join('');
    var ticks = [0, .25, .5, .75, 1].map(function(t){
      return '<i style="left:' + pc(t) + '"></i>';
    }).join('');
    var labs = [['0', 0], ['.25', .25], ['.50', .5], ['.75', .75], ['1', 1]].map(function(t){
      return '<b style="left:' + pc(t[1]) + '">' + t[0] + '</b>';
    }).join('');
    host.innerHTML =
      '<p class="gap-key">'
      + '<span><i class="dyn"></i><b>dynamic</b>2D and 3D Dynamics</span>'
      + '<span><i class="sta"></i><b>static</b>Perceptual and 3D Geometry</span>'
      + '</p>'
      + '<div class="gap-plot"><div class="gap-grid"><span class="gap-name"></span>'
      + '<span class="gap-track">' + ticks + '</span></div>'
      + rows
      + '<div class="gap-axis"><span class="gap-name"></span>'
      + '<span class="gap-track">' + labs + '</span></div></div>'
      + '<p class="gap-foot">Normalised score, 0 to 1; each side is the mean of its '
      + 'families. The top ' + rs.length + ' of ' + all.length + ' models; the rest are '
      + 'in the <a href="#lbv-caps">full comparison</a>.</p>';
  }


  // ------------------------------------------------ what makes a task hard
  // Seven contrasts against the six families. The cell is the standardised effect:
  // negative means the first side of the contrast scores lower. Bold and underlined
  // is the paper's "robust": the interval excludes zero and nearly every model agrees.
  var EFF = null;

  // the paper rounds half away from zero, so -0.105 prints as -0.11
  function eff2(v){
    var r = (Math.abs(v) * 100 + 0.5) | 0;
    return (v < 0 ? '\u2212' : '+') + (r / 100).toFixed(2);
  }

  // the paper's diverging map (paper_four._div_cmap on the crane palette), sampled at
  // 33 even stops from orange through cream to periwinkle
  var EFF_MAP = ['#d86415', '#dc6515', '#df6615', '#e36815', '#e76914', '#eb6b14', '#ee7a2c', '#f1904e', '#f3a571', '#f6bb93', '#f9d1b6', '#fbe0ce', '#fae4d4', '#f9e8da', '#f8ece0', '#f8f0e6', '#f7f4ec', '#f3f1ee', '#efeff1', '#ebecf3', '#e7eaf5', '#e3e7f8', '#d3daf5', '#c0caf1', '#adbaec', '#99a9e8', '#8699e3', '#788ddb', '#7386cf', '#6d7ec2', '#6777b6', '#6170a9', '#5c6a9e'].map(function(h){
    return [1, 3, 5].map(function(k){ return parseInt(h.substr(k, 2), 16) / 255; }); });
  // as fig_category colours a cell: clipped at the largest effect shown, curved gently
  function effFill(e, clip){
    var x = Math.max(-1, Math.min(1, e / clip));
    var t = .5 + .5 * Math.sign(x) * Math.pow(Math.abs(x), 1.15);
    var f = t * (EFF_MAP.length - 1), i = Math.min(EFF_MAP.length - 2, Math.floor(f)), u = f - i;
    var c = EFF_MAP[i].map(function(v, k){ return v + (EFF_MAP[i + 1][k] - v) * u; });
    return {css: 'rgb(' + c.map(function(v){ return Math.round(v * 255); }).join(',') + ')',
            dark: .2126 * c[0] + .7152 * c[1] + .0722 * c[2] < .55};
  }

  function drawEffects(){
    var host = $('eff-fig'); if (!host || !EFF) return;
    var clip = Math.max.apply(null, EFF.rows.map(function(r){
      return Math.max.apply(null, r.cells.map(function(c){ return c ? Math.abs(c.e) : 0; })); }));
    // built like the capability figure beside it: column names over a framed block,
    // row names to its left, the heat in the cell
    var heads = EFF.families.map(function(f){
      return '<span><span class="nm-l">' + esc(f) + '</span><span class="nm-s">' + esc(SHORT[f] || f) + '</span></span>'; }).join('');
    var names = EFF.rows.map(function(r){
      return '<div class="eff-n">' + esc(r.label) + '</div>'; }).join('');
    var cells = EFF.rows.map(function(r, i){
      return r.cells.map(function(c, j){
        var ij = ' data-i="' + i + '" data-j="' + j + '"';
        if (!c) return '<div class="eff-c na"' + ij + '>n/a</div>';
        var fill = effFill(c.e, clip);
        // the paper's claim: the interval excludes zero and nearly every model agrees
        var k = (c.robust ? ' strong' : '') + (fill.dark ? ' w' : '');
        return '<div class="eff-c' + k + '"' + ij
          + ' style="background:' + fill.css + '">'
          + eff2(c.e) + '</div>';
      }).join('');
    }).join('');
    host.innerHTML = '<div class="eff-wrap"><div class="efffig">'
      + '<div class="eff-heads">' + heads + '</div>'
      + '<div class="eff-names">' + names + '</div>'
      + '<div class="eff-box">' + cells + '</div></div></div>'
      + '<p class="gap-foot">Standardised effect on each family: '
      + '<b class="eff-k neg"></b> the first side scores lower, '
      + '<b class="eff-k pos"></b> higher.</p>';
  }

  // ------------------------------------------------ the metric list in the FAQ
  function drawMetrics(){
    if (!$('metric-list')) return;
    $('metric-list').innerHTML = LB.columns.map(function(c){
      return '<li><span class="mfam">' + esc(SHORT[c] === c ? c : c) + '</span>'
        + '<span class="mwhat">' + esc(LB.family_notes[c] || '') + '</span></li>';
    }).join('');
  }


  // ---------------------------------------------------------- code colouring
  // A small highlighter for the two languages this page shows. It emits highlight.js
  // class names, which site.css already maps onto the syntax palette, so nothing is
  // fetched at load time. One pass with one alternation per language: a second pass
  // would re-match the spans the first pass inserted.
  function escText(s){
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var LANG = {
    bash: {
      // the command only counts at the head of a line, so `git` inside a URL stays plain
      re: /(#[^\n]*)|('[^'\n]*'|"[^"\n]*")|(\s)(--?[A-Za-z][\w-]*)|(^|\n)([ \t]*)(git|cd|docker|python3?|hf|export|curl|mkdir|cp|mv|rm)\b|\b(clone|build|download|run|install)\b/g,
      cls: ['hljs-comment', 'hljs-string', null, 'hljs-attr', null, null,
            'hljs-built_in', 'hljs-keyword']
    },
    bibtex: {
      re: /(@\w+)|(\{[^{}]*\})|\b([a-z]+)(?=\s*=)|\b(\d{4})\b/g,
      cls: ['hljs-keyword', 'hljs-string', 'hljs-attr', 'hljs-number']
    }
  };
  function paint(src, lang){
    var L = LANG[lang], out = '', last = 0;
    src.replace(L.re, function(m){
      var args = arguments, at = args[args.length - 2];
      out += escText(src.slice(last, at));
      for (var g = 1; g <= L.cls.length; g++){
        if (args[g] === undefined) continue;
        if (L.cls[g - 1] === null){ out += escText(args[g]); continue; }  // kept, not coloured
        out += '<span class="' + L.cls[g - 1] + '">' + escText(args[g]) + '</span>';
      }
      last = at + m.length;
      return m;
    });
    return out + escText(src.slice(last));
  }
  function highlight(){
    document.querySelectorAll('.code').forEach(function(box){
      var lang = (box.querySelector('.code-lang') || {}).textContent;
      var code = box.querySelector('pre > code');
      if (!code || !LANG[lang] || code.dataset.lit) return;
      code.innerHTML = paint(code.textContent, lang);
      code.dataset.lit = '1';
    });
  }
  highlight();

  // ------------------------------------------------------------------- wiring
  document.querySelectorAll('.lbtab').forEach(function(b){
    b.addEventListener('click', function(){
      var v = b.dataset.view;
      document.querySelectorAll('.lbtab').forEach(function(u){
        u.setAttribute('aria-selected', u === b); u.classList.toggle('is-on', u === b); });
      ['table'].forEach(function(k){ $('lbv-' + k).hidden = k !== v; });
    });
  });
  document.querySelectorAll('.ontab').forEach(function(b){
    b.addEventListener('click', function(){
      view = b.dataset.view;
      document.querySelectorAll('.ontab').forEach(function(u){
        u.setAttribute('aria-selected', u === b); u.classList.toggle('is-on', u === b); });
      drawOnto();
    });
  });

  // Tasks, composition and metrics share one strip. Each stays linkable: the hash
  // names the open tab, and a scene hash (the gallery writes one per task) means tasks.
  var TABS = ['tasks', 'dataset', 'metrics-sec'];

  // strict: the hash names one of the three, or something inside the gallery
  function tabOf(hash){
    var h = decodeURIComponent((hash || '').replace(/^#/, ''));
    if (TABS.indexOf(h) >= 0) return h;
    return (h === 'gallery' || h === 'stage') ? 'tasks' : null;
  }
  // the tasks are the default view, and a hash naming nothing here is a scene,
  // which the gallery owns and shows there too

  function showTab(name, scroll){
    if (TABS.indexOf(name) < 0 || !$(name)) return;
    TABS.forEach(function(t){ $(t).hidden = t !== name; });
    document.querySelectorAll('.switch .sw').forEach(function(b){
      b.setAttribute('aria-selected', b.dataset.tab === name);
    });
    // the metrics explorer is a whole app of its own: load it the first time it is asked for
    if (name === 'metrics-sec' && !$('metrics-frame').src) $('metrics-frame').src = 'metrics/?embed';
    if (scroll) $(name).scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  document.querySelectorAll('.switch .sw').forEach(function(b){
    b.addEventListener('click', function(){
      showTab(b.dataset.tab, false);
      // Switching by hand does not go in the URL: the tasks are the page's default and
      // a reload should come back to them. A hash naming a tab only ever arrives from a
      // link, so drop one that is already there rather than write a new one. A scene
      // hash belongs to the gallery and is left alone.
      if (tabOf(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    });
  });
  // a link to one of these sections opens its tab instead of scrolling to nothing
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    var t = tabOf(a.getAttribute('href'));
    if (t) a.addEventListener('click', function(){ showTab(t, false); });
  });
  addEventListener('hashchange', function(){ var t = tabOf(location.hash); if (t) showTab(t, false); });
  showTab(tabOf(location.hash) || 'tasks', false);

  // Load benchmark data only when a remaining widget needs it.
  if (['lb-table', 'metric-list', 'lbv-caps', 'gap-fig', 'align-scatter'].some(function(id){ return $(id); }))
  Promise.all([fetch('data/leaderboard.json').then(function(r){ return r.json(); }),
               fetch('models.json').then(function(r){ return r.json(); })])
    .then(function(res){
      res[1].models.forEach(function(m){ REG[m.key] = m; if (m.logo) LOGO[m.key] = m.logo; });
      // the names are the registry's, not the labels site_data.py wrote into leaderboard.json
      res[0].models.forEach(function(r){
        var m = REG[r.run];
        if (!m) throw new Error('leaderboard.json names ' + r.run + ', which models.json does not');
        r.label = m.effort ? m.name + ' [' + m.effort + ']' : m.name;
        r.short = m.effort ? m.short + ' [' + (m.effort === 'Default' ? 'Def' : m.effort) + ']' : m.short;
      });
      LB = res[0]; drawTable(); drawMetrics(); drawCaps(); drawGap(); drawAlign();
      matchMedia('(max-width:640px)').addEventListener('change', drawAlign);
    });
  if ($('onto')) fetch('data/ontology.json').then(function(r){ return r.json(); }).then(function(d){
    ONTO = d; drawOnto();
  });
  if ($('eff-fig')) fetch('data/effects.json').then(function(r){ return r.json(); }).then(function(d){
    EFF = d; drawEffects();
  }).catch(function(){});

  // the case clips: they load and play when they come near, and pause when they leave,
  // so four videos do not all decode on load
  (function(){
    // the figure is observed, not the video: a video with no src has no intrinsic size,
    // so at width:auto it is a zero-area box and may never report as intersecting --
    // it would then never be given the src that would have given it a size
    var figs = document.querySelectorAll('.hv'); if (!figs.length) return;
    var obs = new IntersectionObserver(function(es){
      es.forEach(function(en){
        var v = en.target.querySelector('.hv-v'); if (!v) return;
        if (en.isIntersecting){
          if (!v.src) v.src = v.dataset.src;
          var r = v.play(); if (r && r.catch) r.catch(function(){});
        } else if (!v.paused) v.pause();
      });
    }, {rootMargin: '200px'});
    figs.forEach(function(f){ obs.observe(f); });
  })();

  // a sideways scroller fades its right edge while there is more to the right of it
  (function(){
    var SEL = '.table-wrap,.cap-wrap,.uplot';
    function mark(el){ el.classList.toggle('more', el.scrollLeft + el.clientWidth < el.scrollWidth - 2); }
    var queued = false;
    function all(){ queued = false; document.querySelectorAll(SEL).forEach(mark); }
    function queue(){ if (!queued){ queued = true; requestAnimationFrame(all); } }
    document.addEventListener('scroll', function(e){ if (e.target.matches && e.target.matches(SEL)) mark(e.target); }, true);
    addEventListener('resize', queue);
    // the figures fill in after load
    new MutationObserver(queue).observe(document.body, {childList: true, subtree: true});
    all();
  })();

  // the section rail. The dots sit evenly, so progress is counted in sections: a
  // reading line that runs from the top of the window at the top of the page to its
  // bottom at the end says which section is being read and how far into it.
  (function(){
    var nav = $('pnav'), fill = nav.querySelector('.pnav-fill'), track = nav.querySelector('.pnav-track');
    var stops = [].slice.call(nav.querySelectorAll('a'));
    var secs = stops.map(function(a){
      var el = $(a.dataset.sec);
      if (!el) throw new Error('the section rail names #' + a.dataset.sec + ', which the page does not have');
      return el;
    });
    var n = stops.length;
    // each dot takes the gradient's colour at its height, so a read dot matches the fill beside it
    stops.forEach(function(a, i){
      a.style.setProperty('--c', 'color-mix(in srgb, var(--orange) ' + (100 * i / (n - 1)) + '%, var(--peri))');
      a.addEventListener('click', function(e){
        e.preventDefault();
        pinned = i; queue();
        secs[i].scrollIntoView({behavior: 'smooth', block: 'start'});
        history.replaceState(null, '', a.getAttribute('href'));
      });
    });
    // a section near the end can't scroll up to the reading line, so after a click the
    // rail holds on the dot that was asked for until the reader scrolls on their own
    var queued = false, pinned = -1;
    ['wheel', 'touchmove', 'keydown'].forEach(function(t){
      addEventListener(t, function(){ if (pinned >= 0){ pinned = -1; queue(); } }, {passive: true});
    });
    function update(){
      queued = false;
      if (getComputedStyle(nav).display === 'none') return;   // the rail is hidden on narrow screens
      var max = document.documentElement.scrollHeight - innerHeight;
      var line = scrollY + innerHeight * (max > 0 ? scrollY / max : 0);
      var tops = secs.map(function(s){ return s.getBoundingClientRect().top + scrollY; });
      tops[0] = 0;
      var p = 0;
      for (var i = 0; i < n; i++){
        if (line < tops[i]) break;
        var next = i + 1 < n ? tops[i + 1] : document.documentElement.scrollHeight;
        p = i + Math.min(1, (line - tops[i]) / Math.max(1, next - tops[i]));
      }
      p = pinned >= 0 ? pinned : Math.min(p, n - 1);
      var len = track.clientHeight, h = len * p / (n - 1);
      fill.style.height = h + 'px';
      fill.style.backgroundSize = '100% ' + len + 'px';
      var on = Math.min(n - 1, Math.floor(p + 1e-6));
      stops.forEach(function(a, i){
        a.classList.toggle('on', i === on);
        a.classList.toggle('read', i < on);
        if (i === on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
    function queue(){ if (!queued){ queued = true; requestAnimationFrame(update); } }
    addEventListener('scroll', queue, {passive: true});
    addEventListener('resize', queue);
    // the gallery and the leaderboard fill in after load and move every section below them
    new ResizeObserver(queue).observe(document.body);
    update();
  })();
})();
