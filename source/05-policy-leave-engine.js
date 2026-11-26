// 05-policy-leave-engine.js

/* Maintainer map:
 * Edit leave caps/anchors, policy validation, leave deadlines, and duty-status
 * calculations in the [EDIT-*] sections below. Status definitions are in
 * source\03-calendar-holidays-storage.js; pay-rate inputs are in source\06-sad-pay-calculator.js.
 */

/* ====================================================================================
   [EDIT-LEAVE-RATES] 49-DAY LEAVE CAP (EFF. 03 DEC 2026) & 18 NOV 2026 ANCHOR
   ==================================================================================== */
const MAX_LEAVE_DAYS = 49;
const LEAVE_CAP_BUFFER_DAYS = 2;
const LEAVE_CAP_EFFECTIVE_DATE = new Date(2026, 11, 3);
const LEAVE_ANCHOR_DATE = new Date(2026, 10, 18); // 18 NOV 2026

function getLeaveCapResumeThreshold(maxCap = MAX_LEAVE_DAYS, bufferDays = LEAVE_CAP_BUFFER_DAYS) {
  const safeBuffer = Math.max(0, Number(bufferDays) || 0);
  return Math.round((maxCap - safeBuffer) * 100) / 100;
}

function isValidInTransitBridge(previousStatus, nextStatus) {
  return (previousStatus === 'shift' && nextStatus === 'drl') ||
    (previousStatus === 'drl' && nextStatus === 'shift');
}

function policyReferenceLink(label) {
  return `<span class="policy-cite">${label}</span>`;
}

/* ====================================================================================
   ONE-TAP ERROR JUMP BANNER (STICKY TOP BAR)
   ==================================================================================== */
let firstErrorSlotIdx = -1;

function updateErrorJumpBanner(perPpErrors) {
  const banner = document.getElementById('errorJumpBanner');
  const textEl = document.getElementById('errorJumpText');
  if (!banner || !textEl) return;

  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  let totalErrors = 0;
  let errorPpCount = 0;
  firstErrorSlotIdx = -1;

  for (let s = 0; s < activePayPeriodCount; s++) {
    const uniqueErrs = [...new Set(perPpErrors[s])];
    if (uniqueErrs.length > 0) {
      totalErrors += uniqueErrs.length;
      errorPpCount++;
      if (firstErrorSlotIdx === -1) firstErrorSlotIdx = s;
    }
  }

  if (totalErrors > 0 && firstErrorSlotIdx !== -1) {
    const firstPp = payPeriods[startPpIdx + firstErrorSlotIdx];
    const ppLabel = firstPp ? `PP ${String(firstPp.ppNum).padStart(2, '0')}` : `PP #${firstErrorSlotIdx + 1}`;
    const errWord = totalErrors === 1 ? 'Policy Error' : 'Policy Errors';
    const ppScope = errorPpCount > 1 ? ` across ${errorPpCount} Pay Periods` : '';
    const ppSection = document.getElementById(`ppSection_${firstErrorSlotIdx}`);
    const conflictSelector = currentViewMode === 'mobile' ? '.mini-cal-tile.conflict' : '.day-cell.conflict';
    const firstConflictCell = ppSection ? ppSection.querySelector(conflictSelector) : null;
    const dayMatch = firstConflictCell && firstConflictCell.id.match(/_(\d+)_(\d+)$/);
    const firstErrorDate = firstPp && dayMatch
      ? formatFullDate(addDays(firstPp.start, Number(dayMatch[2])))
      : '';
    const locationText = firstErrorDate ? `${ppLabel}, ${firstErrorDate}` : ppLabel;
    textEl.textContent = `❌ ${totalErrors} ${errWord}${ppScope} — First highlighted issue: ${locationText}. Tap to review the message and fix it.`;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

function jumpToFirstPolicyError() {
  if (firstErrorSlotIdx < 0) return;

  const alertsContainer = document.getElementById(`alerts_${firstErrorSlotIdx}`);
  const firstAlert = alertsContainer ? alertsContainer.querySelector('.alert-error') : null;
  const ppSection = document.getElementById(`ppSection_${firstErrorSlotIdx}`);

  const scrollTarget = firstAlert || ppSection;
  if (scrollTarget) {
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (firstAlert) {
    firstAlert.classList.remove('error-flash');
    void firstAlert.offsetWidth;
    firstAlert.classList.add('error-flash');
  }

  if (ppSection) {
    const conflictViewSelector = currentViewMode === 'mobile' ? '.mini-cal-tile.conflict' : '.day-cell.conflict';
    const firstConflictCell = ppSection.querySelector(conflictViewSelector);
    if (firstConflictCell) {
      firstConflictCell.classList.remove('error-flash');
      void firstConflictCell.offsetWidth;
      firstConflictCell.classList.add('error-flash');
    }
  }
}

/* ====================================================================================
   PAY CALCULATOR SYNC, LIVE MHA BADGE & PER-PAY-PERIOD DISPLAY HELPER
   ==================================================================================== */
function resolveRoleIncentiveTierFromUi() {
  const roleVal = (document.getElementById('smRoleInput')?.value || '').trim();
  if (roleVal === 'C2') return 'c2';
  if (roleVal === 'Facility Leadership' || roleVal === 'General Purpose') return 'fac_gen';
  return 'none';
}

function syncPaySettingsInputs() {
  if (typeof getPayProfile !== 'function') return;
  const prof = getPayProfile();
  const gradeEl = document.getElementById('payGradeSelect');
  const yosEl = document.getElementById('payYosSelect');
  const depEl = document.getElementById('payDepSelect');
  const bahEl = document.getElementById('payBahEntitledCheck');
  const basEl = document.getElementById('payBasEntitledCheck');
  if (gradeEl) gradeEl.value = prof.grade;
  if (yosEl) yosEl.value = prof.yosKey;
  syncPayLocationInputs('pay', prof);
  if (depEl) depEl.value = prof.depStatus;
  if (bahEl) bahEl.checked = prof.bahEntitled !== false;
  if (basEl) basEl.checked = prof.basEntitled !== false;
  updatePayZipMhaBadge(prof);
}

function updatePayZipMhaBadge(prof) {
  const badge = document.getElementById('payZipMhaBadge');
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
  const entNote = typeof getEntitlementStatusNote === 'function'
    ? getEntitlementStatusNote(info)
    : (() => {
        const excluded = [];
        if (info.bahEntitled === false) excluded.push('BAH: Not Entitled');
        if (info.basEntitled === false) excluded.push('BAS: Not Entitled');
        return excluded.length > 0 ? ` [${excluded.join(' · ')}]` : '';
      })();

  if (!info.bahEntitled) {
    badge.style.color = 'var(--text-main)';
    badge.textContent = `${labels.base} ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom} ${formatUsd(info.dailyBahRate)}/d${incText} (${formatUsd(info.dailyTotalRate)}/d · ${labels.estimateTag})${entNote}`;
  } else if (info.locationType === 'mha' && !info.zipMatched && !info.selectedMhaName) {
    badge.style.color = 'var(--text-sub)';
    badge.textContent = `${labels.base}: ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom}: ${formatUsd(info.dailyBahRate)}/d${incText} — Choose an MHA for BAH (${labels.estimateTag})${entNote}`;
  } else if (info.locationType === 'mha' && !info.zipMatched) {
    badge.style.color = 'var(--danger)';
    badge.textContent = `⚠️ MHA "${info.selectedMhaName}" unavailable in the BAH table (${labels.base} ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom} ${formatUsd(info.dailyBahRate)}/d${incText} · ${labels.estimateTag})${entNote}`;
  } else if (info.locationType !== 'mha' && !info.zipCode) {
    badge.style.color = 'var(--text-sub)';
    badge.textContent = `${labels.base}: ${formatUsd(info.dailyBasePay)}/d + ${labels.adlCom}: ${formatUsd(info.dailyBahRate)}/d${incText} — Enter 5-digit ZIP for BAH (${labels.estimateTag})${entNote}`;
  } else if (info.locationType !== 'mha' && info.zipCode.length < 5) {
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

function onPaySettingsChange() {
  if (typeof syncBahDetailsVisibility === 'function') syncBahDetailsVisibility('pay');
  if (typeof savePayProfile !== 'function') return;
  const bahEl = document.getElementById('payBahEntitledCheck');
  const basEl = document.getElementById('payBasEntitledCheck');
  const roleVal = (document.getElementById('smRoleInput')?.value || '').trim();
  const prof = {
    grade: document.getElementById('payGradeSelect')?.value || 'E-4',
    yosKey: document.getElementById('payYosSelect')?.value || 'over6',
    locationType: document.getElementById('payLocationTypeSelect')?.value || 'zip',
    zipCode: document.getElementById('payZipInput')?.value || '',
    mhaName: document.getElementById('payMhaSelect')?.value || '',
    depStatus: document.getElementById('payDepSelect')?.value || 'withoutDep',
    bahEntitled: bahEl ? bahEl.checked : true,
    basEntitled: basEl ? basEl.checked : true,
    roleName: roleVal,
    roleTier: resolveRoleIncentiveTierFromUi()
  };
  savePayProfile(prof);
  updatePayZipMhaBadge(prof);
  calculateAllPayPeriods();
  if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function renderPayReadoutForSlot(s, dayStatusIds, runningTotal) {
  if (typeof computePayForPayPeriod !== 'function' || typeof formatUsd !== 'function') {
    return { nextRunningTotal: runningTotal, summaryText: '' };
  }
  const info = computePayForPayPeriod(s, dayStatusIds);
  const nextRunningTotal = typeof truncateCents === 'function'
    ? truncateCents(runningTotal + info.totalPay)
    : Math.round((runningTotal + info.totalPay) * 100) / 100;

  const labels = info.labels || {
    base: 'Fee-DMNA (Base Pay)',
    adlCom: 'Adl Com (BAH + BAS)',
    incentive: 'Incentive Pay',
    estimateTag: 'Est. · Before Tax'
  };

  let boxEl = document.getElementById(`payReadout_${s}`);
  if (!boxEl) {
    const summaryTable = document.getElementById(`summaryTable_${s}`);
    if (summaryTable && summaryTable.parentElement) {
      boxEl = document.createElement('div');
      boxEl.id = `payReadout_${s}`;
      boxEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;background:var(--bg-light);border:1px solid var(--border);border-radius:6px;padding:6px 10px;margin-top:6px;font-size:11.5px;';
      summaryTable.parentElement.insertBefore(boxEl, summaryTable.nextSibling);
    }
  }

  const mhaTag = (info.bahEntitled !== false && info.zipMatched) ? ` [${info.mhaName}]` : '';
  const entTag = typeof getEntitlementStatusNote === 'function' ? getEntitlementStatusNote(info) : '';
  const incAmt = info.ppIncentiveBonus || 0;
  const incSegment = incAmt > 0
    ? ` + ${labels.incentive} ${formatUsd(info.incentiveTotal)}`
    : '';
  const summaryText = `SAD Est. Pay: ${formatUsd(info.totalPay)} (${info.paidSadDays}d @ ${formatUsd(info.dailyTotalRate)}/d${incAmt > 0 ? ` + ${labels.incentive} ${formatUsd(info.incentiveTotal)}` : ''} · ${labels.estimateTag})${entTag} | Cum: ${formatUsd(nextRunningTotal)}`;
  const yearsOfService = info.yosKey === 'lt2'
    ? 'under 2 years'
    : `over ${String(info.yosKey || '').replace(/^over/, '')} years`;
  const locationAssumption = info.locationType === 'mha'
    ? `MHA ${info.selectedMhaName || 'not selected'}`
    : `ZIP ${info.zipCode || 'not entered'}`;
  const profileAssumption = `${info.grade}, ${yearsOfService}, ${locationAssumption}, ${info.depStatus === 'withDep' ? 'with' : 'without'} dependents; BAH ${info.bahEntitled ? 'included when eligible' : 'not included'}; BAS ${info.basEntitled ? 'included when eligible' : 'not included'}.`;
  const rateAssumptions = typeof getPayRateDataAssumptionText === 'function'
    ? getPayRateDataAssumptionText()
    : 'Using the rate tables bundled with this app.';

  if (boxEl) {
    boxEl.innerHTML = `
      <div class="pay-readout-main">
        <span><strong>💵 SAD Pay (${info.grade}, ${info.paidSadDays}d${mhaTag}${entTag}):</strong> ${labels.base} ${formatUsd(info.basePayTotal)} + ${labels.adlCom} ${formatUsd(info.bahTotal)} (${formatUsd(info.dailyTotalRate)}/d)${incSegment}</span>
        <span class="pay-readout-total">PP Est: ${formatUsd(info.totalPay)} &bull; Cum: ${formatUsd(nextRunningTotal)} <span class="pay-readout-note">(${labels.estimateTag})</span></span>
      </div>
      <details class="pay-estimate-assumptions">
        <summary>Estimate assumptions</summary>
        <div class="pay-estimate-assumptions-body">
          <div>${profileAssumption}</div>
          <div>Base pay and applicable BAH + BAS convert monthly rates to daily rates using ÷ 30, round down to cents, then multiply by ${info.paidSadDays} eligible SAD days. The displayed daily rate excludes Incentive Pay.</div>
          <div>Incentive Pay is added once for the pay period when at least one On Shift or Transfer Day qualifies; it is not part of the daily rate.</div>
          <div>Rate data: ${rateAssumptions}</div>
          <div>Estimate is before tax; daily rates are rounded down to cents.</div>
        </div>
      </details>
    `;
  }

  return { nextRunningTotal, summaryText };
}

/* ====================================================================================
   [EDIT-RDO-EARNING] & [EDIT-INTRANSIT-RULES]
   MASTER POLICY ENGINE ('calculateAllPayPeriods')
   ==================================================================================== */
let CALCULATE_ALL_RAF_PENDING = false;

function calculateAllPayPeriodsNow() {
  const schedType = document.getElementById('schedSelect').value;
  const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
  const targetAnchorBal = Math.max(0, parseFloat(document.getElementById('startingLeaveInput').value) || 0);
  let runningEstPay = 0;

  const resumeThreshold = getLeaveCapResumeThreshold(MAX_LEAVE_DAYS, LEAVE_CAP_BUFFER_DAYS);
  const effCapDateStr = formatFullDate(LEAVE_CAP_EFFECTIVE_DATE);

  ensureSlotCapacity(activePayPeriodCount);
  REFRAD_SCHEDULE_EXPANSION_PENDING = false;

  let refradSlot = -1;
  let refradDay = -1;
  for (let s = 0; s < activePayPeriodCount; s++) {
    for (let d = 0; d < 14; d++) {
      effectiveSelections[s][d] = userSelections[s][d];
      if (userSelections[s][d] === 'refrad_rpt') {
        refradSlot = s;
        refradDay = d;
      }

    }
  }

  const isSpecialPassStatus = (stId) => {
    const obj = getStatusMeta(stId);
    return stId === 'sp' || Boolean(obj && obj.isSpecialPass);
  };

  // Compute starting leave balance for slot 0 by stepping backward from 18 NOV 2026
  const getPpLeaveDelta = (ppObj, selRow) => {
    let qualDays = 0;
    let lvDays = 0;
    for (let d = 0; d < 14; d++) {
      const stId = selRow ? selRow[d] : (typeof isDateRegularRdo === 'function' && isDateRegularRdo(addDays(ppObj.start, d)) ? 'rdo' : 'shift');
      const stObj = getStatusMeta(stId);
      if (stObj.leaveQual) qualDays++;
      if (stId === 'lv' || stId === 'term_lv') lvDays++;
    }
    let earned = 0;
    if (qualDays >= 8) earned = 1.25;
    else if (qualDays >= 5) earned = 0.75;
    return { qualDays, lvDays, earned };
  };

  const firstPpStart = payPeriods[0]?.start || ANCHOR_DATE;
  const anchorOffsetDays = Math.floor((LEAVE_ANCHOR_DATE.getTime() - firstPpStart.getTime()) / 86400000);
  const anchorGlobalPpIdx = Math.floor(anchorOffsetDays / 14);
  const anchorDayInPp = ((anchorOffsetDays % 14) + 14) % 14;

  const getStartingLeaveBalance = (selectionRows) => {
    let balance = targetAnchorBal;
    if (anchorGlobalPpIdx < 0) return balance;
    ensurePayPeriodIndex(Math.max(anchorGlobalPpIdx, startPpIdx + activePayPeriodCount));
    const anchorPp = payPeriods[anchorGlobalPpIdx];

    if (startPpIdx <= anchorGlobalPpIdx && anchorPp) {
      const anchorSlotIdx = anchorGlobalPpIdx - startPpIdx;
      const anchorSel = (anchorSlotIdx >= 0 && anchorSlotIdx < selectionRows.length)
        ? selectionRows[anchorSlotIdx]
        : null;

      if (anchorSel) {
        for (let d = anchorDayInPp; d >= 0; d--) {
          if (anchorSel[d] === 'lv' || anchorSel[d] === 'term_lv') {
            balance = Math.round((balance + 1) * 100) / 100;
          }
        }
        if (anchorDayInPp === 13) {
          const anchorDelta = getPpLeaveDelta(anchorPp, anchorSel);
          balance = Math.max(0, Math.round((balance - anchorDelta.earned) * 100) / 100);
        }
      }

      for (let pIdx = anchorGlobalPpIdx - 1; pIdx >= startPpIdx; pIdx--) {
        const pPp = payPeriods[pIdx];
        const slotIdx = pIdx - startPpIdx;
        const pSel = (slotIdx >= 0 && slotIdx < selectionRows.length) ? selectionRows[slotIdx] : null;
        const delta = getPpLeaveDelta(pPp, pSel);
        balance = Math.max(0, Math.round((balance - delta.earned + delta.lvDays) * 100) / 100);
      }
    }
    return balance;
  };

  const simulateLeavePoolAtRefrad = (selectionRows) => {
    let balance = getStartingLeaveBalance(selectionRows);
    let suspended = balance >= MAX_LEAVE_DAYS;
    for (let s = 0; s <= refradSlot; s++) {
      const endDay = s === refradSlot ? refradDay : 13;
      let qualifyingDays = 0;
      let sadLeaveUsed = 0;
      let terminalLeaveUsed = 0;
      for (let d = 0; d <= endDay; d++) {
        const statusId = selectionRows[s]?.[d] || 'shift';
        const status = getStatusMeta(statusId);
        if (status.leaveQual) qualifyingDays++;
        if (statusId === 'lv') sadLeaveUsed++;
        if (statusId === 'term_lv') terminalLeaveUsed++;
      }

      const rawAccrual = qualifyingDays >= 8 ? 1.25 : qualifyingDays >= 5 ? 0.75 : 0;
      const afterSadLeave = Math.round((balance - sadLeaveUsed) * 100) / 100;
      if (suspended && afterSadLeave < resumeThreshold) suspended = false;
      let accrued = rawAccrual;
      if (suspended) {
        accrued = 0;
      } else if (afterSadLeave + rawAccrual >= MAX_LEAVE_DAYS) {
        accrued = Math.max(0, Math.round((MAX_LEAVE_DAYS - afterSadLeave) * 100) / 100);
        suspended = true;
      }
      balance = Math.round((afterSadLeave + accrued - terminalLeaveUsed) * 100) / 100;
    }
    return balance;
  };

  REFRAD_BACKFILL_DAYS_NEEDED = 0;
  REFRAD_BACKFILL_DAYS_APPLIED = 0;
  REFRAD_BACKFILL_LEAVE_REMAINING = 0;
  if (refradSlot !== -1) {
    const isReportDatePlan = refradPlanMode !== 'mission_end';
    const markerPp = payPeriods[startPpIdx + refradSlot];
    if (markerPp && anchorGlobalPpIdx >= 0 && addDays(markerPp.start, refradDay) >= LEAVE_ANCHOR_DATE && startPpIdx > anchorGlobalPpIdx + 1) {
      if (shiftScheduleStartEarlier(anchorGlobalPpIdx + 1)) {
        REFRAD_SCHEDULE_EXPANSION_PENDING = true;
        closeInlineStatusPicker();
        buildAllPayPeriodGrids();
        saveStateToLocalStorage();
        return;
      }
    }

    const baseRows = userSelections.slice(0, activePayPeriodCount).map(row => [...row]);
    const availableDaysBeforeMarker = refradSlot * 14 + refradDay;
    const markerDate = markerPp ? addDays(markerPp.start, refradDay) : LEAVE_ANCHOR_DATE;
    const firstEligibleLeaveDate = addDays(LEAVE_ANCHOR_DATE, 1);
    const scheduleStartDate = payPeriods[startPpIdx]?.start || firstEligibleLeaveDate;
    const candidateStartDate = scheduleStartDate > firstEligibleLeaveDate ? scheduleStartDate : firstEligibleLeaveDate;
    const scheduledCandidateDays = Math.max(0, Math.round((markerDate.getTime() - candidateStartDate.getTime()) / 86400000));
    const daysSinceAnchor = Math.max(0, Math.round((markerDate.getTime() - firstEligibleLeaveDate.getTime()) / 86400000));
    let bestRows = baseRows;
    let bestCount = 0;
    let bestRemaining = simulateLeavePoolAtRefrad(baseRows);

    if (isReportDatePlan) {
      const availableLeave = Math.max(0, bestRemaining);
      bestCount = Math.min(
        Math.floor(MAX_LEAVE_DAYS),
        Math.floor(availableLeave + 0.0001)
      );
      bestRemaining = Math.round((availableLeave - bestCount) * 100) / 100;

      const terminalEndOffset = refradSlot * 14 + refradDay + bestCount;
      const terminalEndSlot = Math.floor(terminalEndOffset / 14);
      const requiredPeriodCount = terminalEndSlot + 1;
      if (requiredPeriodCount !== activePayPeriodCount) {
        const oldCount = activePayPeriodCount;
        activePayPeriodCount = requiredPeriodCount;
        ensurePayPeriodIndex(startPpIdx + activePayPeriodCount + 3);
        ensureSlotCapacity(activePayPeriodCount);
        if (activePayPeriodCount > oldCount) {
          for (let slot = oldCount; slot < activePayPeriodCount; slot++) {
            applyRdoPresetForSlot(slot, activeRdoPreset || 'fri_sun');
          }
        } else {
          userSelections = userSelections.slice(0, activePayPeriodCount);
          effectiveSelections = effectiveSelections.slice(0, activePayPeriodCount);
        }
        REFRAD_SCHEDULE_EXPANSION_PENDING = true;
        closeInlineStatusPicker();
        buildAllPayPeriodGrids();
        saveStateToLocalStorage();
        return;
      }

      bestRows = baseRows.map(row => [...row]);
      for (let i = 1; i <= bestCount; i++) {
        const dayOffset = refradSlot * 14 + refradDay + i;
        const slot = Math.floor(dayOffset / 14);
        const day = dayOffset - slot * 14;
        bestRows[slot][day] = 'term_lv';
      }

      effectiveSelections = bestRows.map(row => [...row]);
      for (let s = 0; s < activePayPeriodCount; s++) {
        for (let d = 0; d < 14; d++) {
          if (s * 14 + d > terminalEndOffset) effectiveSelections[s][d] = 'off_mission';
        }
      }
      REFRAD_BACKFILL_DAYS_NEEDED = bestCount;
      REFRAD_BACKFILL_DAYS_APPLIED = bestCount;
      REFRAD_BACKFILL_LEAVE_REMAINING = bestRemaining;
    } else {
      const maximumCandidateDays = Math.min(
        Math.floor(MAX_LEAVE_DAYS),
        availableDaysBeforeMarker,
        scheduledCandidateDays,
        daysSinceAnchor
      );
      for (let candidateCount = 1; candidateCount <= maximumCandidateDays; candidateCount++) {
        const candidateRows = baseRows.map(row => [...row]);
        for (let i = 1; i <= candidateCount; i++) {
          const dayOffset = refradSlot * 14 + refradDay - i;
          const slot = Math.floor(dayOffset / 14);
          const day = dayOffset - slot * 14;
          candidateRows[slot][day] = 'term_lv';
        }
        const remaining = simulateLeavePoolAtRefrad(candidateRows);
        if (remaining >= -0.005) {
          bestRows = candidateRows;
          bestCount = candidateCount;
          bestRemaining = remaining;
        }
      }

      effectiveSelections = bestRows.map(row => [...row]);
      for (let d = refradDay + 1; d < 14; d++) effectiveSelections[refradSlot][d] = 'off_mission';
      REFRAD_BACKFILL_DAYS_APPLIED = bestCount;
      REFRAD_BACKFILL_LEAVE_REMAINING = Math.max(0, bestRemaining);
      REFRAD_BACKFILL_DAYS_NEEDED = Math.min(
        daysSinceAnchor,
        bestCount + Math.floor(Math.max(0, bestRemaining) + 0.0001)
      );
    }
  }

  let runningLeaveBal = getStartingLeaveBalance(effectiveSelections);
  if (refradSlot !== -1) {
    const markerPp = payPeriods[startPpIdx + refradSlot];
    if (markerPp && REFRAD_BACKFILL_DAYS_NEEDED > REFRAD_BACKFILL_DAYS_APPLIED && startPpIdx > 0) {
      const markerDate = addDays(markerPp.start, refradDay);
      const firstEligibleLeaveDate = addDays(LEAVE_ANCHOR_DATE, 1);
      const neededStartDate = addDays(markerDate, -REFRAD_BACKFILL_DAYS_NEEDED);
      const earliestNeededDate = neededStartDate < firstEligibleLeaveDate ? firstEligibleLeaveDate : neededStartDate;
      const neededOffset = Math.round((earliestNeededDate.getTime() - firstPpStart.getTime()) / 86400000);
      const neededStartPpIdx = Math.max(0, Math.floor(neededOffset / 14));
      if (startPpIdx > neededStartPpIdx && shiftScheduleStartEarlier(neededStartPpIdx)) {
        REFRAD_SCHEDULE_EXPANSION_PENDING = true;
        closeInlineStatusPicker();
        buildAllPayPeriodGrids();
        saveStateToLocalStorage();
        return;
      }
    }
  }

  let accrualSuspended = runningLeaveBal >= MAX_LEAVE_DAYS;
  let globalSpUsageMap = {};
  let terminalPoolRemaining = 0;
  let lastTerminalSlot = refradSlot;
  if (refradSlot !== -1) {
    for (let s = 0; s < activePayPeriodCount; s++) {
      if (effectiveSelections[s].includes('term_lv')) lastTerminalSlot = s;
    }
  }
  const perPpErrors = Array.from({ length: activePayPeriodCount }, () => []);
  const perPpWarnings = Array.from({ length: activePayPeriodCount }, () => []);

  for (let s = 0; s < activePayPeriodCount; s++) {
    const pp = payPeriods[startPpIdx + s];
    if (!pp) continue;

    const startBalForThisPp = runningLeaveBal;

    for (let d = 0; d < 14; d++) {
      ['grid', 'list'].forEach(view => {
        const rowEl = document.getElementById(`dayRow_${view}_${s}_${d}`);
        if (rowEl) rowEl.classList.remove('conflict');
      });
    }

    if (refradSlot !== -1 && refradPlanMode === 'mission_end' && s > refradSlot) {
      for (let d = 0; d < 14; d++) {
        effectiveSelections[s][d] = 'off_mission';
      }
    }

    if (s === refradSlot) {
      let preRefradLeaveQual = 0;
      let preRefradSadLeaveUsed = 0;
      let preRefradTerminalLeaveUsed = 0;
      for (let d = 0; d <= refradDay; d++) {
        const stId = effectiveSelections[s][d];
        const stObj = getStatusMeta(stId);
        if (stObj.leaveQual) preRefradLeaveQual++;
        if (stId === 'lv') preRefradSadLeaveUsed++;
        if (stId === 'term_lv') preRefradTerminalLeaveUsed++;
      }

      let refradPpEarned = 0;
      if (preRefradLeaveQual >= 8) refradPpEarned = 1.25;
      else if (preRefradLeaveQual >= 5) refradPpEarned = 0.75;

      let balAfterPreLv = Math.round((startBalForThisPp - preRefradSadLeaveUsed) * 100) / 100;
      let tempSuspended = accrualSuspended;
      if (tempSuspended && balAfterPreLv < resumeThreshold) tempSuspended = false;
      if (!tempSuspended) {
        if (balAfterPreLv + refradPpEarned >= MAX_LEAVE_DAYS) {
          refradPpEarned = Math.max(0, Math.round((MAX_LEAVE_DAYS - balAfterPreLv) * 100) / 100);
        }
      } else {
        refradPpEarned = 0;
      }

      terminalPoolRemaining = Math.round(
        (balAfterPreLv + refradPpEarned - preRefradTerminalLeaveUsed -
          (refradPlanMode === 'mission_end' ? 0 : REFRAD_BACKFILL_DAYS_APPLIED)) * 100
      ) / 100;

      if (refradPlanMode === 'mission_end') {
        for (let d = refradDay + 1; d < 14; d++) {
          effectiveSelections[s][d] = 'off_mission';
        }
      }
    }

    let rdoQualDays = 0;
    let leaveQualDays = 0;
    let shiftCount = 0;
    let rdoSelected = 0;
    let sadLeaveCount = 0;
    let termLeaveCount = 0;
    let spQualCount = 0;
    let trvQualCount = 0;
    let nonSadCount = 0;
    let assignedCount = 0;

    const isoToDayIdx = {};
    for (let d = 0; d < 14; d++) {
      const dayDate = addDays(pp.start, d);
      isoToDayIdx[toIsoDate(dayDate)] = d;
      const stId = effectiveSelections[s][d];
      const stObj = getStatusMeta(stId);

      updateCardVisual(s, d, stId);

      if (stId !== 'unassigned') assignedCount++;
      if (stObj.rdoQual) rdoQualDays++;
      if (stObj.leaveQual) leaveQualDays++;

      if (stId === 'shift' || stId === 'transfer' || stId === 'refrad_rpt') shiftCount++;
      else if (stId === 'rdo') rdoSelected++;
      else if (stId === 'lv') sadLeaveCount++;
      else if (stId === 'term_lv') termLeaveCount++;
      else if (stId === 'trv') trvQualCount++;
      else if (stId === 'drl' || stId === 'incap') nonSadCount++;
      else if (stObj.isSpecialPass) spQualCount++;

      if (stObj.isSpecialPass) {
        if (!globalSpUsageMap[stId]) globalSpUsageMap[stId] = [];
        globalSpUsageMap[stId].push({ s, d, label: `${getDayLabel(pp, d)} (PP ${String(pp.ppNum).padStart(2, '0')})` });
      }
    }

    HOLIDAY_RULES.forEach(h => {
      if (h.type === 'weekday') {
        const holIdx = isoToDayIdx[h.dates[0]];
        if (holIdx !== undefined) {
          const holSt = effectiveSelections[s][holIdx];
          if (holSt === 'term_lv' || holSt === 'off_mission') return;
          const isSp = isSpecialPassStatus(holSt);
          if (!isSp && holSt !== 'shift' && holSt !== 'transfer' && holSt !== 'refrad_rpt' && holSt !== 'drl') {
            flagCard(s, holIdx);
            perPpErrors[s].push(
              `<span class="policy-cite">NYS SAD Special Holiday Pass Memo (02 OCT 2026), Para 2 &amp; 5:</span> ` +
              `${h.baseName} (${getDayLabel(pp, holIdx)}) cannot be coded as ${getStatusMeta(holSt).name}. Must be Special Pass, On Shift, or TDY.`
            );
          }
        }
      } else if (h.type === 'sat_holiday' || h.type === 'sun_holiday') {
        const d1Idx = isoToDayIdx[h.day1Date];
        const d2Idx = isoToDayIdx[h.day2Date];
        if (d1Idx !== undefined && d2Idx !== undefined) {
          const s1 = effectiveSelections[s][d1Idx];
          const s2 = effectiveSelections[s][d2Idx];
          if (s1 === 'term_lv' || s2 === 'term_lv' || s1 === 'off_mission' || s2 === 'off_mission') return;
          if (s1 === 'rdo' && s2 === 'rdo') {
            flagCard(s, d1Idx);
            flagCard(s, d2Idx);
            perPpErrors[s].push(`<span class="policy-cite">Weekend Holiday Rule (02 OCT 2026 Memo):</span> ${h.baseName} cannot be RDO + RDO.`);
          } else if (((s1 === 'shift' || s1 === 'transfer' || s1 === 'refrad_rpt') && s2 === 'rdo') || (s1 === 'rdo' && (s2 === 'shift' || s2 === 'transfer' || s2 === 'refrad_rpt'))) {
            flagCard(s, d1Idx);
            flagCard(s, d2Idx);
            perPpErrors[s].push(`<span class="policy-cite">Weekend Holiday Rule (02 OCT 2026 Memo):</span> ${h.baseName} cannot pair On Shift with RDO. Replace RDO with Special Pass.`);
          }
        }
      }
    });

    let rdoEarned = 0;
    let rdoSubLabel = '';
    const tableCite = schedType === 'alt' ? '4/3 Schedule (6 RDO Max)' : '5/2 Schedule (4 RDO Max)';

    if (refradSlot !== -1 && s > refradSlot) {
      rdoEarned = 0;
      rdoSubLabel = 'Post-REFRAD';
    } else if (ENABLE_EARNED_RDO_SYSTEM) {
      const effectiveRdoQual = RDO_EARNED_STRICTLY_ON_SHIFT_ONLY ? shiftCount : rdoQualDays;
      rdoSubLabel = RDO_EARNED_STRICTLY_ON_SHIFT_ONLY ? `${effectiveRdoQual} On Shift days` : `${effectiveRdoQual} qual days`;

      if (RDO_EARNED_STRICTLY_ON_SHIFT_ONLY && shiftCount < 3) {
        rdoEarned = 0;
        if (rdoSelected > 0) {
          for (let d = 0; d < 14; d++) if (effectiveSelections[s][d] === 'rdo') flagCard(s, d);
          perPpErrors[s].push(
            `${policyReferenceLink('RDO Policy, Para 6.b:', null)} ` +
            `Minimum 3 "Present for Duty" (On Shift) days required within a pay period to earn paid Pass Days (currently ${shiftCount} On Shift days, but ${rdoSelected} RDOs selected).`
          );
        }
      } else if (schedType === 'alt') {
        if (effectiveRdoQual >= 8) rdoEarned = 6;
        else if (effectiveRdoQual >= 5) rdoEarned = 4;
        else if (effectiveRdoQual === 4) rdoEarned = 3;
        else if (effectiveRdoQual === 3) rdoEarned = 1;
      } else {
        if (effectiveRdoQual >= 10) rdoEarned = 4;
        else if (effectiveRdoQual >= 7) rdoEarned = 3;
        else if (effectiveRdoQual >= 5) rdoEarned = 2;
        else if (effectiveRdoQual >= 3) rdoEarned = 1;
      }
    } else {
      rdoEarned = (schedType === 'alt') ? 6 : 4;
      rdoSubLabel = schedType === 'alt' ? '4/3 Sched (3/wk)' : '5/2 Sched (2/wk)';
    }

    let rawLeaveEarned = 0;
    if (refradSlot !== -1 && s > refradSlot) {
      rawLeaveEarned = 0;
    } else {
      if (leaveQualDays >= 8) rawLeaveEarned = 1.25;
      else if (leaveQualDays >= 5) rawLeaveEarned = 0.75;
    }

    const totalLeaveUsedThisPp = sadLeaveCount + termLeaveCount;
    let balAfterDeduction = Math.round((startBalForThisPp - sadLeaveCount) * 100) / 100;

    if (accrualSuspended && balAfterDeduction < resumeThreshold) accrualSuspended = false;

    let actualLeaveAccrued = rawLeaveEarned;
    if (accrualSuspended) {
      actualLeaveAccrued = 0;
      perPpWarnings[s].push(`<span class="policy-cite">${MAX_LEAVE_DAYS.toFixed(0)}-Day Leave Cap (Eff. ${effCapDateStr}):</span> Accrual stopped until leave balance falls below ${resumeThreshold.toFixed(2)} days.`);
    } else if (balAfterDeduction + rawLeaveEarned >= MAX_LEAVE_DAYS) {
      actualLeaveAccrued = Math.max(0, Math.round((MAX_LEAVE_DAYS - balAfterDeduction) * 100) / 100);
      accrualSuspended = true;
      perPpWarnings[s].push(`<span class="policy-cite">${MAX_LEAVE_DAYS.toFixed(0)}-Day Leave Cap Reached (Eff. ${effCapDateStr}):</span> Balance capped at ${MAX_LEAVE_DAYS.toFixed(2)} days until balance drops below ${resumeThreshold.toFixed(2)}.`);
    }

    let endBalForThisPp = Math.round((balAfterDeduction + actualLeaveAccrued - termLeaveCount) * 100) / 100;

    if (endBalForThisPp < 0) {
      const availableLeave = Math.max(0, startBalForThisPp + actualLeaveAccrued);
      let leaveUsedThroughDay = 0;
      let exhaustionDay = -1;
      for (let d = 0; d < 14; d++) {
        const statusId = effectiveSelections[s][d];
        if (statusId === 'lv' || statusId === 'term_lv') {
          leaveUsedThroughDay++;
          if (exhaustionDay === -1 && leaveUsedThroughDay > availableLeave) exhaustionDay = d;
        }
      }
      const startPpIdx = parseInt(document.getElementById('ppSelect').value, 10);
      const pp = payPeriods[startPpIdx + s];
      const exhaustionDate = pp && exhaustionDay >= 0
        ? formatFullDate(addDays(pp.start, exhaustionDay))
        : '';
      if (exhaustionDay >= 0) flagCard(s, exhaustionDay);
      perPpErrors[s].push(
        `<span class="policy-cite">Exhausted SAD Leave Balance:</span> ` +
        `Leave balance dropped below zero (${endBalForThisPp.toFixed(2)})${exhaustionDate ? ` when leave was scheduled on ${exhaustionDate}` : ''}. ` +
        `SMs cannot take more SAD Leave than accrued. Remove or move leave starting on the highlighted date.`
      );
    }

    runningLeaveBal = endBalForThisPp;

    const rdoAuthEl = document.getElementById(`rdoAuth_${s}`);
    const rdoQualEl = document.getElementById(`rdoQual_${s}`);
    const rdoUsedEl = document.getElementById(`rdoUsed_${s}`);
    if (rdoAuthEl) rdoAuthEl.textContent = rdoEarned;
    if (rdoQualEl) rdoQualEl.textContent = rdoSubLabel;
    if (rdoUsedEl) rdoUsedEl.textContent = rdoSelected;

    const rdoDiff = rdoEarned - rdoSelected;
    const rdoDiffEl = document.getElementById(`rdoDiff_${s}`);
    if (rdoDiffEl) {
      if (rdoDiff === 0) {
        rdoDiffEl.textContent = 'Matches auth';
        rdoDiffEl.style.color = 'var(--success)';
      } else if (rdoDiff > 0) {
        rdoDiffEl.textContent = `${rdoDiff} unused`;
        rdoDiffEl.style.color = 'var(--success)';
      } else {
        rdoDiffEl.textContent = `${Math.abs(rdoDiff)} over limit!`;
        rdoDiffEl.style.color = 'var(--danger)';
        for (let d = 0; d < 14; d++) if (effectiveSelections[s][d] === 'rdo') flagCard(s, d);
        perPpErrors[s].push(`${policyReferenceLink(`RDO Limit Exceeded (${tableCite}), Para 6.b:`, null)} Selected ${rdoSelected} RDOs, exceeding ${rdoEarned} authorized for this pay period.`);
      }
    }

    const lvTotalEl = document.getElementById(`lvTotal_${s}`);
    const lvTotalSubEl = document.getElementById(`lvTotalSub_${s}`);
    if (lvTotalEl) {
      lvTotalEl.textContent = endBalForThisPp.toFixed(2);
      lvTotalEl.style.color = endBalForThisPp < 0 ? 'var(--danger)' : 'var(--primary)';
    }
    if (lvTotalSubEl) {
      lvTotalSubEl.textContent = `Start: ${startBalForThisPp.toFixed(2)} | Net: ${(actualLeaveAccrued - totalLeaveUsedThisPp >= 0 ? '+' : '')}${(actualLeaveAccrued - totalLeaveUsedThisPp).toFixed(2)}`;
    }

    const countShiftEl = document.getElementById(`countShift_${s}`);
    const countRdoEl = document.getElementById(`countRdo_${s}`);
    const countLeaveEl = document.getElementById(`countLeave_${s}`);
    const countSpTrvEl = document.getElementById(`countSpTrv_${s}`);
    const countNonSadEl = document.getElementById(`countNonSad_${s}`);
    const totalAssignedEl = document.getElementById(`totalAssignedOut_${s}`);
    if (countShiftEl) countShiftEl.textContent = shiftCount;
    if (countRdoEl) countRdoEl.textContent = rdoSelected;
    if (countLeaveEl) countLeaveEl.textContent = sadLeaveCount + termLeaveCount;
    if (countSpTrvEl) countSpTrvEl.textContent = spQualCount + trvQualCount;
    if (countNonSadEl) countNonSadEl.textContent = nonSadCount;
    if (totalAssignedEl) totalAssignedEl.textContent = `${assignedCount} / 14`;

    const payRes = renderPayReadoutForSlot(s, effectiveSelections[s], runningEstPay);
    runningEstPay = payRes.nextRunningTotal;
  }

  if (refradSlot !== -1 && terminalPoolRemaining > 0) {
    if (REFRAD_BACKFILL_DAYS_NEEDED > REFRAD_BACKFILL_DAYS_APPLIED) {
      perPpWarnings[refradSlot].push(
        `<span class="policy-cite">Terminal Leave Could Not Be Fully Scheduled:</span> ` +
        `${Math.floor(terminalPoolRemaining)} whole leave day(s) remain because the schedule does not include enough earlier dates.`
      );
    } else if (terminalPoolRemaining >= 1.0) {
      perPpWarnings[refradSlot].push(
        `<span class="policy-cite">Terminal Leave Balance Remaining:</span> ` +
        `${Math.floor(terminalPoolRemaining)} whole leave day(s) remain. Your balance is as of 18 Nov 2026, so there may not be enough days after that date to schedule all of it before REFRAD.`
      );
    } else if (terminalPoolRemaining < 1.0 && lastTerminalSlot !== -1) {
      perPpWarnings[lastTerminalSlot].push(
        `<span class="policy-cite">Terminal Leave Fractional Remainder:</span> ` +
        `${terminalPoolRemaining.toFixed(2)} fractional leave day(s) remain after whole Terminal Leave days were applied (SAD Leave is charged in full-day increments).`
      );
    }
  }

  const timeline = [];
  for (let s = 0; s < activePayPeriodCount; s++) {
    const pp = payPeriods[startPpIdx + s];
    if (!pp) continue;
    for (let d = 0; d < 14; d++) {
      const st = effectiveSelections[s][d];
      timeline.push({
        s,
        d,
        st,
        isPassOrSp: st === 'rdo' || isSpecialPassStatus(st),
        isSp: isSpecialPassStatus(st),
        isDuty: st === 'shift' || st === 'transfer' || st === 'refrad_rpt',
        dateObj: addDays(pp.start, d),
        label: getDayLabel(pp, d)
      });
    }
  }

  if (PROHIBIT_LEAVE_TOUCHING_RDO) {
    for (let i = 0; i < timeline.length - 1; i++) {
      const curr = timeline[i];
      const next = timeline[i + 1];

      if ((curr.st === 'lv' && next.isPassOrSp) || (curr.isPassOrSp && next.st === 'lv')) {
        flagCard(curr.s, curr.d);
        flagCard(next.s, next.d);
        perPpErrors[next.s].push(
          `<span class="policy-cite">Rescinded 22 OCT 2026 Pass Policy, Para 1.j &amp; 1.k:</span> ` +
          `SAD Leave cannot touch RDO or Special Pass days (${curr.label} &amp; ${next.label}).`
        );
      }
    }
  }

  if (ENFORCE_BOOKEND_RULE) {
    let idx = 0;
    while (idx < timeline.length) {
      if (timeline[idx].st === 'lv') {
        let lvEnd = idx;
        while (lvEnd + 1 < timeline.length && timeline[lvEnd + 1].st === 'lv') lvEnd++;

        const hasLeftPass = idx > 0 && timeline[idx - 1].isPassOrSp;
        const hasRightPass = lvEnd + 1 < timeline.length && timeline[lvEnd + 1].isPassOrSp;
        if (hasLeftPass && hasRightPass) {
          for (let k = idx; k <= lvEnd; k++) flagCard(timeline[k].s, timeline[k].d);
          perPpErrors[timeline[idx].s].push(
            `<span class="policy-cite">Rescinded 22 OCT 2026 Leave Policy, Para 2.c (Bookend Rule):</span> ` +
            `RDO / Special Pass days cannot bookend both sides of a SAD Leave block (${timeline[idx].label} to ${timeline[lvEnd].label}).`
          );
        }

        let scan = lvEnd + 1;
        if (scan < timeline.length && timeline[scan].isPassOrSp) {
          while (scan < timeline.length && timeline[scan].isPassOrSp) scan++;
          if (scan < timeline.length && timeline[scan].st === 'lv') {
            for (let k = lvEnd; k <= scan; k++) flagCard(timeline[k].s, timeline[k].d);
            perPpErrors[timeline[scan].s].push(
              `<span class="policy-cite">Rescinded 22 OCT 2026 Leave Policy, Para 2.c (Bookend Rule):</span> ` +
              `SAD Leave days are not authorized on both sides ("bookends") of an RDO and/or Special Pass Day (${timeline[lvEnd].label} through ${timeline[scan].label}).`
            );
          }
        }
        idx = lvEnd + 1;
      } else {
        idx++;
      }
    }
  }

  /* ====================================================================================
     IN-TRANSIT (TRAVEL) VALIDATION (01 APR 2026 CHANGE 2)
     ==================================================================================== */
  const wedPresets = ['mon_wed', 'tue_thu', 'wed_fri', 'tue_wed', 'wed_thu'];
  const thuPresets = ['thu_sat', 'tue_thu', 'wed_fri', 'thu_fri', 'wed_thu'];
  const rdoIncludesWed = wedPresets.includes(activeRdoPreset) || effectiveSelections[0][6] === 'rdo' || effectiveSelections[0][13] === 'rdo';
  const lastSlot = activePayPeriodCount - 1;
  const rdoIncludesThu = thuPresets.includes(activeRdoPreset) || effectiveSelections[lastSlot][0] === 'rdo' || effectiveSelections[lastSlot][7] === 'rdo';

  for (let i = 0; i < timeline.length; i++) {
    const curr = timeline[i];
    if (curr.st === 'trv') {
      const prev = i > 0 ? timeline[i - 1] : null;
      const next = i < timeline.length - 1 ? timeline[i + 1] : null;
      let hasHardError = false;

      if (prev && (prev.isPassOrSp || prev.st === 'lv' || prev.st === 'term_lv')) {
        flagCard(prev.s, prev.d);
        flagCard(curr.s, curr.d);
        hasHardError = true;
        perPpErrors[curr.s].push(
          `${policyReferenceLink('JTF Sentinel Policy Change 2 (01 APR 2026), Para 9.b (PDF p.3):', 3)} ` +
          `In-Transit day (${curr.label}) cannot be used immediately after an RDO, Leave day, or Special Pass (${prev.label}).`
        );
      }
      if (next && (next.isPassOrSp || next.st === 'lv' || next.st === 'term_lv')) {
        flagCard(curr.s, curr.d);
        flagCard(next.s, next.d);
        hasHardError = true;
        perPpErrors[curr.s].push(
          `${policyReferenceLink('JTF Sentinel Policy Change 2 (01 APR 2026), Para 9.b (PDF p.3):', 3)} ` +
          `In-Transit day (${curr.label}) cannot be used immediately before an RDO, Leave day, or Special Pass (${next.label}).`
        );
      }

      if (prev && next) {
        const bridgesShiftAndTdy = isValidInTransitBridge(prev.st, next.st);
        if (!bridgesShiftAndTdy && !hasHardError) {
          flagCard(curr.s, curr.d);
          if (prev.isDuty && next.isDuty) {
            perPpErrors[curr.s].push(
              `${policyReferenceLink('Modeled In-Transit rule; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `In-Transit (${curr.label}) must connect On Shift with TDY. Para 4.e covers the 120-mile travel authorization; confirm status coding with orders and unit guidance.`
            );
          } else if (prev.st === 'drl' && curr.d === 13 && next.d === 0) {
            flagCard(next.s, next.d);
            perPpErrors[curr.s].push(
              `${policyReferenceLink('Modeled pay-period boundary check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Day 13 is TDY and Day 14 is In-Transit (${curr.label}), so Day 1 of the next pay period (${next.label}) MUST be On Shift.`
            );
          } else if (prev.isDuty && curr.d === 13 && next.d === 0) {
            flagCard(next.s, next.d);
            perPpErrors[curr.s].push(
              `${policyReferenceLink('Modeled pay-period boundary check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Day 13 is On Shift and Day 14 is In-Transit (${curr.label}), so Day 1 of the next pay period (${next.label}) MUST be TDY.`
            );
          } else if (curr.d === 0 && next.st === 'drl') {
            flagCard(prev.s, prev.d);
            perPpErrors[curr.s].push(
              `${policyReferenceLink('Modeled pay-period boundary check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Day 1 is In-Transit (${curr.label}) and Day 2 is TDY, so Wednesday of the previous pay period (${prev.label}) MUST be On Shift.`
            );
          } else if (curr.d === 0 && next.isDuty) {
            flagCard(prev.s, prev.d);
            perPpErrors[curr.s].push(
              `${policyReferenceLink('Modeled pay-period boundary check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Day 1 is In-Transit (${curr.label}) and Day 2 is On Shift, so Wednesday of the previous pay period (${prev.label}) MUST be TDY.`
            );
          } else {
            perPpErrors[curr.s].push(
              `${policyReferenceLink('Modeled In-Transit rule; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `In-Transit (${curr.label}) must connect On Shift with TDY. Para 4.e covers the 120-mile travel authorization; confirm status coding with orders and unit guidance.`
            );
          }
        }
      } else if (!prev && next) {
        if (next.st === 'drl') {
          if (rdoIncludesWed) {
            flagCard(curr.s, curr.d);
            perPpErrors[curr.s].push(
              `${policyReferenceLink('Modeled In-Transit / RDO check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Day 1 (${curr.label}) is In-Transit and Day 2 is TDY, but your regular RDOs include Wednesday. Confirm Wednesday of the previous pay period is switched to On Shift.`
            );
          } else {
            perPpWarnings[curr.s].push(
              `${policyReferenceLink('Modeled previous pay-period check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Because Day 1 (${curr.label}) is In-Transit and Day 2 is TDY, make sure the last day (Wednesday) of the previous pay period is coded as On Shift.`
            );
          }
        } else if (next.isDuty) {
          perPpWarnings[curr.s].push(
            `${policyReferenceLink('Modeled previous pay-period check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
            `Because Day 1 (${curr.label}) is In-Transit and Day 2 is On Shift, make sure the last day (Wednesday) of the previous pay period is coded as TDY.`
          );
        } else if (!hasHardError) {
          flagCard(curr.s, curr.d);
          perPpErrors[curr.s].push(
            `${policyReferenceLink('Modeled In-Transit rule; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
            `Day 1 (${curr.label}) is In-Transit, so Day 2 must be either TDY or On Shift.`
          );
        }
      } else if (prev && !next) {
        if (prev.st === 'drl') {
          if (rdoIncludesThu) {
            perPpWarnings[curr.s].push(
              `${policyReferenceLink('Modeled next pay-period / RDO check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Day 13 is TDY and Day 14 (${curr.label}) is In-Transit. Your regular RDOs include Thursday—make sure Day 1 (Thursday) of the next pay period is switched to On Shift.`
            );
          } else {
            perPpWarnings[curr.s].push(
              `${policyReferenceLink('Modeled next pay-period check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
              `Day 13 is TDY and Day 14 (${curr.label}) is In-Transit—make sure Day 1 (Thursday) of the next pay period is coded as On Shift.`
            );
          }
        } else if (prev.isDuty) {
          perPpWarnings[curr.s].push(
            `${policyReferenceLink('Modeled next pay-period check; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
            `Day 13 is On Shift and Day 14 (${curr.label}) is In-Transit—make sure Day 1 (Thursday) of the next pay period is coded as On Shift.`
          );
        } else if (!hasHardError) {
          flagCard(curr.s, curr.d);
          perPpErrors[curr.s].push(
            `${policyReferenceLink('Modeled In-Transit rule; related policy reference: Para 4.e (PDF p.2)', 2)}: ` +
            `Day 14 (${curr.label}) is In-Transit, so Day 13 must be either TDY or On Shift.`
          );
        }
      }
    }
  }

  Object.keys(globalSpUsageMap).forEach(spId => {
    const usages = globalSpUsageMap[spId];
    if (usages.length > 1) {
      const stMeta = getStatusMeta(spId);
      usages.forEach(u => {
        flagCard(u.s, u.d);
        perPpErrors[u.s].push(
          `<span class="policy-cite">Special Pass Once-Only Limit (02 OCT 2026 Memo, Para 2):</span> ` +
          `${stMeta.name} was used ${usages.length} times (${usages.map(x => x.label).join(', ')}). Only 1 day is authorized per holiday across all pay periods.`
        );
      });
    }
  });

  for (let s = 0; s < activePayPeriodCount; s++) {
    const alertsEl = document.getElementById(`alerts_${s}`);
    if (!alertsEl) continue;
    alertsEl.innerHTML = '';

    [...new Set(perPpErrors[s])].forEach(err => {
      const div = document.createElement('div');
      div.className = 'alert alert-error';
      div.innerHTML = `❌ ${err}`;
      const help = document.createElement('div');
      help.className = 'alert-helper';
      help.textContent = 'To fix: tap a red-highlighted date, choose an allowed duty status, and the planner will recheck your schedule.';
      div.appendChild(help);
      alertsEl.appendChild(div);
    });

    [...new Set(perPpWarnings[s])].forEach(warn => {
      const div = document.createElement('div');
      div.className = 'alert alert-warn';
      div.innerHTML = `⚠️ ${warn}`;
      alertsEl.appendChild(div);
    });
  }

  updateErrorJumpBanner(perPpErrors);
  updatePerPayPeriodDeadlines(timeline);

  if (activePicker.open && activePicker.s >= 0 && activePicker.d >= 0) {
    renderInlineStatusPicker(activePicker.s, activePicker.d);
    highlightSelectedDate();
  }
}

function calculateAllPayPeriods() {
  if (CALCULATE_ALL_RAF_PENDING) return;
  CALCULATE_ALL_RAF_PENDING = true;
  window.requestAnimationFrame(() => {
    CALCULATE_ALL_RAF_PENDING = false;
    calculateAllPayPeriodsNow();
  });
}

/* ====================================================================================
   [EDIT-DEADLINES] LEAVE SUBMISSION LEAD TIMES (30 DAYS / 60 DAYS OCONUS)
   ==================================================================================== */
function updatePerPayPeriodDeadlines(timeline) {
  const allBlocks = [];
  let currentBlock = null;

  timeline.forEach(item => {
    if (item.st === 'lv' || item.st === 'term_lv') {
      if (!currentBlock) {
        currentBlock = {
          id: toIsoDate(item.dateObj),
          type: item.st === 'term_lv' ? 'Terminal Leave' : 'SAD Leave',
          startDate: item.dateObj,
          endDate: item.dateObj,
          days: 1,
          slots: new Set([item.s])
        };
      } else {
        currentBlock.endDate = item.dateObj;
        currentBlock.days++;
        currentBlock.slots.add(item.s);
        if (item.st === 'term_lv') currentBlock.type = 'Terminal Leave';
      }
    } else if (currentBlock) {
      allBlocks.push(currentBlock);
      currentBlock = null;
    }
  });
  if (currentBlock) allBlocks.push(currentBlock);

  for (let s = 0; s < activePayPeriodCount; s++) {
    const listEl = document.getElementById(`deadlineList_${s}`);
    if (!listEl) continue;
    listEl.innerHTML = '';

    const blocksForThisSlot = allBlocks.filter(b => b.slots.has(s));

    if (blocksForThisSlot.length === 0) {
      listEl.innerHTML = `<div style="font-size: 11px; color: var(--text-sub);">No SAD Leave or Terminal Leave scheduled in this pay period.</div>`;
      continue;
    }

    blocksForThisSlot.forEach(b => {
      const isOconus = Boolean(oconusBlockFlags[b.id]);
      const due30d = addDays(b.startDate, -30);
      const due60d = addDays(b.startDate, -60);
      const spanTag = b.slots.size > 1 ? ` <em>(Spans multiple PPs)</em>` : '';

      const item = document.createElement('div');
      item.className = 'deadline-item';
      item.innerHTML = `
        <div>
          <strong>${b.type} (${b.days} day${b.days > 1 ? 's' : ''}): ${formatShortDate(b.startDate)} – ${formatFullDate(b.endDate)}${spanTag}</strong><br>
          <span style="color: var(--text-sub); font-size: 11px;">
            &bull; Leave Packet Submission (30-Day Notice): <strong>Due ${formatFullDate(due30d)}</strong>
            ${isOconus ? `<br><span style="color: var(--danger); font-weight: 700;">✈️ OCONUS Foreign Travel Submission (60-Day Notice — All Branches): Due ${formatFullDate(due60d)}</span>` : ''}
          </span>
        </div>
        <label class="oconus-toggle">
          <input type="checkbox" ${isOconus ? 'checked' : ''} onchange="toggleOconusBlock('${b.id}', this.checked)">
          OCONUS Travel?
        </label>
      `;
      listEl.appendChild(item);
    });
  }
}

function toggleOconusBlock(blockId, isChecked) {
  oconusBlockFlags[blockId] = isChecked;
  calculateAllPayPeriods();
  saveStateToLocalStorage();
}