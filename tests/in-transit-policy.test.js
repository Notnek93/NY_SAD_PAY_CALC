const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const policySource = fs.readFileSync(
  path.join(__dirname, '..', 'source', '05-policy-leave-engine.js'),
  'utf8'
);
const policyContext = vm.createContext({});
vm.runInContext(policySource, policyContext);

const isValidInTransitBridge = (previousStatus, nextStatus) =>
  vm.runInContext(
    `isValidInTransitBridge(${JSON.stringify(previousStatus)}, ${JSON.stringify(nextStatus)})`,
    policyContext
  );

test('In-Transit is valid between On Shift and AT / Drill / TDY in either direction', () => {
  assert.equal(isValidInTransitBridge('shift', 'drl'), true);
  assert.equal(isValidInTransitBridge('drl', 'shift'), true);
});

test('In-Transit cannot substitute other statuses for On Shift or AT / Drill / TDY', () => {
  for (const status of ['lv', 'term_lv', 'transfer', 'refrad_rpt', 'rdo', 'trv']) {
    assert.equal(isValidInTransitBridge(status, 'drl'), false, `${status} must not count as On Shift`);
    assert.equal(isValidInTransitBridge('drl', status), false, `${status} must not count as AT / Drill / TDY`);
  }
});
