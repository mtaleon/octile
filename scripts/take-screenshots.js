#!/usr/bin/env node
/**
 * Take all Octile app screenshots at Nest Hub Max resolution (1280x800)
 * for both English and Chinese.
 *
 * Usage: SCREENSHOT_URL=http://localhost:5500 node scripts/take-screenshots.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.SCREENSHOT_URL || 'https://octileapp.gitlab.io';
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const DISMISS_SPLASH = `const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';`;
const CLEAN_TIPS = `document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .hint-tip, .tutorial-tip, .confetti-piece').forEach(t => t.remove());`;

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

// Helper: auto-solve and trigger win
async function triggerWin(page) {
  await page.evaluate(() => { if (typeof startLevel === 'function') startLevel('easy'); });
  await sleep(3000);
  await page.evaluate(() => {
    if (typeof pieces !== 'undefined' && pieces.length > 0) {
      pieces.forEach(p => { p.placed = true; });
      gameOver = true; elapsed = 30; timerStarted = true;
      if (typeof checkWin === 'function') checkWin();
    }
  });
  await sleep(2000);
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
      const btn = document.getElementById('settings-btn') || document.querySelector('[onclick*="Menu"]');
      if (btn) btn.click();
      const dbg = document.getElementById('debug-section');
      if (dbg) dbg.style.display = 'none';
    });
    await sleep(500);
  }},
  { name: 'howtoplay', setup: async (page) => {
    await page.evaluate(() => {
      const modal = document.getElementById('help-modal');
      if (modal) modal.classList.add('show');
    });
    await sleep(500);
  }},
  { name: 'about', setup: async (page) => {
    await page.evaluate(() => {
      const modal = document.getElementById('story-modal');
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
  { name: 'achievements', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof window._achieveTab !== 'undefined') window._achieveTab = 'main';
      if (typeof renderAchieveModal === 'function') renderAchieveModal();
      const modal = document.getElementById('achieve-modal');
      if (modal) { modal.style.display = 'flex'; modal.classList.add('show'); }
    });
    await sleep(500);
  }},
  { name: 'calendar', setup: async (page) => {
    await page.evaluate(() => {
      _achieveTab = 'calendar';
      if (typeof renderAchieveModal === 'function') renderAchieveModal();
      const modal = document.getElementById('achieve-modal');
      if (modal) { modal.style.display = 'flex'; modal.classList.add('show'); }
    });
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
  { name: 'chaptergrid-medium', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openChapterGrid === 'function') openChapterGrid('medium');
    });
    await sleep(500);
  }},
  { name: 'chaptergrid-hard', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openChapterGrid === 'function') openChapterGrid('hard');
    });
    await sleep(500);
  }},
  { name: 'chaptergrid-hell', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openChapterGrid === 'function') openChapterGrid('hell');
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

  // --- Daily Tasks, Messages, Multiplier, League ---
  { name: 'dailytasks', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showDailyTasksModal === 'function') showDailyTasksModal(); });
    await sleep(500);
  }},
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
  { name: 'multiplier-confirm', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showMultiplierConfirm === 'function') showMultiplierConfirm(2); });
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
  { name: 'multiplier-active', setup: async (page) => {
    await startAndClean(page, 'easy', 'classic');
    await page.evaluate(() => { if (typeof activateMultiplier === 'function') activateMultiplier(2); });
    await sleep(300);
  }},
  { name: 'league', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showScoreboardModal === 'function') showScoreboardModal(); });
    await sleep(1000);
    await page.evaluate(() => { if (typeof switchSbTab === 'function') switchSbTab('league'); });
    await sleep(1000);
  }},

  // --- Diamond purchase modals ---
  { name: 'diamond-purchase', setup: async (page) => {
    await page.evaluate(DISMISS_SPLASH);
    await page.evaluate(() => { if (typeof showDiamondPurchase === 'function') showDiamondPurchase('Stained Glass', 500, () => {}); });
    await sleep(500);
  }},
  { name: 'hint-diamond', storage: () => {
    // Exhaust daily hints so button shows diamond cost
    const today = new Date().toISOString().slice(0, 10);
    return { octile_daily_hints: JSON.stringify({ date: today, used: 10 }) };
  }, setup: async (page) => {
    await startAndClean(page, 'easy', 'wood');
  }},
  { name: 'hint-purchase', setup: async (page) => {
    await startAndClean(page, 'easy', 'wood');
    await page.evaluate(() => {
      if (typeof showDiamondPurchase === 'function') showDiamondPurchase(t('hint_buy_name'), 100, () => {});
    });
    await sleep(500);
  }},
  { name: 'unlock-purchase', setup: async (page) => {
    await startAndClean(page, 'easy', 'wood');
    await page.evaluate(() => {
      if (typeof showDiamondPurchase === 'function') showDiamondPurchase(t('unlock_next_puzzle') || 'Unlock Next Puzzle', 50, () => {});
    });
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
  { name: 'viewboard', setup: async (page) => {
    await triggerWin(page);
    await page.evaluate(() => { document.getElementById('win-overlay').classList.remove('show'); });
    await sleep(500);
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
      localStorage.setItem('octile_energy_day', JSON.stringify({ date: today, puzzles: 1, spent: 0 }));
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

  // Take screenshot
  const dir = path.join(__dirname, '..', 'docs', 'png', 'app', lang);
  const filepath = path.join(dir, `${screen.name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });

  const stat = fs.statSync(filepath);
  console.log(`  ${screen.name}.png (${Math.round(stat.size / 1024)}KB)`);

  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

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
    await browser.close();
  }

  console.log('\nDone! ' + (SCREENS.length * 2) + ' screenshots captured.');
})();
