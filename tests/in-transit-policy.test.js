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

test('policy citations render as plain labels, not links to a PDF', () => {
  const cite = vm.runInContext("policyReferenceLink('Para 9.b', 3)", policyContext);
  assert.equal(cite, '<span class="policy-cite">Para 9.b</span>');
});

function runTdyRange({ confirmAnswer }) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'source', '04-schedule-wizard-grid.js'), 'utf8');
  const start = src.indexOf('function applyPlannedDateRange()');
  const end = src.indexOf('/* ====', start);
  const fnSource = src.slice(start, end);

  const day = 86400000;
  const base = new Date(2026, 11, 1);
  const addDays = (d, n) => new Date(d.getTime() + n * day);
  const pad = n => String(n).padStart(2, '0');
  const toIsoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fields = {
    rangeStatusSelect: { value: 'tdy' },
    rangeStartDate: { value: toIsoDate(addDays(base, 15)) },
    rangeEndDate: { value: toIsoDate(addDays(base, 19)) },
    ppSelect: { value: '0' },
    tdyQualRadio_yes: { checked: true },
  };
  const userSelections = [new Array(14).fill('shift'), new Array(14).fill('shift')];
  userSelections[1][0] = 'rdo';
  userSelections[1][6] = 'rdo';

  const prompts = [];
  const context = vm.createContext({
    document: { getElementById: id => fields[id] || null },
    parseIsoDateLocal: iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); },
    payPeriods: [{ start: base }],
    userSelections,
    activePayPeriodCount: 2,
    transferEvents: [],
    addDays,
    toIsoDate,
    formatFullDate: toIsoDate,
    getStatusMeta: id => ({ name: id }),
    ensureSlotCapacity: () => {},
    ensurePayPeriodIndex: () => {},
    applyRdoPresetForSlot: () => {},
    captureLastDayStatusUndo: () => {},
    clearLastDayStatusUndo: () => {},
    removeTransferEventForDate: () => false,
    closeRangeBuilderModal: () => {},
    buildAllPayPeriodGrids: () => {},
    saveStateToLocalStorage: () => {},
    onPaySettingsChange: () => {},
    alert: () => {},
    confirm: message => { prompts.push(message); return confirmAnswer; },
  });
  vm.runInContext(fnSource + '\napplyPlannedDateRange();', context);
  return { prompts, row: userSelections[1].slice(0, 8) };
}

test('TDY travel days next to an RDO ask first, then switch those days to On Shift', () => {
  const { prompts, row } = runTdyRange({ confirmAnswer: true });
  assert.equal(prompts.length, 1);
  assert.deepEqual(row, ['shift', 'trv', 'drl', 'drl', 'drl', 'trv', 'shift', 'shift']);
});

test('declining the travel day prompt leaves the schedule unchanged', () => {
  const { prompts, row } = runTdyRange({ confirmAnswer: false });
  assert.equal(prompts.length, 1);
  assert.deepEqual(row, ['rdo', 'shift', 'shift', 'shift', 'shift', 'shift', 'rdo', 'shift']);
});
