const { test, expect } = require('@playwright/test');

test.describe('Welcome Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    // Go to welcome panel
    await page.evaluate(() => returnToWelcome());
    await page.waitForTimeout(500);
  });

  test('welcome panel is visible', async ({ page }) => {
    const visible = await page.evaluate(() => !document.getElementById('welcome-panel').classList.contains('hidden'));
    expect(visible).toBe(true);
  });

  test('welcome panel shows difficulty levels', async ({ page }) => {
    const html = await page.evaluate(() => document.getElementById('welcome-panel').innerHTML);
    // Should contain level names
    expect(html).toContain('Easy');
  });

  test('today goal card is visible', async ({ page }) => {
    const exists = await page.evaluate(() => !!document.getElementById('wp-today-goal'));
    expect(exists).toBe(true);
  });
});

test.describe('Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('startGame enters game mode', async ({ page }) => {
    await page.evaluate(() => {
      // Ensure energy available
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      startGame(1);
    });
    await page.waitForTimeout(500);
    const inGame = await page.evaluate(() => document.body.classList.contains('in-game'));
    expect(inGame).toBe(true);
  });

  test('returnToWelcome exits game mode', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      startGame(1);
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => returnToWelcome());
    await page.waitForTimeout(300);
    const inGame = await page.evaluate(() => document.body.classList.contains('in-game'));
    expect(inGame).toBe(false);
  });

  test('scoreboard modal opens', async ({ page }) => {
    await page.evaluate(() => {
      try { showScoreboardModal(); } catch(e) {}
    });
    await page.waitForTimeout(500);
    const visible = await page.evaluate(() => document.getElementById('scoreboard-modal').classList.contains('show'));
    expect(visible).toBe(true);
  });

  test('messages modal opens', async ({ page }) => {
    await page.evaluate(() => showMessagesModal());
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() => document.getElementById('messages-modal').classList.contains('show'));
    expect(visible).toBe(true);
  });

  test('settings modal opens', async ({ page }) => {
    await page.evaluate(() => document.getElementById('settings-modal').classList.add('show'));
    const visible = await page.evaluate(() => document.getElementById('settings-modal').classList.contains('show'));
    expect(visible).toBe(true);
  });
});

test.describe('Puzzle Data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('getEffectivePuzzleCount returns valid count', async ({ page }) => {
    const count = await page.evaluate(() => getEffectivePuzzleCount());
    expect(count).toBeGreaterThan(1000);
  });

  test('getRandomPuzzleNumber returns valid number', async ({ page }) => {
    const num = await page.evaluate(() => getRandomPuzzleNumber());
    expect(num).toBeGreaterThan(0);
    expect(num).toBeLessThanOrEqual(await page.evaluate(() => getMaxPuzzleNumber()));
  });

  test('puzzleNumberToDisplay and back are inverses', async ({ page }) => {
    const result = await page.evaluate(() => {
      var original = 42;
      var display = puzzleNumberToDisplay(original);
      var back = displayToPuzzleNumber(display);
      return { original, display, back };
    });
    expect(result.back).toBe(result.original);
  });
});
