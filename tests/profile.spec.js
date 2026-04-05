const { test, expect } = require('@playwright/test');

test.describe('Player Tier & Rank', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('new player is tier "new"', async ({ page }) => {
    const tier = await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '0');
      return getPlayerTier();
    });
    expect(tier).toBe('new');
  });

  test('player with 5+ solves is "active"', async ({ page }) => {
    const tier = await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '10');
      return getPlayerTier();
    });
    expect(tier).toBe('active');
  });

  test('getRankTitle returns non-empty string', async ({ page }) => {
    const title = await page.evaluate(() => {
      localStorage.setItem('octile_exp', '1000');
      return getRankTitle(1000);
    });
    expect(title.length).toBeGreaterThan(0);
  });

  test('rank color is valid CSS color', async ({ page }) => {
    const color = await page.evaluate(() => getRankColor(1000));
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

test.describe('Profile Stats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('calcProfileStats returns expected structure', async ({ page }) => {
    const stats = await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '10');
      localStorage.setItem('octile_exp', '500');
      localStorage.setItem('octile_diamonds', '100');
      localStorage.setItem('octile_grades', JSON.stringify({ S: 3, A: 4, B: 3 }));
      return calcProfileStats();
    });
    expect(stats).toHaveProperty('totalSolves');
    expect(stats).toHaveProperty('diamonds');
    expect(stats).toHaveProperty('streak');
    expect(stats).toHaveProperty('radar');
    expect(stats).toHaveProperty('worldSolves');
    expect(stats.totalSolves).toBe(10);
    expect(stats.diamonds).toBe(100);
  });

  test('radar chart has 5 dimensions', async ({ page }) => {
    const radar = await page.evaluate(() => {
      localStorage.setItem('octile_total_solved', '20');
      return calcProfileStats().radar;
    });
    expect(radar).toHaveProperty('speed');
    expect(radar).toHaveProperty('mastery');
    expect(radar).toHaveProperty('breadth');
    expect(radar).toHaveProperty('dedication');
    expect(radar).toHaveProperty('progress');
  });
});

test.describe('Profile Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('profile modal opens and shows player name', async ({ page }) => {
    await page.evaluate(() => showProfileModal());
    await page.waitForTimeout(500);
    const visible = await page.evaluate(() => document.getElementById('profile-modal').classList.contains('show'));
    expect(visible).toBe(true);
    // Should show an anonymous name (Kind Wolf, etc.) or auth name
    const body = await page.evaluate(() => document.getElementById('profile-body').innerHTML);
    expect(body.length).toBeGreaterThan(50);
  });

  test('profile close button works', async ({ page }) => {
    await page.evaluate(() => showProfileModal());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('profile-close').click());
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() => document.getElementById('profile-modal').classList.contains('show'));
    expect(visible).toBe(false);
  });
});
