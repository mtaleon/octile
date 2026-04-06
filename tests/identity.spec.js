const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// B. Multi-device / re-login / data merge rules
// ---------------------------------------------------------------------------

test.describe('Sync & Merge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('_getLocalProgress captures all progress fields', async ({ page }) => {
    const progress = await page.evaluate(() => {
      localStorage.setItem('octile_exp', '1000');
      localStorage.setItem('octile_diamonds', '50');
      localStorage.setItem('octile_level_easy', '10');
      localStorage.setItem('octile_total_solved', '20');
      localStorage.setItem('octile_grades', JSON.stringify({ S: 5, A: 10, B: 5 }));
      return _getLocalProgress();
    });
    expect(progress.exp).toBe(1000);
    expect(progress.diamonds).toBe(50);
    expect(progress.level_easy).toBe(10);
    expect(progress.total_solved).toBe(20);
    expect(progress.grades_s).toBe(5);
    expect(progress).toHaveProperty('browser_uuid');
    expect(progress).toHaveProperty('achievements');
    expect(progress).toHaveProperty('solved_set');
    expect(progress).toHaveProperty('best_times');
    expect(progress).toHaveProperty('unlocked_themes');
    expect(progress).toHaveProperty('months');
  });

  test('_applyServerProgress uses MAX merge for levels', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_level_easy', '15');
      _applyServerProgress({ level_easy: 10, level_medium: 0 });
      var afterLow = getLevelProgress('easy');
      _applyServerProgress({ level_easy: 20 });
      var afterHigh = getLevelProgress('easy');
      return { afterLow, afterHigh };
    });
    expect(result.afterLow).toBe(15);  // local 15 > server 10, keep local
    expect(result.afterHigh).toBe(20); // server 20 > local 15, take server
  });

  test('_applyServerProgress uses MAX merge for EXP', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_exp', '500');
      _applyServerProgress({ exp: 300 });
      var afterLow = getExp();
      _applyServerProgress({ exp: 800 });
      var afterHigh = getExp();
      return { afterLow, afterHigh };
    });
    expect(result.afterLow).toBe(500);
    expect(result.afterHigh).toBe(800);
  });

  test('_applyServerProgress uses MAX merge for diamonds', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_diamonds', '100');
      _applyServerProgress({ diamonds: 50 });
      var afterLow = getDiamonds();
      _applyServerProgress({ diamonds: 200 });
      var afterHigh = getDiamonds();
      return { afterLow, afterHigh };
    });
    expect(result.afterLow).toBe(100);
    expect(result.afterHigh).toBe(200);
  });

  test('_applyServerProgress unions achievements', async ({ page }) => {
    const result = await page.evaluate(() => {
      saveUnlockedAchievements({ local_ach: true });
      _applyServerProgress({ achievements: ['server_ach'] });
      var u = getUnlockedAchievements();
      return { hasLocal: !!u.local_ach, hasServer: !!u.server_ach };
    });
    expect(result.hasLocal).toBe(true);
    expect(result.hasServer).toBe(true);
  });

  test('_applyServerProgress unions solved set', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_solved', JSON.stringify([1, 2, 3]));
      _applyServerProgress({ solved_set: [3, 4, 5] });
      var s = getSolvedSet();
      return { size: s.size, has1: s.has(1), has4: s.has(4), has5: s.has(5) };
    });
    expect(result.size).toBe(5);
    expect(result.has1).toBe(true);
    expect(result.has4).toBe(true);
    expect(result.has5).toBe(true);
  });

  test('_applyServerProgress keeps faster best times', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_best_42', '60');
      _applyServerProgress({ best_times: { '42': 45, '99': 30 } });
      return {
        puzzle42: parseFloat(localStorage.getItem('octile_best_42')),
        puzzle99: parseFloat(localStorage.getItem('octile_best_99')),
      };
    });
    expect(result.puzzle42).toBe(45);  // server 45 < local 60
    expect(result.puzzle99).toBe(30);  // new puzzle from server
  });

  test('_applyServerProgress unions months', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_months', JSON.stringify([null, null, null, true])); // March
      _applyServerProgress({ months: [0, 5] }); // Jan + June
      var months = JSON.parse(localStorage.getItem('octile_months'));
      return { jan: !!months[0], mar: !!months[3], jun: !!months[5] };
    });
    expect(result.jan).toBe(true);
    expect(result.mar).toBe(true);
    expect(result.jun).toBe(true);
  });

  test('_applyServerProgress unions unlocked themes', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_unlocked_themes', JSON.stringify(['dark']));
      _applyServerProgress({ unlocked_themes: ['ocean', 'dark'] });
      return JSON.parse(localStorage.getItem('octile_unlocked_themes')).sort();
    });
    expect(result).toEqual(['dark', 'ocean']);
  });

  test('_applyServerProgress keeps higher streak', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Use today's date so getStreak() doesn't normalize/reset the count
      var today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('octile_streak', JSON.stringify({ count: 5, lastDate: today }));
      _applyServerProgress({ streak_count: 3, streak_last_date: '2026-03-30' });
      var s = JSON.parse(localStorage.getItem('octile_streak'));
      return s.count;
    });
    expect(result).toBe(5); // local 5 > server 3
  });

  test('_applyServerProgress uses MAX merge for grades', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_grades', JSON.stringify({ S: 10, A: 5, B: 3 }));
      _applyServerProgress({ grades_s: 8, grades_a: 12, grades_b: 1 });
      return JSON.parse(localStorage.getItem('octile_grades'));
    });
    expect(result.S).toBe(10); // local 10 > server 8
    expect(result.A).toBe(12); // server 12 > local 5
    expect(result.B).toBe(3);  // local 3 > server 1
  });
});

test.describe('Browser UUID', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('getBrowserUUID prefers cookie UUID over legacy', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_cookie_uuid', 'cookie-123');
      localStorage.setItem('octile_browser_uuid', 'legacy-456');
      return getBrowserUUID();
    });
    expect(result).toBe('cookie-123');
  });

  test('getBrowserUUID falls back to legacy UUID', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_cookie_uuid');
      localStorage.setItem('octile_browser_uuid', 'legacy-456');
      return getBrowserUUID();
    });
    expect(result).toBe('legacy-456');
  });

  test('_getLocalProgress includes browser_uuid', async ({ page }) => {
    const progress = await page.evaluate(() => _getLocalProgress());
    expect(typeof progress.browser_uuid).toBe('string');
    expect(progress.browser_uuid.length).toBeGreaterThan(0);
  });
});
