(function (scope) {
  'use strict';

  function prepare(reachability, utility, epsilon) {
    var n = utility.length;
    if (n < 2 || reachability.length !== n || !(epsilon > 0 && epsilon < 1)) {
      throw new Error('The video and value arrays do not align.');
    }
    var costs = new Array(n);
    for (var i = 0; i < n; i++) {
      if (!Number.isFinite(utility[i]) || utility[i] < 0 || utility[i] > 1 ||
          (i && utility[i] < utility[i - 1] - 1e-10) || reachability[i].length !== n - i - 1) {
        throw new Error('Invalid framewise utility or forward reachability values.');
      }
      costs[i] = new Float64Array(n - i - 1);
      for (var j = 0; j < costs[i].length; j++) {
        var r = reachability[i][j];
        if (!Number.isFinite(r) || r < 0 || r > 1) throw new Error('Invalid reachability value.');
        costs[i][j] = -Math.log(Math.max(epsilon, r));
      }
    }
    return { n: n, utility: utility, costs: costs };
  }

  function edge(data, params, i, j, remaining) {
    var mu = (data.n - 1 - i) / (remaining + 1);
    var spacing = Math.pow((j - i) / mu - 1, 2);
    return params.wr * data.costs[i][j - i - 1] + params.ws * spacing;
  }

  function pathCost(data, params, path) {
    var value = 0, i = 0;
    path.forEach(function (j, index) {
      value += edge(data, params, i, j, params.k - index);
      i = j;
    });
    return value - params.wg * data.utility[i];
  }

  function solve(data, params) {
    var n = data.n, T = n - 1, k = params.k, gap = params.gap;
    if (!Number.isInteger(k) || k < 1 || !Number.isInteger(gap) || gap < 1 || k * gap > T ||
        ['wr', 'wg', 'ws'].some(function (key) { return !Number.isFinite(params[key]) || params[key] < 0; })) {
      throw new Error('The subgoal count and minimum gap must fit within this video.');
    }
    var table = new Array(k + 1), next = new Array(k + 1);
    table[0] = Float64Array.from(data.utility, function (u) { return -params.wg * u; });
    next[0] = new Int32Array(n).fill(-1);
    for (var m = 1; m <= k; m++) {
      table[m] = new Float64Array(n).fill(Infinity);
      next[m] = new Int32Array(n).fill(-1);
      var jMax = T - (m - 1) * gap;
      for (var i = jMax - gap; i >= 0; i--) {
        var mu = (T - i) / (m + 1);
        var best = Infinity, chosen = -1;
        var row = data.costs[i], future = table[m - 1];
        for (var j = i + gap; j <= jMax; j++) {
          var spacing = (j - i) / mu - 1;
          var candidate = params.wr * row[j - i - 1] + params.ws * spacing * spacing + future[j];
          if (candidate < best) { best = candidate; chosen = j; }
        }
        table[m][i] = best;
        next[m][i] = chosen;
      }
    }
    var path = [], current = 0;
    for (var left = k; left > 0; left--) {
      current = next[left][current];
      if (current < 0) throw new Error('No feasible subgoal chain exists.');
      path.push(current);
    }
    // A local baseline uses immediate utility gain; for monotone annotations,
    // these gains telescope to the same terminal utility term as the DP objective.
    var greedy = [];
    current = 0;
    for (var stage = 0; stage < k; stage++) {
      var remaining = k - stage, end = T - (remaining - 1) * gap;
      var localBest = Infinity, localChoice = -1;
      for (var t = current + gap; t <= end; t++) {
        var local = edge(data, params, current, t, remaining) - params.wg * (data.utility[t] - data.utility[current]);
        if (local < localBest) { localBest = local; localChoice = t; }
      }
      greedy.push(localChoice);
      current = localChoice;
    }
    return { path: path, cost: table[k][0], table: table, greedy: greedy,
      greedyCost: pathCost(data, params, greedy), params: params };
  }

  var api = { prepare: prepare, edge: edge, solve: solve, pathCost: pathCost };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.DreamCanDP = api;
})(typeof self !== 'undefined' ? self : globalThis);
