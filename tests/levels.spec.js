const { test, expect } = require('@playwright/test');

test.describe('Level System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('4 difficulty levels exist', async ({ page }) => {
    const levels = await page.evaluate(() => LEVELS);
    expect(levels).toEqual(['easy', 'medium', 'hard', 'hell']);
  });

  test('easy is always unlocked', async ({ page }) => {
    const unlocked = await page.evaluate(() => isLevelUnlocked('easy'));
    expect(unlocked).toBe(true);
  });

  test('medium locked when easy not complete', async ({ page }) => {
    const unlocked = await page.evaluate(() => {
      localStorage.setItem('octile_level_easy', '0');
      return isLevelUnlocked('medium');
    });
    expect(unlocked).toBe(false);
  });

  test('getLevelProgress reads from localStorage', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_level_easy', '15');
      return getLevelProgress('easy');
    });
    expect(result).toBe(15);
  });

  test('setLevelProgress writes to localStorage', async ({ page }) => {
    await page.evaluate(() => setLevelProgress('easy', 42));
    const val = await page.evaluate(() => parseInt(localStorage.getItem('octile_level_easy')));
    expect(val).toBe(42);
  });

  test('chapter size varies by level', async ({ page }) => {
    const result = await page.evaluate(() => ({
      easy: getChapterSize('easy'),
      medium: getChapterSize('medium'),
      hard: getChapterSize('hard'),
      hell: getChapterSize('hell'),
    }));
    expect(result.easy).toBeGreaterThan(0);
    expect(result.medium).toBeGreaterThan(0);
    expect(result.hard).toBeGreaterThan(0);
    expect(result.hell).toBeGreaterThan(0);
  });

  test('PAR_TIMES defined for all levels', async ({ page }) => {
    const result = await page.evaluate(() => PAR_TIMES);
    expect(result).toEqual({ easy: 60, medium: 90, hard: 120, hell: 180 });
  });
});

test.describe('Hints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('hints start at 0 used today', async ({ page }) => {
    const used = await page.evaluate(() => {
      localStorage.removeItem('octile_hints');
      return getHintsUsedToday();
    });
    expect(used).toBe(0);
  });

  test('MAX_HINTS is 3', async ({ page }) => {
    const max = await page.evaluate(() => MAX_HINTS);
    expect(max).toBe(3);
  });

  test('useHint increments count', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_hints');
      useHint();
      return getHintsUsedToday();
    });
    expect(result).toBe(1);
  });

  test('rolloverDailyHints resets on new day', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Set hints as if from yesterday
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_hints', JSON.stringify({ date: yesterday, used: 3 }));
      rolloverDailyHints();
      return getHintsUsedToday();
    });
    expect(result).toBe(0);
  });
});
