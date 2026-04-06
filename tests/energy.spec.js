const { test, expect } = require('@playwright/test');

test.describe('Energy System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('default energy is 5 on fresh state', async ({ page }) => {
    const pts = await page.evaluate(() => {
      localStorage.removeItem('octile_energy');
      return getEnergyState().points;
    });
    expect(pts).toBe(5);
  });

  test('first puzzle of the day is free', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_energy_day');
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      return hasEnoughEnergy();
    });
    expect(result).toBe(true);
  });

  test('no energy after first free puzzle used', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      localStorage.setItem('octile_energy_day', JSON.stringify({ puzzles: 1, spent: 1, date: new Date().toISOString().slice(0, 10) }));
      return hasEnoughEnergy();
    });
    expect(result).toBe(false);
  });

  test('energy recovers over time', async ({ page }) => {
    const pts = await page.evaluate(() => {
      // Set energy to 0, timestamp 4 hours ago (should recover 2 points)
      var ts = Date.now() - 4 * 3600 * 1000;
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: ts }));
      return getEnergyState().points;
    });
    expect(pts).toBeGreaterThanOrEqual(1.9);
    expect(pts).toBeLessThanOrEqual(2.1);
  });

  test('energy caps at max 5', async ({ page }) => {
    const pts = await page.evaluate(() => {
      var ts = Date.now() - 24 * 3600 * 1000; // 24 hours ago
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: ts }));
      return getEnergyState().points;
    });
    expect(pts).toBe(5);
  });

  test('deductEnergy reduces points', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 3, ts: Date.now() }));
      deductEnergy(1);
      return getEnergyState().points;
    });
    expect(result).toBeCloseTo(2, 1);
  });

  test('energy display updates', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 3, ts: Date.now() }));
      updateEnergyDisplay();
    });
    const display = await page.evaluate(() => {
      var el = document.getElementById('energy-value') || document.querySelector('[id*="energy"]');
      return el ? el.textContent.trim() : '';
    });
    expect(display.length).toBeGreaterThan(0);
  });

  test('energy modal shows with restore button when not full', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 1, ts: Date.now() }));
      showEnergyModal(false);
    });
    const visible = await page.evaluate(() => document.getElementById('energy-modal').classList.contains('show'));
    expect(visible).toBe(true);
    const restoreBtn = await page.evaluate(() => document.getElementById('energy-restore-btn').classList.contains('show'));
    expect(restoreBtn).toBe(true);
  });
});
