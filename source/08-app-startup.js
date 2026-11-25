<!-- 08-app-startup.js -->

/* ====================================================================================
   INITIALIZATION ON PAGE LOAD (AUTO-MIGRATES V5 -> V6 & SKIPS WIZARD FOR RETURNING USERS)
   ==================================================================================== */
initPayPeriods();
const loadResult = loadStateFromLocalStorage();
updatePresetDropdownOptions();

if (loadResult.restored && typeof getPayProfile === 'function' && typeof savePayProfile === 'function') {
  const restoredProf = getPayProfile();
  const uiRoleName = (document.getElementById('smRoleInput')?.value || '').trim();
  if (uiRoleName && restoredProf.roleName !== uiRoleName) {
    restoredProf.roleName = uiRoleName;
    savePayProfile(restoredProf);
  }
}

syncPaySettingsInputs();

if (!loadResult.restored) {
  applyRdoPresetForSlot(0, activeRdoPreset);
  buildAllPayPeriodGrids();
  setViewMode(currentViewMode);
  updateQuickProfileStrip();
  /* Keep storage clean until user completes the 5-step onboarding wizard */
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Storage clear skipped:', e);
  }
  openSetupWizard(false);
} else {
  buildAllPayPeriodGrids();
  setViewMode(currentViewMode);
  updateQuickProfileStrip();

  if (loadResult.migratedFromV5) {
    saveStateToLocalStorage();
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {
      console.warn('Legacy storage clear skipped:', e);
    }

    const upgradeBanner = document.getElementById('sopUpgradeBanner');
    if (upgradeBanner) upgradeBanner.style.display = 'block';
    openSopModal();
  }
}

/* Register PWA Service Worker when served over HTTP/HTTPS */
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration skipped:', err);
    });
  });
}