// 06-sad-pay-calculator.js

/* Maintainer map:
 * Edit pay defaults, BAS assumptions, and role incentives in the settings below.
 * Base-pay/BAH/ZIP data is generated from data\BasePay.csv and data\raw\*.csv by
 * build.ps1; do not hand-edit PAY_RATE_DB in source\07-pay-data.js.
 */

/* ====================================================================================
   [EDIT-PAY-DB] SAD PAY CALCULATOR (BASE PAY + BAH + BAS + ROLE BONUS -> PAY PERIOD)
   ==================================================================================== */
const PAY_DB_FALLBACK = {
  baseByGradeAndYos: {},
  mhaNames: [],
  zipToMhaIdx: {},
  mhaBahByIdx: {}
};

const PAY_DAYS_PER_MONTH = 30;

// Manual code switch: set to false to turn BAS off globally without adding UI controls
const INCLUDE_BAS_BY_DEFAULT = true;

// 2026 monthly BAS rates (Enlisted vs. Officer/Warrant)
const BAS_MONTHLY_RATES_2026 = {
  enlisted: 476.95,
  officer: 328.48
};
const BAS_RATE_YEAR = 2026;

// Per-pay-period role incentive bonuses (USD per pay period, awarded in full if >= 1 On Shift day in PP)
const ROLE_PP_INCENTIVE_BONUS = {
  "C2": 1000,
  "External Support": 1000,
  "Facility Leadership": 2000,
  "General Purpose": 2000
};

// Display labels & pre-tax estimate tag
const PAY_LABELS = {
  base: "Fee-DMNA (Base Pay)",
  adlCom: "Adl Com (BAH + BAS)",
  incentive: "Incentive Pay",
  estimateTag: "Est. · Before Tax"
};

function getPayDatabase() {
  return (typeof PAY_RATE_DB !== "undefined" && PAY_RATE_DB) ? PAY_RATE_DB : PAY_DB_FALLBACK;
}

function getPayRateDataAssumptionText() {
  const rateData = getPayDatabase().rateData || {};
  const yearLabel = (year) => Number.isInteger(Number(year)) && Number(year) > 0
    ? String(Number(year))
    : "year not specified";
  return `Base pay ${yearLabel(rateData.basePayYear)}; BAH ${yearLabel(rateData.bahRateYear)}; ZIP-to-MHA ${yearLabel(rateData.zipMhaYear)}; BAS ${BAS_RATE_YEAR}.`;
}

const PAY_PROFILE_LOOKUP_CACHE = new Map();
const PAY_PERIOD_COMPUTATION_CACHE = new Map();
const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const PAY_PROFILE_DEFAULTS = {
  grade: "E-4",
  yosKey: "over6",
  locationType: "zip",
  zipCode: "",
  mhaName: "",
  depStatus: "withoutDep", // "withDep" | "withoutDep"
  bahEntitled: true,
  basEntitled: true,
  roleName: ""           // "C2" | "External Support" | "Facility Leadership" | "General Purpose" | ""
};

function normalizeBooleanFlag(val, fallback = true) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    if (lower === "true" || lower === "yes" || lower === "1") return true;
    if (lower === "false" || lower === "no" || lower === "0") return false;
  }
  return Boolean(fallback);
}

function normalizeZip5(rawZip) {
  const digits = String(rawZip || "").replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : digits;
}

function getMhaNames() {
  const names = getPayDatabase().mhaNames;
  return Array.isArray(names)
    ? [...new Set(names.filter(name => typeof name === "string" && name.trim()))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    : [];
}

function filterMhaOptions(prefix) {
  const search = document.getElementById(`${prefix}MhaSearch`);
  const select = document.getElementById(`${prefix}MhaSelect`);
  const status = document.getElementById(`${prefix}MhaSearchStatus`);
  if (!search || !select) return;

  const names = getMhaNames();
  const query = search.value.trim().toLocaleLowerCase();
  const matchingNames = query
    ? names.filter(name => name.toLocaleLowerCase().includes(query))
    : names;
  const selectedName = select.value;
  const visibleNames = selectedName && !matchingNames.includes(selectedName)
    ? [selectedName, ...matchingNames]
    : matchingNames;

  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = names.length ? "Choose an MHA" : "MHA data unavailable";
  select.appendChild(placeholder);

  visibleNames.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  select.value = selectedName;

  if (status) {
    status.textContent = query
      ? `${matchingNames.length} matching ${matchingNames.length === 1 ? "area" : "areas"}`
      : `${names.length} ${names.length === 1 ? "area" : "areas"} available`;
  }
}

function syncBahDetailsVisibility(prefix) {
  const bahCheck = document.getElementById(`${prefix}BahEntitledCheck`) || document.getElementById(prefix === "wizPay" ? "wizBahEntitledCheck" : "payBahEntitledCheck");
  const details = document.getElementById(`${prefix}BahDetails`);
  if (details && bahCheck) details.hidden = !bahCheck.checked;
}

function syncPayLocationInputs(prefix, profile) {
  const locationType = profile.locationType === "mha" ? "mha" : "zip";
  const typeSelect = document.getElementById(`${prefix}LocationTypeSelect`);
  const zipField = document.getElementById(`${prefix}ZipField`);
  const mhaField = document.getElementById(`${prefix}MhaField`);
  const zipInput = document.getElementById(`${prefix}ZipInput`);
  const mhaSelect = document.getElementById(`${prefix}MhaSelect`);
  const mhaSearch = document.getElementById(`${prefix}MhaSearch`);

  if (typeSelect) typeSelect.value = locationType;
  if (zipField) zipField.hidden = locationType === "mha";
  if (mhaField) mhaField.hidden = locationType !== "mha";
  if (zipInput) zipInput.value = normalizeZip5(profile.zipCode);
  if (mhaSearch) mhaSearch.value = profile.mhaName || "";
  filterMhaOptions(prefix);
  if (mhaSelect) mhaSelect.value = profile.mhaName || "";
  syncBahDetailsVisibility(prefix);
}

function onPayLocationTypeChange() {
  const locationType = document.getElementById("payLocationTypeSelect")?.value;
  const zipField = document.getElementById("payZipField");
  const mhaField = document.getElementById("payMhaField");
  if (zipField) zipField.hidden = locationType === "mha";
  if (mhaField) mhaField.hidden = locationType !== "mha";
  onPaySettingsChange();
}

function onWizardPayLocationTypeChange() {
  const locationType = document.getElementById("wizPayLocationTypeSelect")?.value;
  const zipField = document.getElementById("wizPayZipField");
  const mhaField = document.getElementById("wizPayMhaField");
  if (zipField) zipField.hidden = locationType === "mha";
  if (mhaField) mhaField.hidden = locationType !== "mha";
  onWizardPayChange();
}

function onMhaSelectChange(prefix) {
  const select = document.getElementById(`${prefix}MhaSelect`);
  const search = document.getElementById(`${prefix}MhaSearch`);
  if (search && select) search.value = select.value;
  if (prefix === "wizPay") onWizardPayChange();
  else onPaySettingsChange();
}

function normalizeRoleName(rawRole, legacyRoleTier) {
  const role = String(rawRole || "").trim();
  if (ROLE_PP_INCENTIVE_BONUS[role] !== undefined) return role;
  if (legacyRoleTier === "c2") return "C2";
  if (legacyRoleTier === "fac_gen") return "Facility Leadership";
  return "";
}

function getPayProfile() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_PAY_PROFILE`);
    if (!raw) return { ...PAY_PROFILE_DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      grade: parsed.grade || PAY_PROFILE_DEFAULTS.grade,
      yosKey: parsed.yosKey || PAY_PROFILE_DEFAULTS.yosKey,
      locationType: parsed.locationType === "mha" ? "mha" : "zip",
      zipCode: normalizeZip5(parsed.zipCode),
      mhaName: typeof parsed.mhaName === "string" ? parsed.mhaName.trim() : "",
      depStatus: parsed.depStatus === "withDep" ? "withDep" : "withoutDep",
      bahEntitled: normalizeBooleanFlag(parsed.bahEntitled, PAY_PROFILE_DEFAULTS.bahEntitled),
      basEntitled: normalizeBooleanFlag(parsed.basEntitled, PAY_PROFILE_DEFAULTS.basEntitled),
      roleName: normalizeRoleName(parsed.roleName, parsed.roleTier)
    };
  } catch (e) {
    return { ...PAY_PROFILE_DEFAULTS };
  }
}

function savePayProfile(profile) {
  try {
    PAY_PROFILE_LOOKUP_CACHE.clear();
    PAY_PERIOD_COMPUTATION_CACHE.clear();
    localStorage.setItem(`${STORAGE_KEY}_PAY_PROFILE`, JSON.stringify({
      grade: profile.grade || PAY_PROFILE_DEFAULTS.grade,
      yosKey: profile.yosKey || PAY_PROFILE_DEFAULTS.yosKey,
      locationType: profile.locationType === "mha" ? "mha" : "zip",
      zipCode: normalizeZip5(profile.zipCode),
      mhaName: typeof profile.mhaName === "string" ? profile.mhaName.trim() : "",
      depStatus: profile.depStatus === "withDep" ? "withDep" : "withoutDep",
      bahEntitled: normalizeBooleanFlag(profile.bahEntitled, PAY_PROFILE_DEFAULTS.bahEntitled),
      basEntitled: normalizeBooleanFlag(profile.basEntitled, PAY_PROFILE_DEFAULTS.basEntitled),
      roleName: normalizeRoleName(profile.roleName, profile.roleTier)
    }));
  } catch (e) {
    console.warn("Pay profile save skipped:", e);
  }
}

/* Truncates (rounds down) to 2 decimal places without floating-point drift */
function truncateCents(amount) {
  const val = Number(amount) || 0;
  return Math.floor((val + 1e-9) * 100) / 100;
}

/* Converts monthly table rates into daily rates (monthly / 30), rounded down to cents */
function convertMonthlyToDaily(monthlyAmount, daysPerMonth = PAY_DAYS_PER_MONTH, floorDaily = true) {
  const monthly = Math.max(0, Number(monthlyAmount) || 0);
  const divisor = daysPerMonth > 0 ? daysPerMonth : 30;
  const rawDaily = monthly / divisor;
  return floorDaily ? truncateCents(rawDaily) : rawDaily;
}

function getMonthlyBasForGrade(grade, basEntitled = true, includeBas = INCLUDE_BAS_BY_DEFAULT) {
  if (!includeBas || !normalizeBooleanFlag(basEntitled, true)) return 0;
  const g = String(grade || "").trim().toUpperCase();
  if (g.startsWith("E-")) return BAS_MONTHLY_RATES_2026.enlisted;
  if (g.startsWith("O-") || g.startsWith("W-")) return BAS_MONTHLY_RATES_2026.officer;
  return 0;
}

function getPpIncentiveBonusForRole(roleName) {
  const key = String(roleName || "").trim();
  return Math.max(0, Number(ROLE_PP_INCENTIVE_BONUS[key]) || 0);
}

function getPayPeriodRoleIncentive(slotIdx, dayStatusIds, fallbackRoleName) {
  const startPpIdx = parseInt(document.getElementById("ppSelect")?.value, 10) || 0;
  const pp = payPeriods[startPpIdx + slotIdx];
  if (!pp) return 0;

  const events = [...transferEvents].sort((a, b) => a.date.localeCompare(b.date));
  let eventIdx = 0;
  let roleName = normalizeRoleName(transferRoleBase) || normalizeRoleName(fallbackRoleName);
  let periodBonus = 0;

  for (let d = 0; d < dayStatusIds.length; d++) {
    const dayIso = toIsoDate(addDays(pp.start, d));
    while (eventIdx < events.length && events[eventIdx].date <= dayIso) {
      roleName = events[eventIdx].roleName;
      eventIdx++;
    }
    periodBonus = Math.max(periodBonus, getPpIncentiveBonusForRole(roleName));
  }
  return periodBonus;
}

function resolveActiveRoleName(profile) {
  if (typeof document !== "undefined") {
    const wizBackdrop = document.getElementById("wizardBackdrop");
    const wizRoleEl = document.getElementById("wizSmRoleInput");
    if (wizBackdrop && wizBackdrop.classList.contains("open") && wizRoleEl && wizRoleEl.value) {
      return normalizeRoleName(wizRoleEl.value);
    }
    const smRoleEl = document.getElementById("smRoleInput");
    if (smRoleEl && smRoleEl.value) {
      return normalizeRoleName(smRoleEl.value);
    }
  }
  return normalizeRoleName(profile && profile.roleName, profile && profile.roleTier);
}

function lookupDailySadRates(profile, includeBas = INCLUDE_BAS_BY_DEFAULT) {
  const roleName = resolveActiveRoleName(profile);
  const cacheKey = JSON.stringify({
    grade: profile.grade,
    yosKey: profile.yosKey,
    locationType: profile.locationType === "mha" ? "mha" : "zip",
    zipCode: normalizeZip5(profile.zipCode),
    mhaName: typeof profile.mhaName === "string" ? profile.mhaName.trim() : "",
    depStatus: profile.depStatus,
    bahEntitled: normalizeBooleanFlag(profile.bahEntitled, true),
    basEntitled: normalizeBooleanFlag(profile.basEntitled, true),
    roleName,
    includeBas
  });
  if (PAY_PROFILE_LOOKUP_CACHE.has(cacheKey)) {
    return PAY_PROFILE_LOOKUP_CACHE.get(cacheKey);
  }

  const db = getPayDatabase();
  const grade = profile.grade || PAY_PROFILE_DEFAULTS.grade;
  const yosKey = profile.yosKey || PAY_PROFILE_DEFAULTS.yosKey;
  const locationType = profile.locationType === "mha" ? "mha" : "zip";
  const zipCode = normalizeZip5(profile.zipCode);
  const selectedMhaName = typeof profile.mhaName === "string" ? profile.mhaName.trim() : "";
  const depStatus = profile.depStatus === "withDep" ? "withDep" : "withoutDep";
  const bahEntitled = normalizeBooleanFlag(profile && profile.bahEntitled, PAY_PROFILE_DEFAULTS.bahEntitled);
  const basEntitled = normalizeBooleanFlag(profile && profile.basEntitled, PAY_PROFILE_DEFAULTS.basEntitled);
  const ppIncentiveBonus = getPpIncentiveBonusForRole(roleName);

  const gradeBaseMap = (db.baseByGradeAndYos && db.baseByGradeAndYos[grade]) || {};
  const monthlyBasePay = Math.max(0, Number(gradeBaseMap[yosKey]) || 0);
  const dailyBasePay = convertMonthlyToDaily(monthlyBasePay, PAY_DAYS_PER_MONTH, true);
  const exactDailyBasePay = convertMonthlyToDaily(monthlyBasePay, PAY_DAYS_PER_MONTH, false);

  let mhaName = "";
  let rawBahRateForMha = 0;

  let mhaIdx;
  if (locationType === "mha") {
    mhaIdx = Array.isArray(db.mhaNames) ? db.mhaNames.indexOf(selectedMhaName) : -1;
    if (mhaIdx < 0) mhaIdx = undefined;
  } else if (zipCode.length === 5 && db.zipToMhaIdx && db.zipToMhaIdx[zipCode] !== undefined) {
    mhaIdx = db.zipToMhaIdx[zipCode];
  }

  if (mhaIdx !== undefined) {
    mhaName = (db.mhaNames && db.mhaNames[mhaIdx]) || "";
    const mhaGrades = (db.mhaBahByIdx && db.mhaBahByIdx[String(mhaIdx)]) || {};
    const pair = mhaGrades[grade]; // [monthlyWithDep, monthlyWithoutDep]
    if (Array.isArray(pair)) {
      rawBahRateForMha = Math.max(0, Number(depStatus === "withDep" ? pair[0] : pair[1]) || 0);
    }
  }

  const monthlyBahOnlyRate = bahEntitled ? rawBahRateForMha : 0;
  const effectiveBasIncluded = Boolean(includeBas) && basEntitled;
  const monthlyBasRate = getMonthlyBasForGrade(grade, basEntitled, includeBas);
  const monthlyBahRate = truncateCents(monthlyBahOnlyRate + monthlyBasRate);
  const dailyBahRate = convertMonthlyToDaily(monthlyBahRate, PAY_DAYS_PER_MONTH, true);
  const exactDailyBahRate = convertMonthlyToDaily(monthlyBahRate, PAY_DAYS_PER_MONTH, false);

  const dailyTotalRate = truncateCents(dailyBasePay + dailyBahRate);

  const result = {
    grade,
    yosKey,
    locationType,
    zipCode,
    selectedMhaName,
    mhaName,
    zipMatched: Boolean(mhaName),
    depStatus,
    bahEntitled,
    basEntitled,
    roleName,
    ppIncentiveBonus,
    basIncluded: effectiveBasIncluded,
    labels: PAY_LABELS,
    monthlyBasePay,
    monthlyBahOnlyRate,
    monthlyBasRate,
    monthlyBahRate,
    dailyBasePay,
    dailyBahRate,
    exactDailyBasePay,
    exactDailyBahRate,
    dailyTotalRate
  };
  PAY_PROFILE_LOOKUP_CACHE.set(cacheKey, result);
  return result;
}

function computePayForPayPeriod(slotIdx, dayStatusIds) {
  const profile = getPayProfile();
  const rates = lookupDailySadRates(profile);
  const startPpIdx = parseInt(document.getElementById("ppSelect")?.value, 10) || 0;
  const payPeriodStart = payPeriods[startPpIdx + slotIdx]?.start;
  const cacheKey = JSON.stringify({
    slotIdx,
    payPeriodStart: payPeriodStart ? toIsoDate(payPeriodStart) : "",
    grade: profile.grade,
    yosKey: profile.yosKey,
    locationType: profile.locationType === "mha" ? "mha" : "zip",
    zipCode: normalizeZip5(profile.zipCode),
    mhaName: typeof profile.mhaName === "string" ? profile.mhaName.trim() : "",
    depStatus: profile.depStatus,
    bahEntitled: normalizeBooleanFlag(profile.bahEntitled, true),
    basEntitled: normalizeBooleanFlag(profile.basEntitled, true),
    roleName: rates.roleName,
    transferRoleBase,
    transferEvents,
    dayStatusIds
  });
  if (PAY_PERIOD_COMPUTATION_CACHE.has(cacheKey)) {
    return PAY_PERIOD_COMPUTATION_CACHE.get(cacheKey);
  }

  let paidSadDays = 0;
  let onShiftDays = 0;

  for (let d = 0; d < dayStatusIds.length; d++) {
    const statusId = dayStatusIds[d];
    const meta = getStatusMeta(statusId);
    if (meta && meta.paidSad) paidSadDays++;
    if (statusId === "shift" || statusId === "transfer") onShiftDays++;
  }

  const ppIncentiveBonus = getPayPeriodRoleIncentive(slotIdx, dayStatusIds, rates.roleName);
  const basePayTotal = truncateCents(paidSadDays * rates.dailyBasePay);
  const bahTotal = truncateCents(paidSadDays * rates.dailyBahRate);
  const incentiveQualified = onShiftDays >= 1;
  const incentiveTotal = incentiveQualified ? truncateCents(ppIncentiveBonus) : 0;
  const totalPay = truncateCents(basePayTotal + bahTotal + incentiveTotal);

  const incentivePart = ppIncentiveBonus > 0
    ? ` + ${PAY_LABELS.incentive} ${formatUsd(incentiveTotal)}`
    : "";

  const result = {
    paidSadDays,
    onShiftDays,
    incentiveQualified,
    ...rates,
    ppIncentiveBonus,
    basePayTotal,
    bahTotal,
    incentiveTotal,
    totalPay,
    summaryText: `${PAY_LABELS.base} ${formatUsd(basePayTotal)} + ${PAY_LABELS.adlCom} ${formatUsd(bahTotal)} (${formatUsd(rates.dailyTotalRate)}/d)${incentivePart} · ${PAY_LABELS.estimateTag}`
  };
  PAY_PERIOD_COMPUTATION_CACHE.set(cacheKey, result);
  return result;
}

function formatUsd(amount) {
  return USD_FORMATTER.format(Number(amount) || 0);
}