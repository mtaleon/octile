const { test, expect } = require('@playwright/test');

test.describe('UUID & Avatar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('getBrowserUUID returns a string', async ({ page }) => {
    const uuid = await page.evaluate(() => getBrowserUUID());
    expect(typeof uuid).toBe('string');
    expect(uuid.length).toBeGreaterThan(0);
  });

  test('generateCuteName is deterministic per UUID', async ({ page }) => {
    const result = await page.evaluate(() => {
      var name1 = generateCuteName('test-uuid-123');
      var name2 = generateCuteName('test-uuid-123');
      var name3 = generateCuteName('different-uuid');
      return { name1, name2, name3 };
    });
    expect(result.name1).toBe(result.name2);
    expect(result.name1).not.toBe(result.name3);
  });

  test('generateAvatar returns data URL', async ({ page }) => {
    const avatar = await page.evaluate(() => generateAvatar('test-uuid-123'));
    expect(typeof avatar).toBe('string');
    expect(avatar.startsWith('data:')).toBe(true);
  });
});

test.describe('Move Log (Anti-Cheat)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('_moveLog starts empty after reset', async ({ page }) => {
    const len = await page.evaluate(() => {
      _moveLog = [];
      return _moveLog.length;
    });
    expect(len).toBe(0);
  });

  test('recordMove adds entry to log', async ({ page }) => {
    const result = await page.evaluate(() => {
      _moveLog = [];
      // recordMove(tileIndex, direction, position)
      if (typeof recordMove === 'function') {
        recordMove(0, 0, 10);
        return _moveLog.length;
      }
      return -1; // function not found
    });
    expect(result).toBeGreaterThanOrEqual(1);
  });

  test('encodeMoveLog produces string', async ({ page }) => {
    const result = await page.evaluate(() => {
      _moveLog = [];
      // Add enough entries to test encoding
      if (typeof recordMove === 'function') {
        for (var i = 0; i < 8; i++) recordMove(i, 0, i * 8);
      }
      return typeof encodeMoveLog();
    });
    expect(result).toBe('string');
  });
});

test.describe('Offline Score Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('getScoreQueue returns array', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_score_queue');
      return Array.isArray(getScoreQueue());
    });
    expect(result).toBe(true);
  });

  test('saveScoreQueue persists', async ({ page }) => {
    const result = await page.evaluate(() => {
      saveScoreQueue([{ puzzle: 1, time: 30 }]);
      return getScoreQueue();
    });
    expect(result.length).toBe(1);
    expect(result[0].puzzle).toBe(1);
  });
});
