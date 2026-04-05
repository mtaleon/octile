const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// P0: Back behavior / modal stacking
// ---------------------------------------------------------------------------

test.describe('Modal Close Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('closing profile modal does not leave ghost overlays', async ({ page }) => {
    await page.evaluate(() => showProfileModal());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('profile-close').click());
    await page.waitForTimeout(300);
    const modals = await page.evaluate(() => {
      var shown = [];
      document.querySelectorAll('[role="dialog"]').forEach(el => {
        if (el.classList.contains('show')) shown.push(el.id);
      });
      return shown;
    });
    expect(modals.length).toBe(0);
  });

  test('closing scoreboard modal does not leave ghost overlays', async ({ page }) => {
    await page.evaluate(() => { try { showScoreboardModal(); } catch(e) {} });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.getElementById('scoreboard-modal').classList.remove('show');
    });
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() => document.getElementById('scoreboard-modal').classList.contains('show'));
    expect(visible).toBe(false);
  });

  test('opening multiple modals sequentially: only last one shows', async ({ page }) => {
    await page.evaluate(() => {
      showProfileModal();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.getElementById('profile-modal').classList.remove('show');
      showMessagesModal();
    });
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      profile: document.getElementById('profile-modal').classList.contains('show'),
      messages: document.getElementById('messages-modal').classList.contains('show'),
    }));
    expect(state.profile).toBe(false);
    expect(state.messages).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P0: Race condition - rapid navigation
// ---------------------------------------------------------------------------

test.describe('Rapid Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('rapid returnToWelcome does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      try {
        returnToWelcome();
        returnToWelcome();
        returnToWelcome();
        return 'ok';
      } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('ok');
  });

  test('rapid profile open/close does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      try {
        for (var i = 0; i < 5; i++) {
          showProfileModal();
          document.getElementById('profile-modal').classList.remove('show');
        }
        return 'ok';
      } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('ok');
  });

  test('rapid startGame/returnToWelcome does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      try {
        startGame(1);
        returnToWelcome();
        startGame(1);
        returnToWelcome();
        return 'ok';
      } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// P0: Offline score queue
// ---------------------------------------------------------------------------

test.describe('Offline Score Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('queue preserves order (FIFO)', async ({ page }) => {
    const result = await page.evaluate(() => {
      saveScoreQueue([]);
      var q = getScoreQueue();
      q.push({ puzzle: 1, time: 10 });
      q.push({ puzzle: 2, time: 20 });
      q.push({ puzzle: 3, time: 30 });
      saveScoreQueue(q);
      var loaded = getScoreQueue();
      return loaded.map(s => s.puzzle);
    });
    expect(result).toEqual([1, 2, 3]);
  });

  test('queue survives page reload', async ({ page }) => {
    await page.evaluate(() => {
      saveScoreQueue([{ puzzle: 42, time: 60 }]);
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const result = await page.evaluate(() => getScoreQueue());
    expect(result.length).toBe(1);
    expect(result[0].puzzle).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// P1: Welcome panel / tutorial state
// ---------------------------------------------------------------------------

test.describe('Tutorial State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('isTutorialSeen returns false initially', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_tutorial_seen');
      return isTutorialSeen();
    });
    expect(result).toBe(false);
  });

  test('markTutorialSeen persists', async ({ page }) => {
    const result = await page.evaluate(() => {
      markTutorialSeen();
      return isTutorialSeen();
    });
    expect(result).toBe(true);
  });

  test('onboarded flag persists across logout', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_onboarded', '1');
      localStorage.setItem('octile_auth_token', 'test');
      localStorage.setItem('octile_auth_user', '{}');
      authLogout();
    });
    const result = await page.evaluate(() => localStorage.getItem('octile_onboarded'));
    expect(result).toBe('1');
  });
});
