#!/usr/bin/env node
/**
 * Take Steam D1 screenshots at desktop resolution
 * for both English and Chinese.
 *
 * Simulates _isElectron = true with D1 flags to show the
 * subtraction-first UI (no economy, hints, goals, etc.)
 *
 * Usage: SCREENSHOT_URL=http://localhost:8371 node scripts/take-screenshots-steam.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.SCREENSHOT_URL || 'http://localhost:8371';
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CLEAN_TIPS = `
  document.querySelectorAll('.tooltip, .toast, .checkin-toast, .achieve-toast, .tip-bubble, .hint-tip, .tutorial-tip, .tutorial-hint, .confetti-piece, .ota-banner, .encourage-toast').forEach(t => t.remove());
  var _at = document.getElementById('achieve-toast'); if (_at) { _at.classList.remove('show'); _at.style.display = 'none'; }
`;

// Inject Electron D1 simulation
const SIMULATE_ELECTRON = `
  _isElectron = true;
  window.steam = { platform: 'test' };
  _applySteamFlags({ steam: { phase: 'phase1', features: {
    energy: false, diamond_multiplier: false, daily_tasks: false,
    league: false, inbox: false, elo_profile: false, rating_leaderboard: false,
    gamepad: true
  }}});
  _appConfig.puzzleSet = 11378;
  // Hide header economy + hint + nav buttons
  ['exp-display','diamond-display','energy-display','multiplier-display','hint-btn'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  ['goals-btn','scoreboard-btn','messages-btn'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  // Fix nav layout
  var np = document.querySelector('.settings-nav-primary');
  if (np) { np.style.gridTemplateColumns = '1fr'; np.style.maxWidth = '280px'; np.style.margin = '0 auto 10px'; }
  var ns = document.querySelector('.settings-nav-secondary');
  if (ns) ns.style.display = 'none';
  var nu = document.querySelector('.settings-nav-utility');
  if (nu) { nu.style.display = 'grid'; nu.style.gridTemplateColumns = '1fr'; nu.style.maxWidth = '280px'; nu.style.margin = '0 auto 16px'; nu.style.paddingBottom = '16px'; nu.style.borderBottom = '1px solid rgba(255,255,255,0.08)'; }
  var hb = document.getElementById('help-btn');
  if (hb) { hb.classList.add('primary'); hb.style.fontSize = ''; hb.style.padding = ''; }
  updateEnergyDisplay();
  showWelcomeState();
  applyLanguage();
`;

async function startAndClean(page, level, theme) {
  await page.evaluate((th) => {
    if (th && typeof setTheme === 'function') setTheme(th);
    if (typeof startLevel === 'function') startLevel('easy');
  }, theme || null);
  await sleep(2500);
  await page.evaluate(CLEAN_TIPS);
  await sleep(300);
}

async function triggerSteamWin(page) {
  await page.evaluate(() => { if (typeof startLevel === 'function') startLevel('easy'); });
  await sleep(3000);
  await page.evaluate(CLEAN_TIPS);
  await page.evaluate(() => {
    gameOver = true;
    elapsed = 30;
    _winData = { elapsed: 30, isNewBest: true, prevBest: 45, grade: 'S', expEarned: 200,
      chapterBonus: 0, totalUnique: 50, totalSolved: 51, isFirstClear: true, improvement: 15,
      newlyUnlocked: [], isLevelComplete: false, levelTotal: 800,
      cost: 0, totalLeft: 99, motivation: '', fact: '' };
    _winStep = 1;
    document.getElementById('win-step1-title').textContent = t('win_title');
    document.getElementById('win-puzzle-num').textContent = '\uD83C\uDF3F ' + t('level_easy') + ' #9';
    document.getElementById('win-time').textContent = '0:30';
    var bestEl = document.getElementById('win-best');
    bestEl.textContent = t('win_new_best') + ' (' + t('win_best') + '0:45)';
    bestEl.className = 'win-best-new'; bestEl.style.display = '';
    // Use Steam grade desc (no "no hints")
    var sDesc = t('grade_s_desc_steam') || t('grade_s_desc');
    document.getElementById('win-grade').innerHTML = '<span class="win-grade-letter grade-s">S</span><span class="win-grade-desc">' + sDesc + '</span>';
    document.getElementById('win-grade').style.color = '#f1c40f';
    document.getElementById('win-level-complete').style.display = 'none';
    document.getElementById('win-tap1').textContent = t('win_tap_continue');
    // Step 2: empty on Electron
    document.getElementById('win-step2-title').textContent = '';
    document.getElementById('win-rewards').innerHTML = '';
    document.getElementById('win-achievement').innerHTML = '';
    document.getElementById('win-tap2').textContent = '';
    // Step 3: no energy
    document.getElementById('win-step3-title').textContent = '\uD83C\uDF3F 9 / 800';
    document.getElementById('win-energy-cost').style.display = 'none';
    document.getElementById('win-motivation').style.display = 'none';
    document.getElementById('win-fact').textContent = '';
    document.getElementById('win-next-btn').innerHTML = t('win_next');
    document.getElementById('win-prev-btn').style.display = '';
    document.getElementById('win-share-btn').innerHTML = t('win_share');
    document.getElementById('win-view-btn').textContent = t('win_view_board');
    document.getElementById('win-random-btn').style.display = 'none';
    document.getElementById('win-menu-btn').textContent = t('win_menu');
    _showWinStep(1);
    document.getElementById('win-overlay').classList.add('show');
  });
  await sleep(1000);
  await page.evaluate(CLEAN_TIPS);
  await sleep(300);
}

const SCREENS = [
  { name: 'splash', setup: async (page) => {
    await sleep(300);
  }},
  { name: 'welcome', setup: async (page) => {
    await page.evaluate(CLEAN_TIPS);
    await sleep(300);
  }},
  { name: 'welcome-medium', setup: async (page) => {
    await page.evaluate(CLEAN_TIPS);
    await page.evaluate(() => { if (typeof _goToSlide === 'function') _goToSlide(1); });
    await sleep(500);
  }},
  { name: 'welcome-hard', setup: async (page) => {
    await page.evaluate(CLEAN_TIPS);
    await page.evaluate(() => { if (typeof _goToSlide === 'function') _goToSlide(2); });
    await sleep(500);
  }},
  { name: 'welcome-hell', setup: async (page) => {
    await page.evaluate(CLEAN_TIPS);
    await page.evaluate(() => { if (typeof _goToSlide === 'function') _goToSlide(3); });
    await sleep(500);
  }},
  { name: 'gameplay', setup: async (page) => {
    await startAndClean(page, 'easy');
  }},
  { name: 'menu', setup: async (page) => {
    await page.evaluate(() => {
      var btn = document.getElementById('settings-btn');
      if (btn) btn.click();
      var dbg = document.getElementById('debug-section');
      if (dbg) dbg.style.display = 'none';
    });
    await sleep(500);
  }},
  { name: 'helpabout', setup: async (page) => {
    await page.evaluate(() => {
      var modal = document.getElementById('help-modal');
      if (modal) modal.classList.add('show');
    });
    await sleep(500);
  }},
  { name: 'paused', setup: async (page) => {
    await page.evaluate(() => { if (typeof startLevel === 'function') startLevel('easy'); });
    await sleep(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .tip-bubble, .tutorial-tip').forEach(t => t.remove());
      timerStarted = true; elapsed = 42;
      if (typeof pauseGame === 'function') pauseGame();
    });
    await sleep(500);
  }},
  { name: 'zen', setup: async (page) => {
    await page.evaluate(() => { if (typeof startLevel === 'function') startLevel('easy'); });
    await sleep(2500);
    await page.evaluate(CLEAN_TIPS);
    await page.evaluate(() => { document.body.classList.add('zen-mode'); });
    await sleep(500);
  }},
  // Themes (only 3 free on Steam)
  { name: 'theme-lego', setup: async (page) => { await startAndClean(page, 'easy', 'lego'); }},
  { name: 'theme-wood', setup: async (page) => { await startAndClean(page, 'easy', 'wood'); }},
  // Navigation
  { name: 'chaptergrid', setup: async (page) => {
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openChapterGrid === 'function') openChapterGrid('easy');
    });
    await sleep(500);
  }},
  { name: 'puzzlepath', setup: async (page) => {
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openPuzzlePath === 'function') openPuzzlePath('easy', 0);
    });
    await sleep(500);
  }},
  // Profile (minimal on Steam)
  { name: 'profile', setup: async (page) => {
    await page.evaluate(() => { if (typeof showProfileModal === 'function') showProfileModal(); });
    await sleep(500);
  }},
  // Settings — theme picker (3 tiles only)
  { name: 'themes', setup: async (page) => {
    await page.evaluate(() => {
      if (typeof renderThemeGrid === 'function') renderThemeGrid();
      // Scroll settings to show themes
      var grid = document.getElementById('theme-grid');
      if (grid) grid.scrollIntoView({ block: 'center' });
    });
    await sleep(300);
  }},
  // Daily Challenge card states
  { name: 'daily-fresh', setup: async (page) => {
    await page.evaluate(() => {
      _setBackendOnline(true);
      var date = getDailyChallengeDate();
      ['easy','medium','hard','hell'].forEach(lv => {
        localStorage.removeItem('octile_daily_try_' + date + '_' + lv);
        localStorage.removeItem('octile_daily_done_' + date + '_' + lv);
      });
      localStorage.removeItem('octile_daily_streak');
      renderDailyChallengeCard();
      showWelcomeState();
    });
    await sleep(500);
  }},
  { name: 'daily-mixed', setup: async (page) => {
    await page.evaluate(() => {
      _setBackendOnline(true);
      var date = getDailyChallengeDate();
      ['easy','medium','hard','hell'].forEach(lv => {
        localStorage.removeItem('octile_daily_try_' + date + '_' + lv);
        localStorage.removeItem('octile_daily_done_' + date + '_' + lv);
      });
      localStorage.setItem('octile_daily_done_' + date + '_easy', JSON.stringify({ time: 23, grade: 'S', puzzle: 100 }));
      localStorage.setItem('octile_daily_try_' + date + '_medium', JSON.stringify({ date: date, slot: 1, puzzle: 200, startedAt: new Date().toISOString() }));
      localStorage.setItem('octile_daily_streak', JSON.stringify({ count: 5, lastDate: date }));
      renderDailyChallengeCard();
      showWelcomeState();
    });
    await sleep(500);
  }},
  { name: 'daily-alldone', setup: async (page) => {
    await page.evaluate(() => {
      _setBackendOnline(true);
      var date = getDailyChallengeDate();
      localStorage.setItem('octile_daily_done_' + date + '_easy', JSON.stringify({ time: 23, grade: 'S', puzzle: 100 }));
      localStorage.setItem('octile_daily_done_' + date + '_medium', JSON.stringify({ time: 45, grade: 'A', puzzle: 200 }));
      localStorage.setItem('octile_daily_done_' + date + '_hard', JSON.stringify({ time: 72, grade: 'A', puzzle: 300 }));
      localStorage.setItem('octile_daily_done_' + date + '_hell', JSON.stringify({ time: 120, grade: 'B', puzzle: 400 }));
      localStorage.setItem('octile_daily_streak', JSON.stringify({ count: 7, lastDate: date }));
      renderDailyChallengeCard();
      showWelcomeState();
    });
    await sleep(500);
  }},
  // Win flow (Steam: grade + time only, no rewards)
  { name: 'win-grade', setup: async (page) => {
    await triggerSteamWin(page);
  }},
  { name: 'win-reward', setup: async (page) => {
    await triggerSteamWin(page);
    // Trigger reward modal (secondary = View Board, primary = Next)
    await page.evaluate(() => { _showWinRewardModal(); });
    await sleep(800);
  }},
  { name: 'win-next', setup: async (page) => {
    await triggerSteamWin(page);
    await page.evaluate(() => { _showWinStep(3); });
    await sleep(800);
  }},
];

async function captureScreen(browser, lang, screen) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });

  if (screen.name === 'splash') {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate((l) => {
      if (typeof currentLang !== 'undefined') { currentLang = l; }
      if (typeof applyLanguage === 'function') applyLanguage();
    }, lang);
    await screen.setup(page);
  } else {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('octile_onboarded', '1');
      localStorage.setItem('octile_total_solved', '50');
      localStorage.setItem('octile_tutorial_seen', '1');
      localStorage.setItem('octile_solved', JSON.stringify(Array.from({length: 50}, (_, i) => i + 1)));
      var today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Set language
    await page.evaluate((l) => {
      currentLang = l;
      if (typeof applyLanguage === 'function') applyLanguage();
    }, lang);
    await sleep(500);

    // Simulate Electron D1
    await page.evaluate(SIMULATE_ELECTRON);
    await sleep(500);

    // Dismiss splash
    await page.evaluate(() => { if (typeof dismissSplash === 'function') dismissSplash(); });
    await sleep(800);

    // Setup the screen
    await screen.setup(page);
  }

  // Final cleanup
  if (!['splash'].includes(screen.name)) {
    await page.evaluate(CLEAN_TIPS);
    await sleep(200);
  }

  const dir = path.join(__dirname, '..', 'docs', 'png', 'steam', lang);
  const filepath = path.join(dir, `${screen.name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });

  const stat = fs.statSync(filepath);
  console.log(`  ${screen.name}.png (${Math.round(stat.size / 1024)}KB)`);

  await page.close();
}

(async () => {
  let browser, connected = false;
  try {
    browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
    connected = true;
    console.log('Connected to existing Chrome on port 9222');
  } catch {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    console.log('Launched new Chrome instance');
  }

  try {
    for (const lang of ['en', 'zh']) {
      const dir = path.join(__dirname, '..', 'docs', 'png', 'steam', lang);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`\n=== STEAM ${lang.toUpperCase()} ===`);

      for (const screen of SCREENS) {
        try {
          await captureScreen(browser, lang, screen);
        } catch (e) {
          console.log(`  ${screen.name}.png FAILED: ${e.message}`);
        }
      }
    }
  } finally {
    if (connected) await browser.disconnect();
    else await browser.close();
  }

  console.log('\nDone! ' + (SCREENS.length * 2) + ' Steam screenshots captured.');
  console.log('Saved to: docs/png/steam/en/ and docs/png/steam/zh/');
})();
