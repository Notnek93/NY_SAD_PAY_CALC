// 04-schedule-wizard-grid.js

/* Maintainer map:
 * Edit RDO presets, wizard/settings interactions, planner controls, and REFRAD UI
 * behavior here. Markup IDs are in source\02-planner-ui.html; policy calculations
 * are in source\05-policy-leave-engine.js. Keep event-handler names and IDs in sync.
 */

/* ====================================================================================
   [EDIT-RDO-PRESETS] RDO PRESET DROPDOWN OPTIONS (4/3 AND 5/2)
   ==================================================================================== */
function getRdoPresetList(schedType) {
  return schedType === 'alt'
    ? [
        { val: 'thu_sat', text: 'Thu – Fri – Sat' },
        { val: 'fri_sun', text: 'Fri – Sat – Sun' },
        { val: 'sat_mon', text: 'Sat – Sun – Mon' },
        { val: 'sun_tue', text: 'Sun – Mon – Tue' },
        { val: 'mon_wed', text: 'Mon – Tue – Wed' },
        { val: 'tue_thu', text: 'Tue – Wed – Thu' },
        { val: 'wed_fri', text: 'Wed – Thu – Fri' }
      ]
    : [
        { val: 'thu_fri', text: 'Thu – Fri' },
        { val: 'fri_sat', text: 'Fri – Sat' },
        { val: 'sat_sun', text: 'Sat – Sun' },
        { val: 'sun_mon', text: 'Sun – Mon' },
        { val: 'mon_tue', text: 'Mon – Tue' },
        { val: 'tue_wed', text: 'Tue – Wed' },
        { val: 'wed_thu', text: 'Wed – Thu' }
      ];
}

function getRdoPresetLabel(schedType, presetKey) {
  const list = getRdoPresetList(schedType);
  const found = list.find(o => o.val === presetKey);
  return found ? found.text : (schedType === 'alt' ? 'Fri – Sat – Sun' : 'Sat – Sun');
}

function updatePresetDropdownOptions() {
  const schedType = document.getElementById('schedSelect').value;
  const presetSelect = document.getElementById('rdoPresetSelect');
  if (!presetSelect) return;
  presetSelect.innerHTML = '<option value="">Choose RDOs</option>';

  const presets = getRdoPresetList(schedType);
  presets.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.val;
    opt.textContent = o.text;
    presetSelect.appendChild(opt);
  });
  presetSelect.value = hasAppliedRdoPreset && presets.some(o => o.val === activeRdoPreset)
    ? activeRdoPreset
    : '';
}

function isSpecialPassAlreadyUsedBeforeSlot(spId, upToSlotIdx) {
  for (let p = 0; p < upToSlotIdx; p++) {
    for (let i = 0; i < 14; i++) {
      if (userSelections[p][i] === spId) return true;
    }
  }
  return false;
}

function autoApplySpecialPassOnHolidaysForSlot(slotIdx) {
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  ensurePayPeriodIndex(startPpIdx + slotIdx);
  const pp = payPeriods[startPpIdx + slotIdx];
  if (!pp) return;

  const isoToDayIdx = {};
  for (let i = 0; i < 14; i++) {
    isoToDayIdx[toIsoDate(addDays(pp.start, i))] = i;
  }

  HOLIDAY_RULES.forEach(h => {
    const spId = `sp_${toIsoDate(h.holidayDate)}`;
    if (isSpecialPassAlreadyUsedBeforeSlot(spId, slotIdx)) return;

    if (h.type === 'weekday') {
      const holIdx = isoToDayIdx[h.dates[0]];
      if (holIdx !== undefined && userSelections[slotIdx][holIdx] === 'rdo') {
        userSelections[slotIdx][holIdx] = spId;
      }
    } else if (h.type === 'sat_holiday' || h.type === 'sun_holiday') {
      const d1Idx = isoToDayIdx[h.day1Date];
      const d2Idx = isoToDayIdx[h.day2Date];
      if (d1Idx !== undefined && d2Idx !== undefined) {
        if (userSelections[slotIdx][d1Idx] === 'rdo' && userSelections[slotIdx][d2Idx] === 'rdo') {
          userSelections[slotIdx][d1Idx] = spId;
        }
      } else if (d1Idx !== undefined && userSelections[slotIdx][d1Idx] === 'rdo') {
        userSelections[slotIdx][d1Idx] = spId;
      } else if (d2Idx !== undefined && userSelections[slotIdx][d2Idx] === 'rdo') {
        userSelections[slotIdx][d2Idx] = spId;
      }
    }
  });
}

function applyRdoPresetForSlot(slotIdx, presetKey) {
  ensureSlotCapacity(slotIdx + 1);
  const schedType = document.getElementById('schedSelect').value;
  const blockSize = (schedType === 'alt') ? 3 : 2;
  const actualPreset = presetKey || (schedType === 'alt' ? 'fri_sun' : 'sat_sun');

  let w1Start = 1, w2Start = 8;
  switch (actualPreset) {
    case 'thu_sat': case 'thu_fri': w1Start = 0; w2Start = 7; break;
    case 'fri_sun': case 'fri_sat': w1Start = 1; w2Start = 8; break;
    case 'sat_mon': case 'sat_sun': w1Start = 2; w2Start = 9; break;
    case 'sun_tue': case 'sun_mon': w1Start = 3; w2Start = 10; break;
    case 'mon_wed': case 'mon_tue': w1Start = 4; w2Start = 11; break;
    case 'tue_thu': case 'tue_wed': w1Start = 5; w2Start = 12; break;
    case 'wed_fri': case 'wed_thu': w1Start = 6; w2Start = 13; break;
  }

  userSelections[slotIdx] = new Array(14).fill('shift');
  for (let k = 0; k < blockSize; k++) {
    userSelections[slotIdx][(w1Start + k) % 14] = 'rdo';
    userSelections[slotIdx][(w2Start + k) % 14] = 'rdo';
  }
  autoApplySpecialPassOnHolidaysForSlot(slotIdx);
}

function applyRdoPresetAll(presetKey) {
  clearLastDayStatusUndo();
  activeRdoPreset = presetKey || (document.getElementById('schedSelect').value === 'alt' ? 'fri_sun' : 'sat_sun');
  hasAppliedRdoPreset = true;
  ensureSlotCapacity(activePayPeriodCount);
  updateDynamicSpecialPassPalette();
  for (let s = 0; s < activePayPeriodCount; s++) {
    applyRdoPresetForSlot(s, activeRdoPreset);
  }
  const presetEl = document.getElementById('rdoPresetSelect');
  if (presetEl) presetEl.value = activeRdoPreset;
  updateQuickProfileStrip();
  buildAllPayPeriodGrids();
  saveStateToLocalStorage();
}

function applyDefaultPatternAll() {
  applyRdoPresetAll(document.getElementById('schedSelect').value === 'alt' ? 'fri_sun' : 'sat_sun');
}

function confirmApplyDefaultPatternAll() {
  if (!confirm('Reset the RDO pattern in every open pay period? Other date selections in those pay periods may be replaced.')) return;
  applyDefaultPatternAll();
  const menu = document.getElementById('headerMoreTools');
  if (menu) menu.open = false;
}

function openRangeBuilderFromMenu() {
  const menu = document.getElementById('headerMoreTools');
  if (menu) menu.open = false;
  openRangeBuilderModal();
}

/* ====================================================================================
   TASK FORCE ONBOARDING WIZARD (FIRST-TIME USERS & RE-RUN OPTION)
   ==================================================================================== */
const TASK_FORCE_STORAGE_KEY = 'JTF_SENTINEL_DOCCS_TASK_FORCE';
const WIZARD_SENTINEL_STEP_NAMES = [
  'Welcome',
  'Choose View',
  'Task Force',
  'Schedule & RDOs',
  'SAD Pay & Leave',
  'Pay Period',
  'How-To Offer'
];
const WIZARD_EMPIRE_STEP_NAMES = [
  'Welcome',
  'Choose View',
  'Task Force',
  'Work in Progress'
];
let wizardCurrentStep = 1;
let wizardSelectedView = currentViewMode;
let wizardSelectedTheme = colorThemePreference;
let wizardSelectedTaskForce = 'sentinel';
let wizardIsRerun = false;
let wizardInitialSnapshot = null;

function mapWizardRoleToTier(smRoleVal) {
  const role = String(smRoleVal || '').trim();
  if (role === 'C2') return 'c2';
  if (role === 'Facility Leadership' || role === 'General Purpose') return 'fac_gen';
  return 'none';
}

function getEntitlementStatusNote(info) {
  const excluded = [];
  if (info && info.bahEntitled === false) excluded.push('BAH: Not Entitled');
  if (info && info.basEntitled === false) excluded.push('BAS: Not Entitled');
  return excluded.length > 0 ? ` [${excluded.join(' · ')}]` : '';
}

function updateWizardPayZipMhaBadge(prof) {
  const badge = document.getElementById('wizPayZipMhaBadge');
  if (!badge || typeof lookupDailySadRates !== 'function' || typeof formatUsd !== 'function') return;
  const info = lookupDailySadRates(prof);
  const labels = info.labels || {
    base: 'Fee-DMNA (Base Pay)',
    adlCom: 'Adl Com (BAH + BAS)',
    incentive: 'Incentive Pay',
    estimateTag: 'Est. · Before Tax'
  };
  const incAmt = info.ppIncentiveBonus || 0;
  const incText = incAmt > 0
    ? ` + ${labels.incentive} ${formatUsd(incAmt)}/PP`
    : '';
  const entNote = getEntitlementStatusNote(info);

  if (!info.bahEntitled) {
    badge.style.color = 'var(--text-main)';
    badge.textContent = `${labels.base} ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom} ${formatUsd(info.dailyBahRate)}/d${incText} (${formatUsd(info.dailyTotalRate)}/d · ${labels.estimateTag})${entNote}`;
  } else if (!info.zipCode) {
    badge.style.color = 'var(--text-sub)';
    badge.textContent = `${labels.base}: ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom}: ${formatUsd(info.dailyBahRate)}/d${incText} — Enter 5-digit ZIP for BAH (${labels.estimateTag})${entNote}`;
  } else if (info.zipCode.length < 5) {
    badge.style.color = 'var(--text-sub)';
    badge.textContent = `${info.zipCode.length}/5 digits...${entNote}`;
  } else if (info.zipMatched) {
    badge.style.color = 'var(--success)';
    badge.textContent = `✓ ${info.mhaName} — ${labels.base} ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom} ${formatUsd(info.dailyBahRate)}/d${incText} (${formatUsd(info.dailyTotalRate)}/d · ${labels.estimateTag})${entNote}`;
  } else {
    badge.style.color = 'var(--danger)';
    badge.textContent = `⚠️ ZIP ${info.zipCode} not found (${labels.base} ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom} ${formatUsd(info.dailyBahRate)}/d${incText} · ${labels.estimateTag})${entNote}`;
  }
}

function onWizardPayChange() {
  const wizRoleEl = document.getElementById('wizSmRoleInput');
  const wizRoleVal = wizRoleEl ? wizRoleEl.value.trim() : '';
  if (wizRoleEl && wizRoleVal !== '') {
    wizRoleEl.classList.remove('field-missing');
  }

  const bahCheck = document.getElementById('wizBahEntitledCheck');
  const basCheck = document.getElementById('wizBasEntitledCheck');

  const prof = {
    grade: document.getElementById('wizPayGradeSelect')?.value || 'E-4',
    yosKey: document.getElementById('wizPayYosSelect')?.value || 'over6',
    zipCode: document.getElementById('wizPayZipInput')?.value || '',
    depStatus: document.getElementById('wizPayDepSelect')?.value || 'withoutDep',
    bahEntitled: bahCheck ? bahCheck.checked : true,
    basEntitled: basCheck ? basCheck.checked : true,
    roleName: wizRoleVal,
    roleTier: mapWizardRoleToTier(wizRoleVal)
  };
  updateWizardPayZipMhaBadge(prof);
}

function openSetupWizard(isRerun) {
  wizardIsRerun = Boolean(isRerun);
  wizardCurrentStep = 1;
  wizardSelectedView = currentViewMode;
  wizardSelectedTheme = colorThemePreference;
  try {
    const savedTaskForce = localStorage.getItem(TASK_FORCE_STORAGE_KEY);
    wizardSelectedTaskForce = savedTaskForce === 'empire-shield' ? savedTaskForce : 'sentinel';
  } catch (e) {
    console.warn('Task force preference load skipped:', e);
    wizardSelectedTaskForce = 'sentinel';
  }

  const schedType = document.getElementById('schedSelect').value || 'alt';
  const latestAllowedIdx = typeof getLatestAllowedPayPeriodIndex === 'function'
    ? getLatestAllowedPayPeriodIndex()
    : (parseInt(document.getElementById('ppSelect').value, 10) || 0);
  const startPpIdx = Math.min(parseInt(document.getElementById('ppSelect').value, 10) || 0, latestAllowedIdx);

  wizardInitialSnapshot = {
    schedType,
    rdoPreset: activeRdoPreset,
    startPpIdx
  };

  document.getElementById('wizSchedSelect').value = schedType;
  populateWizardRdoOptions(schedType, activeRdoPreset);

  document.getElementById('wizStartingLeave').value = document.getElementById('startingLeaveInput').value || '';

  const payProf = typeof getPayProfile === 'function'
    ? getPayProfile()
    : { grade: 'E-4', yosKey: 'over6', zipCode: '', depStatus: 'withoutDep', bahEntitled: true, basEntitled: true, roleTier: 'none' };
  const wGrade = document.getElementById('wizPayGradeSelect');
  const wYos = document.getElementById('wizPayYosSelect');
  const wZip = document.getElementById('wizPayZipInput');
  const wDep = document.getElementById('wizPayDepSelect');
  const wBah = document.getElementById('wizBahEntitledCheck');
  const wBas = document.getElementById('wizBasEntitledCheck');
  const wRole = document.getElementById('wizSmRoleInput');

  if (wGrade) wGrade.value = payProf.grade;
  if (wYos) wYos.value = payProf.yosKey;
  if (wZip) wZip.value = payProf.zipCode;
  if (wDep) wDep.value = payProf.depStatus;
  if (wBah) wBah.checked = payProf.bahEntitled !== false;
  if (wBas) wBas.checked = payProf.basEntitled !== false;

  const existingSmRole = (document.getElementById('smRoleInput')?.value || '').trim();
  if (wRole) {
    wRole.classList.remove('field-missing');
    wRole.value = existingSmRole;
  }

  payProf.roleName = existingSmRole;
  payProf.roleTier = mapWizardRoleToTier(existingSmRole || '');
  updateWizardPayZipMhaBadge(payProf);

  populateWizardPpOptions(startPpIdx);
  const themeSelect = document.getElementById('wizThemeSelect');
  if (themeSelect) themeSelect.value = wizardSelectedTheme;
  selectWizardView(wizardSelectedView);
  selectWizardTaskForce(wizardSelectedTaskForce);
  renderWizardStep();

  const backdrop = document.getElementById('wizardBackdrop');
  if (backdrop) backdrop.classList.add('open');
}

function rerunSetupWizard() {
  if (!closeSettingsModal()) return;
  openSetupWizard(true);
}

function selectWizardView(mode) {
  wizardSelectedView = mode;
  const dCard = document.getElementById('wizViewCard_desktop');
  const mCard = document.getElementById('wizViewCard_mobile');
  if (dCard) dCard.classList.toggle('selected', mode === 'desktop');
  if (mCard) mCard.classList.toggle('selected', mode === 'mobile');
}

function selectWizardTheme(preference) {
  if (['system', 'light', 'dark'].includes(preference)) wizardSelectedTheme = preference;
}

function selectWizardTaskForce(taskForce) {
  wizardSelectedTaskForce = taskForce === 'empire-shield' ? 'empire-shield' : 'sentinel';
  const sentinelCard = document.getElementById('wizTaskForceCard_sentinel');
  const empireCard = document.getElementById('wizTaskForceCard_empire');
  if (sentinelCard) {
    const selected = wizardSelectedTaskForce === 'sentinel';
    sentinelCard.classList.toggle('selected', selected);
    sentinelCard.setAttribute('aria-pressed', String(selected));
  }
  if (empireCard) {
    const selected = wizardSelectedTaskForce === 'empire-shield';
    empireCard.classList.toggle('selected', selected);
    empireCard.setAttribute('aria-pressed', String(selected));
  }
  try {
    localStorage.setItem(TASK_FORCE_STORAGE_KEY, wizardSelectedTaskForce);
  } catch (e) {
    console.warn('Task force preference save skipped:', e);
  }
  if (wizardCurrentStep === 3) renderWizardStep();
}

function populateWizardRdoOptions(schedType, preferredPreset) {
  const select = document.getElementById('wizRdoSelect');
  if (!select) return;
  const list = getRdoPresetList(schedType);
  select.innerHTML = '';
  list.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.val;
    opt.textContent = o.text;
    select.appendChild(opt);
  });
  const defaultKey = schedType === 'alt' ? 'fri_sun' : 'sat_sun';
  const validMatch = list.some(o => o.val === preferredPreset);
  select.value = validMatch ? preferredPreset : defaultKey;
}

function onWizardSchedChange() {
  const schedType = document.getElementById('wizSchedSelect').value;
  populateWizardRdoOptions(schedType, '');
}

function populateWizardPpOptions(selectedIdx) {
  const wizPp = document.getElementById('wizPpSelect');
  const mainPp = document.getElementById('ppSelect');
  if (!wizPp || !mainPp) return;
  const latestAllowedIdx = typeof getLatestAllowedPayPeriodIndex === 'function'
    ? getLatestAllowedPayPeriodIndex()
    : payPeriods.length - 1;
  wizPp.innerHTML = '';
  Array.from(mainPp.options).forEach(o => {
    const idx = parseInt(o.value, 10);
    if (!Number.isNaN(idx) && idx <= latestAllowedIdx) {
      const copyOpt = document.createElement('option');
      copyOpt.value = o.value;
      copyOpt.textContent = o.textContent;
      wizPp.appendChild(copyOpt);
    }
  });
  const safeIdx = Math.min(Math.max(0, selectedIdx || 0), latestAllowedIdx);
  wizPp.value = safeIdx;
  updateJumpToCurrentPayPeriodButtons();
}

function setWizardToCurrentPp() {
  const foundIdx = getCurrentPayPeriodIndex();
  const wizPp = document.getElementById('wizPpSelect');
  if (wizPp) wizPp.value = foundIdx;
  updateJumpToCurrentPayPeriodButtons();
}

function getCurrentPayPeriodIndex() {
  const currentIdx = payPeriods.findIndex(pp => pp.isCurrent && pp.isAllowedStart !== false);
  return currentIdx >= 0
    ? currentIdx
    : (typeof getLatestAllowedPayPeriodIndex === 'function' ? getLatestAllowedPayPeriodIndex() : 0);
}

function updateJumpToCurrentPayPeriodButtons() {
  const currentIdx = getCurrentPayPeriodIndex();
  const settingsSelect = document.getElementById('ppSelect');
  const settingsButton = document.getElementById('settingsJumpToCurrentPpButton');
  if (settingsSelect && settingsButton) {
    settingsButton.hidden = parseInt(settingsSelect.value, 10) === currentIdx;
  }

  const wizardSelect = document.getElementById('wizPpSelect');
  const wizardButtonWrap = document.getElementById('wizardJumpToCurrentPpWrap');
  if (wizardSelect && wizardButtonWrap) {
    wizardButtonWrap.hidden = parseInt(wizardSelect.value, 10) === currentIdx;
  }
}

function renderWizardStep() {
  for (let i = 1; i <= 8; i++) {
    const panel = document.getElementById(`wizardStep_${i}`);
    if (panel) panel.classList.toggle('active', i === wizardCurrentStep);
  }
  const labelEl = document.getElementById('wizardStepLabel');
  const nameEl = document.getElementById('wizardStepName');
  const fillEl = document.getElementById('wizardProgressFill');
  const backBtn = document.getElementById('wizBackBtn');
  const nextBtn = document.getElementById('wizNextBtn');

  const isEmpireShield = wizardSelectedTaskForce === 'empire-shield';
  const displayStep = isEmpireShield || wizardCurrentStep <= 3 ? wizardCurrentStep : wizardCurrentStep - 1;
  const totalSteps = isEmpireShield ? 4 : 7;
  const stepName = isEmpireShield
    ? WIZARD_EMPIRE_STEP_NAMES[wizardCurrentStep - 1]
    : WIZARD_SENTINEL_STEP_NAMES[displayStep - 1];

  if (labelEl) labelEl.textContent = `Step ${displayStep} of ${totalSteps}`;
  if (nameEl) nameEl.textContent = stepName || '';
  if (fillEl) fillEl.style.width = `${(displayStep / totalSteps) * 100}%`;
  if (backBtn) backBtn.disabled = wizardCurrentStep <= 1;
  if (nextBtn) {
    nextBtn.style.display = (isEmpireShield && wizardCurrentStep === 4) || (!isEmpireShield && wizardCurrentStep === 8)
      ? 'none'
      : 'inline-block';
    nextBtn.textContent = wizardCurrentStep === 1 ? 'Get Started ▶' : 'Next ▶';
  }
}

function wizardStepNav(delta) {
  if (delta > 0 && wizardCurrentStep === 3) {
    wizardCurrentStep = wizardSelectedTaskForce === 'empire-shield' ? 4 : 5;
    renderWizardStep();
    return;
  }
  if (delta < 0 && wizardSelectedTaskForce === 'sentinel' && wizardCurrentStep === 5) {
    wizardCurrentStep = 3;
    renderWizardStep();
    return;
  }
  if (delta > 0 && wizardCurrentStep === 6) {
    const wizRoleEl = document.getElementById('wizSmRoleInput');
    if (wizRoleEl && wizRoleEl.value.trim() === '') {
      wizRoleEl.classList.add('field-missing');
      wizRoleEl.focus();
      alert('Please select your Assignment Role (C2, External Support, Facility Leadership, or General Purpose) before continuing.');
      return;
    }
    const leaveBalanceEl = document.getElementById('wizStartingLeave');
    if (leaveBalanceEl && !leaveBalanceEl.reportValidity()) return;
  }
  const nextStep = wizardCurrentStep + delta;
  if (nextStep < 1 || nextStep > 8) return;
  if (wizardSelectedTaskForce === 'empire-shield' && nextStep > 4) return;
  if (wizardSelectedTaskForce === 'sentinel' && nextStep === 4) return;
  wizardCurrentStep = nextStep;
  renderWizardStep();
}

function finishWizard(openSopAfter) {
  if (wizardSelectedTaskForce === 'sentinel') {
    const leaveBalanceEl = document.getElementById('wizStartingLeave');
    if (leaveBalanceEl && !leaveBalanceEl.reportValidity()) return;
  }

  const chosenView = wizardSelectedView || currentViewMode;
  const chosenSched = document.getElementById('wizSchedSelect').value || 'alt';
  const chosenRdo = document.getElementById('wizRdoSelect').value || (chosenSched === 'alt' ? 'fri_sun' : 'sat_sun');
  const chosenLeave = document.getElementById('wizStartingLeave').value;
  const chosenRole = (document.getElementById('wizSmRoleInput')?.value || '').trim();
  const bahCheck = document.getElementById('wizBahEntitledCheck');
  const basCheck = document.getElementById('wizBasEntitledCheck');
  const latestAllowedIdx = typeof getLatestAllowedPayPeriodIndex === 'function'
    ? getLatestAllowedPayPeriodIndex()
    : payPeriods.length - 1;
  const rawPpIdx = parseInt(document.getElementById('wizPpSelect').value, 10) || 0;
  const chosenPpIdx = Math.min(Math.max(0, rawPpIdx), latestAllowedIdx);

  const smRoleEl = document.getElementById('smRoleInput');
  if (smRoleEl && chosenRole) {
    smRoleEl.value = chosenRole;
  }

  const chosenPayProf = {
    grade: document.getElementById('wizPayGradeSelect')?.value || 'E-4',
    yosKey: document.getElementById('wizPayYosSelect')?.value || 'over6',
    zipCode: document.getElementById('wizPayZipInput')?.value || '',
    depStatus: document.getElementById('wizPayDepSelect')?.value || 'withoutDep',
    bahEntitled: bahCheck ? bahCheck.checked : true,
    basEntitled: basCheck ? basCheck.checked : true,
    roleName: chosenRole,
    roleTier: mapWizardRoleToTier(chosenRole)
  };
  if (typeof savePayProfile === 'function') savePayProfile(chosenPayProf);
  if (typeof syncPaySettingsInputs === 'function') syncPaySettingsInputs();

  document.getElementById('schedSelect').value = chosenSched;
  updatePresetDropdownOptions();

  document.getElementById('startingLeaveInput').value = chosenLeave !== '' ? chosenLeave : '';

  const schedOrRdoChanged = !wizardIsRerun ||
    !wizardInitialSnapshot ||
    wizardInitialSnapshot.schedType !== chosenSched ||
    wizardInitialSnapshot.rdoPreset !== chosenRdo;

  const ppChanged = wizardInitialSnapshot && wizardInitialSnapshot.startPpIdx !== chosenPpIdx;

  document.getElementById('ppSelect').value = chosenPpIdx;
  activeRdoPreset = chosenRdo;

  if (schedOrRdoChanged) {
    previousStartPpIdx = chosenPpIdx;
    applyRdoPresetAll(chosenRdo);
  } else if (ppChanged) {
    onStartPayPeriodChange();
  } else {
    buildAllPayPeriodGrids();
    saveStateToLocalStorage();
  }

  setViewMode(chosenView);
  colorThemePreference = wizardSelectedTheme;
  applyColorTheme();
  updateQuickProfileStrip();
  saveStateToLocalStorage();

  const backdrop = document.getElementById('wizardBackdrop');
  if (backdrop) backdrop.classList.remove('open');

  if (openSopAfter) {
    openSopModal();
  }
}

/* ====================================================================================
   EDIT SETTINGS MODAL & SMART PRINT GUARD
   ==================================================================================== */
const REQUIRED_EXPORT_FIELDS = ['smNameInput', 'smRoleInput', 'smFacilityInput', 'smLeaderInput'];

function clearMissingFieldHighlights() {
  REQUIRED_EXPORT_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    const fg = document.getElementById(`fg_${id}`);
    if (el) el.classList.remove('field-missing');
    if (fg) fg.classList.remove('has-missing');
  });
  const alertEl = document.getElementById('settingsGuardAlert');
  if (alertEl) alertEl.classList.remove('visible');
}

function getMissingExportFields() {
  return REQUIRED_EXPORT_FIELDS.filter(id => {
    const el = document.getElementById(id);
    return !el || el.value.trim() === '';
  });
}

function openSettingsModal(guardModeAction) {
  clearMissingFieldHighlights();
  if (typeof syncPaySettingsInputs === 'function') syncPaySettingsInputs();
  pendingExportAction = guardModeAction || null;

  const primaryBtn = document.getElementById('settingsPrimaryBtn');
  const alertEl = document.getElementById('settingsGuardAlert');
  const cocDetails = document.getElementById('cocReportDetails');
  const themeSelect = document.getElementById('settingsThemeSelect');
  if (themeSelect) themeSelect.value = colorThemePreference;

  if (pendingExportAction) {
    if (cocDetails) cocDetails.open = true;
    const missingIds = getMissingExportFields();
    missingIds.forEach(id => {
      const el = document.getElementById(id);
      const fg = document.getElementById(`fg_${id}`);
      if (el) el.classList.add('field-missing');
      if (fg) fg.classList.add('has-missing');
    });
    if (alertEl) alertEl.classList.add('visible');
    if (primaryBtn) {
      primaryBtn.textContent = pendingExportAction === 'pdf'
        ? '🖨️ Save & Print DA-6 PDF'
        : '💾 Save & Download CoC Report';
      primaryBtn.classList.add('guard-proceed');
    }
  } else {
    if (primaryBtn) {
      primaryBtn.textContent = '✓ Done';
      primaryBtn.classList.remove('guard-proceed');
    }
  }

  const backdrop = document.getElementById('settingsBackdrop');
  if (backdrop) backdrop.classList.add('open');

  if (pendingExportAction) {
    const missingIds = getMissingExportFields();
    if (missingIds.length > 0) {
      const firstEl = document.getElementById(missingIds[0]);
      if (firstEl) setTimeout(() => firstEl.focus(), 60);
    }
  }
}

function closeSettingsModal(skipLeaveValidation) {
  const leaveBalanceEl = document.getElementById('startingLeaveInput');
  if (!skipLeaveValidation && leaveBalanceEl && !leaveBalanceEl.reportValidity()) return false;
  pendingExportAction = null;
  clearMissingFieldHighlights();
  const backdrop = document.getElementById('settingsBackdrop');
  if (backdrop) backdrop.classList.remove('open');
  return true;
}

function validateBeforeExport(actionType) {
  const missingIds = getMissingExportFields();
  if (missingIds.length > 0) {
    openSettingsModal(actionType);
    return false;
  }
  return true;
}

function onSettingsPrimaryAction() {
  if (pendingExportAction) {
    const missingIds = getMissingExportFields();
    if (missingIds.length > 0) {
      missingIds.forEach(id => {
        const el = document.getElementById(id);
        const fg = document.getElementById(`fg_${id}`);
        if (el) el.classList.add('field-missing');
        if (fg) fg.classList.add('has-missing');
      });
      const firstEl = document.getElementById(missingIds[0]);
      if (firstEl) firstEl.focus();
      return;
    }
    const actionToRun = pendingExportAction;
    if (!closeSettingsModal()) return;
    if (actionToRun === 'pdf') exportToPdfForCoC();
    else if (actionToRun === 'download') downloadStandaloneReport();
  } else {
    closeSettingsModal();
  }
}

/* ====================================================================================
   VIEW MODE (VERTICAL STACKING) + PLAN RANGE BUILDER (120-MILE IN-TRANSIT PROMPT)
   ==================================================================================== */
function setViewMode(mode) {
  currentViewMode = mode;
  document.getElementById('modeDesktopBtn').className = 'view-toggle-btn' + (mode === 'desktop' ? ' active' : '');
  document.getElementById('modeMobileBtn').className = 'view-toggle-btn' + (mode === 'mobile' ? ' active' : '');

  for (let s = 0; s < activePayPeriodCount; s++) {
    const sectionEl = document.getElementById(`ppSection_${s}`);
    const gridEl = document.getElementById(`gridContainer_${s}`);
    const miniCalEl = document.getElementById(`miniCalWrap_${s}`);
    const hintEl = document.getElementById(`mobileCalHint_${s}`);

    if (sectionEl) sectionEl.style.display = 'block';
    if (gridEl) gridEl.style.display = mode === 'desktop' ? 'block' : 'none';
    if (miniCalEl) miniCalEl.style.display = mode === 'mobile' ? 'block' : 'none';
    if (hintEl) hintEl.style.display = mode === 'mobile' ? 'flex' : 'none';
  }

  if (activePicker.open) {
    highlightSelectedDate();
  }
  saveStateToLocalStorage();
}

function openRangeBuilderModal(slotOverride) {
  closeInlineStatusPicker();
  const card = document.getElementById('rangeBuilderCard');
  if (!card) return;

  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const targetSlot = typeof slotOverride === 'number' ? slotOverride : 0;
  const pp = payPeriods[startPpIdx + targetSlot] || payPeriods[startPpIdx];
  const defaultIso = toIsoDate(pp.start);

  const startInput = document.getElementById('rangeStartDate');
  const endInput = document.getElementById('rangeEndDate');
  if (startInput) startInput.value = defaultIso;
  if (endInput) endInput.value = defaultIso;

  onRangeStatusChange();
  card.classList.add('open');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeRangeBuilderModal() {
  const card = document.getElementById('rangeBuilderCard');
  if (card) card.classList.remove('open');
}

function onTdyQualRadioChange() {
  const yesRadio = document.getElementById('tdyQualRadio_yes');
  const isYes = Boolean(yesRadio && yesRadio.checked);
  const yesCard = document.getElementById('tdyQualCard_yes');
  const noCard = document.getElementById('tdyQualCard_no');
  if (yesCard) yesCard.classList.toggle('selected', isYes);
  if (noCard) noCard.classList.toggle('selected', !isYes);
  updateRangeHelperNote();
}

function onRangeStatusChange() {
  const mode = document.getElementById('rangeStatusSelect').value;
  const qualBox = document.getElementById('tdyQualBox');
  if (qualBox) {
    qualBox.classList.toggle('visible', mode === 'tdy');
  }
  updateRangeHelperNote();
}

function updateRangeHelperNote() {
  const mode = document.getElementById('rangeStatusSelect').value;
  const noteEl = document.getElementById('rangeHelperNote');
  if (!noteEl) return;

  if (mode === 'tdy') {
    const yesRadio = document.getElementById('tdyQualRadio_yes');
    const qualifiesInTransit = Boolean(yesRadio && yesRadio.checked);
    if (qualifiesInTransit) {
      noteEl.innerHTML = 'Outside 120 miles: Sets <strong>Start Date</strong> and <strong>End Date</strong> as <strong>In-Transit (Travel)</strong> and fills all days in between as <strong>TDY</strong>. Automatically adds pay periods if needed.';
    } else {
      noteEl.innerHTML = 'Within 120 miles: Fills all dates from Start Date through End Date as <strong>TDY</strong> without In-Transit travel days.';
    }
  } else if (mode === 'lv') {
    noteEl.innerHTML = 'Fills all dates from Start Date through End Date as <strong>SAD Leave</strong> and calculates your 30-day / 60-day OCONUS deadline.';
  } else if (mode === 'rdo') {
    noteEl.innerHTML = 'Fills all dates from Start Date through End Date as <strong>RDO</strong>.';
  } else {
    noteEl.innerHTML = 'Resets all dates from Start Date through End Date back to <strong>On Shift</strong>.';
  }
}

function applyPlannedDateRange() {
  const mode = document.getElementById('rangeStatusSelect').value;
  const startIso = document.getElementById('rangeStartDate').value;
  const endIso = document.getElementById('rangeEndDate').value;

  const startDate = parseIsoDateLocal(startIso);
  const endDate = parseIsoDateLocal(endIso);

  if (!startDate || !endDate) {
    alert('Please select both a valid Start Date and End Date.');
    return;
  }
  if (endDate < startDate) {
    alert('End Date cannot be earlier than Start Date.');
    return;
  }

  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const firstPpStart = payPeriods[startPpIdx].start;

  if (startDate < firstPpStart) {
    alert(`Start Date (${formatFullDate(startDate)}) is earlier than your Beginning Pay Period (${formatFullDate(firstPpStart)}). Change Beginning Pay Period in Edit Settings first.`);
    return;
  }

  const yesRadio = document.getElementById('tdyQualRadio_yes');
  const useTdyInTransit = (mode === 'tdy' && Boolean(yesRadio && yesRadio.checked));
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

  if (useTdyInTransit && totalDays < 3) {
    alert('Auto-filling In-Transit on both Start and End dates requires at least 3 days so at least 1 TDY day sits between them (Policy Change 2 requires In-Transit to bridge On Shift and TDY). For 1–2 day trips, select "No — Within 120 Miles" and set a single In-Transit day manually if needed.');
    return;
  }

  const endOffsetDays = Math.floor((endDate.getTime() - firstPpStart.getTime()) / 86400000);
  const requiredSlots = Math.floor(endOffsetDays / 14) + 1;
  clearLastDayStatusUndo();

  if (requiredSlots > activePayPeriodCount) {
    const prevCount = activePayPeriodCount;
    activePayPeriodCount = requiredSlots;
    ensurePayPeriodIndex(startPpIdx + activePayPeriodCount + 3);
    ensureSlotCapacity(activePayPeriodCount);
    for (let s = prevCount; s < activePayPeriodCount; s++) {
      applyRdoPresetForSlot(s, activeRdoPreset || 'fri_sun');
    }
  }

  let firstModifiedSlot = -1;
  for (let i = 0; i < totalDays; i++) {
    const curDate = addDays(startDate, i);
    const offsetFromFirst = Math.floor((curDate.getTime() - firstPpStart.getTime()) / 86400000);
    const s = Math.floor(offsetFromFirst / 14);
    const d = offsetFromFirst % 14;
    if (firstModifiedSlot === -1) firstModifiedSlot = s;

    let statusToApply = mode;
    if (mode === 'tdy') {
      if (useTdyInTransit) {
        statusToApply = (i === 0 || i === totalDays - 1) ? 'trv' : 'drl';
      } else {
        statusToApply = 'drl';
      }
    }
    userSelections[s][d] = statusToApply;
  }

  closeRangeBuilderModal();
  buildAllPayPeriodGrids();
  saveStateToLocalStorage();

  if (firstModifiedSlot >= 0) {
    const targetSection = document.getElementById(`ppSection_${firstModifiedSlot}`);
    if (targetSection) targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ====================================================================================
   UNIFIED INLINE STATUS PICKER (BOTH DESKTOP & PHONE — NO PAINTBRUSH)
   ==================================================================================== */
function onDateSelect(s, d) {
  if (activePicker.open && activePicker.s === s && activePicker.d === d) {
    closeInlineStatusPicker();
    return;
  }
  const currentSt = effectiveSelections[s][d];
  if (currentSt === 'refrad_rpt') {
    alert('Use Plan REFRAD to change or clear the REFRAD date.');
    return;
  }
  if (currentSt === 'term_lv' || currentSt === 'off_mission') {
    alert('Terminal Leave and Post-REFRAD (Off) dates are calculated by the REFRAD plan. Change or clear the plan to edit them.');
    return;
  }
  openInlineStatusPicker(s, d);
}

function openInlineStatusPicker(s, d) {
  closeRangeBuilderModal();
  document.querySelectorAll('.status-sheet-card.open').forEach(el => el.classList.remove('open'));
  activePicker = { open: true, s, d };
  highlightSelectedDate();
  renderInlineStatusPicker(s, d);
}

function closeInlineStatusPicker() {
  activePicker = { open: false, s: -1, d: -1 };
  document.querySelectorAll('.status-sheet-card.open').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.day-cell.selected-cell').forEach(el => el.classList.remove('selected-cell'));
  document.querySelectorAll('.mini-cal-tile.selected-tile').forEach(el => el.classList.remove('selected-tile'));
}

function highlightSelectedDate() {
  document.querySelectorAll('.day-cell.selected-cell').forEach(el => el.classList.remove('selected-cell'));
  document.querySelectorAll('.mini-cal-tile.selected-tile').forEach(el => el.classList.remove('selected-tile'));

  if (!activePicker.open || activePicker.s < 0 || activePicker.d < 0) return;

  const gridCell = document.getElementById(`dayRow_grid_${activePicker.s}_${activePicker.d}`);
  if (gridCell) gridCell.classList.add('selected-cell');

  const mobileTile = document.getElementById(`dayRow_list_${activePicker.s}_${activePicker.d}`);
  if (mobileTile) mobileTile.classList.add('selected-tile');

  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const pp = payPeriods[startPpIdx + activePicker.s];
  const hintLabel = document.getElementById(`mobileSelectedHint_${activePicker.s}`);
  if (pp && hintLabel) {
    const dObj = addDays(pp.start, activePicker.d);
    const curMeta = getStatusMeta(effectiveSelections[activePicker.s][activePicker.d]);
    hintLabel.innerHTML = `Selected: <strong>${DAY_NAMES[activePicker.d % 7]} ${formatShortDate(dObj)}</strong> (${curMeta.name})`;
  }
}

function renderInlineStatusPicker(s, d) {
  const sheetEl = document.getElementById(`statusSheet_${s}`);
  if (!sheetEl) return;

  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const pp = payPeriods[startPpIdx + s];
  if (!pp) return;
  const dayDate = addDays(pp.start, d);
  const currentSt = effectiveSelections[s][d];

  const usedSpSet = new Set();
  for (let p = 0; p < activePayPeriodCount; p++) {
    for (let i = 0; i < 14; i++) {
      const stId = effectiveSelections[p][i];
      if (stId && stId.startsWith('sp_')) usedSpSet.add(stId);
    }
  }

  let optionsHtml = '';
  STATUS_OPTIONS.forEach(st => {
    if (st.isToolOnly) return;
    if (st.isSpecialPass && st.holidayDate) {
      if (dayDate < st.holidayDate || dayDate > st.expirationDate) return;
    }
    const isUsed = st.isSpecialPass && usedSpSet.has(st.id) && currentSt !== st.id;
    const label = isUsed ? `${st.name} ✓ [USED]` : st.name;
    const extraClass = (currentSt === st.id ? ' current-opt' : '') + (st.isSpecialPass ? ' sp-opt' : '') + (isUsed ? ' sp-used' : '');
    optionsHtml += `
      <div class="status-sheet-opt${extraClass}"
           style="background:${st.color};color:${st.textCol};border-color:${st.border};"
           onclick="pickStatusFromInlinePicker(${s}, ${d}, '${st.id}')">
        ${label}
      </div>
    `;
  });

  sheetEl.innerHTML = `
    <div class="status-sheet-hdr">
      <div class="status-sheet-title">Set Status — ${DAY_NAMES[d % 7]}, ${formatFullDate(dayDate)}</div>
      <button type="button" class="status-sheet-close" onclick="closeInlineStatusPicker()">✕ Close</button>
    </div>
    <div class="status-sheet-grid">${optionsHtml}</div>
  `;
  sheetEl.classList.add('open');
}

function pickStatusFromInlinePicker(s, d, statusId) {
  setDayStatusDirect(s, d, statusId);
  if (statusId === 'lv' && userSelections[s]?.[d] === 'lv') {
    offerLeaveFormDownload();
  }
  closeInlineStatusPicker();
}

function offerLeaveFormDownload() {
  let alreadyOffered = false;
  try {
    alreadyOffered = localStorage.getItem(LEAVE_FORM_OFFERED_KEY) === '1';
    if (!alreadyOffered) localStorage.setItem(LEAVE_FORM_OFFERED_KEY, '1');
  } catch (error) {
    console.warn('Leave form offer preference could not be saved:', error);
  }
  if (alreadyOffered) return;

  if (!confirm('Would you like to download the SAD Leave Request Form (PDF) now? You can also download it later from the planner.')) return;
  const link = document.createElement('a');
  link.href = './assets/DOCCS_SAD_Leave_Request_Form.pdf';
  link.download = 'DOCCS_SAD_Leave_Request_Form.pdf';
  link.click();
}

/* ====================================================================================
   SPECIAL PASS CONFLICT, DEFAULT SCHEDULE REVERT & PAST-DATE WARNING GUARD
   ==================================================================================== */
let spConflictPending = null;

function isDateRegularRdo(dateObj) {
  const schedType = document.getElementById('schedSelect').value;
  const blockSize = (schedType === 'alt') ? 3 : 2;
  const actualPreset = activeRdoPreset || (schedType === 'alt' ? 'fri_sun' : 'sat_sun');

  let startThuIdx = 1;
  switch (actualPreset) {
    case 'thu_sat': case 'thu_fri': startThuIdx = 0; break;
    case 'fri_sun': case 'fri_sat': startThuIdx = 1; break;
    case 'sat_mon': case 'sat_sun': startThuIdx = 2; break;
    case 'sun_tue': case 'sun_mon': startThuIdx = 3; break;
    case 'mon_wed': case 'mon_tue': startThuIdx = 4; break;
    case 'tue_thu': case 'tue_wed': startThuIdx = 5; break;
    case 'wed_fri': case 'wed_thu': startThuIdx = 6; break;
  }

  const thuIdx = (dateObj.getDay() + 3) % 7;
  for (let k = 0; k < blockSize; k++) {
    if ((startThuIdx + k) % 7 === thuIdx) return true;
  }
  return false;
}

function getDefaultStatusForDate(dateObj) {
  return isDateRegularRdo(dateObj) ? 'rdo' : 'shift';
}

function isHolidayDateForSp(dateObj, spId) {
  if (!spId || !spId.startsWith('sp_')) return false;
  const iso = spId.substring(3);
  const rule = HOLIDAY_RULES.find(r => toIsoDate(r.holidayDate) === iso);
  if (!rule) return false;
  return rule.dates.includes(toIsoDate(dateObj));
}

function isDateInPast(dateObj) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  return target < today;
}

function getRevertStatusForOldSpDay(oldDate, spId) {
  return isHolidayDateForSp(oldDate, spId) ? 'shift' : getDefaultStatusForDate(oldDate);
}

function findSpecialPassConflict(targetStatus, newS, newD) {
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);

  for (let p = 0; p < activePayPeriodCount; p++) {
    for (let i = 0; i < 14; i++) {
      if (userSelections[p] && userSelections[p][i] === targetStatus && !(p === newS && i === newD)) {
        const pp = payPeriods[startPpIdx + p];
        const oldDate = addDays(pp.start, i);
        return {
          mode: 'visible',
          oldPpIdx: startPpIdx + p,
          oldSlot: p,
          oldDay: i,
          oldPp: pp,
          oldDate,
          isHolidaySelf: isHolidayDateForSp(oldDate, targetStatus),
          landedOnRdo: isDateRegularRdo(oldDate),
          isPast: isDateInPast(oldDate)
        };
      }
    }
  }

  for (let p = activePayPeriodCount; p < userSelections.length; p++) {
    for (let i = 0; i < 14; i++) {
      if (userSelections[p] && userSelections[p][i] === targetStatus) {
        ensurePayPeriodIndex(startPpIdx + p);
        const pp = payPeriods[startPpIdx + p];
        const oldDate = addDays(pp.start, i);
        return {
          mode: 'future_hidden',
          oldPpIdx: startPpIdx + p,
          oldSlot: p,
          oldDay: i,
          oldPp: pp,
          oldDate,
          isHolidaySelf: isHolidayDateForSp(oldDate, targetStatus),
          landedOnRdo: isDateRegularRdo(oldDate),
          isPast: isDateInPast(oldDate)
        };
      }
    }
  }

  const holIso = targetStatus.substring(3);
  const rule = HOLIDAY_RULES.find(r => toIsoDate(r.holidayDate) === holIso);
  if (rule) {
    const diffDays = Math.floor((rule.holidayDate.getTime() - payPeriods[0].start.getTime()) / 86400000);
    const holPpIdx = Math.floor(diffDays / 14);
    if (holPpIdx < startPpIdx) {
      let targetHolDate = rule.holidayDate;
      let landedOnRdo = false;
      for (const dIso of rule.dates) {
        const dObj = parseIsoDateLocal(dIso);
        if (dObj && isDateRegularRdo(dObj)) {
          landedOnRdo = true;
          targetHolDate = dObj;
          break;
        }
      }
      const pp = holPpIdx >= 0 ? payPeriods[holPpIdx] : null;
      const holDayOffset = pp ? Math.floor((targetHolDate.getTime() - pp.start.getTime()) / 86400000) : 0;
      return {
        mode: 'earlier_unshown',
        oldPpIdx: holPpIdx,
        oldSlot: -1,
        oldDay: Math.max(0, Math.min(13, holDayOffset)),
        oldPp: pp,
        oldDate: targetHolDate,
        isHolidaySelf: true,
        landedOnRdo,
        isPast: isDateInPast(targetHolDate)
      };
    }
  }

  return null;
}

function openSpConflictModal(newS, newD, targetStatus, conflict) {
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const basePp = payPeriods[startPpIdx + newS] || payPeriods[startPpIdx];
  if (!basePp) return;
  const newDate = addDays(basePp.start, newD);
  const stOpt = getStatusMeta(targetStatus);

  spConflictPending = { newS, newD, newDate, targetStatus, stOpt, conflict };
  renderSpConflictStep1();

  const backdrop = document.getElementById('spConflictBackdrop');
  if (backdrop) backdrop.classList.add('open');
}

function closeSpConflictModal() {
  spConflictPending = null;
  const backdrop = document.getElementById('spConflictBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function renderSpConflictStep1() {
  if (!spConflictPending) return;
  const { newDate, stOpt, conflict } = spConflictPending;
  const header = document.getElementById('spConflictHeader');
  const titleEl = document.getElementById('spConflictTitle');
  const bodyEl = document.getElementById('spConflictBody');

  header.classList.remove('danger-mode');
  const ppLabel = conflict.oldPp ? `PP ${String(conflict.oldPp.ppNum).padStart(2, '0')}` : 'an earlier Pay Period';
  const oldDateStr = formatFullDate(conflict.oldDate);
  const oldShortStr = formatShortDate(conflict.oldDate);
  const newShortStr = formatShortDate(newDate);
  const revertStatus = getRevertStatusForOldSpDay(conflict.oldDate, spConflictPending.targetStatus);
  const revertLabel = getStatusMeta(revertStatus).name;

  let calloutHtml = '';
  let noteHtml = '';
  let actionButtonsHtml = '';

  if (conflict.mode === 'visible') {
    titleEl.textContent = '⚠️ Special Pass Already Used';
    calloutHtml = `
      <strong>${stOpt.name}</strong> is already assigned to <strong>${oldDateStr}</strong> (${ppLabel}).
      Each holiday Special Pass can only be used <strong>once</strong>.
    `;
    noteHtml = conflict.isHolidaySelf
      ? `Choosing <strong>Replace</strong> will switch the holiday (${oldShortStr}) to <strong>On Shift</strong> and place the Special Pass on ${newShortStr}.`
      : `Choosing <strong>Replace</strong> will restore ${oldShortStr} to your default schedule (<strong>${revertLabel}</strong>) and move the Special Pass to ${newShortStr}.`;

    actionButtonsHtml = `
      <button type="button" class="sp-conflict-btn primary" onclick="spConflictJumpVisible()">📍 Jump to ${oldShortStr} (${ppLabel})</button>
      <button type="button" class="sp-conflict-btn warn" onclick="spConflictRequestReplace()">🔄 Replace &amp; Move to ${newShortStr}</button>
      <button type="button" class="sp-conflict-btn subtle" onclick="closeSpConflictModal()">Cancel</button>
    `;
  } else {
    titleEl.textContent = '⚠️ Pay Period Not Currently Open';
    const rdoNote = conflict.landedOnRdo
      ? `That date landed on your regular <strong>RDO</strong> (where this Special Pass would normally auto-apply).`
      : `That date was a regular <strong>On Shift</strong> day.`;

    calloutHtml = conflict.mode === 'future_hidden'
      ? `<strong>${stOpt.name}</strong> is already assigned on <strong>${oldDateStr}</strong> (${ppLabel}), but this tracker doesn't currently have ${ppLabel} open.`
      : `<strong>${stOpt.holidayName} (${oldDateStr})</strong> fell in <strong>${ppLabel}</strong>, which is not currently open in this tracker—so we can't verify whether you already took this Special Pass. ${rdoNote}`;

    noteHtml = conflict.mode === 'earlier_unshown'
      ? `Opening ${ppLabel} will shift your Beginning Pay Period back to include it (double-check your 18 NOV 2026 Leave Balance in ⚙️ Edit Settings afterward).`
      : `Opening ${ppLabel} will restore that pay period so you can review or edit ${oldShortStr}.`;

    const canOpenPp = conflict.oldPpIdx >= 0;
    actionButtonsHtml = `
      ${canOpenPp ? `<button type="button" class="sp-conflict-btn primary" onclick="spConflictOpenUnshownPp()">📂 Open ${ppLabel} &amp; Jump to ${oldShortStr}</button>` : ''}
      <button type="button" class="sp-conflict-btn warn" onclick="spConflictRequestReplace()">🔄 Replace &amp; Place on ${newShortStr}</button>
      <button type="button" class="sp-conflict-btn subtle" onclick="closeSpConflictModal()">Cancel</button>
    `;
  }

  bodyEl.innerHTML = `
    <div class="sp-conflict-callout">${calloutHtml}</div>
    <p class="sp-conflict-note">${noteHtml}</p>
    <div class="sp-conflict-actions">${actionButtonsHtml}</div>
  `;
}

function spConflictRequestReplace() {
  if (!spConflictPending) return;
  if (spConflictPending.conflict.isPast) {
    renderSpConflictPastConfirm();
  } else {
    executeSpReplace();
  }
}

function renderSpConflictPastConfirm() {
  if (!spConflictPending) return;
  const { newDate, stOpt, conflict } = spConflictPending;
  const header = document.getElementById('spConflictHeader');
  const titleEl = document.getElementById('spConflictTitle');
  const bodyEl = document.getElementById('spConflictBody');

  header.classList.add('danger-mode');
  const oldDateStr = formatFullDate(conflict.oldDate);
  const newShortStr = formatShortDate(newDate);
  const revertStatus = getRevertStatusForOldSpDay(conflict.oldDate, spConflictPending.targetStatus);
  const revertLabel = getStatusMeta(revertStatus).name;

  let warningBody = '';
  if (conflict.landedOnRdo) {
    titleEl.textContent = '🚨 Past RDO Holiday — Are You Sure?';
    warningBody = `
      <strong>${oldDateStr} has already passed and landed on your regular RDO.</strong><br><br>
      If you already took ${oldDateStr} off using <strong>${stOpt.name}</strong>, you cannot reuse it on ${newShortStr}.
      Moving it will change ${oldDateStr} to <strong>${revertLabel}</strong>. Are you sure you actually worked (or adjusted) that past date?
    `;
  } else {
    titleEl.textContent = '⚠️ Past Date Warning — Are You Sure?';
    warningBody = `
      <strong>${oldDateStr} has already passed</strong> (it was a regular On Shift day, not an RDO).<br><br>
      Moving <strong>${stOpt.name}</strong> to ${newShortStr} will revert ${oldDateStr} to <strong>${revertLabel}</strong>.
      Are you sure your past DA-6 / timecard matches this change?
    `;
  }

  bodyEl.innerHTML = `
    <div class="sp-conflict-callout danger-callout">${warningBody}</div>
    <div class="sp-conflict-actions">
      <button type="button" class="sp-conflict-btn danger" onclick="executeSpReplace()">✓ Yes, I'm Sure — Place on ${newShortStr}</button>
      <button type="button" class="sp-conflict-btn subtle" onclick="renderSpConflictStep1()">◀ Back</button>
    </div>
  `;
}

function executeSpReplace() {
  if (!spConflictPending) return;
  const { newS, newD, targetStatus } = spConflictPending;
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);

  for (let p = 0; p < userSelections.length; p++) {
    for (let i = 0; i < 14; i++) {
      if (userSelections[p][i] === targetStatus && !(p === newS && i === newD)) {
        const pp = payPeriods[startPpIdx + p];
        if (pp) {
          const oldDate = addDays(pp.start, i);
          userSelections[p][i] = getRevertStatusForOldSpDay(oldDate, targetStatus);
        } else {
          userSelections[p][i] = 'shift';
        }
      }
    }
  }

  userSelections[newS][newD] = targetStatus;
  closeSpConflictModal();
  calculateAllPayPeriods();
  saveStateToLocalStorage();
}

function jumpToScheduleDate(s, d) {
  openInlineStatusPicker(s, d);
  requestAnimationFrame(() => {
    const cellId = currentViewMode === 'mobile' ? `dayRow_list_${s}_${d}` : `dayRow_grid_${s}_${d}`;
    const cellEl = document.getElementById(cellId) || document.getElementById(`ppSection_${s}`);
    if (cellEl) {
      cellEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cellEl.classList.remove('error-flash');
      void cellEl.offsetWidth;
      cellEl.classList.add('error-flash');
    }
  });
}

function spConflictJumpVisible() {
  if (!spConflictPending) return;
  const { oldSlot, oldDay } = spConflictPending.conflict;
  closeSpConflictModal();
  jumpToScheduleDate(oldSlot, oldDay);
}

function spConflictOpenUnshownPp() {
  if (!spConflictPending) return;
  const { conflict } = spConflictPending;
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);

  if (conflict.mode === 'future_hidden') {
    const targetSlot = conflict.oldSlot;
    const targetDay = conflict.oldDay;
    activePayPeriodCount = targetSlot + 1;
    ensurePayPeriodIndex(startPpIdx + activePayPeriodCount + 3);
    closeSpConflictModal();
    buildAllPayPeriodGrids();
    saveStateToLocalStorage();
    jumpToScheduleDate(targetSlot, targetDay);
  } else if (conflict.mode === 'earlier_unshown' && conflict.oldPpIdx >= 0) {
    const targetPpIdx = conflict.oldPpIdx;
    const targetDay = conflict.oldDay;
    const delta = startPpIdx - targetPpIdx;
    const existingCopy = userSelections.slice(0, activePayPeriodCount).map(r => [...r]);

    activePayPeriodCount += delta;
    document.getElementById('ppSelect').value = targetPpIdx;
    previousStartPpIdx = targetPpIdx;
    ensurePayPeriodIndex(targetPpIdx + activePayPeriodCount + 3);

    userSelections = [];
    effectiveSelections = [];
    ensureSlotCapacity(activePayPeriodCount);

    for (let p = 0; p < delta; p++) {
      applyRdoPresetForSlot(p, activeRdoPreset);
    }
    for (let p = 0; p < existingCopy.length; p++) {
      userSelections[delta + p] = existingCopy[p];
    }

    closeSpConflictModal();
    buildAllPayPeriodGrids();
    saveStateToLocalStorage();
    jumpToScheduleDate(0, targetDay);
  }
}

let lastDayStatusUndoSnapshot = null;
let REFRAD_SCHEDULE_EXPANSION_PENDING = false;

function clearLastDayStatusUndo() {
  lastDayStatusUndoSnapshot = null;
  const button = document.getElementById('undoScheduleButton');
  if (button) {
    button.hidden = true;
    button.disabled = true;
  }
}

function captureLastDayStatusUndo() {
  lastDayStatusUndoSnapshot = {
    activePayPeriodCount,
    startPpIdx: parseInt(document.getElementById('ppSelect').value, 10),
    previousStartPpIdx,
    userSelections: userSelections.map(row => [...row]),
    refradPlanMode,
    refradPlanDate,
    refradScheduleSnapshot: cloneRefradScheduleSnapshot(refradScheduleSnapshot)
  };
  const button = document.getElementById('undoScheduleButton');
  if (button) {
    button.hidden = false;
    button.disabled = false;
  }
}

function undoLastDayStatusChange() {
  if (!lastDayStatusUndoSnapshot) return;
  activePayPeriodCount = lastDayStatusUndoSnapshot.activePayPeriodCount;
  document.getElementById('ppSelect').value = lastDayStatusUndoSnapshot.startPpIdx;
  previousStartPpIdx = lastDayStatusUndoSnapshot.previousStartPpIdx;
  userSelections = lastDayStatusUndoSnapshot.userSelections.map(row => [...row]);
  refradPlanMode = lastDayStatusUndoSnapshot.refradPlanMode;
  refradPlanDate = lastDayStatusUndoSnapshot.refradPlanDate;
  refradScheduleSnapshot = cloneRefradScheduleSnapshot(lastDayStatusUndoSnapshot.refradScheduleSnapshot);
  updateRefradClearButton();
  clearLastDayStatusUndo();
  buildAllPayPeriodGrids();
  saveStateToLocalStorage();
}

function setDayStatusDirect(s, d, targetStatus) {
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const pp = payPeriods[startPpIdx + s];
  if (!pp) return;
  const dayDate = addDays(pp.start, d);
  const stOpt = getStatusMeta(targetStatus);

  if (targetStatus === 'refrad_rpt') {
    alert('Use Plan REFRAD to set the REFRAD date.');
    return;
  }
  if (userSelections[s][d] === 'refrad_rpt') {
    alert('Use Plan REFRAD to change or clear the REFRAD date.');
    return;
  }

  if (userSelections[s][d] === targetStatus) return;

  const currentEffective = effectiveSelections[s][d];
  if (currentEffective === 'term_lv' || currentEffective === 'off_mission') {
    alert('Terminal Leave and Post-REFRAD (Off) dates are calculated by the REFRAD plan. Change or clear the plan to edit them.');
    return;
  }

  if (stOpt && stOpt.isSpecialPass && stOpt.holidayDate) {
    if (dayDate < stOpt.holidayDate) {
      alert(`Policy Restriction (02 OCT 2026 Memo, Para 3): Cannot use Special Pass for ${stOpt.holidayName} prior to the holiday (${formatShortDate(stOpt.holidayDate)}).`);
      return;
    }
    if (dayDate > stOpt.expirationDate) {
      alert(`Policy Restriction (02 OCT 2026 Memo, Para 4): Special Pass for ${stOpt.holidayName} expired on ${formatShortDate(stOpt.expirationDate)} (3 full payrolls limit).`);
      return;
    }

    const conflict = findSpecialPassConflict(targetStatus, s, d);
    if (conflict) {
      openSpConflictModal(s, d, targetStatus, conflict);
      return;
    }
  }

  captureLastDayStatusUndo();

  userSelections[s][d] = targetStatus;
  calculateAllPayPeriods();
  saveStateToLocalStorage();
}

/* ====================================================================================
   VERTICAL PAY PERIOD GRID BUILDER & AUTO-SCROLL ON ADD
   ==================================================================================== */
function buildAllPayPeriodGrids() {
  const container = document.getElementById('multiPpContainer');
  container.innerHTML = '';
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);

  closeInlineStatusPicker();
  ensureSlotCapacity(activePayPeriodCount);
  ensurePayPeriodIndex(startPpIdx + activePayPeriodCount + 3);
  updateDynamicSpecialPassPalette();

  for (let s = 0; s < activePayPeriodCount; s++) {
    const pp = payPeriods[startPpIdx + s];
    if (!pp) continue;

    const section = document.createElement('div');
    section.className = 'pp-section';
    section.id = `ppSection_${s}`;
    section.style.display = 'block';

    const badgeText = s === 0
      ? `Beginning PP (PP ${String(pp.ppNum).padStart(2, '0')})${pp.isCurrent ? ' • Current' : ''}`
      : `+${s} PP (PP ${String(pp.ppNum).padStart(2, '0')})${pp.isCurrent ? ' • Current' : ''}`;

    let thDates = '';
    let thDays = '';
    let tdCells = '';

    for (let d = 0; d < 14; d++) {
      const dayDate = addDays(pp.start, d);
      const iso = toIsoDate(dayDate);
      const badgeInfo = DATE_BADGE_MAP[iso] || null;
      const dayName = DAY_NAMES[d % 7];

      const holTagHtml = badgeInfo
        ? `<span class="th-hol-tag" style="background:${badgeInfo.isWeekendPair ? '#fef7e0' : '#e8f0fe'};color:${badgeInfo.isWeekendPair ? '#b06000' : '#1a73e8'};">${badgeInfo.label}</span>`
        : '';

      thDates += `<th class="date-th" title="${badgeInfo ? badgeInfo.desc : ''}">${formatShortDate(dayDate)}${holTagHtml}</th>`;
      thDays += `<th>${dayName}</th>`;
      tdCells += `
        <td class="day-cell" id="dayRow_grid_${s}_${d}" onclick="onDateSelect(${s}, ${d})" title="Click to change status">
          <div id="display_grid_${s}_${d}">On Shift</div>
        </td>
      `;
    }

    const da6MatrixHtml = `
      <div class="da6-matrix-container">
        <table class="da6-table">
          <thead>
            <tr>
              <th class="da6-header-label">DATE</th>
              ${thDates}
            </tr>
            <tr>
              <th class="da6-header-label">DAY</th>
              ${thDays}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="da6-header-label">DUTY STATUS</td>
              ${tdCells}
            </tr>
          </tbody>
        </table>
      </div>
    `;

    let dowHeadersHtml = '';
    DAY_NAMES.forEach(dn => {
      dowHeadersHtml += `<div class="mini-cal-dow">${dn}</div>`;
    });

    let miniTilesHtml = '';
    for (let d = 0; d < 14; d++) {
      const dayDate = addDays(pp.start, d);
      const iso = toIsoDate(dayDate);
      const badgeInfo = DATE_BADGE_MAP[iso] || null;
      const dateNumLabel = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;
      const holClass = badgeInfo ? (badgeInfo.isWeekendPair ? ' holiday-tile weekend-hol' : ' holiday-tile') : '';
      const holMiniLabel = badgeInfo ? `<div class="mini-tile-hol-dot">${badgeInfo.isWeekendPair ? 'HOL*' : 'HOL'}</div>` : '';

      miniTilesHtml += `
        <div class="mini-cal-tile${holClass}" id="dayRow_list_${s}_${d}" onclick="onDateSelect(${s}, ${d})">
          <div class="mini-tile-date">${dateNumLabel}</div>
          ${holMiniLabel}
          <div class="mini-tile-code" id="display_list_${s}_${d}">SHFT</div>
        </div>
      `;
    }

    let actionButtonsHtml = '';
    if (s === activePayPeriodCount - 1) {
      actionButtonsHtml += `<button type="button" class="btn-add-pp" onclick="addPayPeriod()">➕ Add Pay Period (PP #${activePayPeriodCount + 1})</button>`;
    }

    section.innerHTML = `
      <div class="pp-section-header">
        <div class="pp-section-title">PP ${String(pp.ppNum).padStart(2, '0')}: ${formatShortDate(pp.start)} – ${formatFullDate(pp.end)}</div>
        <div class="pp-header-right">
          <span class="pp-section-badge">${badgeText}</span>
          <details class="pp-more-tools">
            <summary>More tools</summary>
            <div class="more-tools-menu">
              <button type="button" class="more-tools-button" onclick="openRangeBuilderModal(${s})">📅 Plan Range for this pay period</button>
              ${s === activePayPeriodCount - 1 && activePayPeriodCount > 1 ? `<button type="button" class="more-tools-button" onclick="removeLastPayPeriod()">🗑️ Remove Last Pay Period</button>` : ''}
            </div>
          </details>
        </div>
      </div>

      <div class="deadline-panel">
        <div class="deadline-title">📅 Leave &amp; Terminal Leave Submission Deadlines (30-Day Standard / 60-Day OCONUS)</div>
        <div id="deadlineList_${s}" class="deadline-list"></div>
      </div>

      <div class="mobile-cal-hint-bar" id="mobileCalHint_${s}" style="display: ${currentViewMode === 'mobile' ? 'flex' : 'none'};">
        <span id="mobileSelectedHint_${s}">Tap any date below to set its duty status</span>
      </div>

      <div class="status-sheet-card" id="statusSheet_${s}"></div>

      <div id="gridContainer_${s}" style="display: ${currentViewMode === 'desktop' ? 'block' : 'none'};">${da6MatrixHtml}</div>

      <div class="mini-cal-wrap" id="miniCalWrap_${s}" style="display: ${currentViewMode === 'mobile' ? 'block' : 'none'};">
        <div class="mini-cal-dow-row">${dowHeadersHtml}</div>
        <div class="mini-cal-grid">${miniTilesHtml}</div>
      </div>

      <div class="results-box">
        <div class="pp-metrics-grid">
          <div class="metric-box">
            <div class="metric-label">RDO Auth</div>
            <div class="metric-val" id="rdoAuth_${s}">0</div>
            <div class="metric-sub" id="rdoQual_${s}">Standard Sched</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">RDO Used</div>
            <div class="metric-val" id="rdoUsed_${s}">0</div>
            <div class="metric-sub" id="rdoDiff_${s}">Matches auth</div>
          </div>
          <div class="metric-box highlight-total">
            <div class="metric-label">Ending Leave</div>
            <div class="metric-val" id="lvTotal_${s}">0.00</div>
            <div class="metric-sub" id="lvTotalSub_${s}">Start: 0.00</div>
          </div>
        </div>

        <table class="summary-table" id="summaryTable_${s}">
          <tr>
            <td>On Shift (Present for Duty):</td>
            <td id="countShift_${s}">0</td>
          </tr>
          <tr>
            <td>RDO:</td>
            <td id="countRdo_${s}">0</td>
          </tr>
          <tr>
            <td>SAD Leave Days:</td>
            <td id="countLeave_${s}">0</td>
          </tr>
          <tr>
            <td>Special Pass (Holiday) / In-Transit:</td>
            <td id="countSpTrv_${s}">0</td>
          </tr>
          <tr>
            <td>TDY / INCAP:</td>
            <td id="countNonSad_${s}">0</td>
          </tr>
          <tr>
            <td><strong>Total Days Accounted:</strong></td>
            <td id="totalAssignedOut_${s}">14 / 14</td>
          </tr>
        </table>
      </div>

      <div class="alerts-container" id="alerts_${s}"></div>
      ${actionButtonsHtml ? `<div class="pp-action-row"><div style="display:flex;gap:8px;width:100%;">${actionButtonsHtml}</div></div>` : ''}
    `;

    container.appendChild(section);
  }

  calculateAllPayPeriods();
}

function addPayPeriod() {
  clearLastDayStatusUndo();
  const newSlot = activePayPeriodCount;
  activePayPeriodCount++;
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  ensurePayPeriodIndex(startPpIdx + activePayPeriodCount + 3);
  ensureSlotCapacity(activePayPeriodCount);
  updateDynamicSpecialPassPalette();
  applyRdoPresetForSlot(newSlot, activeRdoPreset || 'fri_sun');
  buildAllPayPeriodGrids();
  saveStateToLocalStorage();

  requestAnimationFrame(() => {
    const newSection = document.getElementById(`ppSection_${newSlot}`);
    if (newSection) {
      newSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function removeLastPayPeriod() {
  if (activePayPeriodCount > 1) {
    if (!confirm(`Remove the last pay period and its scheduled dates? This cannot be undone.`)) return;
    clearLastDayStatusUndo();
    activePayPeriodCount--;
    buildAllPayPeriodGrids();
    saveStateToLocalStorage();
  }
}

function updateCardVisual(s, d, statusId) {
  const opt = getStatusMeta(statusId);
  const gridBadge = document.getElementById(`display_grid_${s}_${d}`);
  if (gridBadge) {
    gridBadge.textContent = opt.name;
    gridBadge.style.backgroundColor = opt.color;
    gridBadge.style.color = opt.textCol;
    gridBadge.style.border = `1px solid ${opt.border || opt.color}`;
    gridBadge.style.padding = '4px 2px';
    gridBadge.style.borderRadius = '4px';
    gridBadge.style.display = 'block';
  }

  const mobileTile = document.getElementById(`dayRow_list_${s}_${d}`);
  const mobileBadge = document.getElementById(`display_list_${s}_${d}`);
  if (mobileTile && mobileBadge) {
    mobileTile.style.backgroundColor = opt.color;
    mobileTile.style.color = opt.textCol;
    mobileTile.style.borderColor = opt.border || opt.color;
    mobileBadge.textContent = opt.shortName || opt.name.slice(0, 4).toUpperCase();
  }
}

function onStartPayPeriodChange() {
  clearLastDayStatusUndo();
  const newStartPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const delta = newStartPpIdx - previousStartPpIdx;
  updateJumpToCurrentPayPeriodButtons();

  if (delta !== 0) {
    const oldCopy = userSelections.slice(0, activePayPeriodCount).map(arr => [...arr]);
    ensureSlotCapacity(activePayPeriodCount);
    for (let s = 0; s < activePayPeriodCount; s++) {
      const srcSlot = s + delta;
      if (srcSlot >= 0 && srcSlot < oldCopy.length) {
        userSelections[s] = [...oldCopy[srcSlot]];
      } else {
        applyRdoPresetForSlot(s, activeRdoPreset);
      }
    }
    previousStartPpIdx = newStartPpIdx;
    buildAllPayPeriodGrids();
    saveStateToLocalStorage();
  }
}

function onScheduleTypeChange(schedEl) {
  const previousType = schedEl && schedEl.dataset.previousValue;
  if (previousType && previousType !== schedEl.value) {
    const confirmed = confirm('Changing the shift schedule resets day statuses in all open pay periods to the default pattern. Continue?');
    if (!confirmed) {
      schedEl.value = previousType;
      return;
    }
  }
  updatePresetDropdownOptions();
  applyDefaultPatternAll();
  if (schedEl) schedEl.dataset.previousValue = schedEl.value;
}

function jumpToCurrentPayPeriod(forceReset) {
  const foundIdx = getCurrentPayPeriodIndex();
  document.getElementById('ppSelect').value = foundIdx;
  updateJumpToCurrentPayPeriodButtons();
  if (forceReset) {
    previousStartPpIdx = foundIdx;
    applyDefaultPatternAll();
  } else {
    onStartPayPeriodChange();
  }
}

function updateRefradClearButton() {
  const button = document.getElementById('clearRefradPlanButton');
  if (button) button.hidden = !(refradPlanMode && refradPlanDate);
}

function clearRefradOnly() {
  const refradCount = userSelections.reduce((count, row) => count + row.filter(statusId => statusId === 'refrad_rpt').length, 0);
  if (refradCount === 0 && !refradPlanMode) {
    alert('No REFRAD plan is set.');
    return;
  }
  if (!confirm('Clear the REFRAD plan? Automatically generated Terminal Leave and Post-REFRAD days will return to the saved schedule.')) return;
  clearLastDayStatusUndo();
  const savedSchedule = cloneRefradScheduleSnapshot(refradScheduleSnapshot);
  if (savedSchedule) {
    ensurePayPeriodIndex(savedSchedule.startPpIdx + savedSchedule.activePayPeriodCount + 3);
    document.getElementById('ppSelect').value = savedSchedule.startPpIdx;
    previousStartPpIdx = savedSchedule.previousStartPpIdx;
    activePayPeriodCount = savedSchedule.activePayPeriodCount;
    userSelections = savedSchedule.userSelections.map(row =>
      row.map(statusId => statusId === 'refrad_rpt' ? 'shift' : statusId)
    );
  } else {
    for (let s = 0; s < userSelections.length; s++) {
      for (let d = 0; d < 14; d++) {
        if (userSelections[s][d] === 'refrad_rpt') userSelections[s][d] = 'shift';
      }
    }
  }
  refradPlanMode = '';
  refradPlanDate = '';
  refradScheduleSnapshot = null;
  updateRefradClearButton();
  updateJumpToCurrentPayPeriodButtons();
  buildAllPayPeriodGrids();
  saveStateToLocalStorage();
}

function getRefradDateLocation(dateIso) {
  const date = parseIsoDateLocal(dateIso);
  const firstPpStart = payPeriods[0]?.start;
  if (!date || !firstPpStart) return null;
  const dayOffset = Math.round((date.getTime() - firstPpStart.getTime()) / 86400000);
  const ppIdx = Math.floor(dayOffset / 14);
  return { ppIdx, dayIdx: dayOffset - ppIdx * 14 };
}

function openRefradPlanner() {
  const leaveBalanceEl = document.getElementById('startingLeaveInput');
  if (leaveBalanceEl && !leaveBalanceEl.reportValidity()) {
    openSettingsModal();
    setTimeout(() => leaveBalanceEl.focus(), 60);
    return;
  }

  const modeSelect = document.getElementById('refradPlanModeSelect');
  const dateInput = document.getElementById('refradPlanDateInput');
  const earliestDate = payPeriods[0]?.start;
  const firstBalanceDate = addDays(LEAVE_ANCHOR_DATE, 1);
  const minimumDate = earliestDate && earliestDate > firstBalanceDate ? earliestDate : firstBalanceDate;
  if (modeSelect) modeSelect.value = refradPlanMode || 'report_date';
  if (dateInput) {
    dateInput.min = toIsoDate(minimumDate);
    dateInput.value = refradPlanDate || toIsoDate(new Date());
  }
  onRefradModeChange();
  const backdrop = document.getElementById('refradPlannerBackdrop');
  if (backdrop) backdrop.classList.add('open');
}

function closeRefradPlanner() {
  const backdrop = document.getElementById('refradPlannerBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function onRefradModeChange() {
  const mode = document.getElementById('refradPlanModeSelect')?.value || 'report_date';
  const dateLabel = document.getElementById('refradDateLabel');
  const helper = document.getElementById('refradModeHelper');
  const notice = document.getElementById('refradPlanNotice');
  if (mode === 'mission_end') {
    if (dateLabel) dateLabel.textContent = 'MISSION END DATE (LAST MISSION-PAID DAY)';
    if (helper) {
      helper.textContent = 'Choose the last day the mission can pay you. The planner will mark that date as REFRAD, schedule remaining Terminal Leave immediately before it, and stop mission pay after it.';
    }
    if (notice) {
      notice.textContent = 'Remaining Terminal Leave will be scheduled backward from the selected last mission-paid day, replacing earlier statuses as needed. That date is marked REFRAD; later dates in that pay period are Off Mission, and later pay periods are removed. Your leave balance is as of 18 Nov 2026, so choose 19 Nov 2026 or later.';
    }
  } else {
    if (dateLabel) dateLabel.textContent = 'REFRAD REPORT DATE';
    if (helper) {
      helper.textContent = 'Choose the day you will report to work for REFRAD. That date is marked RFRD and counts as Present / On Shift; remaining Terminal Leave starts the next day, with Off Mission dates after Terminal Leave ends.';
    }
    if (notice) {
      notice.textContent = 'Remaining Terminal Leave will be scheduled forward from the day after your REFRAD Report Date, replacing later statuses as needed. The report date counts as Present / On Shift. The planner adds or removes pay periods so the final period ends with your Terminal Leave and Off Mission dates. Your leave balance is as of 18 Nov 2026, so choose 19 Nov 2026 or later.';
    }
  }
}

function shiftScheduleStartEarlier(newStartPpIdx) {
  const oldStartPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const periodsAdded = oldStartPpIdx - newStartPpIdx;
  if (periodsAdded <= 0) return false;

  const oldCount = activePayPeriodCount;
  const oldSelections = userSelections.slice(0, oldCount).map(row => [...row]);
  const newCount = oldCount + periodsAdded;
  ensurePayPeriodIndex(newStartPpIdx + newCount + 3);
  document.getElementById('ppSelect').value = newStartPpIdx;
  previousStartPpIdx = newStartPpIdx;
  activePayPeriodCount = newCount;
  ensureSlotCapacity(newCount);

  for (let slot = 0; slot < periodsAdded; slot++) {
    applyRdoPresetForSlot(slot, activeRdoPreset);
  }
  for (let slot = 0; slot < oldCount; slot++) {
    userSelections[periodsAdded + slot] = oldSelections[slot];
  }
  return true;
}

function ensureRefradPlanSchedule() {
  const location = getRefradDateLocation(refradPlanDate);
  if (!location) return false;

  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const targetSlot = location.ppIdx - startPpIdx;
  const neededPeriods = Math.max(0, targetSlot + 1 - activePayPeriodCount);
  if (neededPeriods === 0) return false;

  const oldCount = activePayPeriodCount;
  activePayPeriodCount += neededPeriods;
  ensurePayPeriodIndex(startPpIdx + activePayPeriodCount + 3);
  ensureSlotCapacity(activePayPeriodCount);
  for (let slot = oldCount; slot < activePayPeriodCount; slot++) {
    applyRdoPresetForSlot(slot, activeRdoPreset);
  }
  return true;
}

function finalizeRefradPlanAfterCalculation() {
  requestAnimationFrame(() => {
    if (REFRAD_SCHEDULE_EXPANSION_PENDING) {
      finalizeRefradPlanAfterCalculation();
      return;
    }
    const location = getRefradDateLocation(refradPlanDate);
    if (!location) return;
    const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
    saveStateToLocalStorage();
    closeRefradPlanner();
    if (REFRAD_BACKFILL_LEAVE_REMAINING >= 1) {
      const direction = refradPlanMode === 'mission_end' ? 'before this date' : 'after this date';
      alert(
        `${Math.floor(REFRAD_BACKFILL_LEAVE_REMAINING)} whole leave day(s) could not be scheduled ${direction}. ` +
        `Your leave balance is as of 18 Nov 2026, so there may not be enough days after that date. ` +
        `Choose a later REFRAD date or review your leave balance.`
      );
    }
    const targetSlot = location.ppIdx - startPpIdx;
    const cellId = currentViewMode === 'mobile'
      ? `dayRow_list_${targetSlot}_${location.dayIdx}`
      : `dayRow_grid_${targetSlot}_${location.dayIdx}`;
    const cellEl = document.getElementById(cellId) || document.getElementById(`ppSection_${targetSlot}`);
    if (cellEl) {
      cellEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cellEl.classList.remove('error-flash');
      void cellEl.offsetWidth;
      cellEl.classList.add('error-flash');
    }
  });
}

function applyRefradPlan() {
  const leaveBalanceEl = document.getElementById('startingLeaveInput');
  if (leaveBalanceEl && !leaveBalanceEl.reportValidity()) {
    closeRefradPlanner();
    openSettingsModal();
    setTimeout(() => leaveBalanceEl.focus(), 60);
    return;
  }

  const dateInput = document.getElementById('refradPlanDateInput');
  if (!dateInput || !dateInput.reportValidity()) return;
  const mode = document.getElementById('refradPlanModeSelect')?.value || 'report_date';
  const dateIso = dateInput.value;
  const firstBalanceDate = addDays(LEAVE_ANCHOR_DATE, 1);
  if (parseIsoDateLocal(dateIso) < firstBalanceDate) {
    alert('Choose a REFRAD date on or after 19 Nov 2026. The leave balance used by this planner is as of 18 Nov 2026.');
    return;
  }
  const location = getRefradDateLocation(dateIso);
  if (!location || location.ppIdx < 0) {
    alert('Choose a REFRAD date within the planner calendar.');
    return;
  }
  const dateDescription = mode === 'mission_end'
    ? 'The selected date will be the last mission-paid day. Remaining Terminal Leave will be scheduled before it; later dates will be Off Mission, and later pay periods will be removed.'
    : 'The selected date will be marked REFRAD Report Date and count as Present / On Shift. Remaining Terminal Leave will start the next day; Off Mission dates follow the Terminal Leave block, and later pay periods will be removed.';
  if (!confirm(`Apply the ${mode === 'mission_end' ? 'MISSION END DATE' : 'REFRAD REPORT DATE'} of ${formatFullDate(parseIsoDateLocal(dateIso))}? ${dateDescription}`)) return;

  captureLastDayStatusUndo();
  if (!refradScheduleSnapshot) {
    refradScheduleSnapshot = {
      startPpIdx: parseInt(document.getElementById('ppSelect').value, 10),
      previousStartPpIdx,
      activePayPeriodCount,
      userSelections: userSelections.slice(0, activePayPeriodCount).map(row =>
        row.map(statusId => statusId === 'refrad_rpt' ? 'shift' : statusId)
      )
    };
  }
  userSelections.forEach(row => {
    for (let d = 0; d < row.length; d++) {
      if (row[d] === 'refrad_rpt') row[d] = 'shift';
    }
  });

  ensurePayPeriodIndex(location.ppIdx);
  const currentStart = parseInt(document.getElementById('ppSelect').value, 10);
  if (location.ppIdx < currentStart) {
    shiftScheduleStartEarlier(location.ppIdx);
  }
  refradPlanMode = mode;
  refradPlanDate = dateIso;
  updateRefradClearButton();
  REFRAD_BACKFILL_DAYS_NEEDED = 0;
  REFRAD_BACKFILL_DAYS_APPLIED = 0;
  REFRAD_BACKFILL_LEAVE_REMAINING = 0;

  ensureRefradPlanSchedule();
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const targetSlot = location.ppIdx - startPpIdx;
  userSelections[targetSlot][location.dayIdx] = 'refrad_rpt';
  activePayPeriodCount = targetSlot + 1;
  userSelections = userSelections.slice(0, activePayPeriodCount);
  effectiveSelections = effectiveSelections.slice(0, activePayPeriodCount);
  closeInlineStatusPicker();
  closeRangeBuilderModal();
  buildAllPayPeriodGrids();
  finalizeRefradPlanAfterCalculation();
}

function flagCard(s, d) {
  ['grid', 'list'].forEach(view => {
    const el = document.getElementById(`dayRow_${view}_${s}_${d}`);
    if (el) el.classList.add('conflict');
  });
}