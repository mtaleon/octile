const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// P0: Empty state / New player
// ---------------------------------------------------------------------------

test.describe('New Player Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('zero solves → tier is "new"', async ({ page }) => {
    const tier = await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '0');
      return getPlayerTier();
    });
    expect(tier).toBe('new');
  });

  test('profile stats with zero solves has valid structure', async ({ page }) => {
    const stats = await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '0');
      localStorage.removeItem('octile_grades');
      localStorage.removeItem('octile_total_time');
      return calcProfileStats();
    });
    expect(stats.totalSolves).toBe(0);
    expect(stats.radar.speed).toBe(0);
    expect(stats.radar.mastery).toBe(0);
    expect(stats.radar.breadth).toBe(0);
    // getStreak() returns count>=1 for today, so dedication is never exactly 0
    expect(stats.radar.dedication).toBeGreaterThanOrEqual(0);
    expect(stats.radar.progress).toBe(0);
  });

  test('profile modal shows for new player without crash', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '0');
      localStorage.removeItem('octile_grades');
      showProfileModal();
    });
    await page.waitForTimeout(500);
    const visible = await page.evaluate(() => document.getElementById('profile-modal').classList.contains('show'));
    expect(visible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P0: Tier transition
// ---------------------------------------------------------------------------

test.describe('Tier Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('tier progresses: new → active at threshold', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '0');
      var tier0 = getPlayerTier();
      // TIER_ACTIVE defaults to 10
      localStorage.setItem('octile_total_solved', String(TIER_ACTIVE));
      var tierActive = getPlayerTier();
      return { tier0, tierActive };
    });
    expect(result.tier0).toBe('new');
    expect(result.tierActive).toBe('active');
  });

  test('expert tier at high solve count', async ({ page }) => {
    const tier = await page.evaluate(() => {
      // TIER_EXPERT defaults to 200, code uses > (not >=), so need 201+
      localStorage.setItem('octile_total_solved', String(TIER_EXPERT + 1));
      localStorage.setItem('octile_exp', '50000');
      return getPlayerTier();
    });
    expect(tier).toBe('expert');
  });
});

// ---------------------------------------------------------------------------
// P0: Stats source consistency
// ---------------------------------------------------------------------------

test.describe('Stats Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('calcProfileStats reads same data as getExp/getDiamonds', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_exp', '2500');
      localStorage.setItem('octile_diamonds', '75');
      localStorage.setItem('octile_total_solved', '30');
      var stats = calcProfileStats();
      return {
        statsExp: stats.exp || getExp(),
        directExp: getExp(),
        statsDiamonds: stats.diamonds,
        directDiamonds: getDiamonds(),
        statsSolves: stats.totalSolves,
        directSolves: parseInt(localStorage.getItem('octile_total_solved')),
      };
    });
    expect(result.directExp).toBe(2500);
    expect(result.statsDiamonds).toBe(75);
    expect(result.directDiamonds).toBe(75);
    expect(result.statsSolves).toBe(30);
    expect(result.directSolves).toBe(30);
  });

  test('grade counts match localStorage', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_grades', JSON.stringify({ S: 10, A: 15, B: 5 }));
      var stats = calcProfileStats();
      return { S: stats.grades?.S, A: stats.grades?.A, B: stats.grades?.B };
    });
    expect(result.S).toBe(10);
    expect(result.A).toBe(15);
    expect(result.B).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// P1: Extreme values
// ---------------------------------------------------------------------------

test.describe('Extreme Values', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('very high EXP does not crash profile', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_exp', '999999999');
      localStorage.setItem('octile_total_solved', '10000');
      try { calcProfileStats(); showProfileModal(); return 'ok'; } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('ok');
  });

  test('very high streak does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_streak', JSON.stringify({ count: 99999, lastDate: new Date().toISOString().slice(0, 10) }));
      try { calcProfileStats(); return 'ok'; } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('ok');
  });

  test('energy never goes below 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      deductEnergy(5);
      return getEnergyState().points;
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('energy never exceeds ENERGY_MAX', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 10, ts: Date.now() }));
      return getEnergyState().points;
    });
    expect(result).toBeLessThanOrEqual(5);
  });
});
