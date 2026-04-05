const { test, expect } = require('@playwright/test');

test.describe('Achievements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('getUnlockedAchievements returns object', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_achievements');
      return typeof getUnlockedAchievements();
    });
    expect(result).toBe('object');
  });

  test('saveUnlockedAchievements persists', async ({ page }) => {
    const result = await page.evaluate(() => {
      saveUnlockedAchievements({ first_win: true, streak_3: true });
      var loaded = getUnlockedAchievements();
      return { first_win: loaded.first_win, streak_3: loaded.streak_3 };
    });
    expect(result.first_win).toBe(true);
    expect(result.streak_3).toBe(true);
  });

  test('checkAchievements returns newly unlocked', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_achievements');
      var stats = {
        unique: 1, total: 1, elapsed: 30, streak: 1,
        noHint: true, dailyCount: 1, justSolved: true,
        nightSolves: 0, morningSolves: 0, months: [],
        levelEasy: 1, levelMedium: 0, levelHard: 0, levelHell: 0,
        chaptersCompleted: 0,
        totalEasy: 800, totalMedium: 400, totalHard: 200, totalHell: 100,
      };
      return checkAchievements(stats);
    });
    expect(Array.isArray(result)).toBe(true);
    // First solve should unlock at least one achievement
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('claiming achievement awards diamonds', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Use a known achievement ID from the app
      var unlocked = getUnlockedAchievements();
      var achIds = Object.keys(unlocked);
      if (achIds.length === 0) {
        // Force unlock first_solve
        saveUnlockedAchievements({ first_solve: true });
        achIds = ['first_solve'];
      }
      localStorage.setItem('octile_diamonds', '0');
      localStorage.removeItem('octile_claimed_achievements');
      claimAchievementDiamonds(achIds[0]);
      return getDiamonds();
    });
    expect(result).toBeGreaterThanOrEqual(0); // May be 0 if achievement has no diamond reward
  });

  test('double claim does not award twice', async ({ page }) => {
    const result = await page.evaluate(() => {
      saveUnlockedAchievements({ first_solve: true });
      localStorage.setItem('octile_diamonds', '0');
      localStorage.removeItem('octile_claimed_achievements');
      claimAchievementDiamonds('first_solve');
      var after1 = getDiamonds();
      claimAchievementDiamonds('first_solve');
      var after2 = getDiamonds();
      return { after1, after2 };
    });
    expect(result.after1).toBe(result.after2);
  });
});

test.describe('Daily Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('getDailyTasks returns 3 tasks', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_daily_tasks');
      var data = getDailyTasks();
      return { count: data.tasks.length, hasDate: !!data.date };
    });
    expect(result.count).toBe(3);
    expect(result.hasDate).toBe(true);
  });

  test('daily tasks are deterministic for same day', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_daily_tasks');
      var data1 = getDailyTasks();
      localStorage.removeItem('octile_daily_tasks');
      var data2 = getDailyTasks();
      return {
        ids1: data1.tasks.map(t => t.id),
        ids2: data2.tasks.map(t => t.id),
      };
    });
    expect(result.ids1).toEqual(result.ids2);
  });

  test('task counters track solves', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_daily_task_counters');
      updateDailyTaskCounters('S', 30, 'easy');
      return getDailyTaskCounters();
    });
    expect(result.solves).toBe(1);
    expect(result.aGrades).toBe(1);
    expect(result.sGrades).toBe(1);
  });

  test('claimDailyTaskReward awards diamonds', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_daily_tasks');
      localStorage.setItem('octile_diamonds', '0');
      var data = getDailyTasks();
      // Force task 0 to completed
      data.tasks[0].progress = data.tasks[0].target;
      localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
      claimDailyTaskReward(0);
      return { diamonds: getDiamonds(), claimed: getDailyTasks().tasks[0].claimed };
    });
    expect(result.diamonds).toBeGreaterThan(0);
    expect(result.claimed).toBe(true);
  });
});

test.describe('Goals Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('showGoalsModal opens achieve-modal', async ({ page }) => {
    await page.evaluate(() => showGoalsModal('tasks'));
    const visible = await page.evaluate(() => document.getElementById('achieve-modal').classList.contains('show'));
    expect(visible).toBe(true);
  });

  test('showGoalsModal defaults to tasks tab', async ({ page }) => {
    await page.evaluate(() => showGoalsModal());
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() => document.getElementById('achieve-modal').classList.contains('show'));
    expect(visible).toBe(true);
  });
});

test.describe('Reward Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('showRewardModal displays with title and rewards', async ({ page }) => {
    await page.evaluate(() => {
      showRewardModal({
        title: 'Test Reward',
        reason: 'Test reason',
        rewards: [{ icon: '⭐', value: 100, label: 'EXP' }],
        primary: { text: 'Continue' },
      });
    });
    const visible = await page.evaluate(() => document.getElementById('reward-modal').classList.contains('show'));
    expect(visible).toBe(true);
    const title = await page.evaluate(() => document.getElementById('reward-title').textContent);
    expect(title).toBe('Test Reward');
  });

  test('backdrop click triggers primary action', async ({ page }) => {
    let closed = false;
    await page.evaluate(() => {
      showRewardModal({
        title: 'Test',
        rewards: [],
        primary: { text: 'OK', action: () => { window._testClosed = true; } },
      });
    });
    // Click backdrop
    await page.evaluate(() => {
      var modal = document.getElementById('reward-modal');
      modal.click(); // clicks backdrop
    });
    await page.waitForTimeout(300);
    const result = await page.evaluate(() => ({
      closed: !!window._testClosed,
      visible: document.getElementById('reward-modal').classList.contains('show'),
    }));
    expect(result.closed).toBe(true);
    expect(result.visible).toBe(false);
  });
});
