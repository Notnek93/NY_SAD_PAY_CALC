const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'source', '03-calendar-holidays-storage.js'), 'utf8');
const start = source.indexOf("const BACKUP_FORMAT");
const buildStart = source.indexOf('function parseBackupJson');
const end = source.indexOf('async function exportBackup');
const context = vm.createContext({});
vm.runInContext(source.slice(start, source.indexOf('\n', start)) + '\n' + source.slice(buildStart, end), context);

const parse = value => vm.runInContext(`parseBackupJson(${JSON.stringify(JSON.stringify(value))})`, context);
const row = () => new Array(14).fill('shift');
const valid = () => ({ format: 'ny-sad-planner-backup', version: 1, state: { userSelections: [row(), row()], smName: 'A' }, payProfile: { zip: '12345' } });

test('a planner backup is read back with its schedule and pay profile', () => {
  const result = parse(valid());
  assert.equal(result.state.userSelections.length, 2);
  assert.equal(result.payProfile.zip, '12345');
});

test('a backup without a pay profile is accepted', () => {
  const backup = valid();
  backup.payProfile = null;
  assert.equal(parse(backup).payProfile, null);
});

test('files that are not planner backups are rejected', () => {
  assert.throws(() => vm.runInContext('parseBackupJson("not json")', context), /not a planner backup/);
  assert.throws(() => parse({ format: 'something-else', state: {} }), /not a planner backup/);
});

test('a backup with a broken schedule is rejected', () => {
  const noRows = valid();
  noRows.state.userSelections = [];
  assert.throws(() => parse(noRows), /no usable schedule/);
  const shortRow = valid();
  shortRow.state.userSelections = [['shift', 'rdo']];
  assert.throws(() => parse(shortRow), /no usable schedule/);
});
