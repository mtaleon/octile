// --- Event listeners (replaces inline onclick) ---

// Header buttons
document.getElementById('menu-btn').addEventListener('click', returnToWelcome);
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('pause-play-btn').addEventListener('click', resumeGame);
document.getElementById('pause-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) resumeGame();
});

// Auto-pause on visibility change (tab hidden, app backgrounded)
// Track energy when leaving, show recovery toast on return
let _energyOnHide = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _stopHealthPoll();
    _energyOnHide = _feature('energy') ? Math.floor(getEnergyState().points) : 0;
    if (timerStarted && !gameOver && !paused) {
      pauseGame();
    }
  } else {
    _startHealthPoll();
    // Flow 5: returning to app — check if energy recovered
    if (_feature('energy')) {
      const nowPlays = Math.floor(getEnergyState().points);
      if (nowPlays > _energyOnHide && _energyOnHide <= 0) {
        // Was at zero, now has plays — show recovery toast
        const toast = document.getElementById('achieve-toast');
        toast.querySelector('.toast-icon').textContent = '\u2615';
        toast.querySelector('.toast-label').textContent = '';
        toast.querySelector('.toast-name').textContent = t('energy_ready');
        toast.classList.add('show');
        if (achieveToastTimer) clearTimeout(achieveToastTimer);
        achieveToastTimer = setTimeout(() => { toast.classList.remove('show'); achieveToastTimer = null; }, 4000);
      }
      updateEnergyDisplay();
    }
    updateExpDisplay();
    updateDiamondDisplay();
  }
});

function closeSettingsAndDo(fn) {
  _closeSettings();
  setTimeout(fn, 350);
}
document.getElementById('help-btn').addEventListener('click', () => closeSettingsAndDo(() => document.getElementById('help-modal').classList.add('show')));
document.getElementById('goals-btn').addEventListener('click', () => closeSettingsAndDo(() => showGoalsModal()));
document.getElementById('messages-btn').addEventListener('click', () => closeSettingsAndDo(showMessagesModal));

// Settings modal
const THEMES = [
  { id: 'default', key: 'theme_classic', cost: 0 },
  { id: 'lego', key: 'theme_lego', cost: 0 },
  { id: 'wood', key: 'theme_wood', cost: 0 },
  { id: 'stained-glass', key: 'theme_stained_glass', cost: 500 },
  { id: 'marble-gold', key: 'theme_marble_gold', cost: 800 },
  { id: 'quilt', key: 'theme_quilt', cost: 500 },
  { id: 'deep-sea', key: 'theme_deep_sea', cost: 1000 },
  { id: 'space-galaxy', key: 'theme_space_galaxy', cost: 1500 },
  { id: 'botanical', key: 'theme_botanical', cost: 500 },
  { id: 'cyberpunk', key: 'theme_cyberpunk', cost: 1000 },
  { id: 'ancient-ink', key: 'theme_ancient_ink', cost: 800 },
  { id: 'ukiyo-e', key: 'theme_ukiyo_e', cost: 1000 },
  { id: 'steampunk', key: 'theme_steampunk', cost: 1500 },
  { id: 'frozen', key: 'theme_frozen', cost: 800 },
  { id: 'halloween', key: 'theme_halloween', cost: 800 },
];
function getThemeCost(th) { return _cfg('themeCosts.' + th.id, th.cost); }
const THEME_SWATCHES = {
  'default':       ['#1a1a40','#e74c3c','#3498db','#f1c40f','#ecf0f1','#888','#16213e','#e74c3c','#3498db'],
  'lego':          ['#2d8a4e','#c0392b','#2980b9','#f39c12','#ecf0f1','#7f8c8d','#1a5c2a','#c0392b','#2980b9'],
  'wood':          ['#6b4226','#a63c2e','#2b5e7e','#c49a2a','#d4c5a9','#8b7355','#5c3a1e','#a63c2e','#2b5e7e'],
  'stained-glass': ['#18082a','#b83230','#1e6898','#c8a010','#a8b8c0','#7a6830','#2a1a3a','#b83230','#1e6898'],
  'marble-gold':   ['#ece4d6','#d8c8a8','#c0aa80','#dcc888','#f0ebe0','#b0a090','#c8b898','#d8c8a8','#c0aa80'],
  'quilt':         ['#f0e0cc','#c85040','#4a7c6f','#d8a848','#ecdcc8','#a89080','#6a5040','#c85040','#4a7c6f'],
  'deep-sea':      ['#081420','#186878','#0c4468','#188878','#50c8b8','#1e3a48','#051018','#186878','#0c4468'],
  'space-galaxy':  ['#08041a','#6828a0','#220e50','#8838b8','#b858d8','#3a1860','#08041a','#6828a0','#220e50'],
  'botanical':     ['#1a2e1a','#488838','#2a6228','#70b050','#98d080','#4a6840','#142014','#488838','#2a6228'],
  'cyberpunk':     ['#0a0a16','#ff2a6d','#05d9e8','#c8f0ff','#ff6898','#282838','#0a0a16','#ff2a6d','#05d9e8'],
  'ancient-ink':   ['#efe6d4','#282420','#484440','#b83020','#d8d0c0','#888078','#d4cab8','#282420','#484440'],
  'ukiyo-e':       ['#281a10','#b83828','#285878','#c89838','#dcc898','#5a4030','#281a10','#b83828','#285878'],
  'steampunk':     ['#18100a','#8a6830','#604820','#a88038','#c0a060','#4a3a28','#1a1008','#8a6830','#604820'],
  'frozen':        ['#e4ecf4','#88c0e0','#5898c8','#a8d0e8','#f0f6fc','#98b0c4','#a8c0d8','#88c0e0','#5898c8'],
  'halloween':     ['#18081a','#d85820','#7028a0','#d89818','#e8b848','#3a1a3a','#180a18','#d85820','#7028a0'],
};
function getUnlockedThemes() {
  try { return JSON.parse(localStorage.getItem('octile_unlocked_themes') || '[]'); } catch(e) { return []; }
}
function isThemeUnlocked(id) {
  var th = THEMES.find(t => t.id === id);
  if (!th || getThemeCost(th) === 0) return true;
  return getUnlockedThemes().indexOf(id) >= 0;
}
function unlockTheme(id) {
  var list = getUnlockedThemes();
  if (list.indexOf(id) < 0) { list.push(id); localStorage.setItem('octile_unlocked_themes', JSON.stringify(list)); }
}
const ALL_THEME_CLASSES = THEMES.filter(t => t.id !== 'default').map(t => t.id + '-theme');
function getCurrentTheme() {
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].id !== 'default' && document.body.classList.contains(THEMES[i].id + '-theme')) return THEMES[i].id;
  }
  return 'default';
}
function setTheme(theme) {
  ALL_THEME_CLASSES.forEach(c => document.body.classList.remove(c));
  if (theme !== 'default') document.body.classList.add(theme + '-theme');
  try { localStorage.setItem('octile-theme', theme); } catch(e) {}
}
var _themeScrollIdx = 0;
function _themeVisibleCount() {
  var scroll = document.getElementById('theme-scroll');
  if (!scroll) return 3;
  return Math.max(1, Math.floor(scroll.clientWidth / 84));
}
function _updateThemeScroll() {
  var grid = document.getElementById('theme-grid');
  var leftBtn = document.getElementById('theme-left');
  var rightBtn = document.getElementById('theme-right');
  if (!grid) return;
  var vis = _themeVisibleCount();
  var _themeCount = !_feature('paid_themes') ? THEMES.filter(function(th) { return getThemeCost(th) === 0; }).length : THEMES.length;
  var maxIdx = Math.max(0, _themeCount - vis);
  _themeScrollIdx = Math.max(0, Math.min(_themeScrollIdx, maxIdx));
  grid.style.transform = 'translateX(' + (-_themeScrollIdx * 84) + 'px)';
  if (leftBtn) leftBtn.disabled = _themeScrollIdx <= 0;
  if (rightBtn) rightBtn.disabled = _themeScrollIdx >= maxIdx;
}
function renderThemeGrid() {
  var grid = document.getElementById('theme-grid');
  if (!grid) return;
  var cur = getCurrentTheme();
  // Electron D1: only free themes (no paid themes, no lock icons, no purchase flow)
  var visibleThemes = !_feature('paid_themes') ? THEMES.filter(function(th) { return getThemeCost(th) === 0; }) : THEMES;
  var html = '';
  visibleThemes.forEach(th => {
    var unlocked = isThemeUnlocked(th.id);
    var active = th.id === cur;
    var cls = 'theme-tile' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');
    var swatch = THEME_SWATCHES[th.id] || THEME_SWATCHES['default'];
    html += '<div class="' + cls + '" data-theme="' + th.id + '">';
    if (active) html += '<span class="theme-check">\u2714</span>';
    html += '<div class="theme-swatch">';
    for (var s = 0; s < 9; s++) html += '<span style="background:' + swatch[s] + '"></span>';
    html += '</div>';
    html += '<div class="theme-name">' + t(th.key) + '</div>';
    if (!unlocked && _feature('paid_themes')) html += '<div class="theme-lock">' + t('theme_locked').replace('{cost}', getThemeCost(th)) + '</div>';
    html += '</div>';
  });
  grid.innerHTML = html;
  // Scroll to active theme on first render
  var activeIdx = THEMES.findIndex(th => th.id === cur);
  if (activeIdx >= 0) {
    var vis = _themeVisibleCount();
    _themeScrollIdx = Math.max(0, activeIdx - Math.floor(vis / 2));
  }
  _updateThemeScroll();
  grid.querySelectorAll('.theme-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      var id = tile.dataset.theme;
      if (!isThemeUnlocked(id)) {
        var th = THEMES.find(t => t.id === id);
        document.getElementById('settings-modal').classList.remove('show');
        showDiamondPurchase(t(th.key), getThemeCost(th), () => {
          unlockTheme(id);
          setTheme(id);
          document.getElementById('settings-modal').classList.add('show');
          renderThemeGrid();
        });
        return;
      }
      setTheme(id);
      renderThemeGrid();
    });
  });
}
document.getElementById('theme-left').addEventListener('click', () => { _themeScrollIdx--; _updateThemeScroll(); });
document.getElementById('theme-right').addEventListener('click', () => { _themeScrollIdx++; _updateThemeScroll(); });
function updateSettingsLabels() {
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  var langSelect = document.getElementById('settings-lang-select');
  langSelect.value = _langPref;
  var langKeys = { system: 'lang_system', en: 'lang_en', zh: 'lang_zh' };
  for (var li = 0; li < langSelect.options.length; li++) {
    var lk = langKeys[langSelect.options[li].value];
    if (lk) langSelect.options[li].textContent = t(lk);
  }
  document.getElementById('settings-theme-label').textContent = t('menu_theme');
  renderThemeGrid();
}
document.getElementById('sound-btn').addEventListener('click', toggleSound);
_updateSoundBtn();
document.getElementById('settings-btn').addEventListener('click', () => {
  updateSettingsLabels();
  if (_isDebugEnv()) _updateDebugUI();
  var dot = document.querySelector('#settings-btn .settings-dot');
  if (dot) dot.classList.remove('show');
  document.getElementById('settings-modal').classList.add('show');
});
document.getElementById('settings-close').addEventListener('click', () => _closeSettings());
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) _closeSettings();
});

// Bottom sheet swipe-to-dismiss
(function() {
  var handle = document.getElementById('settings-handle');
  var content = document.getElementById('settings-content');
  var modal = document.getElementById('settings-modal');
  var dragging = false, startY = 0, currentDeltaY = 0, dragStartTime = 0;

  function onStart(e) {
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    currentDeltaY = 0;
    dragStartTime = Date.now();
    content.classList.add('dragging');
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    var y = e.touches ? e.touches[0].clientY : e.clientY;
    currentDeltaY = Math.max(0, y - startY); // only allow downward drag
    content.style.transform = 'translateY(' + currentDeltaY + 'px)';
    e.preventDefault();
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    content.classList.remove('dragging');
    var duration = Date.now() - dragStartTime;
    var velocity = duration > 0 ? currentDeltaY / duration : 0;
    // Dismiss if fast swipe down or dragged past 30% of content height
    if (velocity > 0.3 || currentDeltaY > content.offsetHeight * 0.3) {
      content.style.transform = 'translateY(100%)';
      setTimeout(function() {
        modal.classList.remove('show');
        content.style.transform = '';
      }, 300);
    } else {
      content.style.transform = '';
    }
    currentDeltaY = 0;
  }
  handle.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  handle.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
})();

function _closeSettings() {
  var content = document.getElementById('settings-content');
  var modal = document.getElementById('settings-modal');
  content.style.transform = 'translateY(100%)';
  setTimeout(function() {
    modal.classList.remove('show');
    content.style.transform = '';
  }, 300);
}
document.getElementById('settings-lang-select').addEventListener('change', (e) => {
  setLang(e.target.value);
  updateSettingsLabels();
});
// Theme grid handles its own clicks via renderThemeGrid()
// --- Debug panel (local/dev only) --- (handlers below, vars declared near Turnstile)

function _isDebugEnv() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || _cfg('debug', false);
}

function _updateDebugUI() {
  const offBtn = document.getElementById('debug-offline-btn');
  const hintBtn = document.getElementById('debug-hints-btn');
  const energyBtn = document.getElementById('debug-energy-btn');
  if (offBtn) offBtn.textContent = _debugForceOffline ? 'ON' : 'OFF';
  if (hintBtn) hintBtn.textContent = _debugUnlimitedHints ? 'ON' : 'OFF';
  if (energyBtn) energyBtn.textContent = _debugUnlimitedEnergy ? 'ON' : 'OFF';
  // Steam config debug info
  var steamEl = document.getElementById('debug-steam-info');
  if (steamEl && _isElectron) {
    var phase = _appConfig._steamPhase || '-';
    var status = _appConfig._steamConfigStatus || 'pending';
    var ago = _appConfig._steamConfigFetchedAt ? Math.round((Date.now() - _appConfig._steamConfigFetchedAt) / 60000) + 'm ago' : '-';
    var flags = _appConfig.features || {};
    var flagStr = Object.keys(flags).map(function(k) { return k + '=' + (flags[k] ? 'on' : 'off'); }).join(' ');
    steamEl.textContent = 'Steam: ' + phase + ' | ' + status + ' | ' + ago + '\nFlags: ' + (flagStr || 'none');
  }
}

if (_isDebugEnv()) {
  const dbg = document.getElementById('debug-section');
  if (dbg) dbg.style.display = '';

  document.getElementById('debug-offline-btn').addEventListener('click', () => {
    _debugForceOffline = !_debugForceOffline;
    if (_debugForceOffline) {
      _backendOnline = false;
      _levelTotals = {..._getOfflineTotals()};
    } else {
      refreshBackendStatus();
      fetchLevelTotals().then(() => updateWelcomeLevels());
    }
    updateWelcomeLevels();
    _saveDebugConfig();
    _updateDebugUI();
  });

  document.getElementById('debug-hints-btn').addEventListener('click', () => {
    _debugUnlimitedHints = !_debugUnlimitedHints;
    updateHintBtn();
    _saveDebugConfig();
    _updateDebugUI();
  });

  document.getElementById('debug-energy-btn').addEventListener('click', () => {
    _debugUnlimitedEnergy = !_debugUnlimitedEnergy;
    updateEnergyDisplay();
    _saveDebugConfig();
    _updateDebugUI();
  });
}

// Restore saved theme
try {
  const saved = localStorage.getItem('octile-theme');
  if (saved && saved !== 'default') setTheme(saved);
} catch(e) {}

// Control bar
document.getElementById('ctrl-random').addEventListener('click', loadRandomPuzzle);
document.getElementById('ctrl-restart').addEventListener('click', () => {
  if (_feature('energy') && gameOver && !hasEnoughEnergy()) { showEnergyModal(true); return; }
  resetGame(currentPuzzleNumber);
});
document.getElementById('ctrl-undo').addEventListener('click', function() { _kbUndoLastPlacement(); });
document.getElementById('ctrl-rotate').addEventListener('click', function() { _doRotateSelected(); });
document.getElementById('hint-btn').addEventListener('click', showHint);

// Level navigation
document.getElementById('level-prev').addEventListener('click', () => goLevelSlot(currentSlot - 1));
document.getElementById('level-next').addEventListener('click', () => {
  if (!currentLevel) return;
  const nextSlot = currentSlot + 1;
  const total = getEffectiveLevelTotal(currentLevel);
  const completed = getLevelProgress(currentLevel);
  if (nextSlot <= total && _feature('blockUnsolved') && isBlockUnsolved() && nextSlot > completed + 1) {
    showDiamondPurchase(t('unlock_puzzle_name'), UNLOCK_PUZZLE_DIAMOND_COST, () => {
      setLevelProgress(currentLevel, nextSlot - 1);
      goLevelSlot(nextSlot);
    });
    return;
  }
  goLevelSlot(nextSlot);
});

// 3-tier navigation: modal back buttons + backdrop close
document.getElementById('chapter-back').addEventListener('click', () => document.getElementById('chapter-modal').classList.remove('show'));
document.getElementById('path-back').addEventListener('click', () => {
  document.getElementById('path-modal').classList.remove('show');
});
document.getElementById('chapter-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('chapter-modal')) document.getElementById('chapter-modal').classList.remove('show');
});
document.getElementById('path-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('path-modal')) document.getElementById('path-modal').classList.remove('show');
});

// Win card
document.getElementById('win-share-btn').addEventListener('click', shareWin);
document.getElementById('win-view-btn').addEventListener('click', () => {
  document.getElementById('win-overlay').classList.remove('show');
  clearConfetti();
  document.body.classList.add('win-view-mode');
});
document.getElementById('win-back-btn').addEventListener('click', () => {
  document.body.classList.remove('win-view-mode');
  _showWinStep(3);
  document.getElementById('win-overlay').classList.add('show');
});
// Win step advancement: tap step 1 → step 2 → step 3
document.getElementById('win-step1').addEventListener('click', function() {
  if (_winStep === 1) {
    if (!_feature('win_meta')) {
      // Skip reward modal, go straight to step 3
      _showWinStep(3);
      playSound('select');
    } else {
      playSound('achieve'); haptic([30, 20, 60]);
      _showWinRewardModal();
    }
  }
});
document.getElementById('win-step2').addEventListener('click', function() {
  if (_winStep === 2) { _showWinStep(3); playSound('select'); }
});
document.getElementById('win-prev-btn').addEventListener('click', () => {
  document.getElementById('win-overlay').classList.remove('show');
  goLevelSlot(currentSlot - 1);
});
document.getElementById('win-next-btn').addEventListener('click', nextPuzzle);
document.getElementById('win-random-btn').addEventListener('click', winRandom);
document.getElementById('win-menu-btn').addEventListener('click', returnToWelcome);

// Energy display & modal
document.getElementById('energy-display').addEventListener('click', () => showEnergyModal(false));
document.getElementById('energy-close').addEventListener('click', () => document.getElementById('energy-modal').classList.remove('show'));

// Achievement/Goals modal
document.getElementById('achieve-close').addEventListener('click', () => document.getElementById('achieve-modal').classList.remove('show'));
document.getElementById('achieve-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.achieve-tab');
  if (!btn) return;
  _achieveTab = btn.dataset.tab;
  renderAchieveModal();
});

// Profile modal
document.getElementById('profile-btn').addEventListener('click', () => closeSettingsAndDo(showProfileModal));
document.getElementById('profile-close').addEventListener('click', () => document.getElementById('profile-modal').classList.remove('show'));
document.getElementById('profile-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
// Messages modal
document.getElementById('messages-close').addEventListener('click', () => document.getElementById('messages-modal').classList.remove('show'));
document.getElementById('messages-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
// Multiplier confirm modal
document.getElementById('multiplier-confirm-start').addEventListener('click', () => {
  var modal = document.getElementById('multiplier-confirm-modal');
  var value = modal._pendingValue || 2;
  modal.classList.remove('show');
  activateMultiplier(value);
});
document.getElementById('multiplier-confirm-skip').addEventListener('click', () => {
  var modal = document.getElementById('multiplier-confirm-modal');
  var value = modal._pendingValue || 2;
  modal.classList.remove('show');
  // Save to message center for later claiming
  addClaimableMultiplier(value);
});

// Quit confirm modal
document.getElementById('quit-cancel-btn').addEventListener('click', () => {
  document.getElementById('quit-confirm-modal').classList.remove('show');
});
document.getElementById('quit-confirm-btn').addEventListener('click', () => {
  document.getElementById('quit-confirm-modal').classList.remove('show');
  clearConfetti();
  returnToWelcome();
});

// Auth modal
document.getElementById('auth-close').addEventListener('click', () => document.getElementById('auth-modal').classList.remove('show'));
document.getElementById('auth-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
document.getElementById('auth-agree-check').addEventListener('change', function() {
  document.getElementById('auth-magic-btn').disabled = !this.checked;
});
document.getElementById('auth-magic-btn').addEventListener('click', _sendMagicLink);
document.getElementById('auth-magic-resend').addEventListener('click', function() {
  // Resend magic link for the same email
  if (_magicLinkEmail) {
    document.getElementById('auth-email').value = _magicLinkEmail;
    _sendMagicLink();
  } else {
    document.getElementById('auth-form-magic').style.display = '';
    document.getElementById('auth-form-magic-sent').style.display = 'none';
  }
});
// Enter key submits magic link form
document.getElementById('auth-email').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !document.getElementById('auth-magic-btn').disabled) _sendMagicLink();
});

// Scoreboard modal
updateOnlineUI();
document.getElementById('scoreboard-btn').addEventListener('click', () => { tutStep7_LockedFeature(); closeSettingsAndDo(showScoreboardModal); });
document.getElementById('sb-share-btn').addEventListener('click', shareGame);
document.getElementById('scoreboard-close').addEventListener('click', () => document.getElementById('scoreboard-modal').classList.remove('show'));
document.querySelectorAll('.sb-tab').forEach(btn => {
  btn.addEventListener('click', () => switchSbTab(btn.dataset.tab));
});

// Daily challenge leaderboard modal
document.getElementById('dc-lb-close').addEventListener('click', () => document.getElementById('dc-leaderboard-modal').classList.remove('show'));

// Modal backdrop click (with stopPropagation on content)
['help-modal', 'energy-modal', 'achieve-modal', 'scoreboard-modal', 'dc-leaderboard-modal'].forEach(id => {
  const modal = document.getElementById(id);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
});
document.getElementById('help-close').addEventListener('click', () => document.getElementById('help-modal').classList.remove('show'));

// Android back button handler — returns true if handled
var _modalIds = ['dc-leaderboard-modal', 'reward-modal', 'diamond-purchase-modal', 'auth-modal', 'profile-modal', 'help-modal', 'energy-modal', 'achieve-modal', 'scoreboard-modal', 'chapter-modal', 'path-modal', 'messages-modal', 'multiplier-confirm-modal', 'quit-confirm-modal', 'settings-modal'];
function handleAndroidBack() {
  // 1. Close any open modal (highest priority first)
  for (var i = 0; i < _modalIds.length; i++) {
    var el = document.getElementById(_modalIds[i]);
    if (el && el.classList.contains('show')) {
      if (_modalIds[i] === 'settings-modal') _closeSettings();
      else el.classList.remove('show');
      return true;
    }
  }
  // 2. Close win overlay
  var win = document.getElementById('win-overlay');
  if (win && win.classList.contains('show')) {
    win.classList.remove('show');
    clearConfetti();
    returnToWelcome();
    return true;
  }
  // 2.5. Exit win-view-mode (back to win overlay)
  if (document.body.classList.contains('win-view-mode')) {
    document.body.classList.remove('win-view-mode');
    _showWinStep(3);
    document.getElementById('win-overlay').classList.add('show');
    return true;
  }
  // 3. If in gameplay, show quit confirm or return to welcome
  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn && menuBtn.style.display !== 'none') {
    if (gameStarted && !gameOver) {
      document.getElementById('quit-confirm-modal').classList.add('show');
      return true;
    }
    returnToWelcome();
    return true;
  }
  // 4. Not handled — let Android exit
  return false;
}

// --- Keyboard & Mouse controls (PC/Steam) ---
var _kbCursorR = -1, _kbCursorC = -1;
var _inputMode = 'mouse'; // 'mouse' | 'keyboard'

// Track input mode: mouse movement hides keyboard cursor, keyboard shows it
document.addEventListener('mousemove', () => {
  if (_inputMode === 'keyboard') {
    _inputMode = 'mouse';
    document.querySelectorAll('.cell.kb-cursor').forEach(c => c.classList.remove('kb-cursor'));
  }
}, { passive: true });
document.addEventListener('keydown', () => { _inputMode = 'keyboard'; }, { capture: true, passive: true });

function _isModalOpen() {
  for (var i = 0; i < _modalIds.length; i++) {
    var el = document.getElementById(_modalIds[i]);
    if (el && el.classList.contains('show')) return true;
  }
  return document.getElementById('win-overlay').classList.contains('show');
}

function _isInGame() {
  return document.body.classList.contains('in-game') && !gameOver && !paused;
}

function _updateKbCursor() {
  document.querySelectorAll('.cell.kb-cursor').forEach(c => c.classList.remove('kb-cursor'));
  if (_inputMode !== 'keyboard' || _kbCursorR < 0 || _kbCursorC < 0) return;
  var cell = document.querySelector('.cell[data-row="' + _kbCursorR + '"][data-col="' + _kbCursorC + '"]');
  if (cell) cell.classList.add('kb-cursor');
}

function _kbPlaceAtCursor() {
  if (!selectedPiece || selectedPiece.placed || _kbCursorR < 0) return;
  var shape = selectedPiece.currentShape;
  var rows = shape.length, cols = shape[0].length;
  var startR = Math.max(0, Math.min(_kbCursorR, 8 - rows));
  var startC = Math.max(0, Math.min(_kbCursorC, 8 - cols));
  if (canPlace(shape, startR, startC, null)) {
    ensureTimerRunning();
    placePiece(shape, startR, startC, selectedPiece.id);
    recordMove(selectedPiece.id, shape, startR, startC);
    selectedPiece.placed = true;
    selectedPiece = null;
    piecesPlacedCount++;
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    _updateKbCursor();
    maybeShowEncourageToast();
    checkWin();
    onPiecePlaced();
  }
}

function _kbSelectPieceByIndex(idx) {
  var playable = pieces.filter(p => !p.auto && !p.placed);
  if (idx >= 0 && idx < playable.length) {
    selectPiece(playable[idx]);
  }
}

function _kbUndoLastPlacement() {
  // Remove the most recently placed piece using placement order stack
  if (gameOver) {
    playSound('error');
    return;
  }
  if (!_placementOrder.length) return;
  var lastId = _placementOrder.pop();
  _moveLog.pop();
  var lastPlaced = pieces.find(function(p) { return p.id === lastId; });
  if (!lastPlaced || !lastPlaced.placed) return;
  removePiece(lastPlaced.id);
  lastPlaced.placed = false;
  piecesPlacedCount = Math.max(0, piecesPlacedCount - 1);
  playSound('remove'); haptic(10);
  renderBoard();
  renderPool();
  _updateKbCursor();
  _updateControlButtons();
}

// Escape key closes modals and win overlay; also handles game keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close modals
    if (handleAndroidBack()) return;
    document.getElementById('help-modal').classList.remove('show');
    document.getElementById('energy-modal').classList.remove('show');
    document.getElementById('achieve-modal').classList.remove('show');
    document.getElementById('scoreboard-modal').classList.remove('show');
    document.getElementById('chapter-modal').classList.remove('show');
    document.getElementById('path-modal').classList.remove('show');
    document.getElementById('diamond-purchase-modal').classList.remove('show');
    if (document.getElementById('win-overlay').classList.contains('show')) {
      document.getElementById('win-overlay').classList.remove('show');
      clearConfetti();
      returnToWelcome();
    }
    return;
  }

  // N: next puzzle (on win screen — step 3 overlay, or reward modal during win flow)
  if ((e.key === 'n' || e.key === 'N') && (
    document.getElementById('win-overlay').classList.contains('show') ||
    (document.getElementById('reward-modal').classList.contains('show') && gameOver)
  )) {
    e.preventDefault();
    if (document.getElementById('reward-modal').classList.contains('show')) {
      var btn = document.getElementById('reward-primary');
      if (btn) btn.click();
    } else if (!_isDailyChallenge) {
      nextPuzzle();
    }
    return;
  }

  // Don't handle game keys if a modal is open or input is focused
  if (_isModalOpen()) return;
  var tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // In-game keyboard controls
  if (_isInGame()) {
    // 1-8: select piece by index
    if (e.key >= '1' && e.key <= '8') {
      e.preventDefault();
      _kbSelectPieceByIndex(parseInt(e.key) - 1);
      return;
    }

    // R: rotate selected piece
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      _doRotateSelected();
      return;
    }

    // Arrow keys: move cursor on board
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; }
      if (e.key === 'ArrowUp') _kbCursorR = Math.max(0, _kbCursorR - 1);
      if (e.key === 'ArrowDown') _kbCursorR = Math.min(7, _kbCursorR + 1);
      if (e.key === 'ArrowLeft') _kbCursorC = Math.max(0, _kbCursorC - 1);
      if (e.key === 'ArrowRight') _kbCursorC = Math.min(7, _kbCursorC + 1);
      _updateKbCursor();
      return;
    }

    // Enter/Space: place piece at cursor (init cursor if needed)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
      if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; _updateKbCursor(); }
      _kbPlaceAtCursor();
      return;
    }

    // Backspace or Ctrl+Z: undo last placement
    if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      _kbUndoLastPlacement();
      return;
    }

    // H: show hint
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      showHint();
      return;
    }

    // P: pause/resume
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (paused) resumeGame(); else pauseGame();
      return;
    }

    // Z: toggle zen mode — "the puzzle can breathe"
    if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      var entering = !document.body.classList.contains('zen-mode');
      document.body.classList.toggle('zen-mode', entering);
      showSimpleToast(entering ? '\uD83E\uDDD8' : '', entering ? 'Zen Mode' : 'Zen Mode Off', entering ? 1500 : 1000);
      return;
    }
  }

  // P to resume if paused
  if (document.body.classList.contains('in-game') && paused && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    resumeGame();
    return;
  }

  // ?: open help (keyboard shortcuts)
  if (e.key === '?') {
    e.preventDefault();
    document.getElementById('help-modal').classList.add('show');
    var kbSec = document.getElementById('kb-shortcuts');
    if (kbSec) kbSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

});

// Mouse wheel on pool: cycle through pieces
document.getElementById('pool').addEventListener('wheel', (e) => {
  if (gameOver || paused) return;
  var playable = pieces.filter(p => !p.auto && !p.placed);
  if (playable.length === 0) return;
  var curIdx = selectedPiece ? playable.indexOf(selectedPiece) : -1;
  var dir = e.deltaY > 0 ? 1 : -1;
  var nextIdx = curIdx < 0 ? 0 : (curIdx + dir + playable.length) % playable.length;
  selectPiece(playable[nextIdx]);
  e.preventDefault();
}, { passive: false });

// Right-click on placed piece: remove it
document.getElementById('board').addEventListener('contextmenu', (e) => {
  var cell = e.target.closest('.cell[data-piece-id]');
  if (!cell || gameOver || paused) return;
  var pid = cell.dataset.pieceId;
  var piece = getPieceById(pid);
  if (!piece || piece.auto) return;
  e.preventDefault();
  removePiece(pid);
  piece.placed = false;
  piecesPlacedCount = Math.max(0, piecesPlacedCount - 1);
  var oi = _placementOrder.lastIndexOf(pid);
  if (oi !== -1) { _placementOrder.splice(oi, 1); _moveLog.splice(oi, 1); }
  playSound('remove'); haptic(10);
  renderBoard();
  renderPool();
  _updateKbCursor();
});

// Init — show offline defaults first, then update after health check
showWelcomeState();
applyLanguage();
updateEnergyDisplay();
updateExpDisplay();
updateDiamondDisplay();
_checkAuthCallback();
_checkPendingAuth();
_fxInit();
// Init new features (gated by feature flags) — wait for config to load
_configReady.then(function() {
  if (_feature('daily_tasks')) getDailyTasks(); // generate if new day
  if (_feature('daily_tasks')) checkDailyTaskNotification();
  if (_feature('messages')) updateMessageBadge();
  if (_feature('diamond_multiplier')) checkMultiplierOnLoad();
});

// Daily check-in (skip on Electron — no check-in system) — wait for config
_configReady.then(function() {
  if (_feature('diamonds')) {
    var _pendingCheckin = doDailyCheckin();
    if (_pendingCheckin) {
      var _showCheckinAfterSplash = function() {
        if (!splashDismissed) { setTimeout(_showCheckinAfterSplash, 1000); return; }
        setTimeout(function() { showDailyCheckinToast(_pendingCheckin.reward, _pendingCheckin.combo); }, 800);
      };
      _showCheckinAfterSplash();
    }
  }
});
// Desktop first-visit toast: keyboard shortcuts hint
if (matchMedia('(pointer: fine)').matches && !localStorage.getItem('octile_kb_hint_shown')) {
  localStorage.setItem('octile_kb_hint_shown', '1');
  setTimeout(function() { showSimpleToast('\u2328\uFE0F', t('kb_hint_toast'), 3500); }, 2000);
}

if (_feature('energy')) setInterval(updateEnergyDisplay, 60000);
// Unclaimed reward reminders: 5s after load, then every 15min
if (_feature('diamonds')) {
  setTimeout(checkUnclaimedRewards, 5000);
  setInterval(checkUnclaimedRewards, 15 * 60 * 1000);
}
// Wait for config + steam flags, then init packs + fetch level totals + check backend health
_steamConfigReady.then(() => Promise.all([_initPacks(), fetchLevelTotals(), refreshBackendStatus()])).then(() => {
  // Re-apply feature-gated UI now that steam flags are loaded
  updateEnergyDisplay();
  // --- Feature-gated UI: hide header displays and nav buttons based on features ---
  var _featureDisplayMap = [
    ['diamonds', 'diamond-display'], ['energy', 'energy-display'],
    ['diamond_multiplier', 'multiplier-display'], ['hints', 'hint-btn']
  ];
  for (var _fi = 0; _fi < _featureDisplayMap.length; _fi++) {
    var _fel = document.getElementById(_featureDisplayMap[_fi][1]);
    if (_fel && !_feature(_featureDisplayMap[_fi][0])) _fel.style.display = 'none';
  }
  // EXP display: hidden when diamonds (economy) is off
  var _expEl = document.getElementById('exp-display');
  if (_expEl && !_feature('diamonds')) _expEl.style.display = 'none';
  // Nav buttons: hide based on features
  var _featureNavMap = [
    ['daily_tasks', 'goals-btn'], ['scoreboard', 'scoreboard-btn'], ['messages', 'messages-btn']
  ];
  for (var _fni = 0; _fni < _featureNavMap.length; _fni++) {
    var _fnel = document.getElementById(_featureNavMap[_fni][1]);
    if (_fnel && !_feature(_featureNavMap[_fni][0])) _fnel.style.display = 'none';
  }
  // --- Electron: layout adjustments ---
  if (_isElectron) {
    var _navPrimary = document.querySelector('.settings-nav-primary');
    if (_navPrimary) { _navPrimary.style.gridTemplateColumns = '1fr'; _navPrimary.style.maxWidth = '280px'; _navPrimary.style.margin = '0 auto 10px'; }
    var _navSecondary = document.querySelector('.settings-nav-secondary');
    if (_navSecondary && !_feature('scoreboard') && !_feature('messages')) _navSecondary.style.display = 'none';
    var _navUtility = document.querySelector('.settings-nav-utility');
    if (_navUtility) { _navUtility.style.display = 'grid'; _navUtility.style.gridTemplateColumns = '1fr'; _navUtility.style.maxWidth = '280px'; _navUtility.style.margin = '0 auto 16px'; _navUtility.style.paddingBottom = '16px'; _navUtility.style.borderBottom = '1px solid rgba(255,255,255,0.08)'; }
    var _helpBtn = document.getElementById('help-btn');
    if (_helpBtn) { _helpBtn.classList.add('primary'); _helpBtn.style.fontSize = ''; _helpBtn.style.padding = ''; }
    _appConfig.puzzleSet = 11378;
  }
  // --- Pure mode: layout adjustments ---
  if (_isPureMode) {
    if (!isAuthEnabled()) {
      var _profBtn = document.getElementById('profile-btn');
      if (_profBtn) _profBtn.style.display = 'none';
    }
    var _pNavPrimary = document.querySelector('.settings-nav-primary');
    if (_pNavPrimary && !isAuthEnabled()) _pNavPrimary.style.display = 'none';
    var _pNavSecondary = document.querySelector('.settings-nav-secondary');
    if (_pNavSecondary && !_feature('scoreboard') && !_feature('messages')) _pNavSecondary.style.display = 'none';
    var _pNavUtility = document.querySelector('.settings-nav-utility');
    if (_pNavUtility) { _pNavUtility.style.display = 'grid'; _pNavUtility.style.gridTemplateColumns = '1fr'; _pNavUtility.style.maxWidth = '280px'; _pNavUtility.style.margin = '0 auto 16px'; _pNavUtility.style.paddingBottom = '16px'; _pNavUtility.style.borderBottom = '1px solid rgba(255,255,255,0.08)'; }
    var _pHelpBtn = document.getElementById('help-btn');
    if (_pHelpBtn) { _pHelpBtn.classList.add('primary'); }
    var _pShareBtn = document.getElementById('win-share-btn');
    if (_pShareBtn) _pShareBtn.style.display = 'none';
    // Pure mode: show clean puzzle-only help (no daily challenge, no hints/energy/tasks)
    document.getElementById('help-body').innerHTML = t(_helpBodyKey());
  }
  showWelcomeState();
  updateOnlineUI();
  // Flush any queued feedback
  if (typeof _flushFeedbackQueue === 'function') _flushFeedbackQueue();
  // Init gamepad support (Steam only)
  if (typeof _gpInit === 'function') _gpInit();
});
// Start managed health polling (stops when hidden/in-game, resumes on return)
_startHealthPoll();

// URL parameter: ?p=N skips splash/welcome, starts puzzle N directly
(function handleUrlParam() {
  const params = new URLSearchParams(location.search);
  const p = parseInt(params.get('p'));
  if (p >= 1 && p <= TOTAL_PUZZLE_COUNT) {
    // Skip splash immediately
    splashDismissed = true;
    const splash = document.getElementById('splash');
    if (splash) splash.remove();
    // Start game directly
    startGame(p);
  }
})();

// FullPack ready event: update Daily Challenge UI
document.addEventListener('fullpack-ready', function() {
  console.info('[Octile] FullPack ready event received');
  if (typeof renderDailyChallengeCard === 'function') {
    renderDailyChallengeCard();
  }
});

// Debug commands (dev only, not exposed in UI)
window.clearGameState = function() {
  localStorage.clear();
  sessionStorage.clear();
  console.info('[Octile] Game state cleared');
};
window.clearGameStateAndReload = function() {
  localStorage.clear();
  sessionStorage.clear();
  location.reload();
};

// Service worker registration (skip in Electron — local files, Steam handles updates)
if ('serviceWorker' in navigator && !_isElectron) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
