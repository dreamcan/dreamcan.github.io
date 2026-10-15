'use strict';
importScripts('dp-solver.js?v=20261010-dp');
var prepared;
self.onmessage = function (event) {
  var message = event.data;
  try {
    if (message.type === 'init') {
      prepared = DreamCanDP.prepare(message.reachability, message.utility, message.epsilon);
    }
    if (!prepared) throw new Error('Load a trajectory before selecting subgoals.');
    var result = DreamCanDP.solve(prepared, message.params);
    self.postMessage({ version: message.version, result: result });
  } catch (error) {
    self.postMessage({ version: message.version, error: error.message });
  }
};
