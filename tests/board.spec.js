const { test, expect } = require('@playwright/test');

test.describe('Pieces', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('PIECES has 11 piece definitions', async ({ page }) => {
    const count = await page.evaluate(() => PIECES.length);
    expect(count).toBe(11);
  });

  test('each piece has id, color, and shape', async ({ page }) => {
    const result = await page.evaluate(() => {
      return PIECES.every(p => typeof p.id === 'string' && typeof p.color === 'string' && Array.isArray(p.shape));
    });
    expect(result).toBe(true);
  });

  test('rotateShape rotates a shape matrix', async ({ page }) => {
    const result = await page.evaluate(() => {
      var shape = [[1,1,0],[0,1,1]];
      var rotated = rotateShape(shape);
      return { rows: rotated.length, cols: rotated[0].length };
    });
    // 2x3 rotated becomes 3x2
    expect(result.rows).toBe(3);
    expect(result.cols).toBe(2);
  });
});

test.describe('Board State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('board is 8x8 after initBoard', async ({ page }) => {
    const result = await page.evaluate(() => {
      initBoard();
      return { rows: board.length, cols: board[0].length };
    });
    expect(result.rows).toBe(8);
    expect(result.cols).toBe(8);
  });

  test('board initializes as 8x8 grid', async ({ page }) => {
    const result = await page.evaluate(() => {
      initBoard();
      return board.length === 8 && board.every(row => row.length === 8);
    });
    expect(result).toBe(true);
  });
});

test.describe('Timer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('formatTime formats seconds correctly', async ({ page }) => {
    const result = await page.evaluate(() => ({
      zero: formatTime(0),
      minute: formatTime(60),
      mixed: formatTime(125),
    }));
    expect(result.zero).toBe('0:00');
    expect(result.minute).toBe('1:00');
    expect(result.mixed).toBe('2:05');
  });
});

test.describe('Solved Set', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('getSolvedSet returns a Set', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem('octile_solved', JSON.stringify([1, 5, 10]));
      var s = getSolvedSet();
      return { size: s.size, has1: s.has(1), has99: s.has(99) };
    });
    expect(result.size).toBe(3);
    expect(result.has1).toBe(true);
    expect(result.has99).toBe(false);
  });

  test('saveSolvedSet persists to localStorage', async ({ page }) => {
    const result = await page.evaluate(() => {
      var s = new Set([1, 2, 3]);
      saveSolvedSet(s);
      return JSON.parse(localStorage.getItem('octile_solved'));
    });
    expect(result.sort()).toEqual([1, 2, 3]);
  });
});
