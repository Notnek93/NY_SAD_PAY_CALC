const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'source', '04-schedule-wizard-grid.js'), 'utf8');
const start = source.indexOf('function pickStatusFromInlinePicker');
const fnSource = source.slice(start, source.indexOf('\nfunction renderInTransitConfirmation', start));

function pick(statusId, currentStatus) {
  const calls = [];
  const base = new Date(2026, 10, 18);
  const context = vm.createContext({
    userSelections: [new Array(14).fill(currentStatus)],
    payPeriods: [{ start: base }],
    document: { getElementById: () => ({ value: '0' }) },
    addDays: (date, days) => new Date(date.getTime() + days * 86400000),
    toIsoDate: date => date.toISOString().slice(0, 10),
    closeInlineStatusPicker: () => calls.push(['close']),
    openRangeBuilderModal: (...args) => calls.push(['planner', ...args]),
    renderInTransitConfirmation: () => calls.push(['transit']),
    setDayStatusDirect: (...args) => calls.push(['set', ...args]),
    offerLeaveFormDownload: () => calls.push(['leaveForm']),
  });
  vm.runInContext(fnSource + `\npickStatusFromInlinePicker(0, 3, ${JSON.stringify(statusId)});`, context);
  return calls;
}

test('picking Transfer Day opens the transfer planner for that date instead of setting it directly', () => {
  const calls = pick('transfer', 'shift');
  assert.deepEqual(calls.find(call => call[0] === 'planner').slice(1, 3), [0, 'transfer']);
  assert.equal(calls.some(call => call[0] === 'set'), false);
  assert.match(calls.find(call => call[0] === 'planner')[3], /^2026-1[12]-\d\d$/);
});

test('picking Transfer Day on a date that is already a transfer does nothing', () => {
  const calls = pick('transfer', 'transfer');
  assert.equal(calls.some(call => call[0] === 'planner' || call[0] === 'set'), false);
});

test('picking In-Transit asks for confirmation first, other statuses are set directly', () => {
  assert.equal(pick('trv', 'shift').some(call => call[0] === 'transit'), true);
  assert.equal(pick('rdo', 'shift').some(call => call[0] === 'set'), true);
});
