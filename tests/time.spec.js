const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// E. Time-dependent logic — mock dates to avoid flakiness
// ---------------------------------------------------------------------------

test.describe('Daily Reset (date boundary)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('energy first-free resets on new day', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Yesterday: used 3 puzzles
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_energy_day', JSON.stringify({ date: yesterday, puzzles: 3, spent: 3 }));
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      // Today should be a new day → first puzzle free
      return hasEnoughEnergy();
    });
    expect(result).toBe(true);
  });

  test('daily stats reset on new day', async ({ page }) => {
    const result = await page.evaluate(() => {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_energy_day', JSON.stringify({ date: yesterday, puzzles: 5, spent: 5 }));
      return getDailyStats().puzzles;
    });
    expect(result).toBe(0); // new day, fresh stats
  });

  test('daily tasks regenerate on new day', async ({ page }) => {
    const result = await page.evaluate(() => {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_daily_tasks', JSON.stringify({
        date: yesterday,
        tasks: [{ id: 'old_task', target: 1, progress: 1, reward: 10, claimed: true, counter: 'solves' }],
        bonusClaimed: true,
      }));
      var data = getDailyTasks();
      return { date: data.date, count: data.tasks.length, claimed: data.tasks[0].claimed };
    });
    var today = new Date().toISOString().slice(0, 10);
    expect(result.date).toBe(today);
    expect(result.count).toBe(3);
    expect(result.claimed).toBe(false);
  });

  test('daily task counters reset on new day', async ({ page }) => {
    const result = await page.evaluate(() => {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_daily_task_counters', JSON.stringify({ date: yesterday, solves: 10 }));
      return getDailyTaskCounters().solves;
    });
    expect(result).toBe(0);
  });

  test('hints reset on new day', async ({ page }) => {
    const result = await page.evaluate(() => {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_hints', JSON.stringify({ date: yesterday, used: 3 }));
      rolloverDailyHints();
      return getHintsUsedToday();
    });
    expect(result).toBe(0);
  });

  test('check-in resets on new day', async ({ page }) => {
    const result = await page.evaluate(() => {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_daily_checkin', JSON.stringify({ lastDate: yesterday, combo: 3 }));
      localStorage.setItem('octile_diamonds', '0');
      doDailyCheckin();
      return getDiamonds();
    });
    expect(result).toBeGreaterThan(0);
  });
});

test.describe('Energy Recovery Over Time', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('0 points → 1 point after 2 hours', async ({ page }) => {
    const pts = await page.evaluate(() => {
      var ts = Date.now() - 2 * 3600 * 1000;
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts }));
      return Math.floor(getEnergyState().points);
    });
    expect(pts).toBe(1);
  });

  test('0 points → 2 points after 4 hours', async ({ page }) => {
    const pts = await page.evaluate(() => {
      var ts = Date.now() - 4 * 3600 * 1000;
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts }));
      return Math.floor(getEnergyState().points);
    });
    expect(pts).toBe(2);
  });

  test('3 points → caps at 5 after 10 hours', async ({ page }) => {
    const pts = await page.evaluate(() => {
      var ts = Date.now() - 10 * 3600 * 1000;
      localStorage.setItem('octile_energy', JSON.stringify({ points: 3, ts }));
      return getEnergyState().points;
    });
    expect(pts).toBe(5);
  });

  test('already at 5 → stays at 5 regardless of time', async ({ page }) => {
    const pts = await page.evaluate(() => {
      var ts = Date.now() - 24 * 3600 * 1000;
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts }));
      return getEnergyState().points;
    });
    expect(pts).toBe(5);
  });
});

test.describe('Streak Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('streak from yesterday continues today', async ({ page }) => {
    const result = await page.evaluate(() => {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_streak', JSON.stringify({ count: 7, lastDate: yesterday }));
      return updateStreak();
    });
    expect(result).toBe(8);
  });

  test('streak from 2 days ago resets to 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      var twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_streak', JSON.stringify({ count: 10, lastDate: twoDaysAgo }));
      return updateStreak();
    });
    expect(result).toBe(1);
  });

  test('streak from today stays unchanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      var today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('octile_streak', JSON.stringify({ count: 5, lastDate: today }));
      return updateStreak();
    });
    expect(result).toBe(5);
  });

  test('empty streak starts at 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_streak');
      return updateStreak();
    });
    expect(result).toBe(1);
  });

  test('corrupt streak starts fresh at 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_streak', 'garbage');
      return updateStreak();
    });
    expect(result).toBe(1);
  });
});

test.describe('Multiplier Time Windows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('MULTIPLIER_TIME_WINDOWS are defined', async ({ page }) => {
    const windows = await page.evaluate(() => MULTIPLIER_TIME_WINDOWS);
    expect(Array.isArray(windows)).toBe(true);
    expect(windows.length).toBeGreaterThan(0);
    windows.forEach(w => {
      expect(w).toHaveProperty('start');
      expect(w).toHaveProperty('end');
      expect(w.end).toBeGreaterThan(w.start);
    });
  });

  test('multiplier duration is 10 minutes', async ({ page }) => {
    const ms = await page.evaluate(() => MULTIPLIER_DURATION_MS);
    expect(ms).toBe(10 * 60 * 1000);
  });

  test('expired multiplier returns value 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_multiplier', JSON.stringify({
        value: 2, expiresAt: Date.now() - 1000, type: 'time_window'
      }));
      return getActiveMultiplier();
    });
    expect(result).toBe(1);
  });

  test('active multiplier returns stored value', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_multiplier', JSON.stringify({
        value: 3, expiresAt: Date.now() + 60000, type: 'consecutive'
      }));
      return getActiveMultiplier();
    });
    expect(result).toBe(3);
  });
});
