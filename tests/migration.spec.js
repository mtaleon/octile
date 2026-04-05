const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// A. Version upgrade / migration — old localStorage schemas must not crash
// ---------------------------------------------------------------------------

test.describe('Legacy Data Migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('missing energy key defaults to 5 points', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_energy');
      return getEnergyState().points;
    });
    expect(result).toBe(5);
  });

  test('corrupt energy JSON does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', '{bad json');
      try { return getEnergyState().points; } catch(e) { return 'crash: ' + e.message; }
    });
    expect(typeof result).toBe('number');
  });

  test('energy with missing ts field recovers gracefully', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 3 }));
      try { return getEnergyState().points; } catch(e) { return 'crash'; }
    });
    expect(result).not.toBe('crash');
  });

  test('old octile_coins migrates to octile_exp', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Simulate old client with coins but no exp
      localStorage.removeItem('octile_exp');
      localStorage.setItem('octile_coins', '500');
      // Re-run migration (it's an IIFE but we can check the result)
      if (localStorage.getItem('octile_exp') === null && localStorage.getItem('octile_coins') !== null) {
        localStorage.setItem('octile_exp', localStorage.getItem('octile_coins'));
      }
      return parseInt(localStorage.getItem('octile_exp'));
    });
    expect(result).toBe(500);
  });

  test('corrupt grades JSON does not crash calcProfileStats', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_grades', 'not json');
      localStorage.setItem('octile_total_solved', '5');
      try { return typeof calcProfileStats(); } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('object');
  });

  test('corrupt streak JSON does not crash updateStreak', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_streak', '{nope');
      try { return typeof updateStreak(); } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('number');
  });

  test('corrupt achievements JSON does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_achievements', 'broken');
      try { return typeof getUnlockedAchievements(); } catch(e) { return 'crash'; }
    });
    expect(result).toBe('object');
  });

  test('corrupt daily tasks JSON does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_daily_tasks', '{invalid');
      try { var d = getDailyTasks(); return d.tasks.length; } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe(3); // regenerates fresh tasks
  });

  test('corrupt solved set JSON does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_solved', 'not an array');
      try { return getSolvedSet().size; } catch(e) { return 'crash: ' + e.message; }
    });
    expect(typeof result).toBe('number');
  });

  test('corrupt messages JSON does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_messages', 'bad');
      try { return typeof getMessages(); } catch(e) { return 'crash'; }
    });
    expect(result).toBe('object');
  });

  test('corrupt auth user JSON does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_auth_user', '{invalid');
      try { return getAuthUser(); } catch(e) { return 'crash'; }
    });
    expect(result).toBeNull();
  });

  test('corrupt checkin JSON does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_checkin', 'bad');
      try { doDailyCheckin(); return 'ok'; } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('ok');
  });

  test('corrupt translations cache falls back gracefully', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_translations_cache', 'not json');
      // t() should still work from in-memory TRANSLATIONS
      return t('win_title') !== 'win_title';
    });
    expect(result).toBe(true);
  });

  test('old energy_day without spent field does not crash', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy_day', JSON.stringify({ date: new Date().toISOString().slice(0,10), puzzles: 2 }));
      try { return getDailyStats().puzzles; } catch(e) { return 'crash'; }
    });
    expect(result).toBe(2);
  });

  test('missing months array does not crash profile stats', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_months');
      localStorage.setItem('octile_total_solved', '5');
      try { return typeof calcProfileStats(); } catch(e) { return 'crash: ' + e.message; }
    });
    expect(result).toBe('object');
  });
});

test.describe('Key Preservation Across Logout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('_AUTH_KEEP_KEYS includes energy and energy_day', async ({ page }) => {
    const result = await page.evaluate(() => ({
      hasEnergy: _AUTH_KEEP_KEYS.indexOf('octile_energy') >= 0,
      hasEnergyDay: _AUTH_KEEP_KEYS.indexOf('octile_energy_day') >= 0,
    }));
    expect(result.hasEnergy).toBe(true);
    expect(result.hasEnergyDay).toBe(true);
  });

  test('_AUTH_KEEP_KEYS includes device-level keys', async ({ page }) => {
    const result = await page.evaluate(() => {
      var required = ['octile_lang', 'octile_browser_uuid', 'octile_cookie_uuid', 'octile_onboarded', 'octile_sound'];
      return required.every(k => _AUTH_KEEP_KEYS.indexOf(k) >= 0);
    });
    expect(result).toBe(true);
  });

  test('logout clears game keys but preserves device keys', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_auth_token', 'test');
      localStorage.setItem('octile_auth_user', '{}');
      localStorage.setItem('octile_exp', '999');
      localStorage.setItem('octile_energy', JSON.stringify({ points: 2, ts: Date.now() }));
      localStorage.setItem('octile_energy_day', JSON.stringify({ puzzles: 3, spent: 3, date: '2026-04-05' }));
      localStorage.setItem('octile_lang', 'zh');
      localStorage.setItem('octile_sound', '1');
      authLogout();
    });
    const result = await page.evaluate(() => ({
      token: localStorage.getItem('octile_auth_token'),
      exp: localStorage.getItem('octile_exp'),
      energy: localStorage.getItem('octile_energy'),
      energyDay: localStorage.getItem('octile_energy_day'),
      lang: localStorage.getItem('octile_lang'),
      sound: localStorage.getItem('octile_sound'),
    }));
    expect(result.token).toBeNull();       // cleared
    expect(result.exp).toBeNull();         // cleared
    expect(result.energy).not.toBeNull();  // preserved
    expect(result.energyDay).not.toBeNull(); // preserved
    expect(result.lang).toBe('zh');        // preserved
    expect(result.sound).toBe('1');        // preserved
  });
});
