// 08-app-startup.js

/* Maintainer map: page startup order and first-run/returning-user setup are handled
 * here. Load and assemble the preceding source files in the order listed by build.ps1.
 */

/* ====================================================================================
   INITIALIZATION ON PAGE LOAD (AUTO-MIGRATES V5 -> V6 & SKIPS WIZARD FOR RETURNING USERS)
   ==================================================================================== */
initPayPeriods();
const loadResult = loadStateFromLocalStorage();
updateRefradClearButton();
updateJumpToCurrentPayPeriodButtons();
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

  const startingLeaveInput = document.getElementById('startingLeaveInput');
  if (startingLeaveInput && !startingLeaveInput.checkValidity()) {
    openSettingsModal();
    setTimeout(() => startingLeaveInput.focus(), 60);
  }

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

/* Register PWA Service Worker when served over HTTP/HTTPS and offer a refresh when a new version installs */
function showUpdateBanner() {
  if (document.getElementById('updateBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<span>A new version is ready.</span><button type="button">Refresh</button><button type="button" class="update-banner-dismiss" aria-label="Dismiss">✕</button>';
  const [refreshBtn, dismissBtn] = banner.querySelectorAll('button');
  refreshBtn.addEventListener('click', () => window.location.reload());
  dismissBtn.addEventListener('click', () => banner.remove());
  document.body.appendChild(banner);
}

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateBanner();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      // Phones keep the app alive in the background, so look for updates whenever it comes back into view.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    }).catch((err) => {
      console.warn('Service worker registration skipped:', err);
    });
  });
}
