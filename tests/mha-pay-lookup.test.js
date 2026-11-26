const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const sourceRoot = path.join(__dirname, '..', 'source');
const sandbox = {
  STORAGE_KEY: 'test-planner',
  ROLE_PP_INCENTIVE_BONUS: {
    C2: 1000,
    'External Support': 1000,
    'Facility Leadership': 2000,
    'General Purpose': 2000
  },
  localStorage: (() => {
    const values = new Map();
    return {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    };
  })()
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(sourceRoot, '07-pay-data.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(sourceRoot, '06-sad-pay-calculator.js'), 'utf8'), sandbox);

test('MHA selection returns the same BAH rate as a ZIP mapped to that MHA', () => {
  const rates = vm.runInContext(`(() => {
    const zip = Object.keys(PAY_RATE_DB.zipToMhaIdx)[0];
    const mhaIndex = PAY_RATE_DB.zipToMhaIdx[zip];
    const mhaName = PAY_RATE_DB.mhaNames[mhaIndex];
    const profile = {
      grade: 'E-4',
      yosKey: 'over6',
      depStatus: 'withoutDep',
      bahEntitled: true,
      basEntitled: false,
      roleName: ''
    };
    const byZip = lookupDailySadRates({ ...profile, locationType: 'zip', zipCode: zip });
    const byMha = lookupDailySadRates({ ...profile, locationType: 'mha', mhaName });
    return { zip, mhaName, byZip, byMha };
  })()`, sandbox);

  assert.ok(rates.zip);
  assert.ok(rates.mhaName);
  assert.equal(rates.byZip.zipMatched, true);
  assert.equal(rates.byMha.zipMatched, true);
  assert.equal(rates.byMha.mhaName, rates.mhaName);
  assert.equal(rates.byMha.monthlyBahOnlyRate, rates.byZip.monthlyBahOnlyRate);
});

test('MHA choice persists while existing ZIP profiles continue defaulting to ZIP', () => {
  const stored = vm.runInContext(`(() => {
    const legacy = getPayProfile();
    savePayProfile({
      grade: 'E-5',
      yosKey: 'over8',
      locationType: 'mha',
      zipCode: '11228',
      mhaName: PAY_RATE_DB.mhaNames[0],
      depStatus: 'withDep',
      bahEntitled: true,
      basEntitled: false,
      roleName: 'C2'
    });
    return { legacy, restored: getPayProfile() };
  })()`, sandbox);

  assert.equal(stored.legacy.locationType, 'zip');
  assert.equal(stored.restored.locationType, 'mha');
  assert.equal(stored.restored.zipCode, '11228');
  assert.equal(stored.restored.mhaName, sandbox.PAY_RATE_DB?.mhaNames?.[0] || vm.runInContext('PAY_RATE_DB.mhaNames[0]', sandbox));
});

test('unknown MHA does not accidentally use a saved ZIP for BAH', () => {
  const rates = vm.runInContext(`lookupDailySadRates({
    grade: 'E-4',
    yosKey: 'over6',
    locationType: 'mha',
    zipCode: Object.keys(PAY_RATE_DB.zipToMhaIdx)[0],
    mhaName: 'not an MHA',
    depStatus: 'withoutDep',
    bahEntitled: true,
    basEntitled: false,
    roleName: ''
  })`, sandbox);

  assert.equal(rates.zipMatched, false);
  assert.equal(rates.monthlyBahOnlyRate, 0);
});
