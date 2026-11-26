// 03-calendar-holidays-storage.js

/* Maintainer map:
 * Edit policy switches, storage keys/migration, calendar anchors, status options,
 * and holiday rules in their [EDIT-*] sections below. Status meanings belong here;
 * leave/pay calculations are in source\05-policy-leave-engine.js and source\06-sad-pay-calculator.js.
 */

/* ====================================================================================
   [EDIT-POLICY-SWITCHES] MASTER ON/OFF SWITCHES FOR RESCINDED 22 OCT 2026 POLICY RULES
   ==================================================================================== */
const ENABLE_EARNED_RDO_SYSTEM = false;
const RDO_EARNED_STRICTLY_ON_SHIFT_ONLY = true;
const PROHIBIT_LEAVE_TOUCHING_RDO = false;
const ENFORCE_BOOKEND_RULE = false;

/* ====================================================================================
   [EDIT-STORAGE] LOCALSTORAGE KEY & ONE-TIME V5 -> V6 MIGRATION
   ==================================================================================== */
const STORAGE_KEY = 'JTF_SENTINEL_DOCCS_PLANNER_V6';
const LEGACY_STORAGE_KEY = 'JTF_SENTINEL_DOCCS_PLANNER_V5';
const LEAVE_FORM_OFFERED_KEY = `${STORAGE_KEY}_LEAVE_FORM_OFFERED`;
const DAY_NAMES = ['THU', 'FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED'];

/* ====================================================================================
   [EDIT-CALENDAR] PAYROLL CALENDAR ANCHOR DATES
   ==================================================================================== */
const ANCHOR_DATE = new Date(2026, 2, 26);
const FIRST_PP_OFFSET = -16;
const INITIAL_LAST_PP_OFFSET = 52;

let currentViewMode = window.innerWidth <= 768 ? 'mobile' : 'desktop';
let colorThemePreference = 'system';
let activePayPeriodCount = 1;
let previousStartPpIdx = 0;
let mobileVisiblePayPeriodSlot = 0;
let transferRoleBase = '';
let transferEvents = [];

function applyColorTheme() {
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDarkTheme = colorThemePreference === 'dark' || (colorThemePreference === 'system' && systemPrefersDark);
  document.documentElement.dataset.theme = useDarkTheme ? 'dark' : 'light';
  document.documentElement.style.colorScheme = useDarkTheme ? 'dark' : 'light';
}

function setColorThemePreference(preference) {
  if (!['system', 'light', 'dark'].includes(preference)) return;
  colorThemePreference = preference;
  applyColorTheme();
  const wizardSelect = document.getElementById('wizThemeSelect');
  const settingsSelect = document.getElementById('settingsThemeSelect');
  if (wizardSelect) wizardSelect.value = preference;
  if (settingsSelect) settingsSelect.value = preference;
  saveStateToLocalStorage();
}

const systemColorScheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
if (systemColorScheme) {
  const onSystemColorSchemeChange = () => {
    if (colorThemePreference === 'system') applyColorTheme();
  };
  if (typeof systemColorScheme.addEventListener === 'function') {
    systemColorScheme.addEventListener('change', onSystemColorSchemeChange);
  } else if (typeof systemColorScheme.addListener === 'function') {
    systemColorScheme.addListener(onSystemColorSchemeChange);
  }
}
applyColorTheme();

/* Unified Inline Status Picker State (Desktop & Phone) */
let activePicker = { open: false, s: -1, d: -1 };

/* Smart Print Guard Pending Action ('pdf' | 'download' | null) */
let pendingExportAction = null;

/* ====================================================================================
   [EDIT-STATUS-CODES] DUTY STATUS DEFINITIONS
   ==================================================================================== */
const BASE_STATUS_OPTIONS = [
  { id: 'shift',      name: 'Present (On Shift)',            shortName: 'SHFT', leaveQual: true,  rdoQual: true,  paidSad: true,  color: 'var(--surface)', textCol: 'var(--text-main)', border: 'var(--border)' },
  { id: 'transfer',   name: 'Transfer Day',                  shortName: 'XFER', leaveQual: true,  rdoQual: true,  paidSad: true,  color: '#f3e5f5', textCol: '#7b1fa2', border: '#e1bee7' },
  { id: 'rdo',        name: 'Regular Day Off (RDO)',      shortName: 'RDO',  leaveQual: false, rdoQual: false, paidSad: true,  color: 'var(--status-rdo-bg)', textCol: 'var(--status-rdo-text)', border: 'var(--status-rdo-border)' },
  { id: 'lv',         name: 'SAD Leave',           shortName: 'LV',   leaveQual: true,  rdoQual: true,  paidSad: true,  color: 'var(--status-leave-bg)', textCol: 'var(--status-leave-text)', border: 'var(--status-leave-border)' },
  { id: 'refrad_rpt', name: 'REFRAD Report Date',  shortName: 'RFRD', leaveQual: true,  rdoQual: true,  paidSad: true,  color: 'var(--status-refrad-bg)', textCol: 'var(--status-refrad-text)', border: 'var(--status-refrad-border)', isToolOnly: true },
  { id: 'trv',        name: 'In-Transit (Travel)', shortName: 'TRV',  leaveQual: true,  rdoQual: false, paidSad: true,  color: 'var(--status-transit-bg)', textCol: 'var(--status-transit-text)', border: 'var(--status-transit-border)' },
  { id: 'drl',        name: 'TDY / Drill',                shortName: 'TDY',  leaveQual: false, rdoQual: false, paidSad: false, color: 'var(--status-drill-bg)', textCol: 'var(--status-drill-text)', border: 'var(--status-drill-border)' },
  { id: 'incap',      name: 'INCAP Pay',           shortName: 'INCP', leaveQual: false, rdoQual: false, paidSad: false, color: 'var(--status-incap-bg)', textCol: 'var(--status-incap-text)', border: 'var(--status-incap-border)' }
];

const AUTO_TERMINAL_META = { id: 'term_lv', name: 'Terminal Leave', shortName: 'TERM', leaveQual: false, rdoQual: false, paidSad: true, color: 'var(--status-terminal-bg)', textCol: 'var(--status-terminal-text)', border: 'var(--status-terminal-border)' };
const AUTO_OFF_MISSION_META = { id: 'off_mission', name: 'Post-REFRAD (Off)', shortName: 'OFF', leaveQual: false, rdoQual: false, paidSad: false, color: 'var(--status-off-bg)', textCol: 'var(--status-off-text)', border: 'var(--status-off-border)' };

let STATUS_OPTIONS = [...BASE_STATUS_OPTIONS];
let payPeriods = [];
let userSelections = [new Array(14).fill('shift')];
let effectiveSelections = [new Array(14).fill('shift')];

let activeRdoPreset = 'fri_sun';
let hasAppliedRdoPreset = false;
let oconusBlockFlags = {};
let refradPlanMode = '';
let refradPlanDate = '';
let refradScheduleSnapshot = null;
let REFRAD_BACKFILL_DAYS_NEEDED = 0;
let REFRAD_BACKFILL_DAYS_APPLIED = 0;
let REFRAD_BACKFILL_LEAVE_REMAINING = 0;

const generatedHolidayYears = new Set();
const HOLIDAY_RULES = [];
const DATE_BADGE_MAP = {};

function cloneRefradScheduleSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    startPpIdx: snapshot.startPpIdx,
    previousStartPpIdx: snapshot.previousStartPpIdx,
    activePayPeriodCount: snapshot.activePayPeriodCount,
    userSelections: snapshot.userSelections.map(row => [...row]),
    transferRoleBase: snapshot.transferRoleBase || '',
    transferEvents: Array.isArray(snapshot.transferEvents)
      ? snapshot.transferEvents.map(event => ({ ...event }))
      : []
  };
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIsoDateLocal(isoStr) {
  const parts = (isoStr || '').split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(day)) return null;
  return new Date(y, m, day);
}

function formatShortDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDays(date, days) {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

function getDayLabel(pp, idx) {
  const d = addDays(pp.start, idx);
  return `D${idx + 1} (${DAY_NAMES[idx % 7]}, ${formatShortDate(d)})`;
}

function getNthWeekdayOfMonth(year, monthZeroIndexed, weekday, n) {
  const firstDay = new Date(year, monthZeroIndexed, 1);
  const offset = (weekday - firstDay.getDay() + 7) % 7;
  return new Date(year, monthZeroIndexed, 1 + offset + (n - 1) * 7);
}

function getLastWeekdayOfMonth(year, monthZeroIndexed, weekday) {
  const lastDay = new Date(year, monthZeroIndexed + 1, 0);
  const offset = (lastDay.getDay() - weekday + 7) % 7;
  return new Date(year, monthZeroIndexed, lastDay.getDate() - offset);
}

/* ====================================================================================
   [EDIT-SOP-MODAL] HOW-TO GUIDE TAB NAVIGATION
   ==================================================================================== */
function openSopModal(tabKey) {
  const backdrop = document.getElementById('sopModalBackdrop');
  if (!backdrop) return;
  backdrop.classList.add('open');
  switchSopTab(tabKey || 'start');
}

function closeSopModal() {
  const backdrop = document.getElementById('sopModalBackdrop');
  if (backdrop) backdrop.classList.remove('open');
  const upgradeBanner = document.getElementById('sopUpgradeBanner');
  if (upgradeBanner) upgradeBanner.style.display = 'none';
}

function switchSopTab(tabKey) {
  ['start', 'leave', 'refrad', 'save'].forEach(k => {
    const btn = document.getElementById(`sopTabBtn_${k}`);
    const panel = document.getElementById(`sopPanel_${k}`);
    if (btn) btn.classList.toggle('active', k === tabKey);
    if (panel) panel.classList.toggle('active', k === tabKey);
  });
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeSopModal();
    closeSettingsModal();
    closeRefradPlanner();
    closeRangeBuilderModal();
    closeInlineStatusPicker();
    closeSpConflictModal();
  }
});

/* ====================================================================================
   [EDIT-HOLIDAYS] HOLIDAY GENERATOR & WEEKEND OBSERVANCE RULES
   ==================================================================================== */
function ensureHolidaysForYear(year) {
  if (generatedHolidayYears.has(year)) return;
  generatedHolidayYears.add(year);

  function addFixedHoliday(name, monthZeroIndexed, dayOfMonth) {
    const actualDate = new Date(year, monthZeroIndexed, dayOfMonth);
    const dow = actualDate.getDay();
    const actualIso = toIsoDate(actualDate);

    if (dow === 6) {
      const friDate = addDays(actualDate, -1);
      const friIso = toIsoDate(friDate);
      HOLIDAY_RULES.push({ name: `${name} (${year})`, baseName: name, type: 'sat_holiday', dates: [friIso, actualIso], day1Date: friIso, day2Date: actualIso, holidayDate: friDate });
      DATE_BADGE_MAP[friIso] = { label: 'HOL (OBS)', desc: `${name} (Observed Fri/Sat)`, isWeekendPair: true };
      DATE_BADGE_MAP[actualIso] = { label: 'HOLIDAY', desc: `${name} (Fri/Sat)`, isWeekendPair: true };
    } else if (dow === 0) {
      const monDate = addDays(actualDate, 1);
      const monIso = toIsoDate(monDate);
      HOLIDAY_RULES.push({ name: `${name} (${year})`, baseName: name, type: 'sun_holiday', dates: [actualIso, monIso], day1Date: actualIso, day2Date: monIso, holidayDate: actualDate });
      DATE_BADGE_MAP[actualIso] = { label: 'HOLIDAY', desc: `${name} (Sun/Mon)`, isWeekendPair: true };
      DATE_BADGE_MAP[monIso] = { label: 'HOL (OBS)', desc: `${name} (Observed Sun/Mon)`, isWeekendPair: true };
    } else {
      HOLIDAY_RULES.push({ name: `${name} (${year})`, baseName: name, type: 'weekday', dates: [actualIso], holidayDate: actualDate });
      DATE_BADGE_MAP[actualIso] = { label: 'HOLIDAY', desc: name, isWeekendPair: false };
    }
  }

  function addFloatingHoliday(name, dateObj) {
    const iso = toIsoDate(dateObj);
    HOLIDAY_RULES.push({ name: `${name} (${year})`, baseName: name, type: 'weekday', dates: [iso], holidayDate: dateObj });
    DATE_BADGE_MAP[iso] = { label: 'HOLIDAY', desc: name, isWeekendPair: false };
  }

  addFixedHoliday("New Year's Day", 0, 1);
  addFloatingHoliday("MLK Jr. Day", getNthWeekdayOfMonth(year, 0, 1, 3));
  addFloatingHoliday("President's Day", getNthWeekdayOfMonth(year, 1, 1, 3));
  addFloatingHoliday("Memorial Day", getLastWeekdayOfMonth(year, 4, 1));
  addFixedHoliday("Juneteenth", 5, 19);
  addFixedHoliday("Independence Day", 6, 4);
  addFloatingHoliday("Labor Day", getNthWeekdayOfMonth(year, 8, 1, 1));
  addFloatingHoliday("Columbus Day", getNthWeekdayOfMonth(year, 9, 1, 2));
  addFixedHoliday("Veterans Day", 10, 11);
  addFloatingHoliday("Thanksgiving Day", getNthWeekdayOfMonth(year, 10, 4, 4));
  addFixedHoliday("Christmas Day", 11, 25);
}

function getLatestAllowedPayPeriodIndex() {
  const todayEndOfDay = new Date();
  todayEndOfDay.setHours(23, 59, 59, 999);
  let latestIdx = 0;
  for (let i = 0; i < payPeriods.length; i++) {
    if (payPeriods[i].start <= todayEndOfDay) {
      latestIdx = i;
    }
  }
  return latestIdx;
}

function ensurePayPeriodIndex(targetIdx) {
  const select = document.getElementById('ppSelect');
  const now = new Date();
  const todayEndOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  while (payPeriods.length <= targetIdx) {
    const idx = payPeriods.length;
    const offset = FIRST_PP_OFFSET + idx;
    const start = addDays(ANCHOR_DATE, offset * 14);
    const end = addDays(start, 13);

    ensureHolidaysForYear(start.getFullYear() - 1);
    ensureHolidaysForYear(start.getFullYear());
    ensureHolidaysForYear(end.getFullYear());

    const ppNum = ((offset % 26) + 26) % 26 + 1;
    const isCurrent = now >= start && now < addDays(end, 1);
    const isAllowedStart = start <= todayEndOfDay;
    payPeriods.push({ ppNum, start, end, index: idx, isCurrent, isAllowedStart });

    if (select && isAllowedStart) {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `PP ${String(ppNum).padStart(2, '0')}: ${formatShortDate(start)} – ${formatFullDate(end)}${isCurrent ? ' (Current Pay Period)' : ''}`;
      select.appendChild(opt);
    }
  }
}

function ensureSlotCapacity(slotCount) {
  while (userSelections.length < slotCount) {
    userSelections.push(new Array(14).fill('shift'));
  }
  while (effectiveSelections.length < slotCount) {
    effectiveSelections.push(new Array(14).fill('shift'));
  }
}

function initPayPeriods() {
  const select = document.getElementById('ppSelect');
  if (select) select.innerHTML = '';
  payPeriods = [];

  const initialCount = INITIAL_LAST_PP_OFFSET - FIRST_PP_OFFSET + 1;
  ensurePayPeriodIndex(initialCount - 1);

  let activeIndex = getLatestAllowedPayPeriodIndex();
  for (let idx = 0; idx < payPeriods.length; idx++) {
    if (payPeriods[idx].isCurrent && payPeriods[idx].isAllowedStart) {
      activeIndex = idx;
    }
  }

  if (select) select.value = activeIndex;
  previousStartPpIdx = activeIndex;
}

/* ====================================================================================
   [EDIT-SP-EXPIRY] SPECIAL PASS EXPIRATION WINDOW (DEFAULT: 3 PAY PERIODS)
   ==================================================================================== */
function getHolidayExpirationDate(holDate) {
  const diffDays = Math.floor((holDate.getTime() - payPeriods[0].start.getTime()) / 86400000);
  const holPpIndex = Math.floor(diffDays / 14);
  if (holPpIndex >= 0) {
    ensurePayPeriodIndex(holPpIndex + 3);
    return payPeriods[holPpIndex + 3].end;
  }
  const ppStart = addDays(payPeriods[0].start, holPpIndex * 14);
  return addDays(ppStart, 3 * 14 + 13);
}

function updateDynamicSpecialPassPalette() {
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  ensurePayPeriodIndex(startPpIdx + activePayPeriodCount + 3);
  const firstPp = payPeriods[startPpIdx];
  const activeEndPp = payPeriods[startPpIdx + activePayPeriodCount - 1];
  if (!firstPp || !activeEndPp) return;

  STATUS_OPTIONS = [...BASE_STATUS_OPTIONS];

  HOLIDAY_RULES.forEach(h => {
    const holDate = h.holidayDate;
    const expirationDate = getHolidayExpirationDate(holDate);

    if (activeEndPp.end >= holDate && firstPp.start <= expirationDate) {
      STATUS_OPTIONS.push({
        id: `sp_${toIsoDate(holDate)}`,
        name: `SP: ${h.baseName} (${formatShortDate(holDate)})`,
        shortName: 'SP',
        leaveQual: true,
        rdoQual: false,
        paidSad: true,
        color: '#f3e5f5',
        textCol: '#7b1fa2',
        border: '#e1bee7',
        isSpecialPass: true,
        holidayName: h.baseName,
        holidayDate: holDate,
        expirationDate: expirationDate
      });
    }
  });
}

function getStatusMeta(statusId) {
  if (statusId === 'term_lv') return AUTO_TERMINAL_META;
  if (statusId === 'off_mission') return AUTO_OFF_MISSION_META;
  const found = STATUS_OPTIONS.find(st => st.id === statusId);
  if (found) return found;

  if (statusId && statusId.startsWith('sp_')) {
    const iso = statusId.substring(3);
    const rule = HOLIDAY_RULES.find(r => toIsoDate(r.holidayDate) === iso);
    if (rule) {
      const holDate = rule.holidayDate;
      const expirationDate = getHolidayExpirationDate(holDate);
      return {
        id: statusId,
        name: `SP: ${rule.baseName} (${formatShortDate(holDate)})`,
        shortName: 'SP',
        leaveQual: true,
        rdoQual: false,
        paidSad: true,
        color: '#f3e5f5',
        textCol: '#7b1fa2',
        border: '#e1bee7',
        isSpecialPass: true,
        holidayName: rule.baseName,
        holidayDate: holDate,
        expirationDate: expirationDate
      };
    }
  }
  return { name: statusId, shortName: '?', color: '#f1f3f4', textCol: '#5f6368', border: '#dadce0', rdoQual: false, leaveQual: false, isSpecialPass: false };
}

/* ====================================================================================
   LOCALSTORAGE PERSISTENCE, V5 -> V6 MIGRATION & QUICK PROFILE STRIP
   ==================================================================================== */
let SAVE_STATE_TIMER = null;

function saveStateToLocalStorageNow() {
  try {
    const payload = {
      viewMode: currentViewMode,
      colorThemePreference,
      startPpIdx: parseInt(document.getElementById('ppSelect').value, 10) || 0,
      activePayPeriodCount,
      startingLeave: document.getElementById('startingLeaveInput').value,
      schedType: document.getElementById('schedSelect').value,
      smName: document.getElementById('smNameInput').value,
      smRole: document.getElementById('smRoleInput').value,
      smFacility: document.getElementById('smFacilityInput').value,
      smLeader: document.getElementById('smLeaderInput').value,
      activeRdoPreset,
      refradPlanMode,
      refradPlanDate,
      refradScheduleSnapshot: cloneRefradScheduleSnapshot(refradScheduleSnapshot),
      transferRoleBase,
      transferEvents: transferEvents.map(event => ({ ...event })),
      userSelections: userSelections.slice(0, activePayPeriodCount),
      oconusBlockFlags
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSaveStatusBadge('✓ Saved on this device', false);
  } catch (e) {
    setSaveStatusBadge('⚠ Not saved — changes may be lost', true);
    console.warn('Auto-save skipped:', e);
  }
}

function setSaveStatusBadge(message, hasError) {
  const badge = document.getElementById('saveStatusBadge');
  if (!badge) return;
  badge.textContent = message;
  badge.classList.toggle('save-badge-error', Boolean(hasError));
}

function saveStateToLocalStorage() {
  setSaveStatusBadge('Saving…', false);
  if (SAVE_STATE_TIMER !== null) window.clearTimeout(SAVE_STATE_TIMER);
  SAVE_STATE_TIMER = window.setTimeout(() => {
    SAVE_STATE_TIMER = null;
    saveStateToLocalStorageNow();
  }, 250);
}

window.addEventListener('pagehide', () => {
  if (SAVE_STATE_TIMER !== null) {
    window.clearTimeout(SAVE_STATE_TIMER);
    SAVE_STATE_TIMER = null;
    saveStateToLocalStorageNow();
  }
});

function loadStateFromLocalStorage() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    let migratedFromV5 = false;

    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyRaw) return { restored: false, migratedFromV5: false };
      raw = legacyRaw;
      migratedFromV5 = true;
    }

    const data = JSON.parse(raw);

    if (data.viewMode === 'desktop' || data.viewMode === 'mobile') {
      currentViewMode = data.viewMode;
    }
    if (['system', 'light', 'dark'].includes(data.colorThemePreference)) {
      colorThemePreference = data.colorThemePreference;
    }
    applyColorTheme();
    const latestAllowedIdx = getLatestAllowedPayPeriodIndex();
    if (typeof data.startPpIdx === 'number' && data.startPpIdx >= 0) {
      ensurePayPeriodIndex(data.startPpIdx);
      const clampedStartIdx = Math.min(data.startPpIdx, latestAllowedIdx);
      document.getElementById('ppSelect').value = clampedStartIdx;
      previousStartPpIdx = clampedStartIdx;
    }
    if (typeof data.activePayPeriodCount === 'number' && data.activePayPeriodCount >= 1) {
      activePayPeriodCount = data.activePayPeriodCount;
      ensurePayPeriodIndex(previousStartPpIdx + activePayPeriodCount + 3);
    }
    if (data.startingLeave !== undefined) document.getElementById('startingLeaveInput').value = data.startingLeave;
    if (data.schedType) document.getElementById('schedSelect').value = data.schedType;
    if (data.smName !== undefined) document.getElementById('smNameInput').value = data.smName;
    if (data.smRole !== undefined) document.getElementById('smRoleInput').value = data.smRole;
    if (data.smFacility !== undefined) document.getElementById('smFacilityInput').value = data.smFacility;
    if (data.smLeader !== undefined) document.getElementById('smLeaderInput').value = data.smLeader;
    transferRoleBase = normalizeRoleName(data.transferRoleBase);
    transferEvents = Array.isArray(data.transferEvents)
      ? data.transferEvents.filter(event =>
          event &&
          /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
          ROLE_PP_INCENTIVE_BONUS[normalizeRoleName(event.roleName)] !== undefined
        ).map(event => ({ date: event.date, roleName: normalizeRoleName(event.roleName) }))
        .sort((a, b) => a.date.localeCompare(b.date))
      : [];
    if (data.activeRdoPreset) {
      activeRdoPreset = data.activeRdoPreset;
      hasAppliedRdoPreset = true;
    }
    if (Array.isArray(data.userSelections) && data.userSelections.length > 0) {
      userSelections = data.userSelections.map(row => Array.isArray(row) && row.length === 14 ? row : new Array(14).fill('shift'));
    }
    const hasRefradMarker = userSelections.some(row => row.includes('refrad_rpt'));
    refradPlanMode = hasRefradMarker
      ? (data.refradPlanMode === 'mission_end' ? 'mission_end' : 'report_date')
      : '';
    refradPlanDate = hasRefradMarker && typeof data.refradPlanDate === 'string'
      ? data.refradPlanDate
      : '';
    const savedSchedule = data.refradScheduleSnapshot;
    const savedRows = savedSchedule && savedSchedule.userSelections;
    const validSavedSchedule = hasRefradMarker &&
      savedSchedule &&
      Number.isInteger(savedSchedule.startPpIdx) && savedSchedule.startPpIdx >= 0 &&
      Number.isInteger(savedSchedule.previousStartPpIdx) && savedSchedule.previousStartPpIdx >= 0 &&
      Number.isInteger(savedSchedule.activePayPeriodCount) && savedSchedule.activePayPeriodCount >= 1 &&
      Array.isArray(savedRows) &&
      savedRows.length >= savedSchedule.activePayPeriodCount &&
      savedRows.slice(0, savedSchedule.activePayPeriodCount).every(row =>
        Array.isArray(row) && row.length === 14 && row.every(statusId => typeof statusId === 'string')
      );
    refradScheduleSnapshot = validSavedSchedule
      ? cloneRefradScheduleSnapshot({
          ...savedSchedule,
          userSelections: savedRows.slice(0, savedSchedule.activePayPeriodCount)
        })
      : null;
    if (hasRefradMarker && !refradPlanDate) {
      for (let s = 0; s < userSelections.length && !refradPlanDate; s++) {
        const d = userSelections[s].indexOf('refrad_rpt');
        const pp = payPeriods[previousStartPpIdx + s];
        if (d >= 0 && pp) refradPlanDate = toIsoDate(addDays(pp.start, d));
      }
    }
    let trimmedAfterRefrad = false;
    if (hasRefradMarker && refradPlanMode === 'mission_end' && refradPlanDate && typeof getRefradDateLocation === 'function') {
      const refradLocation = getRefradDateLocation(refradPlanDate);
      const refradSlot = refradLocation ? refradLocation.ppIdx - previousStartPpIdx : -1;
      if (refradSlot >= 0 && refradSlot + 1 < activePayPeriodCount) {
        activePayPeriodCount = refradSlot + 1;
        userSelections = userSelections.slice(0, activePayPeriodCount);
        effectiveSelections = effectiveSelections.slice(0, activePayPeriodCount);
        trimmedAfterRefrad = true;
      }
    }
    ensureSlotCapacity(activePayPeriodCount);
    if (data.oconusBlockFlags && typeof data.oconusBlockFlags === 'object') {
      oconusBlockFlags = data.oconusBlockFlags;
    }
    if (trimmedAfterRefrad) saveStateToLocalStorage();
    return { restored: true, migratedFromV5 };
  } catch (e) {
    return { restored: false, migratedFromV5: false };
  }
}

function clearSavedLocalStorage() {
  if (!confirm('Clear the saved schedule, pay profile, and report details from this device? This cannot be undone. Setup will restart.')) return;
  if (typeof clearLastDayStatusUndo === 'function') clearLastDayStatusUndo();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(`${STORAGE_KEY}_PAY_PROFILE`);
  localStorage.removeItem(LEAVE_FORM_OFFERED_KEY);
  colorThemePreference = 'system';
  applyColorTheme();
  document.getElementById('smNameInput').value = '';
  document.getElementById('smRoleInput').value = '';
  document.getElementById('smFacilityInput').value = '';
  document.getElementById('smLeaderInput').value = '';
  document.getElementById('startingLeaveInput').value = '';
  refradPlanMode = '';
  refradPlanDate = '';
  refradScheduleSnapshot = null;
  transferRoleBase = '';
  transferEvents = [];
  if (typeof updateRefradClearButton === 'function') updateRefradClearButton();
  document.getElementById('schedSelect').value = 'alt';
  activeRdoPreset = 'fri_sun';
  hasAppliedRdoPreset = false;
  activePayPeriodCount = 1;
  mobileVisiblePayPeriodSlot = 0;
  closeInlineStatusPicker();
  closeRangeBuilderModal();
  closeSettingsModal(true);
  closeSpConflictModal();
  userSelections = [new Array(14).fill('shift')];
  effectiveSelections = [new Array(14).fill('shift')];
  oconusBlockFlags = {};
  updatePresetDropdownOptions();
  if (typeof syncPaySettingsInputs === 'function') syncPaySettingsInputs();
  jumpToCurrentPayPeriod(true);
  openSetupWizard(false);
}

function updateQuickProfileStrip() {
  const smName = (document.getElementById('smNameInput').value || '').trim();
  const schedType = document.getElementById('schedSelect').value;
  const rawStartLeave = document.getElementById('startingLeaveInput').value;
  const startLeave = rawStartLeave === '' ? 0 : parseFloat(rawStartLeave);

  const qpName = document.getElementById('qpName');
  const qpSched = document.getElementById('qpSched');
  const qpRdo = document.getElementById('qpRdo');
  const qpLeave = document.getElementById('qpLeave');

  if (qpName) qpName.textContent = smName || 'Not entered';
  if (qpSched) qpSched.textContent = schedType === 'alt' ? '4/3 (6 RDOs)' : '5/2 (4 RDOs)';
  if (qpRdo) qpRdo.textContent = getRdoPresetLabel(schedType, activeRdoPreset);
  if (qpLeave) qpLeave.textContent = `${(Number.isNaN(startLeave) ? 0 : startLeave).toFixed(2)} days`;
}

function onUserMetadataInput() {
  if (typeof REQUIRED_EXPORT_FIELDS !== 'undefined' && Array.isArray(REQUIRED_EXPORT_FIELDS)) {
    REQUIRED_EXPORT_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      const fg = document.getElementById(`fg_${id}`);
      if (el && el.value.trim() !== '') {
        el.classList.remove('field-missing');
        if (fg) fg.classList.remove('has-missing');
      }
    });
  }
  updateQuickProfileStrip();
  if (typeof calculateAllPayPeriods === 'function') calculateAllPayPeriods();
  saveStateToLocalStorage();
}