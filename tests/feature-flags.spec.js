const { test, expect } = require('@playwright/test');

// ===========================================================================
// Feature Flag System Tests
//
// Tests the unified _feature() gate.
// Web config.json has NO features block — _feature() defaults to true on web.
// Tests that need features OFF must set _appConfig.features explicitly.
// ===========================================================================

const ALL_FEATURE_KEYS = [
  'diamonds', 'energy', 'hints', 'paid_themes', 'blockUnsolved',
  'diamond_multiplier', 'daily_tasks', 'daily_challenge_rewards',
  'scoreboard', 'league', 'score_submission', 'elo_profile',
  'rating_leaderboard', 'messages', 'today_goal', 'win_meta'
];

function allFeaturesOff() {
  var obj = {};
  for (var k of ALL_FEATURE_KEYS) obj[k] = false;
  return obj;
}

test.describe('Feature Flag: _feature() basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('_feature is a function', async ({ page }) => {
    const type = await page.evaluate(() => typeof _feature);
    expect(type).toBe('function');
  });

  test('_steamFeature is alias for _feature', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Both should return the same value for any feature
      var keys = ['energy', 'hints', 'diamonds', 'scoreboard', 'league', 'daily_tasks'];
      return keys.every(k => _feature(k) === _steamFeature(k));
    });
    expect(result).toBe(true);
  });

  test('_feature returns boolean', async ({ page }) => {
    const result = await page.evaluate(() => typeof _feature('energy'));
    expect(result).toBe('boolean');
  });

  test('all features off when features block is all false', async ({ page }) => {
    const result = await page.evaluate((keys) => {
      _appConfig.features = {};
      for (var k of keys) _appConfig.features[k] = false;
      return keys.map(k => ({ key: k, val: _feature(k) }));
    }, ALL_FEATURE_KEYS);
    for (const { key, val } of result) {
      expect(val, `feature '${key}' should be false`).toBe(false);
    }
  });

  test('unknown feature falls back to !_noMeta()', async ({ page }) => {
    const result = await page.evaluate(() => {
      return { feature: _feature('nonexistent_xyz'), noMeta: _noMeta() };
    });
    expect(result.feature).toBe(!result.noMeta);
  });
});

test.describe('Feature Flag: runtime override', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      _appConfig.features = {
        diamonds: false, energy: false, hints: false, paid_themes: false,
        blockUnsolved: false, diamond_multiplier: false, daily_tasks: false,
        daily_challenge_rewards: false, scoreboard: false, league: false,
        score_submission: false, elo_profile: false, rating_leaderboard: false,
        messages: false, today_goal: false, win_meta: false
      };
    });
  });

  test('setting features.energy=true enables energy', async ({ page }) => {
    const result = await page.evaluate(() => {
      var before = _feature('energy');
      _appConfig.features.energy = true;
      var after = _feature('energy');
      _appConfig.features.energy = false; // restore
      return { before, after };
    });
    expect(result.before).toBe(false);
    expect(result.after).toBe(true);
  });

  test('setting features.hints=true enables hints', async ({ page }) => {
    const result = await page.evaluate(() => {
      var before = _feature('hints');
      _appConfig.features.hints = true;
      var after = _feature('hints');
      _appConfig.features.hints = false;
      return { before, after };
    });
    expect(result.before).toBe(false);
    expect(result.after).toBe(true);
  });

  test('individual feature toggle does not affect others', async ({ page }) => {
    const result = await page.evaluate(() => {
      _appConfig.features.energy = true;
      var energyOn = _feature('energy');
      var hintsStillOff = _feature('hints');
      var diamondsStillOff = _feature('diamonds');
      _appConfig.features.energy = false;
      return { energyOn, hintsStillOff, diamondsStillOff };
    });
    expect(result.energyOn).toBe(true);
    expect(result.hintsStillOff).toBe(false);
    expect(result.diamondsStillOff).toBe(false);
  });
});

test.describe('Feature Flag: gated functions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      _appConfig.features = {
        diamonds: false, energy: false, hints: false, paid_themes: false,
        blockUnsolved: false, diamond_multiplier: false, daily_tasks: false,
        daily_challenge_rewards: false, scoreboard: false, league: false,
        score_submission: false, elo_profile: false, rating_leaderboard: false,
        messages: false, today_goal: false, win_meta: false
      };
    });
  });

  test('deductEnergy is no-op when energy=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 3, ts: Date.now() }));
      deductEnergy(1);
      return getEnergyState().points;
    });
    expect(result).toBeCloseTo(3, 1); // not deducted
  });

  test('deductEnergy works when energy=true', async ({ page }) => {
    const result = await page.evaluate(() => {
      _appConfig.features.energy = true;
      localStorage.setItem('octile_energy', JSON.stringify({ points: 3, ts: Date.now() }));
      deductEnergy(1);
      var pts = getEnergyState().points;
      _appConfig.features.energy = false;
      return pts;
    });
    expect(result).toBeCloseTo(2, 1);
  });

  test('hasEnoughEnergy returns true when energy=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      localStorage.setItem('octile_energy_day', JSON.stringify({ puzzles: 1, spent: 1, date: new Date().toISOString().slice(0, 10) }));
      return hasEnoughEnergy();
    });
    expect(result).toBe(true); // energy disabled = always has enough
  });

  test('updateDailyTaskCounters is no-op when daily_tasks=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_daily_task_counters');
      updateDailyTaskCounters('S', 30, 'easy');
      return getDailyTaskCounters().solves;
    });
    expect(result).toBe(0); // not tracked
  });

  test('updateDailyTaskCounters works when daily_tasks=true', async ({ page }) => {
    const result = await page.evaluate(() => {
      _appConfig.features.daily_tasks = true;
      localStorage.removeItem('octile_daily_task_counters');
      updateDailyTaskCounters('S', 30, 'easy');
      var solves = getDailyTaskCounters().solves;
      _appConfig.features.daily_tasks = false;
      return solves;
    });
    expect(result).toBe(1);
  });

  test('showScoreboardModal returns early when scoreboard=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      showScoreboardModal();
      return document.getElementById('scoreboard-modal').classList.contains('show');
    });
    expect(result).toBe(false);
  });

  test('showMessagesModal returns early when messages=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      showMessagesModal();
      return document.getElementById('messages-modal').classList.contains('show');
    });
    expect(result).toBe(false);
  });

  test('showHint returns early when hints=false', async ({ page }) => {
    await page.evaluate(() => {
      if (typeof returnToWelcome === 'function') returnToWelcome();
    });
    await page.evaluate(() => {
      // Start a game first
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      startGame(1);
    });
    // Wait for board cells to be rendered (resetGame completed)
    await page.waitForFunction(() => document.querySelectorAll('.cell').length === 64);
    // Hint button should be hidden
    const hidden = await page.evaluate(() => {
      return document.getElementById('hint-btn').style.display === 'none';
    });
    expect(hidden).toBe(true);
  });

  test('energy display hidden when energy=false', async ({ page }) => {
    const display = await page.evaluate(() => {
      updateEnergyDisplay();
      return document.getElementById('energy-display').style.display;
    });
    expect(display).toBe('none');
  });

  test('today goal card hidden when today_goal=false', async ({ page }) => {
    const display = await page.evaluate(() => {
      renderTodayGoalCard();
      return document.getElementById('wp-today-goal').style.display;
    });
    expect(display).toBe('none');
  });
});
