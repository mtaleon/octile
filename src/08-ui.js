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

  // Tutorial hints (tracked for cleanup)
  tutorialTimeouts.push(setTimeout(() => showTutorialHint1(), 800));
  tutorialTimeouts.push(setTimeout(() => showTutorialHint3(), 60000));

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
}

// welcomeRandom/welcomeGo removed — replaced by level-based flow

// --- Tutorial Hints ---
let activeHints = [];
let tutorialTimeouts = [];

function isTutorialSeen() {
  return localStorage.getItem('octile_tutorial_seen') === '1';
}
function markTutorialSeen() {
  localStorage.setItem('octile_tutorial_seen', '1');
}

function showHintTooltip(text, targetEl, id) {
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

  activeHints.push({ id, element: hint, timer: setTimeout(() => dismissHint(id), 6000) });
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

function showTutorialHint1() {
  if (isTutorialSeen() || gameOver || !gameStarted) return;
  const pool = document.getElementById('pool-section');
  showHintTooltip(t('hint1'), pool, 'hint1');
}

function showTutorialHint2() {
  if (isTutorialSeen() || gameOver) return;
  if (piecesPlacedCount !== 1) return; // only after first placement
  dismissHint('hint1');
  const pool = document.getElementById('pool-section');
  showHintTooltip(t('hint2'), pool, 'hint2');
}

function showTutorialHint3() {
  if (isTutorialSeen() || gameOver || !gameStarted) return;
  if (piecesPlacedCount > 1) return;
  dismissHint('hint1');
  dismissHint('hint2');
  const hintBtn = document.getElementById('hint-btn');
  showHintTooltip(t('hint3'), hintBtn, 'hint3');
  markTutorialSeen(); // shown all hints, mark as seen
}

// Mark tutorial as seen after any hint3 or after placing 2+ pieces
function maybeCompleteTutorial() {
  if (piecesPlacedCount >= 2 && !isTutorialSeen()) {
    markTutorialSeen();
    dismissAllHints();
  }
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
  document.getElementById('settings-help-label').textContent = t('menu_help');
  document.getElementById('settings-story-label').textContent = t('menu_about');
  document.getElementById('settings-share-label').textContent = t('menu_share');
  // puzzle-input row removed — level-based flow
  document.getElementById('settings-scoreboard-label').textContent = t('menu_scoreboard');
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
  if (/android/i.test(navigator.userAgent)) {
    storeLink = 'https://play.google.com/store/apps/details?id=com.octile.app';
  } else if (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) {
    storeLink = 'https://apps.apple.com/app/com.octile.app';
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

  // Achievement button & modal
  document.getElementById('settings-trophy-label').textContent = t('achieve_title');
  document.getElementById('achieve-modal-title').textContent = t('achieve_title');

  // Daily Tasks & Messages buttons
  document.getElementById('settings-tasks-label').textContent = t('menu_tasks');
  document.getElementById('settings-messages-label').textContent = t('menu_messages');

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

