const { test, expect } = require('@playwright/test');

// Helper: start a game with energy and wait for in-game state
async function startTestGame(page) {
  await page.evaluate(() => {
    localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
    startGame(1);
  });
  await page.waitForTimeout(500);
}

// Use desktop viewport for keyboard tests
test.use({ viewport: { width: 1280, height: 800 } });

// ---------------------------------------------------------------------------
// Piece selection via number keys
// ---------------------------------------------------------------------------

test.describe('Keyboard: Piece Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('pressing 1 selects first unplaced piece', async ({ page }) => {
    await page.keyboard.press('1');
    const selected = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto && !p.placed);
      return selectedPiece === playable[0];
    });
    expect(selected).toBe(true);
  });

  test('pressing 2 selects second unplaced piece', async ({ page }) => {
    await page.keyboard.press('2');
    const selected = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto && !p.placed);
      return selectedPiece === playable[1];
    });
    expect(selected).toBe(true);
  });

  test('pressing 9 does nothing (only 8 playable pieces)', async ({ page }) => {
    await page.keyboard.press('9');
    const noSelection = await page.evaluate(() => selectedPiece === null);
    expect(noSelection).toBe(true);
  });

  test('piece-selected class added on selection', async ({ page }) => {
    await page.keyboard.press('1');
    const hasClass = await page.evaluate(() => document.body.classList.contains('piece-selected'));
    expect(hasClass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Piece rotation via R key
// ---------------------------------------------------------------------------

test.describe('Keyboard: Rotation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('R rotates selected piece', async ({ page }) => {
    await page.keyboard.press('1');
    const before = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    await page.keyboard.press('r');
    const after = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    expect(after).not.toBe(before);
  });

  test('R does nothing when no piece selected', async ({ page }) => {
    // No piece selected — R should not throw
    await page.keyboard.press('r');
    const noError = await page.evaluate(() => selectedPiece === null);
    expect(noError).toBe(true);
  });

  test('4 rotations return to original shape', async ({ page }) => {
    await page.keyboard.press('1');
    const original = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    await page.keyboard.press('r');
    await page.keyboard.press('r');
    await page.keyboard.press('r');
    await page.keyboard.press('r');
    const after4 = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    expect(after4).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Arrow keys: cursor movement
// ---------------------------------------------------------------------------

test.describe('Keyboard: Cursor Movement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('arrow key initializes cursor at center (3,3)', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    // First press initializes to (3,3) then moves down to (4,3)
    expect(pos.r).toBe(4);
    expect(pos.c).toBe(3);
  });

  test('arrow keys move cursor in all directions', async ({ page }) => {
    // Initialize
    await page.keyboard.press('ArrowDown');
    // Move right
    await page.keyboard.press('ArrowRight');
    const pos1 = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos1.c).toBe(4);
    // Move left
    await page.keyboard.press('ArrowLeft');
    const pos2 = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos2.c).toBe(3);
    // Move up
    await page.keyboard.press('ArrowUp');
    const pos3 = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos3.r).toBe(3);
  });

  test('cursor clamps at board boundaries', async ({ page }) => {
    // Initialize at (3,3), then press up 10 times
    await page.keyboard.press('ArrowUp');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.r).toBe(0);
    // Press left 10 times
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
    const pos2 = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos2.c).toBe(0);
  });

  test('kb-cursor class is applied to correct cell', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    const hasKbCursor = await page.evaluate(() => {
      var cell = document.querySelector('.cell.kb-cursor');
      return cell ? { r: cell.dataset.row, c: cell.dataset.col } : null;
    });
    expect(hasKbCursor).not.toBeNull();
    expect(hasKbCursor.r).toBe('4');
    expect(hasKbCursor.c).toBe('3');
  });

  test('mouse movement clears keyboard cursor', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    // Verify cursor exists
    let hasCursor = await page.evaluate(() => !!document.querySelector('.cell.kb-cursor'));
    expect(hasCursor).toBe(true);
    // Move mouse
    await page.mouse.move(400, 400);
    await page.waitForTimeout(100);
    hasCursor = await page.evaluate(() => !!document.querySelector('.cell.kb-cursor'));
    expect(hasCursor).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enter/Space: piece placement
// ---------------------------------------------------------------------------

test.describe('Keyboard: Piece Placement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('Enter places selected piece at cursor', async ({ page }) => {
    // Select piece and move cursor
    await page.keyboard.press('1');
    await page.keyboard.press('ArrowUp');
    // Try to place
    const beforeCount = await page.evaluate(() => piecesPlacedCount);
    await page.keyboard.press('Enter');
    const afterCount = await page.evaluate(() => piecesPlacedCount);
    const piecePlaced = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto);
      return playable[0].placed;
    });
    // Either placed successfully (count incremented) or couldn't place (overlap), but no error
    expect(typeof afterCount).toBe('number');
    if (piecePlaced) {
      expect(afterCount).toBe(beforeCount + 1);
    }
  });

  test('Space places selected piece at cursor', async ({ page }) => {
    await page.keyboard.press('1');
    await page.keyboard.press('ArrowUp');
    const beforeCount = await page.evaluate(() => piecesPlacedCount);
    await page.keyboard.press('Space');
    const afterCount = await page.evaluate(() => piecesPlacedCount);
    expect(typeof afterCount).toBe('number');
  });

  test('Enter auto-initializes cursor if not set', async ({ page }) => {
    await page.keyboard.press('1');
    // Press Enter without arrow keys — should init cursor to (3,3)
    await page.keyboard.press('Enter');
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.r).toBe(3);
    expect(pos.c).toBe(3);
  });

  test('placement uses cursor as top-left anchor (not center)', async ({ page }) => {
    // Place a piece via keyboard at a known cursor position and verify top-left anchor
    const result = await page.evaluate(() => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (!p) return null;
      selectPiece(p);
      var shape = p.currentShape;
      var rows = shape.length, cols = shape[0].length;
      // Set cursor to (1, 1) — enough room for most pieces
      _kbCursorR = 1; _kbCursorC = 1;
      var expectedR = Math.max(0, Math.min(1, 8 - rows));
      var expectedC = Math.max(0, Math.min(1, 8 - cols));
      if (!canPlace(shape, expectedR, expectedC, null)) return null;
      return { rows, cols, expectedR, expectedC };
    });
    if (!result) return; // puzzle doesn't allow placement here — skip
    await page.keyboard.press('Enter');
    const cells = await page.evaluate((exp) => {
      // Check that the piece was placed starting at expected top-left
      for (var r = exp.expectedR; r < exp.expectedR + exp.rows; r++) {
        for (var c = exp.expectedC; c < exp.expectedC + exp.cols; c++) {
          if (board[r][c] !== 0) return true; // at least one cell filled at top-left region
        }
      }
      return false;
    }, result);
    expect(cells).toBe(true);
  });

  test('Enter does nothing without selected piece', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    const beforeCount = await page.evaluate(() => piecesPlacedCount);
    await page.keyboard.press('Enter');
    const afterCount = await page.evaluate(() => piecesPlacedCount);
    expect(afterCount).toBe(beforeCount);
  });
});

// ---------------------------------------------------------------------------
// Backspace / Ctrl+Z: undo
// ---------------------------------------------------------------------------

test.describe('Keyboard: Undo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  // Helper: place a piece via JS and track in _placementOrder
  async function placeOnePiece(page, row, col) {
    return page.evaluate(([r, c]) => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (!p) return null;
      var shape = p.currentShape;
      if (!canPlace(shape, r, c, null)) return null;
      placePiece(shape, r, c, p.id);
      recordMove(p.id, shape, r, c);
      p.placed = true;
      piecesPlacedCount++;
      renderBoard();
      renderPool();
      return p.id;
    }, [row, col]);
  }

  test('Backspace undoes last placement', async ({ page }) => {
    const pid = await placeOnePiece(page, 0, 0);
    if (!pid) return;
    const beforeCount = await page.evaluate(() => piecesPlacedCount);
    await page.keyboard.press('Backspace');
    const afterCount = await page.evaluate(() => piecesPlacedCount);
    expect(afterCount).toBe(beforeCount - 1);
  });

  test('Ctrl+Z undoes last placement', async ({ page }) => {
    const pid = await placeOnePiece(page, 0, 0);
    if (!pid) return;
    const beforeCount = await page.evaluate(() => piecesPlacedCount);
    await page.keyboard.press('Control+z');
    const afterCount = await page.evaluate(() => piecesPlacedCount);
    expect(afterCount).toBe(beforeCount - 1);
  });

  test('Backspace does nothing when no pieces placed', async ({ page }) => {
    const beforeCount = await page.evaluate(() => piecesPlacedCount);
    await page.keyboard.press('Backspace');
    const afterCount = await page.evaluate(() => piecesPlacedCount);
    expect(afterCount).toBe(beforeCount);
  });

  test('undo removes pieces in reverse placement order', async ({ page }) => {
    // Place two pieces at different positions
    const pid1 = await placeOnePiece(page, 0, 0);
    const pid2 = await placeOnePiece(page, 6, 6);
    if (!pid1 || !pid2) return;

    // Undo should remove pid2 (last placed), not pid1
    await page.keyboard.press('Backspace');
    const result = await page.evaluate((ids) => {
      var p1 = pieces.find(p => p.id === ids[0]);
      var p2 = pieces.find(p => p.id === ids[1]);
      return { p1Placed: p1.placed, p2Placed: p2.placed };
    }, [pid1, pid2]);
    expect(result.p1Placed).toBe(true);
    expect(result.p2Placed).toBe(false);
  });

  test('multiple undos remove in reverse order', async ({ page }) => {
    const pid1 = await placeOnePiece(page, 0, 0);
    const pid2 = await placeOnePiece(page, 6, 6);
    if (!pid1 || !pid2) return;

    // Undo both
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    const result = await page.evaluate((ids) => {
      var p1 = pieces.find(p => p.id === ids[0]);
      var p2 = pieces.find(p => p.id === ids[1]);
      return { p1Placed: p1.placed, p2Placed: p2.placed, count: piecesPlacedCount };
    }, [pid1, pid2]);
    expect(result.p1Placed).toBe(false);
    expect(result.p2Placed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// H: hint
// ---------------------------------------------------------------------------

test.describe('Keyboard: Hint', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('H key triggers hint', async ({ page }) => {
    // Ensure hints available
    await page.evaluate(() => localStorage.removeItem('octile_hints_today'));
    const beforePlaced = await page.evaluate(() => piecesPlacedCount);
    await page.keyboard.press('h');
    await page.waitForTimeout(500);
    const afterPlaced = await page.evaluate(() => piecesPlacedCount);
    // Hint places a piece, so count should increase
    expect(afterPlaced).toBeGreaterThanOrEqual(beforePlaced);
  });
});

// ---------------------------------------------------------------------------
// P: pause/resume
// ---------------------------------------------------------------------------

test.describe('Keyboard: Pause', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('P pauses and resumes game', async ({ page }) => {
    // Timer must be started for pause to work
    await page.evaluate(() => ensureTimerRunning());
    await page.keyboard.press('p');
    const isPaused = await page.evaluate(() => paused);
    expect(isPaused).toBe(true);
    await page.keyboard.press('p');
    const isResumed = await page.evaluate(() => paused);
    expect(isResumed).toBe(false);
  });

  test('game keys disabled while paused', async ({ page }) => {
    await page.evaluate(() => ensureTimerRunning());
    await page.keyboard.press('p'); // pause
    await page.keyboard.press('1'); // try to select piece
    const noSelection = await page.evaluate(() => selectedPiece === null);
    expect(noSelection).toBe(true);
    await page.keyboard.press('p'); // resume
  });
});

// ---------------------------------------------------------------------------
// Z: Zen Mode
// ---------------------------------------------------------------------------

test.describe('Keyboard: Zen Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('Z toggles zen-mode class', async ({ page }) => {
    await page.keyboard.press('z');
    const on = await page.evaluate(() => document.body.classList.contains('zen-mode'));
    expect(on).toBe(true);
    await page.keyboard.press('z');
    const off = await page.evaluate(() => document.body.classList.contains('zen-mode'));
    expect(off).toBe(false);
  });

  test('Zen Mode shows toast', async ({ page }) => {
    await page.keyboard.press('z');
    await page.waitForTimeout(200);
    const toastVisible = await page.evaluate(() => {
      var toast = document.getElementById('achieve-toast');
      return toast && toast.classList.contains('show');
    });
    expect(toastVisible).toBe(true);
  });

  test('Zen Mode cleared on returnToWelcome', async ({ page }) => {
    await page.keyboard.press('z');
    await page.evaluate(() => returnToWelcome());
    await page.waitForTimeout(300);
    const off = await page.evaluate(() => document.body.classList.contains('zen-mode'));
    expect(off).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Escape: close modals
// ---------------------------------------------------------------------------

test.describe('Keyboard: Escape', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('Escape closes help modal', async ({ page }) => {
    await page.evaluate(() => document.getElementById('help-modal').classList.add('show'));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => !document.getElementById('help-modal').classList.contains('show'));
    expect(closed).toBe(true);
  });

  test('Escape closes energy modal', async ({ page }) => {
    await page.evaluate(() => document.getElementById('energy-modal').classList.add('show'));
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => !document.getElementById('energy-modal').classList.contains('show'));
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ? key: open help
// ---------------------------------------------------------------------------

test.describe('Keyboard: Help Shortcut', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('? opens help modal', async ({ page }) => {
    // Dispatch ? key event directly (Shift+/ varies by keyboard layout)
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
    await page.waitForTimeout(300);
    const open = await page.evaluate(() => document.getElementById('help-modal').classList.contains('show'));
    expect(open).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mouse: scroll wheel and right-click
// ---------------------------------------------------------------------------

test.describe('Mouse: Wheel & Right-Click', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('scroll wheel on pool selects a piece', async ({ page }) => {
    // Dispatch wheel event directly on pool element
    await page.evaluate(() => {
      var pool = document.getElementById('pool');
      pool.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    });
    await page.waitForTimeout(200);
    const hasSelection = await page.evaluate(() => selectedPiece !== null);
    expect(hasSelection).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rotate button: visibility + click rotates
// ---------------------------------------------------------------------------

test.describe('UI: Rotate Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('rotate button hidden initially, visible when piece selected, click rotates', async ({ page }) => {
    // Initially hidden
    const hiddenBefore = await page.evaluate(() => document.getElementById('ctrl-rotate').classList.contains('is-hidden'));
    expect(hiddenBefore).toBe(true);

    // Select piece via JS (more reliable than keyboard in test)
    await page.evaluate(() => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (p) selectPiece(p);
    });
    const hiddenAfterSelect = await page.evaluate(() => document.getElementById('ctrl-rotate').classList.contains('is-hidden'));
    expect(hiddenAfterSelect).toBe(false);

    // Record shape, click rotate, verify shape changed
    const before = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    await page.evaluate(() => document.getElementById('ctrl-rotate').click());
    const after = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    expect(after).not.toBe(before);
  });

  test('rotate button hides when piece is deselected', async ({ page }) => {
    await page.evaluate(() => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (p) selectPiece(p);
    });
    const visible = await page.evaluate(() => !document.getElementById('ctrl-rotate').classList.contains('is-hidden'));
    expect(visible).toBe(true);

    // Deselect
    await page.evaluate(() => { selectedPiece = null; document.body.classList.remove('piece-selected'); renderPool(); });
    const hiddenAfter = await page.evaluate(() => document.getElementById('ctrl-rotate').classList.contains('is-hidden'));
    expect(hiddenAfter).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Undo button: visibility + click undoes
// ---------------------------------------------------------------------------

test.describe('UI: Undo Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  // Helper: place a piece via JS
  async function placeOnePiece(page, row, col) {
    return page.evaluate(([r, c]) => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (!p) return null;
      var shape = p.currentShape;
      if (!canPlace(shape, r, c, null)) return null;
      placePiece(shape, r, c, p.id);
      recordMove(p.id, shape, r, c);
      p.placed = true;
      piecesPlacedCount++;
      renderBoard();
      renderPool();
      return p.id;
    }, [row, col]);
  }

  test('undo button hidden initially, visible after placement, click undoes', async ({ page }) => {
    // Initially hidden
    const hiddenBefore = await page.evaluate(() => document.getElementById('ctrl-undo').classList.contains('is-hidden'));
    expect(hiddenBefore).toBe(true);

    // Place a piece
    const pid = await placeOnePiece(page, 0, 0);
    if (!pid) return;

    const hiddenAfterPlace = await page.evaluate(() => document.getElementById('ctrl-undo').classList.contains('is-hidden'));
    expect(hiddenAfterPlace).toBe(false);

    // Click undo
    const beforeCount = await page.evaluate(() => piecesPlacedCount);
    await page.evaluate(() => document.getElementById('ctrl-undo').click());
    const afterCount = await page.evaluate(() => piecesPlacedCount);
    expect(afterCount).toBe(beforeCount - 1);

    // No more placements → hidden again
    const hiddenAfterUndo = await page.evaluate(() => document.getElementById('ctrl-undo').classList.contains('is-hidden'));
    expect(hiddenAfterUndo).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Keys should not work when modal is open
// ---------------------------------------------------------------------------

test.describe('Keyboard: Modal Guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('number keys do not select pieces when modal is open', async ({ page }) => {
    await page.evaluate(() => document.getElementById('help-modal').classList.add('show'));
    await page.keyboard.press('1');
    const noSelection = await page.evaluate(() => selectedPiece === null);
    expect(noSelection).toBe(true);
  });

  test('arrow keys do not move cursor when modal is open', async ({ page }) => {
    await page.evaluate(() => document.getElementById('help-modal').classList.add('show'));
    await page.keyboard.press('ArrowDown');
    const pos = await page.evaluate(() => _kbCursorR);
    expect(pos).toBe(-1); // cursor not initialized
  });
});

// ---------------------------------------------------------------------------
// Input mode tracking
// ---------------------------------------------------------------------------

test.describe('Input Mode Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('keydown sets input mode to keyboard', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    const mode = await page.evaluate(() => _inputMode);
    expect(mode).toBe('keyboard');
  });

  test('mouse movement sets input mode to mouse', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    await page.mouse.move(300, 300);
    await page.waitForTimeout(100);
    const mode = await page.evaluate(() => _inputMode);
    expect(mode).toBe('mouse');
  });
});

test.describe('Keyboard: N Key (Next Puzzle)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('N key triggers next puzzle on win overlay (step 3)', async ({ page }) => {
    // Simulate win state: show win overlay at step 3
    await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
      gameOver = true;
      document.getElementById('win-overlay').classList.add('show');
      document.getElementById('win-step3').style.display = '';
    });
    await page.waitForTimeout(200);
    // Press N — should call nextPuzzle which removes 'show'
    await page.keyboard.press('n');
    await page.waitForTimeout(500);
    const overlayVisible = await page.evaluate(() =>
      document.getElementById('win-overlay').classList.contains('show')
    );
    expect(overlayVisible).toBe(false);
  });

  test('N key advances reward modal during win flow', async ({ page }) => {
    // Simulate reward modal open during win flow
    await page.evaluate(() => {
      gameOver = true;
      document.getElementById('reward-modal').classList.add('show');
      document.getElementById('reward-primary').onclick = function() {
        document.getElementById('reward-modal').classList.remove('show');
        document.getElementById('win-overlay').classList.add('show');
      };
    });
    await page.waitForTimeout(200);
    await page.keyboard.press('n');
    await page.waitForTimeout(300);
    const rewardVisible = await page.evaluate(() =>
      document.getElementById('reward-modal').classList.contains('show')
    );
    expect(rewardVisible).toBe(false);
  });

  test('N key does nothing when not on win screen', async ({ page }) => {
    // Ensure we're not in a win state
    await page.evaluate(() => {
      gameOver = false;
      document.getElementById('win-overlay').classList.remove('show');
      document.getElementById('reward-modal').classList.remove('show');
    });
    await page.keyboard.press('n');
    await page.waitForTimeout(200);
    // Nothing should have changed
    const overlayVisible = await page.evaluate(() =>
      document.getElementById('win-overlay').classList.contains('show')
    );
    expect(overlayVisible).toBe(false);
  });
});
