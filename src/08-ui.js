// --- Splash (auto-dismiss) ---
let splashDismissed = false;

function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('fade-out');
  setTimeout(() => {
    splash.remove();
    // First-time user: skip welcome panel, jump straight into Easy #1
    if (!localStorage.getItem('octile_onboarded')) {
      if (!_levelTotals.easy) _levelTotals = {..._getOfflineTotals()};
      startLevel('easy');
    }
  }, 600);
}

// Auto-dismiss: 5s for first-timers (get them playing fast), 3s for returning
setTimeout(dismissSplash, localStorage.getItem('octile_onboarded') ? 3000 : 5000);
document.addEventListener('pointerdown', dismissSplash, { once: true });
document.addEventListener('keydown', dismissSplash, { once: true });

// --- Welcome Panel / Game Flow ---
let gameStarted = false;

function showWelcomeState() {
  // Player stats header
  const streak = getStreak();
  const statsEl = document.getElementById('wp-stats');
  statsEl.innerHTML =
    '<span class="wp-stat"><span class="wp-stat-icon">\u2B50</span><span class="wp-stat-value">' + getExp().toLocaleString() + '</span></span>' +
    '<span class="wp-stat"><span class="wp-stat-icon">\uD83D\uDC8E</span><span class="wp-stat-value">' + getDiamonds().toLocaleString() + '</span></span>' +
    '<span class="wp-stat"><span class="wp-stat-icon">\uD83D\uDD25</span><span class="wp-stat-value">' + (streak.count || 0) + '</span> ' + t('wp_days') + '</span>' +
    '<span class="wp-stat"><span class="wp-stat-icon">\u26A1</span><span class="wp-stat-value">' + Math.floor(getEnergyState().points) + '</span></span>';

  renderTodayGoalCard();
  showTier1();
  updateEnergyDisplay();
}

function startGame(puzzleNumber) {
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const welcome = document.getElementById('welcome-panel');
  if (welcome && !welcome.classList.contains('hidden')) {
    welcome.classList.add('anim-out');
    setTimeout(() => {
      welcome.classList.add('hidden');
      welcome.classList.remove('anim-out');
      revealGame(puzzleNumber);
    }, 300);
  } else {
    revealGame(puzzleNumber);
  }
}

async function revealGame(puzzleNumber) {
  gameStarted = true;
  document.body.classList.add('in-game');
  currentPuzzleNumber = puzzleNumber;
  localStorage.setItem('octile_last_played', Date.now());

  const boardEl = document.getElementById('board');
  const poolEl = document.getElementById('pool-section');
  const actionBarEl = document.getElementById('action-bar');
  const menuBtn = document.getElementById('menu-btn');

  boardEl.style.display = '';
  poolEl.style.display = '';
  actionBarEl.style.display = '';
  menuBtn.style.display = '';

  // Staggered fade-in
  boardEl.classList.add('game-fade-in');
  poolEl.classList.add('game-fade-in');
  poolEl.style.animationDelay = '0.1s';
  actionBarEl.classList.add('game-fade-in');
  actionBarEl.style.animationDelay = '0.15s';

  setTimeout(() => {
    boardEl.classList.remove('game-fade-in');
    poolEl.classList.remove('game-fade-in');
    poolEl.style.animationDelay = '';
    actionBarEl.classList.remove('game-fade-in');
    actionBarEl.style.animationDelay = '';
  }, 500);

  await resetGame(puzzleNumber);
  updateLevelNav();
  setTimeout(showPoolScrollHint, 800);

  // Flow 3: "First puzzle of the day. Take your time." hint
  const _dailyStatsAtStart = getDailyStats();
  if (_dailyStatsAtStart.puzzles === 0) {
    tutorialTimeouts.push(setTimeout(() => {
      if (gameOver) return;
      showHintTooltip(t('win_energy_free'), document.getElementById('board-container'), 'daily-free');
      setTimeout(() => dismissHint('daily-free'), 5000);
    }, 600));
  }

  // Onboarding tutorial steps
  var _tutStep = _getTutStep();
  if (_tutStep === 0) {
    // Step 1: First puzzle — show fill board hint
    tutorialTimeouts.push(setTimeout(() => tutStep1_FillBoard(), 800));
  } else if (_tutStep === 4) {
    // Step 4: Goal-setting hint at start of puzzle #4
    tutorialTimeouts.push(setTimeout(() => tutStep4_GoalSetting(), 800));
  }
  if (_tutStep === 5) {
    // Step 5: Start stuck timer for hint system tutorial
    tutStep5_StartStuckTimer();
  }

  // Gentle pulse on pieces for first 2 games
  var _totalPlayed = parseInt(localStorage.getItem('octile_total_solved') || '0');
  if (_totalPlayed < 2) {
    tutorialTimeouts.push(setTimeout(function() {
      document.querySelectorAll('.piece-wrapper:not(.placed)').forEach(function(el) {
        el.classList.add('nudge');
      });
      setTimeout(function() {
        document.querySelectorAll('.piece-wrapper.nudge').forEach(function(el) {
          el.classList.remove('nudge');
        });
      }, 1500);
    }, 1200));
  }

  // Motivational quote after 120s if stuck
  if (motivationTimeout) clearTimeout(motivationTimeout);
  motivationTimeout = setTimeout(() => {
    if (gameOver || !gameStarted || motivationShown || piecesPlacedCount > 1) return;
    motivationShown = true;
    const quotes = getMotivationQuotes();
    const text = quotes[Math.floor(Math.random() * quotes.length)];
    showHintTooltip(text, document.getElementById('board-container'), 'motivation');
    // Auto-dismiss after 8s
    setTimeout(() => dismissHint('motivation'), 8000);
  }, 120000);
}

function returnToWelcome() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerStarted = false;
  paused = false;
  elapsedBeforePause = 0;
  gameOver = true;
  gameStarted = false;
  document.body.classList.remove('in-game');
  dismissAllHints();
  clearConfetti();
  tutorialTimeouts.forEach(t => clearTimeout(t));
  tutorialTimeouts = [];
  if (motivationTimeout) { clearTimeout(motivationTimeout); motivationTimeout = null; }
  tutStep5_CancelStuckTimer();

  document.getElementById('win-overlay').classList.remove('show');
  document.getElementById('win-back-btn').style.display = 'none';
  document.getElementById('board').style.display = 'none';
  document.getElementById('pool-section').style.display = 'none';
  document.getElementById('action-bar').style.display = 'none';
  document.getElementById('menu-btn').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('timer').style.opacity = '';
  document.getElementById('timer').textContent = '0:00';

  const welcome = document.getElementById('welcome-panel');
  welcome.classList.remove('hidden');
  showWelcomeState();
  tutStep9_Closing();
}

// welcomeRandom/welcomeGo removed — replaced by level-based flow

// --- Tutorial & Hint System ---
// 9-step onboarding: each step shown once, tracked by localStorage
// Steps: 1=fill board, 2=rotate, 3=first rating, 4=goal-setting,
//        5=hint system, 6=daily progress, 7=locked feature, 8=sign-in, 9=closing
let activeHints = [];
let tutorialTimeouts = [];

function _getTutStep() {
  return parseInt(localStorage.getItem('octile_tut_step') || '0');
}
function _setTutStep(step) {
  localStorage.setItem('octile_tut_step', step);
}
function isTutorialDone() {
  return _getTutStep() >= 9;
}

function showHintTooltip(text, targetEl, id, duration) {
  if (!targetEl) return;
  dismissHint(id);
  const hint = document.createElement('div');
  hint.className = 'tutorial-hint';
  hint.dataset.hintId = id;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'hint-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', () => dismissHint(id));
  const span = document.createElement('span');
  span.textContent = text;
  hint.appendChild(span);
  hint.appendChild(closeBtn);

  // Position relative to target
  const container = targetEl.closest('#main-area') || document.body;
  container.style.position = 'relative';
  container.appendChild(hint);

  const targetRect = targetEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  hint.style.left = (targetRect.left - containerRect.left + 10) + 'px';
  hint.style.top = (targetRect.top - containerRect.top - 8) + 'px';

  var dur = duration || 6000;
  activeHints.push({ id, element: hint, timer: setTimeout(() => dismissHint(id), dur) });
}

function dismissHint(id) {
  const idx = activeHints.findIndex(h => h.id === id);
  if (idx === -1) return;
  const h = activeHints[idx];
  clearTimeout(h.timer);
  if (h.element.parentNode) h.element.parentNode.removeChild(h.element);
  activeHints.splice(idx, 1);
}

function dismissAllHints() {
  [...activeHints].forEach(h => dismissHint(h.id));
}

// Step 1: First puzzle — "Fill the board" + "Tap a tile"
function tutStep1_FillBoard() {
  if (_getTutStep() >= 1 || gameOver || !gameStarted) return;
  var board = document.getElementById('board-container');
  showHintTooltip(t('tut_fill_board'), board, 'tut1', 8000);
  tutorialTimeouts.push(setTimeout(function() {
    if (gameOver) return;
    dismissHint('tut1');
    var pool = document.getElementById('pool-section');
    showHintTooltip(t('tut_tap_piece'), pool, 'tut1b', 8000);
  }, 4000));
}

// Step 1 complete: on first win
function tutStep1_Complete() {
  if (_getTutStep() >= 1) return;
  _setTutStep(1);
  dismissAllHints();
}

// Step 2: Rotation — shown on puzzle #2 when player taps a selected piece
function tutStep2_Rotate() {
  if (_getTutStep() !== 1 || gameOver || !gameStarted) return;
  var pool = document.getElementById('pool-section');
  showHintTooltip(t('tut_rotate'), pool, 'tut2', 8000);
  _setTutStep(2);
}

// Step 2 complete: on win of puzzle #2
function tutStep2_Complete() {
  if (_getTutStep() < 2 || _getTutStep() >= 3) return;
  // "Getting the hang of it" shown as encourage toast
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = t('tut_getting_hang');
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 3000);
  }
  _setTutStep(3);
}

// Step 3: First rating — shown on win of puzzle #3
function tutStep3_Rating(grade) {
  if (_getTutStep() !== 3) return;
  _setTutStep(4);
  // Override win step 1 title with "Rating unlocked!"
  var titleEl = document.getElementById('win-step1-title');
  if (titleEl) titleEl.textContent = t('tut_rating_unlock');
  // Show rating description as toast after win card shows
  setTimeout(function() {
    var el = document.getElementById('encourage-toast');
    if (el) {
      el.textContent = t('tut_rating_desc');
      el.classList.add('show');
      setTimeout(function() { el.classList.remove('show'); }, 4000);
    }
    // If grade A or above
    if (grade === 'S' || grade === 'A') {
      setTimeout(function() {
        var el2 = document.getElementById('encourage-toast');
        if (el2) {
          el2.textContent = '\uD83D\uDC4D ' + t('tut_solid_solution');
          el2.classList.add('show');
          setTimeout(function() { el2.classList.remove('show'); }, 3000);
        }
      }, 4500);
    }
  }, 1500);
}

// Step 4: Goal-setting — shown at start of puzzle #4
function tutStep4_GoalSetting() {
  if (_getTutStep() !== 4 || gameOver || !gameStarted) return;
  var board = document.getElementById('board-container');
  showHintTooltip(t('tut_every_puzzle'), board, 'tut4', 8000);
  _setTutStep(5);
}

// Step 5: Hint system — shown after stuck for X seconds (no pieces placed for 30s)
var _tutStuckTimer = null;
function tutStep5_StartStuckTimer() {
  if (_getTutStep() !== 5 || isTutorialDone()) return;
  if (_tutStuckTimer) clearTimeout(_tutStuckTimer);
  _tutStuckTimer = setTimeout(function() {
    if (gameOver || !gameStarted || piecesPlacedCount > 0) return;
    var hintBtn = document.getElementById('hint-btn');
    showHintTooltip(t('tut_stuck'), hintBtn, 'tut5', 8000);
    _setTutStep(6);
  }, 30000);
}
function tutStep5_CancelStuckTimer() {
  if (_tutStuckTimer) { clearTimeout(_tutStuckTimer); _tutStuckTimer = null; }
}

// Step 6: Daily progress — shown after ≥5 total solves
function tutStep6_DailyProgress(totalSolved) {
  if (_getTutStep() < 6 || _getTutStep() >= 7) return;
  if (totalSolved < 5) return;
  _setTutStep(7);
  var dailyStats = getDailyStats();
  var msg = t('tut_daily_progress').replace('{done}', dailyStats.puzzles).replace('{total}', 3);
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 4000);
  }
  setTimeout(function() {
    var el2 = document.getElementById('encourage-toast');
    if (el2) {
      el2.textContent = t('tut_little_progress');
      el2.classList.add('show');
      setTimeout(function() { el2.classList.remove('show'); }, 4000);
    }
  }, 5000);
}

// Step 7: Locked feature teaser — shown when tapping locked features
function tutStep7_LockedFeature() {
  if (_getTutStep() < 7 || _getTutStep() >= 8) return;
  _setTutStep(8);
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = t('tut_keep_playing');
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 3000);
  }
}

// Step 8: Sign-in prompt — shown after ≥5 solves (uses existing _maybeShowSignInHint but with better copy)
// This is handled by existing _maybeShowSignInHint, we just upgrade the text

// Step 9: Day 1 closing — shown when returning to welcome after ≥3 solves
function tutStep9_Closing() {
  if (_getTutStep() < 8 || _getTutStep() >= 9) return;
  var total = parseInt(localStorage.getItem('octile_total_solved') || '0');
  if (total < 3) return;
  _setTutStep(9);
  setTimeout(function() {
    var el = document.getElementById('encourage-toast');
    if (el) {
      el.textContent = t('tut_see_tomorrow');
      el.classList.add('show');
      setTimeout(function() { el.classList.remove('show'); }, 4000);
    }
  }, 800);
}

// Legacy compatibility
function isTutorialSeen() { return isTutorialDone(); }
function markTutorialSeen() { if (!isTutorialDone()) _setTutStep(9); }

// Called from piece placement — replaces old showTutorialHint2/maybeCompleteTutorial
function onPiecePlaced() {
  tutStep5_CancelStuckTimer(); // placed a piece, cancel stuck timer
  // On first piece in puzzle #2, show rotation hint
  if (piecesPlacedCount === 1 && _getTutStep() === 1) {
    // Will show rotate hint on next piece selection, not placement
  }
}

// Called from checkWin — orchestrates win-time tutorial steps
function onTutorialWin(totalSolved, grade) {
  var step = _getTutStep();
  if (step === 0) {
    tutStep1_Complete(); // first ever win
  } else if (step >= 1 && step < 3) {
    tutStep2_Complete(); // second win
  }
  if (step === 3) {
    tutStep3_Rating(grade); // third win: rating unlock
  }
  tutStep6_DailyProgress(totalSolved);
}

// --- i18n (loaded from translations.json) ---
let TRANSLATIONS = { en: {}, zh: {} };
(function loadTranslations() {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'translations.json', false); // sync load — local file, instant
  try { xhr.send(); if (xhr.status === 200 || xhr.status === 0) TRANSLATIONS = JSON.parse(xhr.responseText); } catch(e) {}
})();

function t(key) { return TRANSLATIONS[currentLang][key] || TRANSLATIONS.en[key] || key; }

function applyLanguage() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-Hant' : 'en';
  // Header
  document.getElementById('settings-help-label').textContent = t('menu_help_about');
  document.getElementById('settings-scoreboard-label').textContent = t('menu_community');
  document.getElementById('scoreboard-title').textContent = t('sb_title');
  document.getElementById('sb-tab-global').textContent = t('sb_tab_global');
  document.getElementById('sb-tab-me').textContent = t('sb_tab_me');
  document.getElementById('sb-tab-league').textContent = t('league_tab');

  // Settings modal
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  var _langSelect = document.getElementById('settings-lang-select');
  _langSelect.value = _langPref;
  var _langKeys = { system: 'lang_system', en: 'lang_en', zh: 'lang_zh' };
  for (var _li = 0; _li < _langSelect.options.length; _li++) {
    var _lk = _langKeys[_langSelect.options[_li].value];
    if (_lk) _langSelect.options[_li].textContent = t(_lk);
  }
  document.getElementById('settings-theme-label').textContent = t('menu_theme');
  renderThemeGrid();

  // Control bar
  // ctrl-go removed — level-based flow
  document.getElementById('ctrl-restart').title = t('restart');
  document.getElementById('ctrl-random').textContent = t('random');
  updateHintBtn();

  // Pool label
  const poolLabel = document.querySelector('#pool-section h2');
  if (poolLabel) poolLabel.textContent = t('pieces_label');
  document.getElementById('pause-label').textContent = t('paused');

  // Welcome panel
  // Level card names are updated in updateWelcomeLevels()
  const wpDivider = document.querySelector('#welcome-panel .wp-divider');
  if (wpDivider) wpDivider.textContent = t('wp_or');
  updateWelcomeLevels();
  updateLevelNav();

  // Splash (if still present) — update text then reveal
  const _splashEl = document.getElementById('splash');
  const splashTagline = document.querySelector('#splash .tagline');
  if (splashTagline) splashTagline.innerHTML = t('splash_tagline');
  const splashTap = document.querySelector('#splash .tap-hint');
  if (splashTap) splashTap.textContent = t('splash_tap');
  if (_splashEl && !_splashEl.classList.contains('splash-ready')) {
    setTimeout(() => { if (_splashEl) _splashEl.classList.add('splash-ready'); }, 300);
  }

  // Help & story modal bodies
  document.getElementById('help-body').innerHTML = t('help_body');

  // Open feedback with app context passed via URL params (works in external browser on Android)
  window.openFeedback = function(extra) {
    var params = [];
    try { var au = getAuthUser(); if (au) { if (au.email) params.push('email=' + encodeURIComponent(au.email)); if (au.display_name) params.push('name=' + encodeURIComponent(au.display_name)); } } catch(e) {}
    try { params.push('uuid=' + encodeURIComponent(getBrowserUUID())); } catch(e) {}
    params.push('version=' + encodeURIComponent(APP_VERSION_NAME));
    params.push('lang=' + encodeURIComponent(currentLang));
    var hash = params.join('&') + (extra ? '&' + extra : '');
    window.open('feedback.html#' + hash);
  };

  var storeLink = '';
  // Only show "Rate Us" in the native Android app (file:// protocol)
  if (/android/i.test(navigator.userAgent) && location.protocol === 'file:') {
    storeLink = 'https://play.google.com/store/apps/details?id=com.octile.app';
  }
  var supportHtml = '<div class="about-support">'
    + '<p class="about-support-title">' + t('about_support') + '</p>'
    + (storeLink ? '<a class="about-rate-btn" href="#" onclick="window.open(\'' + storeLink + '\');return false">⭐ ' + t('about_rate') + '</a>' : '')
    + '<p class="about-feedback">' + t('about_feedback') + ' <a href="mailto:octileapp@googlegroups.com">octileapp@googlegroups.com</a> · <a href="#" onclick="openFeedback();return false">' + t('about_feedback_form') + '</a></p>'
    + '</div>';
  document.getElementById('story-body').innerHTML = t('story_body')
    + '<p class="app-version" onclick="if(window.OctileBridge&&OctileBridge.getDeviceInfo)prompt(\'Device Info\',OctileBridge.getDeviceInfo())">v' + APP_VERSION_NAME + '</p>'
    + supportHtml
    + '<p class="about-links"><a href="#" onclick="window.open(\'privacy.html\');return false">' + t('privacy_link') + '</a> · <a href="#" onclick="window.open(\'terms.html\');return false">' + t('terms_link') + '</a></p>';

  // Win flow static text
  document.getElementById('win-step1-title').textContent = t('win_title');
  document.getElementById('win-tap1').textContent = t('win_tap_continue');
  document.getElementById('win-step2-title').textContent = t('win_rewards_title');
  document.getElementById('win-tap2').textContent = t('win_tap_continue');
  document.getElementById('win-share-btn').innerHTML = t('win_share');
  document.getElementById('win-view-btn').textContent = t('win_view_board');
  document.getElementById('win-back-btn').textContent = t('win_back');
  document.getElementById('win-prev-btn').textContent = t('win_prev');
  document.getElementById('win-next-btn').innerHTML = t('win_next');
  document.getElementById('win-random-btn').textContent = t('win_random');
  document.getElementById('win-menu-btn').textContent = t('win_menu');

  // Energy display
  document.getElementById('energy-display').title = t('energy_title');
  document.getElementById('energy-modal-title').textContent = t('energy_title');
  updateEnergyDisplay();

  // Goals button & modal
  document.getElementById('settings-goals-label').textContent = t('menu_goals');
  document.getElementById('achieve-modal-title').textContent = t('goals_title');

  // Inbox button
  document.getElementById('settings-messages-label').textContent = t('menu_inbox');

  // Profile button
  document.getElementById('settings-profile-label').textContent = t('menu_profile');

  // Update banner
  document.getElementById('update-btn').textContent = t('update_btn');
  document.getElementById('update-dismiss').textContent = t('update_later');

  // Refresh tagline
  const taglines = getTaglines();
  const wpTagline = document.getElementById('wp-tagline');
  if (wpTagline) wpTagline.innerHTML = taglines[Math.floor(Math.random() * taglines.length)];
}

function setLang(pref) {
  _langPref = pref;
  localStorage.setItem('octile_lang', pref);
  currentLang = pref === 'system' ? _systemLang() : pref;
  applyLanguage();
}

