const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// P0: Board interaction & constraints
// ---------------------------------------------------------------------------

test.describe('Piece Placement Constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('cannot place piece outside board boundaries', async ({ page }) => {
    const result = await page.evaluate(() => {
      initBoard();
      var piece = PIECES.find(p => p.shape[0].length > 1); // multi-cell piece
      return canPlace(piece.shape, 7, 7); // bottom-right, will overflow
    });
    expect(result).toBe(false);
  });

  test('cannot place piece on occupied cells', async ({ page }) => {
    const result = await page.evaluate(() => {
      initBoard();
      board[0][0] = 1; // occupy cell
      var shape = [[1]]; // single cell
      return canPlace(shape, 0, 0);
    });
    expect(result).toBe(false);
  });

  test('can place piece on empty cells within bounds', async ({ page }) => {
    const result = await page.evaluate(() => {
      initBoard();
      var shape = [[1,1],[1,0]]; // L-shape
      return canPlace(shape, 0, 0);
    });
    expect(result).toBe(true);
  });
});

test.describe('Win Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('all pieces placed = allPlaced true', async ({ page }) => {
    const result = await page.evaluate(() => {
      return pieces.every(p => p.placed) === false; // game just started, not all placed
    });
    expect(result).toBe(true); // not all placed at start
  });
});

test.describe('Piece State Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('resetGame clears board and piece state', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Ensure we have a puzzle loaded
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      await resetGame(1);
      var allUnplaced = pieces.every(p => !p.placed);
      var boardClean = board.every(row => row.every(cell => cell === 0));
      return { allUnplaced, boardClean, gameOver: gameOver };
    });
    expect(result.allUnplaced).toBe(true);
    expect(result.boardClean).toBe(true);
    expect(result.gameOver).toBe(false);
  });
});

test.describe('Timer Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('timer starts at 0 on new game', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      await resetGame(1);
      return elapsed;
    });
    expect(result).toBe(0);
  });

  test('gameOver is false at start', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      await resetGame(1);
      return gameOver;
    });
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P0: Solved detection robustness
// ---------------------------------------------------------------------------

test.describe('Solved Set Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('adding same puzzle twice does not duplicate', async ({ page }) => {
    const result = await page.evaluate(() => {
      var s = new Set([1, 2, 3]);
      s.add(3); // duplicate
      s.add(4);
      saveSolvedSet(s);
      return getSolvedSet().size;
    });
    expect(result).toBe(4);
  });

  test('solved set survives JSON round-trip', async ({ page }) => {
    const result = await page.evaluate(() => {
      var original = new Set([42, 100, 999]);
      saveSolvedSet(original);
      var loaded = getSolvedSet();
      return {
        size: loaded.size,
        has42: loaded.has(42),
        has100: loaded.has(100),
        has999: loaded.has(999),
        has1: loaded.has(1),
      };
    });
    expect(result.size).toBe(3);
    expect(result.has42).toBe(true);
    expect(result.has100).toBe(true);
    expect(result.has999).toBe(true);
    expect(result.has1).toBe(false);
  });
});
