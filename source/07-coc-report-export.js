// 07-coc-report-export.js

/* Maintainer map: edit printable report layout and print behavior in [EDIT-PDF-REPORT].
 * The downloadable SAD leave form is a separate PDF asset copied by build.ps1.
 */

/* ====================================================================================
   [EDIT-PDF-REPORT] DA-6 LANDSCAPE REPORT (5 PPs PER SHEET) & SMART PRINT GUARD
   ==================================================================================== */
function escapeReportHtml(value) {
  const container = document.createElement('div');
  container.textContent = String(value ?? '');
  return container.innerHTML;
}

function buildReportAlertsHtml(alertsEl) {
  if (!alertsEl) return '';
  return [...alertsEl.children].map(alert => {
    const alertType = alert.classList.contains('alert-error')
      ? 'alert-error'
      : alert.classList.contains('alert-warn') ? 'alert-warn' : '';
    const alertClass = alertType ? `alert ${alertType}` : 'alert';
    return `<div class="${alertClass}">${escapeReportHtml(alert.textContent || '')}</div>`;
  }).join('');
}

function buildStandaloneReportHtml(autoTriggerPrint) {
  const startPpIdx = parseInt(document.getElementById('ppSelect')?.value, 10) || 0;
  const firstPp = payPeriods[startPpIdx] || payPeriods[0];
  const endPp = payPeriods[startPpIdx + activePayPeriodCount - 1] || firstPp;
  const schedLabel = document.getElementById('schedSelect')?.value === 'alt' ? '10–12 Hr Shift (4/3)' : '8 Hr Shift (5/2)';
  const smName = (document.getElementById('smNameInput')?.value || '').trim() || '______________________';
  const smRole = (document.getElementById('smRoleInput')?.value || '').trim() || '______________________';
  const smFac = (document.getElementById('smFacilityInput')?.value || '').trim() || '______________________';
  const smLeader = (document.getElementById('smLeaderInput')?.value || '').trim() || '______________________';
  const startingLeave = document.getElementById('startingLeaveInput')?.value || '0.00';
  const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const planWindowText = (firstPp && endPp)
    ? `${formatShortDate(firstPp.start)} – ${formatFullDate(endPp.end)}`
    : '';
  const reportTheme = getComputedStyle(document.documentElement);
  const resolveThemeColor = value => {
    const token = /^var\((--[\w-]+)\)$/.exec(value);
    if (!token) return value;
    const color = reportTheme.getPropertyValue(token[1]).trim();
    if (!color) throw new Error(`Report color variable ${token[1]} is not defined.`);
    return color;
  };

  let sectionsHtml = '';
  const summaryRows = [];

  for (let s = 0; s < activePayPeriodCount; s++) {
    const pp = payPeriods[startPpIdx + s];
    if (!pp) continue;

    let thDates = '';
    let thDays = '';
    let tdCells = '';

    for (let d = 0; d < 14; d++) {
      const dayDate = addDays(pp.start, d);
      const iso = toIsoDate(dayDate);
      const badgeInfo = DATE_BADGE_MAP[iso] || null;
      const dayName = DAY_NAMES[d % 7];
      const stObj = getStatusMeta(effectiveSelections[s][d]);
      const statusBackground = resolveThemeColor(stObj.color);
      const statusText = resolveThemeColor(stObj.textCol);
      const statusBorder = resolveThemeColor(stObj.border || stObj.color);
      const isConflict = Boolean(document.getElementById(`dayRow_grid_${s}_${d}`)?.classList.contains('conflict'));

      const holTagHtml = badgeInfo
        ? `<div style="font-size:6.5px;font-weight:700;padding:0 2px;border-radius:2px;margin:1px auto 0;width:fit-content;background:${badgeInfo.isWeekendPair ? '#fef7e0' : '#e8f0fe'};color:${badgeInfo.isWeekendPair ? '#b06000' : '#1a73e8'};">${badgeInfo.label}</div>`
        : '';

      thDates += `<th style="border:1px solid #5f6368;padding:2px;font-size:9px;background:#3c4043;color:#fff;text-align:center;vertical-align:top;">${formatShortDate(dayDate)}${holTagHtml}</th>`;
      thDays += `<th style="border:1px solid #5f6368;padding:1px 2px;font-size:9px;background:#3c4043;color:#fff;text-align:center;">${dayName}</th>`;
      tdCells += `
        <td style="border:1px solid ${isConflict ? '#c5221f' : '#5f6368'};padding:2px;text-align:center;background:${isConflict ? '#fce8e6' : '#f8f9fa'};height:22px;vertical-align:middle;">
          <div style="font-size:8.5px;font-weight:700;padding:1px 2px;border-radius:2px;background:${statusBackground};color:${statusText};border:1px solid ${statusBorder};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${stObj.name}
          </div>
        </td>
      `;
    }

    const da6TablePrint = `
      <div style="overflow:visible;border:1px solid #45474a;border-radius:4px;margin-bottom:4px;background:#202124;">
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <thead>
            <tr>
              <th style="border:1px solid #5f6368;background:#3c4043;color:#fff;font-weight:700;text-align:left;padding-left:5px;width:88px;font-size:9px;">DATE</th>
              ${thDates}
            </tr>
            <tr>
              <th style="border:1px solid #5f6368;background:#3c4043;color:#fff;font-weight:700;text-align:left;padding-left:5px;width:88px;font-size:9px;">DAY</th>
              ${thDays}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid #5f6368;background:#3c4043;color:#fff;font-weight:700;text-align:left;padding-left:5px;width:88px;font-size:9px;">DUTY STATUS</td>
              ${tdCells}
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const rdoAuth = escapeReportHtml(document.getElementById(`rdoAuth_${s}`)?.textContent ?? '0');
    const rdoQual = escapeReportHtml(document.getElementById(`rdoQual_${s}`)?.textContent ?? '');
    const rdoUsed = escapeReportHtml(document.getElementById(`rdoUsed_${s}`)?.textContent ?? '0');
    const rdoDiff = escapeReportHtml(document.getElementById(`rdoDiff_${s}`)?.textContent ?? '');
    const lvTotal = escapeReportHtml(document.getElementById(`lvTotal_${s}`)?.textContent ?? '0.00');
    const lvTotalSub = escapeReportHtml(document.getElementById(`lvTotalSub_${s}`)?.textContent ?? '');

    const cShift = escapeReportHtml(document.getElementById(`countShift_${s}`)?.textContent ?? '0');
    const cRdo = escapeReportHtml(document.getElementById(`countRdo_${s}`)?.textContent ?? '0');
    const cLeave = escapeReportHtml(document.getElementById(`countLeave_${s}`)?.textContent ?? '0');
    const cSpTrv = escapeReportHtml(document.getElementById(`countSpTrv_${s}`)?.textContent ?? '0');
    const cNonSad = escapeReportHtml(document.getElementById(`countNonSad_${s}`)?.textContent ?? '0');
    const cTotal = escapeReportHtml(document.getElementById(`totalAssignedOut_${s}`)?.textContent ?? '14 / 14');

    const alertsHtml = buildReportAlertsHtml(document.getElementById(`alerts_${s}`));
    const deadlineListHtml = escapeReportHtml(document.getElementById(`deadlineList_${s}`)?.textContent ?? '');

    summaryRows.push({ label: `PP ${String(pp.ppNum).padStart(2, '0')}`, cShift, cRdo, cLeave, cSpTrv, cNonSad, cTotal, rdoQual });
    sectionsHtml += `
      <div style="margin-bottom:5px;page-break-inside:avoid;border:1px solid #dadce0;border-radius:5px;padding:5px 7px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;font-weight:700;color:#1a73e8;margin-bottom:3px;border-bottom:1px solid #f1f3f4;padding-bottom:2px;">
          <span>PP ${String(pp.ppNum).padStart(2, '0')}: ${formatShortDate(pp.start)} – ${formatFullDate(pp.end)} ${s === 0 ? '[Beginning PP]' : `[+${s} PP]`}</span>
          <span style="font-size:9px;color:#5f6368;font-weight:600;">Regular days off: ${rdoUsed}/${rdoAuth} (${rdoDiff}) | Ending leave: ${lvTotal} (${lvTotalSub})</span>
        </div>
        <div style="background:#fff;border:1px solid #dadce0;border-left:3px solid #1a73e8;border-radius:3px;padding:2px 6px;margin-bottom:4px;font-size:9px;">
          <strong>📅 Leave submission deadlines (30 days; 60 days for OCONUS):</strong> ${deadlineListHtml}
        </div>
        ${da6TablePrint}
        ${alertsHtml ? `<div style="margin-top:3px;">${alertsHtml}</div>` : ''}
      </div>
    `;
  }

  const sumCols = ['cShift', 'cRdo', 'cLeave', 'cSpTrv', 'cNonSad'];
  const totals = sumCols.map(k => summaryRows.reduce((n, r) => n + (parseInt(r[k], 10) || 0), 0));
  const cell = 'padding:1px 5px;border:1px solid #e8eaed;text-align:center;';
  const summaryHtml = `
    <div style="margin:4px 0;page-break-inside:avoid;font-size:9px;">
      <div style="font-weight:700;color:#1a73e8;margin-bottom:2px;">Summary, all pay periods</div>
      <table style="border-collapse:collapse;width:100%;background:#f8f9fa;">
        <tr style="font-weight:700;"><td style="${cell}">Pay period</td><td style="${cell}">On Shift</td><td style="${cell}">Regular days off</td><td style="${cell}">SAD Leave</td><td style="${cell}">SP / In-Transit</td><td style="${cell}">TDY / INCAP pay</td><td style="${cell}">Days accounted</td><td style="${cell}">Qualifying days</td></tr>
        ${summaryRows.map(r => `<tr><td style="${cell}">${r.label}</td><td style="${cell}">${r.cShift}</td><td style="${cell}">${r.cRdo}</td><td style="${cell}">${r.cLeave}</td><td style="${cell}">${r.cSpTrv}</td><td style="${cell}">${r.cNonSad}</td><td style="${cell}">${r.cTotal}</td><td style="${cell}">${r.rdoQual}</td></tr>`).join('')}
        <tr style="font-weight:700;"><td style="${cell}">Total</td>${totals.map(t => `<td style="${cell}">${t}</td>`).join('')}<td style="${cell}"></td><td style="${cell}"></td></tr>
      </table>
    </div>`;

  const reportHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>NY SAD Duty, Leave &amp; Pay Plan - ${escapeReportHtml(smName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #202124; margin: 0; padding: 6px; background: #fff; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .report-wrap { width: 100%; max-width: 100%; margin: 0 auto; }
  .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a73e8; padding-bottom: 4px; margin-bottom: 5px; }
  .title { font-size: 14px; font-weight: 700; color: #1a73e8; }
  .sub { font-size: 9px; color: #5f6368; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8f9fa; border: 1px solid #dadce0; border-radius: 4px; padding: 4px 8px; margin-bottom: 6px; font-size: 9.5px; line-height: 1.25; }
  .deadline-list { display: flex; flex-direction: column; gap: 2px; }
  .deadline-item { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 9px; padding: 1px 0; border: none; background: transparent; }
  .oconus-toggle { display: none; }
  .alert { padding: 2px 5px; border-radius: 3px; font-size: 8.5px; margin-bottom: 2px; line-height: 1.2; }
  .alert-error { background: #fce8e6; color: #c5221f; border: 1px solid #f5c2c0; }
  .alert-warn { background: #fef7e0; color: #b06000; border: 1px solid #fde293; }
  .policy-cite { font-weight: 700; text-decoration: underline; }
  .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 8px; padding-top: 6px; border-top: 1px solid #dadce0; font-size: 9.5px; page-break-inside: avoid; }
  .sig-line { border-bottom: 1px solid #202124; height: 16px; margin-bottom: 2px; }
  .no-print-bar { background: #e8f0fe; border: 1px solid #b3d7ff; padding: 6px 10px; border-radius: 5px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #174ea6; }
  .print-btn { background: #1a73e8; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-weight: 600; cursor: pointer; }
  body::after { content: ""; position: fixed; inset: 0; background: url("${new URL('./icons/icon-512.png', window.location.href).href}") center / min(70vmin, 520px) no-repeat; opacity: 0.05; pointer-events: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: 11in 8.5in; margin: 4mm; }
  @media print {
    html, body { zoom: 0.72; padding: 0 !important; margin: 0 !important; width: 100%; }
    .report-wrap { width: 100% !important; max-width: 100% !important; }
    .no-print-bar { display: none !important; }
  }
</style>
</head>
<body>
<div class="report-wrap">
  <div class="no-print-bar">
    <span><strong>📄 Formatted for US Letter landscape (about 8 pay periods per page).</strong> Choose <strong>Save as PDF</strong> in your print options.</span>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>
  <div class="top-bar">
    <div>
      <div class="title">NY SAD Duty, Leave &amp; Pay Plan (DA Form 6 layout)</div>
      <div class="sub">Planning rules modeled: 01 Apr 2026 Policy Change 2 | CY27 Holiday Memo (02 Oct 2026) | 49-day limit effective 03 Dec 2026</div>
    </div>
    <div style="font-size:9px; color:#5f6368; text-align:right;">Generated: ${nowStr}</div>
  </div>
  <div class="meta-grid">
    <div><strong>Service member:</strong> ${escapeReportHtml(smName)}<br><strong>Assignment role:</strong> ${escapeReportHtml(smRole)}</div>
    <div><strong>Facility or assignment:</strong> ${escapeReportHtml(smFac)}<br><strong>Chain of command contact:</strong> ${escapeReportHtml(smLeader)}</div>
    <div><strong>Pay periods covered:</strong> ${activePayPeriodCount}<br>${planWindowText}</div>
    <div><strong>Shift schedule:</strong> ${escapeReportHtml(schedLabel)}<br><strong>Leave balance as of 18 Nov 2026:</strong> ${escapeReportHtml(startingLeave)} days</div>
  </div>
  <div>${sectionsHtml}</div>
  ${summaryHtml}
  <div class="sig-grid">
    <div><div class="sig-line"></div><strong>Service Member Signature &amp; Date</strong></div>
    <div><div class="sig-line"></div><strong>Next in Chain of Command</strong></div>
    <div><div class="sig-line"></div><strong>Facility OIC / AO S1 Verification</strong></div>
  </div>
</div>
${autoTriggerPrint ? `<script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };<\/script>` : ''}
</body>
</html>`;
  return reportHtml.replace(/var\((--[\w-]+)\)/g, token => resolveThemeColor(token));
}

function isMobileDevice() {
  const userAgent = navigator.userAgent || '';
  const isIPad = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || isIPad;
}

function getReportFileName() {
  const smNameClean = document.getElementById('smNameInput').value.trim().replace(/\s+/g, '_') || 'SM';
  return `NY_SAD_Duty_Plan_${smNameClean}.html`;
}

// Same Save to Files / share-sheet flow as downloadLeaveForm(). Returns true if handled.
async function shareReportOnMobile() {
  if (!isMobileDevice() || !navigator.share || !navigator.canShare || typeof File !== 'function') return false;
  try {
    const file = new File([buildStandaloneReportHtml(false)], getReportFileName(), { type: 'text/html' });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: 'NY SAD Duty Plan Report' });
    return true;
  } catch (error) {
    if (error && error.name === 'AbortError') return true;
    console.warn('Native file sharing failed:', error);
    alert('The Save to Files menu could not be opened. A browser download will be attempted instead.');
    return false;
  }
}

async function exportToPdfForCoC() {
  if (!validateBeforeExport('pdf')) return;
  if (await shareReportOnMobile()) return;
  if (isMobileDevice()) {
    downloadReportFile();
    return;
  }
  const printWin = window.open('', '_blank');
  if (printWin && printWin.document) {
    printWin.document.open();
    printWin.document.write(buildStandaloneReportHtml(true));
    printWin.document.close();
  } else {
    downloadReportFile();
  }
}

async function downloadStandaloneReport() {
  if (!validateBeforeExport('download')) return;
  if (await shareReportOnMobile()) return;
  downloadReportFile();
}

function downloadReportFile() {
  const blob = new Blob([buildStandaloneReportHtml(!isMobileDevice())], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getReportFileName();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ====================================================================================
   FEEDBACK EMAIL COPY HELPER
   ==================================================================================== */
function copyFeedbackEmail() {
  const email = 'kenton.lee4.mil@army.mil';
  const btn = document.getElementById('copyFeedbackEmailBtn');
  const setCopiedState = () => {
    if (!btn) return;
    const prevText = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.textContent = prevText;
    }, 1800);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(setCopiedState).catch(() => {
      fallbackCopyText(email, setCopiedState);
    });
  } else {
    fallbackCopyText(email, setCopiedState);
  }
}

function fallbackCopyText(text, onDone) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    console.warn('Copy fallback failed:', e);
  }
  document.body.removeChild(ta);
  if (typeof onDone === 'function') onDone();
}
