#!/usr/bin/env node
/**
 * Take all Octile app screenshots at Nest Hub Max resolution (1280x800)
 * for both English and Chinese.
 *
 * Usage: node scripts/take-screenshots.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://octileapp.gitlab.io';
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Close all modals and overlays
const CLOSE_ALL = `
  document.querySelectorAll('.modal-overlay, .modal').forEach(m => {
    m.style.display = 'none';
    m.classList.remove('show', 'visible');
  });
  // Also close specific known modals
  ['settings-modal','help-modal','story-modal','scoreboard-modal','achieve-modal',
   'energy-modal','pause-overlay','profile-modal','chapter-grid-modal','puzzle-path-modal',
   'signin-modal','diamond-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.remove('show','visible'); }
  });
`;

// Each screen is captured from a fresh page load to avoid state bleed
const SCREENS = [
  { name: 'splash', setup: async (page) => {
    // Capture immediately — splash auto-dismisses after 5s for new users
    await sleep(300);
  }},
  { name: 'welcome', setup: async (page) => {
    // Splash already dismissed by shared code. Just clean up tooltips.
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .tutorial-tip').forEach(t => t.remove());
    });
    await sleep(300);
  }},
  { name: 'gameplay', setup: async (page) => {
    // Start a puzzle directly
    await page.evaluate(() => {
      if (typeof startLevel === 'function') startLevel('easy');
    });
    await sleep(2500);
    // Hide tooltips/toasts
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .hint-tip, .tutorial-tip').forEach(t => t.remove());
    });
    await sleep(300);
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
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
    });
    await sleep(300);
    await page.evaluate(() => {
      if (typeof showScoreboardModal === 'function') showScoreboardModal();
    });
    await sleep(3500); // wait for API
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
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof showEnergyModal === 'function') showEnergyModal(false);
    });
    await sleep(500);
  }},
  { name: 'paused', setup: async (page) => {
    await page.evaluate(() => {
      if (typeof startLevel === 'function') startLevel('easy');
    });
    await sleep(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .tutorial-tip').forEach(t => t.remove());
      // Force timer started so pauseGame works
      timerStarted = true;
      elapsed = 42;
      if (typeof pauseGame === 'function') pauseGame();
    });
    await sleep(500);
  }},
  { name: 'theme-lego', setup: async (page) => {
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('lego');
      if (typeof startLevel === 'function') startLevel('easy');
    });
    await sleep(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .tutorial-tip').forEach(t => t.remove());
    });
    await sleep(300);
  }},
  { name: 'theme-wood', setup: async (page) => {
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('wood');
      if (typeof startLevel === 'function') startLevel('easy');
    });
    await sleep(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .tutorial-tip').forEach(t => t.remove());
    });
    await sleep(300);
  }},
  { name: 'chaptergrid', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openChapterGrid === 'function') openChapterGrid('easy');
    });
    await sleep(500);
  }},
  { name: 'puzzlepath', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof openPuzzlePath === 'function') openPuzzlePath('easy', 0);
    });
    await sleep(500);
  }},
  { name: 'profile', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof showProfileModal === 'function') showProfileModal();
    });
    await sleep(500);
  }},
  { name: 'dailytasks', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof showDailyTasksModal === 'function') showDailyTasksModal();
    });
    await sleep(500);
  }},
  { name: 'messages', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      // Add sample messages for screenshot
      if (typeof addMessage === 'function') {
        addMessage('achievement', '🚀', 'achieve_unlocked', 'ach_first_solve', { achId: 'first_solve' });
        addMessage('multiplier', '💎', 'multiplier_active', 'multiplier_toast_on', { value: 2 });
        addMessage('daily_tasks', '✅', 'tasks_bonus_claimed', '', { diamonds: 50 });
      }
      if (typeof showMessagesModal === 'function') showMessagesModal();
    });
    await sleep(500);
  }},
  { name: 'multiplier-confirm', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof showMultiplierConfirm === 'function') showMultiplierConfirm(2);
    });
    await sleep(500);
  }},
  { name: 'multiplier-active', setup: async (page) => {
    await page.evaluate(() => {
      if (typeof setTheme === 'function') setTheme('classic');
      if (typeof startLevel === 'function') startLevel('easy');
    });
    await sleep(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .tip-bubble, .tutorial-tip').forEach(t => t.remove());
      // Simulate active multiplier display
      if (typeof activateMultiplier === 'function') activateMultiplier(2);
    });
    await sleep(300);
  }},
  { name: 'league', setup: async (page) => {
    await page.evaluate(() => {
      const _sp = document.getElementById('splash'); if (_sp) _sp.style.display = 'none';
      if (typeof showScoreboardModal === 'function') showScoreboardModal();
    });
    await sleep(1000);
    await page.evaluate(() => {
      // Switch to league tab
      if (typeof switchSbTab === 'function') switchSbTab('league');
    });
    await sleep(1000);
  }},
];

async function captureScreen(browser, lang, screen) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });

  if (screen.name === 'splash') {
    // Splash needs fresh state — load page, capture quickly before auto-dismiss (5s for new users)
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Set language immediately
    await page.evaluate((l) => {
      if (typeof currentLang !== 'undefined') { currentLang = l; }
      if (typeof applyLanguage === 'function') applyLanguage();
    }, lang);
    await screen.setup(page);
  } else {
    // Load page first, then set onboarded flag and reload
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('octile_onboarded', '1');
      localStorage.setItem('octile_total_solved', '5');
      localStorage.setItem('octile_tutorial_seen', '1');
      // Suppress "First puzzle of the day" tooltip
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('octile_energy_day', JSON.stringify({ date: today, puzzles: 1, spent: 0 }));
    });
    // Reload so the app sees onboarded=true from startup
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Set language
    await page.evaluate((l) => {
      currentLang = l;
      if (typeof applyLanguage === 'function') applyLanguage();
    }, lang);
    await sleep(500);

    // Dismiss splash (3s for returning users, but dismiss manually)
    await page.evaluate(() => {
      if (typeof dismissSplash === 'function') dismissSplash();
    });
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
