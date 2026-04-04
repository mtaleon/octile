#!/usr/bin/env node
/**
 * Take all Octile app screenshots at mobile resolution
 * for both English and Chinese.
 *
 * Usage: SCREENSHOT_URL=http://localhost:5500 node scripts/take-screenshots.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.SCREENSHOT_URL || 'https://octileapp.gitlab.io';
const WIDTH = 540; // 1280;
const HEIGHT = 720; // 800;
const SCALE = 2;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const DISMISS_SPLASH = `const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';`;
const CLEAN_TIPS = `
  document.querySelectorAll('.tooltip, .toast, .checkin-toast, .achieve-toast, .tip-bubble, .hint-tip, .tutorial-tip, .tutorial-hint, .confetti-piece, .ota-banner, .encourage-toast').forEach(t => t.remove());
  var _at = document.getElementById('achieve-toast'); if (_at) { _at.classList.remove('show'); _at.style.display = 'none'; }
  var _em = document.getElementById('energy-modal'); if (_em) _em.classList.remove('show');
  var _dm = document.getElementById('diamond-purchase-modal'); if (_dm) _dm.classList.remove('show');
  var _mm = document.getElementById('multiplier-confirm-modal'); if (_mm) _mm.classList.remove('show');
`;

// Helper: start a level, wait for board, clean tips
async function startAndClean(page, level, theme) {
  await page.evaluate((th) => {
    if (th && typeof setTheme === 'function') setTheme(th);
    if (typeof startLevel === 'function') startLevel('easy');
  }, theme || null);
  await sleep(2500);
  await page.evaluate(CLEAN_TIPS);
  await sleep(300);
}

// Helper: populate win overlay without calling checkWin (avoids global errors)
async function triggerWin(page) {
  await page.evaluate(() => { if (typeof startLevel === 'function') startLevel('easy'); });
  await sleep(3000);
  await page.evaluate(CLEAN_TIPS);
  await page.evaluate(() => {
    // Populate win UI directly instead of calling checkWin()
    gameOver = true;
    var grade = 'S', elapsed = 30, expEarned = 200;
    _winData = { elapsed: elapsed, isNewBest: true, prevBest: 45, grade: grade, expEarned: expEarned,
      chapterBonus: 0, totalUnique: 50, totalSolved: 51, isFirstClear: true, improvement: 15,
      newlyUnlocked: [], isLevelComplete: false, levelTotal: 800,
      cost: 1, totalLeft: 4, motivation: '', fact: '' };
    _winStep = 1;
    document.getElementById('win-step1-title').textContent = t('win_title');
    document.getElementById('win-puzzle-num').textContent = '🌿 ' + t('level_easy') + ' #9';
    document.getElementById('win-time').textContent = '0:30';
    var bestEl = document.getElementById('win-best');
    bestEl.textContent = t('win_new_best') + ' (' + t('win_best') + '0:45)';
    bestEl.className = 'win-best-new'; bestEl.style.display = '';
    document.getElementById('win-grade').innerHTML = '<span class="win-grade-letter grade-s">S</span><span class="win-grade-desc">' + t('grade_s_desc') + '</span>';
    document.getElementById('win-grade').style.color = '#f1c40f';
    document.getElementById('win-level-complete').style.display = 'none';
    document.getElementById('win-tap1').textContent = t('win_tap_continue');
    // Step 2
    document.getElementById('win-step2-title').textContent = t('win_rewards_title');
    document.getElementById('win-rewards').innerHTML = '<div class="win-reward-line">⭐ +200 EXP</div><div class="win-reward-line">💎 +1</div>';
    document.getElementById('win-achievement').innerHTML = '';
    document.getElementById('win-tap2').textContent = t('win_tap_continue');
    // Step 3
    document.getElementById('win-step3-title').textContent = '🌿 9 / 800';
    document.getElementById('win-energy-cost').textContent = '⚡ ' + t('win_energy_plays').replace('{left}', 4);
    document.getElementById('win-motivation').textContent = '';
    document.getElementById('win-motivation').style.display = 'none';
    document.getElementById('win-fact').textContent = '';
    document.getElementById('win-next-btn').innerHTML = t('win_next');
    document.getElementById('win-prev-btn').style.display = '';
    document.getElementById('win-share-btn').innerHTML = t('win_share');
    document.getElementById('win-view-btn').textContent = t('win_view_board');
    document.getElementById('win-random-btn').style.display = 'none';
    document.getElementById('win-menu-btn').textContent = t('win_menu');
    // Show step 1
    _showWinStep(1);
    document.getElementById('win-overlay').classList.add('show');
  });
  await sleep(1000);
  await page.evaluate(CLEAN_TIPS);
  await sleep(300);
}

// Each screen is captured from a fresh page load to avoid state bleed
const SCREENS = [
  // --- Core screens ---
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
      const btn = document.getElementById('settings-btn');
      if (btn) btn.click();
      const dbg = document.getElementById('debug-section');
      if (dbg) dbg.style.display = 'none';
    });
    await sleep(500);
  }},
  { name: 'helpabout', setup: async (page) => {
    await page.evaluate(() => {
      const modal = document.getElementById('help-modal');
      if (modal) modal.classList.add('show');
    });
    await sleep(500);
  }},
  { name: 'scoreboard', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await sleep(300);
    await page.evaluate(() => { if (typeof showScoreboardModal === 'function') showScoreboardModal(); });
    await sleep(3500);
  }},

  // --- Goals modal (Tasks + Achievements + Calendar) ---
  { name: 'goals-tasks', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showGoalsModal === 'function') showGoalsModal('tasks'); });
    await sleep(500);
  }},
  { name: 'goals-achievements', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showGoalsModal === 'function') showGoalsModal('main'); });
    await sleep(500);
  }},
  { name: 'goals-calendar', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showGoalsModal === 'function') showGoalsModal('calendar'); });
    await sleep(500);
  }},
  { name: 'goals-progress', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showGoalsModal === 'function') showGoalsModal('progress'); });
    await sleep(500);
  }},

  { name: 'energy', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showEnergyModal === 'function') showEnergyModal(false); });
    await sleep(500);
  }},
  { name: 'paused', setup: async (page) => {
    await page.evaluate(() => { if (typeof startLevel === 'function') startLevel('easy'); });
    await sleep(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .tutorial-tip').forEach(t => t.remove());
      timerStarted = true; elapsed = 42;
      if (typeof pauseGame === 'function') pauseGame();
    });
    await sleep(500);
  }},

  // --- Themes ---
  { name: 'theme-lego', setup: async (page) => { await startAndClean(page, 'easy', 'lego'); }},
  { name: 'theme-wood', setup: async (page) => { await startAndClean(page, 'easy', 'wood'); }},

  // --- Chapter grids ---
  { name: 'chaptergrid', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openChapterGrid === 'function') openChapterGrid('easy');
    });
    await sleep(500);
  }},
  { name: 'puzzlepath', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openPuzzlePath === 'function') openPuzzlePath('easy', 0);
    });
    await sleep(500);
  }},

  // --- Profile & Auth ---
  { name: 'profile', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showProfileModal === 'function') showProfileModal(); });
    await sleep(500);
  }},
  { name: 'signin', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showAuthModal === 'function') showAuthModal(); });
    await sleep(500);
  }},

  // --- Messages, Multiplier, League ---
  { name: 'messages', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof addMessage === 'function') {
        addMessage('achievement', '\u{1F680}', 'achieve_unlocked', 'ach_first_solve', { achId: 'first_solve' });
        addMessage('multiplier', '\u{1F48E}', 'multiplier_active', 'multiplier_toast_on', { value: 2 });
        addMessage('daily_tasks', '\u2705', 'tasks_bonus_claimed', '', { diamonds: 50 });
      }
      if (typeof showMessagesModal === 'function') showMessagesModal();
    });
    await sleep(500);
  }},
  { name: '2x-diamond', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showMultiplierConfirm === 'function') showMultiplierConfirm(2); });
    await sleep(500);
  }},
  { name: '3x-diamond', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showMultiplierConfirm === 'function') showMultiplierConfirm(3); });
    await sleep(500);
  }},
  { name: 'league', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showScoreboardModal === 'function') showScoreboardModal(); });
    await sleep(1000);
    await page.evaluate(() => { if (typeof switchSbTab === 'function') switchSbTab('league'); });
    await sleep(1000);
  }},

  // --- Diamond purchase ---
  { name: 'diamond-purchase', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showDiamondPurchase === 'function') showDiamondPurchase('Stained Glass', 500, () => {}); });
    await sleep(500);
  }},

  // --- Win screens ---
  { name: 'win', setup: async (page) => {
    await triggerWin(page);
  }},
  { name: 'win2', setup: async (page) => {
    await triggerWin(page);
    await page.evaluate(() => { if (typeof _showWinStep === 'function') _showWinStep(2); });
    await sleep(800);
  }},
  { name: 'win3', setup: async (page) => {
    await triggerWin(page);
    await page.evaluate(() => { if (typeof _showWinStep === 'function') _showWinStep(3); });
    await sleep(800);
  }},
];

async function captureScreen(browser, lang, screen) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });

  if (screen.name === 'splash') {
    // Splash needs fresh state — capture quickly before auto-dismiss
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate((l) => {
      if (typeof currentLang !== 'undefined') { currentLang = l; }
      if (typeof applyLanguage === 'function') applyLanguage();
    }, lang);
    await screen.setup(page);
  } else {
    // Load page, set localStorage, reload so app sees flags from startup
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    const extraStorage = screen.storage ? screen.storage() : {};
    await page.evaluate((extra) => {
      localStorage.setItem('octile_onboarded', '1');
      localStorage.setItem('octile_total_solved', '50');
      localStorage.setItem('octile_tutorial_seen', '1');
      localStorage.setItem('octile_diamonds', '160');
      localStorage.setItem('octile_exp', '950');
      localStorage.setItem('octile_solved', JSON.stringify(Array.from({length: 50}, (_, i) => i + 1)));
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('octile_energy_day', JSON.stringify({ date: today, puzzles: 0, spent: 0 }));
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      localStorage.setItem('octile_daily_checkin', JSON.stringify({ lastDate: today, combo: 1 }));
      localStorage.setItem('octile_achievements', '{}');
      localStorage.setItem('octile_ach_claimed', '{}');
      localStorage.setItem('octile_daily_tasks', JSON.stringify({ date: today, tasks: [], bonusClaimed: true }));
      // Screen-specific localStorage overrides
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    }, extraStorage);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Set language
    await page.evaluate((l) => {
      currentLang = l;
      if (typeof applyLanguage === 'function') applyLanguage();
    }, lang);
    await sleep(500);

    // Dismiss splash
    await page.evaluate(() => { if (typeof dismissSplash === 'function') dismissSplash(); });
    await sleep(800);

    // Setup the screen
    await screen.setup(page);
  }

  // Final cleanup: remove any toasts/notifications that appeared during setup
  const keepModals = ['energy', 'diamond-purchase', '2x-diamond', '3x-diamond'];
  if (!keepModals.includes(screen.name)) {
    await page.evaluate(CLEAN_TIPS);
    await sleep(200);
  }

  // Take screenshot
  const dir = path.join(__dirname, '..', 'docs', 'png', 'app', lang);
  const filepath = path.join(dir, `${screen.name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });

  const stat = fs.statSync(filepath);
  console.log(`  ${screen.name}.png (${Math.round(stat.size / 1024)}KB)`);

  await page.close();
}

(async () => {
  // Try connecting to existing Chrome debug instance, fall back to launching
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
      const dir = path.join(__dirname, '..', 'docs', 'png', 'app', lang);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`\n=== ${lang.toUpperCase()} ===`);

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

  console.log('\nDone! ' + (SCREENS.length * 2) + ' screenshots captured.');
})();
