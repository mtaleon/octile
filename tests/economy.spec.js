const { test, expect } = require('@playwright/test');

test.describe('Grades & EXP', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('S grade: under par + no hints used today', async ({ page }) => {
    const grade = await page.evaluate(() => {
      // Clear hints to ensure noHint=true
      localStorage.removeItem('octile_hints');
      return calcSkillGrade('easy', 30); // par=60
    });
    expect(grade).toBe('S');
  });

  test('A grade: under 2x par or no hints', async ({ page }) => {
    const grade = await page.evaluate(() => {
      // Use a hint so noHint=false, time under 2x par
      localStorage.setItem('octile_hints', JSON.stringify({ date: new Date().toISOString().slice(0, 10), used: 1 }));
      return calcSkillGrade('easy', 90); // par=60, 2x=120
    });
    expect(grade).toBe('A');
  });

  test('B grade: over 2x par with hints used', async ({ page }) => {
    const grade = await page.evaluate(() => {
      localStorage.setItem('octile_hints', JSON.stringify({ date: new Date().toISOString().slice(0, 10), used: 1 }));
      return calcSkillGrade('easy', 200); // par=60, 2x=120, over
    });
    expect(grade).toBe('B');
  });

  test('EXP base values per level', async ({ page }) => {
    const result = await page.evaluate(() => EXP_BASE);
    expect(result).toEqual({ easy: 100, medium: 250, hard: 750, hell: 2000 });
  });

  test('grade multiplier: S=2, A=1.5, B=1', async ({ page }) => {
    const result = await page.evaluate(() => ({
      S: gradeMultiplier('S'),
      A: gradeMultiplier('A'),
      B: gradeMultiplier('B'),
    }));
    expect(result).toEqual({ S: 2, A: 1.5, B: 1 });
  });

  test('calcPuzzleExp applies grade multiplier', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_hints'); // no hints → S grade
      var sExp = calcPuzzleExp('easy', 30);  // S: 100 * 2 = 200
      localStorage.setItem('octile_hints', JSON.stringify({ date: new Date().toISOString().slice(0, 10), used: 1 }));
      var bExp = calcPuzzleExp('easy', 200); // B: 100 * 1 = 100
      return { sExp, bExp };
    });
    expect(result.sExp).toBe(200);
    expect(result.bExp).toBe(100);
  });
});

test.describe('Diamonds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('addDiamonds increases balance', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_diamonds', '100');
      addDiamonds(50);
      return getDiamonds();
    });
    expect(result).toBe(150);
  });

  test('diamond display updates', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_diamonds', '42');
      updateDiamondDisplay();
    });
    // Check the element that shows diamond count
    const val = await page.evaluate(() => {
      var el = document.getElementById('diamond-value') || document.querySelector('[id*="diamond"]');
      return el ? el.textContent.trim() : null;
    });
    expect(val).toBeTruthy();
  });
});

test.describe('EXP', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('addExp increases total', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_exp', '500');
      addExp(200);
      return getExp();
    });
    expect(result).toBe(700);
  });
});

test.describe('Streak', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('streak increments on daily solve', async ({ page }) => {
    const result = await page.evaluate(() => {
      var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_streak', JSON.stringify({ count: 3, lastDate: yesterday }));
      return updateStreak();
    });
    expect(result).toBe(4);
  });

  test('streak resets if missed a day', async ({ page }) => {
    const result = await page.evaluate(() => {
      var threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      localStorage.setItem('octile_streak', JSON.stringify({ count: 5, lastDate: threeDaysAgo }));
      return updateStreak();
    });
    expect(result).toBe(1);
  });

  test('streak stays same if already counted today', async ({ page }) => {
    const result = await page.evaluate(() => {
      var today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('octile_streak', JSON.stringify({ count: 3, lastDate: today }));
      return updateStreak();
    });
    expect(result).toBe(3);
  });
});

test.describe('Daily Check-in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('first check-in awards diamonds', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_checkin');
      var before = getDiamonds();
      doDailyCheckin();
      return getDiamonds() - before;
    });
    expect(result).toBeGreaterThan(0);
  });

  test('second check-in same day does nothing extra', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('octile_checkin');
      doDailyCheckin();
      var after1 = getDiamonds();
      doDailyCheckin();
      var after2 = getDiamonds();
      return after2 - after1;
    });
    expect(result).toBe(0);
  });
});
