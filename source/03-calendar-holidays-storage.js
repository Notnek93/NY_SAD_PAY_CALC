<!-- 03-calendar-holidays-storage.js -->

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
const DAY_NAMES = ['THU', 'FRI', 'SAT', 'SUN', 'MON', 'TUE', 'WED'];

/* ====================================================================================
   [EDIT-CALENDAR] PAYROLL CALENDAR ANCHOR DATES
   ==================================================================================== */
const ANCHOR_DATE = new Date(2026, 2, 26);
const FIRST_PP_OFFSET = -16;
const INITIAL_LAST_PP_OFFSET = 52;

let currentViewMode = window.innerWidth <= 768 ? 'mobile' : 'desktop';
let activePayPeriodCount = 1;
let previousStartPpIdx = 0;

/* Unified Inline Status Picker State (Desktop & Phone) */
let activePicker = { open: false, s: -1, d: -1 };

/* Smart Print Guard Pending Action ('pdf' | 'download' | null) */
let pendingExportAction = null;

/* ====================================================================================
   [EDIT-STATUS-CODES] DUTY STATUS DEFINITIONS
   ==================================================================================== */
const BASE_STATUS_OPTIONS = [
  { id: 'shift',      name: 'Present (On Shift)',            shortName: 'SHFT', leaveQual: true,  rdoQual: true,  paidSad: true,  color: '#ffffff', textCol: '#202124', border: '#dadce0' },
  { id: 'rdo',        name: 'Pass (RDO)',                 shortName: 'RDO',  leaveQual: false, rdoQual: false, paidSad: true,  color: '#e6f4ea', textCol: '#137333', border: '#ceead6' },
  { id: 'lv',         name: 'SAD Leave',           shortName: 'LV',   leaveQual: true,  rdoQual: true,  paidSad: true,  color: '#e8f0fe', textCol: '#1a73e8', border: '#d2e3fc' },
  { id: 'refrad_rpt', name: 'REFRAD Report Date',  shortName: 'RFRD', leaveQual: true,  rdoQual: true,  paidSad: true,  color: '#ede7f6', textCol: '#4527a0', border: '#b39ddb' },
  { id: 'trv',        name: 'In-Transit (Travel)', shortName: 'TRV',  leaveQual: true,  rdoQual: false, paidSad: true,  color: '#e1f5fe', textCol: '#0277bd', border: '#b3e5fc' },
  { id: 'drl',        name: 'TDY (Drill)',                 shortName: 'TDY',  leaveQual: false, rdoQual: false, paidSad: false, color: '#fffde7', textCol: '#f57f17', border: '#fff9c4' },
  { id: 'incap',      name: 'INCAP Pay',           shortName: 'INCP', leaveQual: false, rdoQual: false, paidSad: false, color: '#fce8e6', textCol: '#c5221f', border: '#f5c2c0' }
];

const AUTO_TERMINAL_META = { id: 'term_lv', name: 'Terminal Leave', shortName: 'TERM', leaveQual: false, rdoQual: false, paidSad: true, color: '#f3e5f5', textCol: '#6a1b9a', border: '#ce93d8' };
const AUTO_OFF_MISSION_META = { id: 'off_mission', name: 'Post-REFRAD (Off)', shortName: 'OFF', leaveQual: false, rdoQual: false, paidSad: false, color: '#eceff1', textCol: '#78909c', border: '#cfd8dc' };

let STATUS_OPTIONS = [...BASE_STATUS_OPTIONS];
let payPeriods = [];
let userSelections = [new Array(14).fill('shift')];
let effectiveSelections = [new Array(14).fill('shift')];

let activeRdoPreset = 'fri_sun';
let oconusBlockFlags = {};

const generatedHolidayYears = new Set();
const HOLIDAY_RULES = [];
const DATE_BADGE_MAP = {};

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
   [EDIT-SOP-MODAL] SOP MODAL NAVIGATION (AUTO-DETECTS PHONE VS DESKTOP)
   ==================================================================================== */
function openSopModal(tabKey) {
  const backdrop = document.getElementById('sopModalBackdrop');
  if (!backdrop) return;
  backdrop.classList.add('open');
  const defaultTab = currentViewMode === 'mobile' ? 'phone' : 'desktop';
  switchSopTab(tabKey || defaultTab);
}

function closeSopModal() {
  const backdrop = document.getElementById('sopModalBackdrop');
  if (backdrop) backdrop.classList.remove('open');
  const upgradeBanner = document.getElementById('sopUpgradeBanner');
  if (upgradeBanner) upgradeBanner.style.display = 'none';
}

function switchSopTab(tabKey) {
  ['phone', 'desktop', 'rules', 'export'].forEach(k => {
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
function saveStateToLocalStorage() {
  try {
    const payload = {
      viewMode: currentViewMode,
      startPpIdx: parseInt(document.getElementById('ppSelect').value, 10) || 0,
      activePayPeriodCount,
      startingLeave: document.getElementById('startingLeaveInput').value,
      schedType: document.getElementById('schedSelect').value,
      smName: document.getElementById('smNameInput').value,
      smRole: document.getElementById('smRoleInput').value,
      smFacility: document.getElementById('smFacilityInput').value,
      smLeader: document.getElementById('smLeaderInput').value,
      activeRdoPreset,
      userSelections: userSelections.slice(0, activePayPeriodCount),
      oconusBlockFlags
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const badge = document.getElementById('saveStatusBadge');
    if (badge) {
      badge.textContent = '✓ Auto-Saved';
      badge.style.opacity = '1';
    }
  } catch (e) {
    console.warn('Auto-save skipped:', e);
  }
}

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
    if (data.activeRdoPreset) activeRdoPreset = data.activeRdoPreset;
    if (Array.isArray(data.userSelections) && data.userSelections.length > 0) {
      userSelections = data.userSelections.map(row => Array.isArray(row) && row.length === 14 ? row : new Array(14).fill('shift'));
    }
    ensureSlotCapacity(activePayPeriodCount);
    if (data.oconusBlockFlags && typeof data.oconusBlockFlags === 'object') {
      oconusBlockFlags = data.oconusBlockFlags;
    }
    return { restored: true, migratedFromV5 };
  } catch (e) {
    return { restored: false, migratedFromV5: false };
  }
}

function clearSavedLocalStorage() {
  if (!confirm('Clear all saved schedule data and re-open the setup wizard?')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(`${STORAGE_KEY}_PAY_PROFILE`);
  document.getElementById('smNameInput').value = '';
  document.getElementById('smRoleInput').value = '';
  document.getElementById('smFacilityInput').value = '';
  document.getElementById('smLeaderInput').value = '';
  document.getElementById('startingLeaveInput').value = '';
  document.getElementById('schedSelect').value = 'alt';
  activeRdoPreset = 'fri_sun';
  activePayPeriodCount = 1;
  closeInlineStatusPicker();
  closeRangeBuilderModal();
  closeSettingsModal();
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

  if (qpName) qpName.textContent = smName || 'Not Set';
  if (qpSched) qpSched.textContent = schedType === 'alt' ? '4/3 (6 RDOs)' : '5/2 (4 RDOs)';
  if (qpRdo) qpRdo.textContent = getRdoPresetLabel(schedType, activeRdoPreset);
  if (qpLeave) qpLeave.textContent = `${(Number.isNaN(startLeave) ? 0 : startLeave).toFixed(2)}d`;
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