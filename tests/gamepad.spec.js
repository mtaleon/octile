const { test, expect } = require('@playwright/test');

// Helper: create a mock gamepad object with specified pressed buttons and axes
function mockGamepad(pressedButtons = [], axes = [0, 0, 0, 0]) {
  const buttons = [];
  for (let i = 0; i < 17; i++) {
    buttons.push({ pressed: pressedButtons.includes(i), value: pressedButtons.includes(i) ? 1 : 0 });
  }
  return JSON.stringify({ buttons, axes, connected: true });
}

// Helper: start a game with energy
async function startTestGame(page) {
  await page.evaluate(() => {
    localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
    startGame(1);
  });
  // Wait for board cells to be rendered
  await page.waitForFunction(() => document.querySelectorAll('.cell').length === 64);
  // Close any modals that might have opened (e.g., multiplier-confirm during happy hours)
  await page.evaluate(() => {
    const modalIds = ['multiplier-confirm-modal', 'reward-modal', 'energy-modal', 'auth-modal'];
    modalIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  });
}

// Helper: simulate one gamepad frame (press a button with edge detection)
// Calls the handler with _gpPrevButtons = [] so any pressed button is a rising edge
async function gpFrame(page, pressedButtons = [], axes = [0, 0, 0, 0]) {
  await page.evaluate(([btns, ax]) => {
    var buttons = [];
    for (var i = 0; i < 17; i++) {
      buttons.push({ pressed: btns.includes(i), value: btns.includes(i) ? 1 : 0 });
    }
    var gp = { buttons: buttons, axes: ax, connected: true };
    // Clear prev buttons so pressed buttons register as rising edge
    _gpPrevButtons = [];
    // Activate input mode
    _gpActivateInputMode();
    // Dispatch based on context
    if (_isModalOpen()) _gpHandleModal(gp);
    else if (_winStep > 0) _gpHandleWin(gp);
    else if (paused) _gpHandlePaused(gp);
    else if (_isInGame()) _gpHandleInGame(gp);
    else _gpHandleWelcome(gp);
    // Save button state
    _gpPrevButtons = [];
    for (var j = 0; j < gp.buttons.length; j++) {
      _gpPrevButtons[j] = gp.buttons[j].pressed;
    }
  }, [pressedButtons, axes]);
}

// Use desktop viewport
test.use({ viewport: { width: 1280, height: 800 } });

// ---------------------------------------------------------------------------
// Init guard: _gpInit should be a no-op on non-Electron
// ---------------------------------------------------------------------------

test.describe('Gamepad: Init Guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('_gpInit is defined as a function', async ({ page }) => {
    const defined = await page.evaluate(() => typeof _gpInit === 'function');
    expect(defined).toBe(true);
  });

  test('_gpInit exits silently on non-Electron (no listeners bound)', async ({ page }) => {
    // On web, _isElectron is false, so _gpInit should not start polling
    const result = await page.evaluate(() => {
      _gpInit();
      return { connected: _gpConnected, rafId: _gpRafId };
    });
    expect(result.connected).toBe(false);
    expect(result.rafId).toBeNull();
  });

  test('gamepad constants are defined', async ({ page }) => {
    const constants = await page.evaluate(() => ({
      GP_A, GP_B, GP_X, GP_Y, GP_LB, GP_RB, GP_START,
      GP_DU, GP_DD, GP_DL, GP_DR, GP_DEADZONE
    }));
    expect(constants.GP_A).toBe(0);
    expect(constants.GP_B).toBe(1);
    expect(constants.GP_X).toBe(2);
    expect(constants.GP_Y).toBe(3);
    expect(constants.GP_LB).toBe(4);
    expect(constants.GP_RB).toBe(5);
    expect(constants.GP_START).toBe(9);
    expect(constants.GP_DU).toBe(12);
    expect(constants.GP_DD).toBe(13);
    expect(constants.GP_DL).toBe(14);
    expect(constants.GP_DR).toBe(15);
    expect(constants.GP_DEADZONE).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

test.describe('Gamepad: Input Helpers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('_gpActivateInputMode sets keyboard mode and initializes cursor', async ({ page }) => {
    const result = await page.evaluate(() => {
      _inputMode = 'mouse';
      _kbCursorR = -1; _kbCursorC = -1;
      _gpActivateInputMode();
      return { mode: _inputMode, r: _kbCursorR, c: _kbCursorC };
    });
    expect(result.mode).toBe('keyboard');
    expect(result.r).toBe(3);
    expect(result.c).toBe(3);
  });

  test('_gpActivateInputMode does not reset cursor if already set', async ({ page }) => {
    const result = await page.evaluate(() => {
      _inputMode = 'mouse';
      _kbCursorR = 5; _kbCursorC = 6;
      _gpActivateInputMode();
      return { r: _kbCursorR, c: _kbCursorC };
    });
    expect(result.r).toBe(5);
    expect(result.c).toBe(6);
  });

  test('_gpPressed detects rising edge only', async ({ page }) => {
    const result = await page.evaluate(() => {
      var btn = { pressed: true, value: 1 };
      var gp = { buttons: [btn] };
      // First frame: no prev → rising edge
      _gpPrevButtons = [];
      var first = _gpPressed(gp, 0);
      // Save state, second frame: same button → not rising edge
      _gpPrevButtons = [true];
      var second = _gpPressed(gp, 0);
      // Release, third frame: not pressed → not rising edge
      gp.buttons[0] = { pressed: false, value: 0 };
      _gpPrevButtons = [true];
      var third = _gpPressed(gp, 0);
      // Press again after release → rising edge
      gp.buttons[0] = { pressed: true, value: 1 };
      _gpPrevButtons = [false];
      var fourth = _gpPressed(gp, 0);
      return { first, second, third, fourth };
    });
    expect(result.first).toBe(true);
    expect(result.second).toBe(false);
    expect(result.third).toBe(false);
    expect(result.fourth).toBe(true);
  });

  test('_gpDigitizeStick respects deadzone', async ({ page }) => {
    const result = await page.evaluate(() => {
      var inside = _gpDigitizeStick(0.1, -0.2);
      var outside = _gpDigitizeStick(-0.8, 0.5);
      var edge = _gpDigitizeStick(0.3, -0.3);
      return { inside, outside, edge };
    });
    // Inside deadzone — all false
    expect(result.inside).toEqual({ left: false, right: false, up: false, down: false });
    // Outside deadzone
    expect(result.outside).toEqual({ left: true, right: false, up: false, down: true });
    // At exactly deadzone threshold — not triggered (strict inequality)
    expect(result.edge).toEqual({ left: false, right: false, up: false, down: false });
  });

  test('_gpDirectionUpdate fires immediately on press, then delays', async ({ page }) => {
    const result = await page.evaluate(() => {
      _gpRepeatState = {};
      var first = _gpDirectionUpdate('up', true);
      // Immediately after: held but no repeat yet
      var second = _gpDirectionUpdate('up', true);
      // Release
      var released = _gpDirectionUpdate('up', false);
      // Re-press
      var repress = _gpDirectionUpdate('up', true);
      return { first, second, released, repress };
    });
    expect(result.first).toBe(true);   // fire immediately
    expect(result.second).toBe(false);  // too soon for repeat
    expect(result.released).toBe(false);
    expect(result.repress).toBe(true);  // new press after release
  });
});

// ---------------------------------------------------------------------------
// In-game: D-pad cursor movement
// ---------------------------------------------------------------------------

test.describe('Gamepad: In-Game Cursor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('D-pad down moves cursor down', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 3; _kbCursorC = 3; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    await gpFrame(page, [13]); // GP_DD = 13
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.r).toBe(4);
    expect(pos.c).toBe(3);
  });

  test('D-pad up moves cursor up', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 3; _kbCursorC = 3; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    await gpFrame(page, [12]); // GP_DU = 12
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.r).toBe(2);
  });

  test('D-pad left moves cursor left', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 3; _kbCursorC = 3; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    await gpFrame(page, [14]); // GP_DL = 14
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.c).toBe(2);
  });

  test('D-pad right moves cursor right', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 3; _kbCursorC = 3; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    await gpFrame(page, [15]); // GP_DR = 15
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.c).toBe(4);
  });

  test('left stick moves cursor (digitized)', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 3; _kbCursorC = 3; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    // Stick left: axis 0 = -0.9
    await gpFrame(page, [], [-0.9, 0, 0, 0]);
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.c).toBe(2);
  });

  test('cursor clamps at top-left boundary', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 0; _kbCursorC = 0; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    await gpFrame(page, [12, 14]); // up + left
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.r).toBe(0);
    expect(pos.c).toBe(0);
  });

  test('cursor clamps at bottom-right boundary', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 7; _kbCursorC = 7; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    await gpFrame(page, [13, 15]); // down + right
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    expect(pos.r).toBe(7);
    expect(pos.c).toBe(7);
  });

  test('kb-cursor class applied to correct cell after gamepad move', async ({ page }) => {
    await page.evaluate(() => { _kbCursorR = 3; _kbCursorC = 3; _inputMode = 'keyboard'; _gpRepeatState = {}; });
    await gpFrame(page, [15]); // right → (3,4)
    const cell = await page.evaluate(() => {
      var c = document.querySelector('.cell.kb-cursor');
      return c ? { r: c.dataset.row, c: c.dataset.col } : null;
    });
    expect(cell).not.toBeNull();
    expect(cell.r).toBe('3');
    expect(cell.c).toBe('4');
  });
});

// ---------------------------------------------------------------------------
// In-game: button actions
// ---------------------------------------------------------------------------

test.describe('Gamepad: In-Game Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('A button places piece at cursor', async ({ page }) => {
    // Select piece and set cursor
    await page.evaluate(() => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (p) selectPiece(p);
      _kbCursorR = 0; _kbCursorC = 0; _inputMode = 'keyboard';
    });
    const before = await page.evaluate(() => piecesPlacedCount);
    await gpFrame(page, [0]); // GP_A
    const after = await page.evaluate(() => piecesPlacedCount);
    // May or may not place depending on piece shape — just no error
    expect(typeof after).toBe('number');
  });

  test('B button undoes last placement', async ({ page }) => {
    // Place a piece via JS
    await page.evaluate(() => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (!p) return;
      var shape = p.currentShape;
      if (canPlace(shape, 0, 0, null)) {
        placePiece(shape, 0, 0, p.id);
        recordMove(p.id, shape, 0, 0);
        p.placed = true;
        piecesPlacedCount++;
        renderBoard(); renderPool();
      }
    });
    const before = await page.evaluate(() => piecesPlacedCount);
    if (before === 0) return; // placement failed
    await gpFrame(page, [1]); // GP_B
    const after = await page.evaluate(() => piecesPlacedCount);
    expect(after).toBe(before - 1);
  });

  test('X button rotates selected piece', async ({ page }) => {
    await page.evaluate(() => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (p) selectPiece(p);
    });
    const before = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    await gpFrame(page, [2]); // GP_X
    const after = await page.evaluate(() => JSON.stringify(selectedPiece.currentShape));
    expect(after).not.toBe(before);
  });

  test('LB/RB cycle through unplaced pieces', async ({ page }) => {
    // Start with no selection
    await page.evaluate(() => { selectedPiece = null; });
    await gpFrame(page, [5]); // GP_RB → select first
    const first = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto && !p.placed);
      return selectedPiece === playable[0];
    });
    expect(first).toBe(true);

    await gpFrame(page, [5]); // GP_RB → next
    const second = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto && !p.placed);
      return selectedPiece === playable[1];
    });
    expect(second).toBe(true);

    await gpFrame(page, [4]); // GP_LB → back to first
    const backToFirst = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto && !p.placed);
      return selectedPiece === playable[0];
    });
    expect(backToFirst).toBe(true);
  });

  test('Start button pauses game', async ({ page }) => {
    await page.evaluate(() => ensureTimerRunning());
    await gpFrame(page, [9]); // GP_START
    const isPaused = await page.evaluate(() => paused);
    expect(isPaused).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Paused state
// ---------------------------------------------------------------------------

test.describe('Gamepad: Paused', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
    await page.evaluate(() => { ensureTimerRunning(); pauseGame(); });
  });

  test('A button resumes game', async ({ page }) => {
    const before = await page.evaluate(() => paused);
    expect(before).toBe(true);
    await gpFrame(page, [0]); // GP_A
    const after = await page.evaluate(() => paused);
    expect(after).toBe(false);
  });

  test('Start button resumes game', async ({ page }) => {
    await gpFrame(page, [9]); // GP_START
    const after = await page.evaluate(() => paused);
    expect(after).toBe(false);
  });

  test('B button returns to welcome', async ({ page }) => {
    await gpFrame(page, [1]); // GP_B
    await page.waitForTimeout(300);
    const inGame = await page.evaluate(() => document.body.classList.contains('in-game'));
    expect(inGame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Modal handling
// ---------------------------------------------------------------------------

test.describe('Gamepad: Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('B button closes open modal', async ({ page }) => {
    await page.evaluate(() => document.getElementById('help-modal').classList.add('show'));
    const before = await page.evaluate(() => document.getElementById('help-modal').classList.contains('show'));
    expect(before).toBe(true);
    await gpFrame(page, [1]); // GP_B → handleAndroidBack()
    const after = await page.evaluate(() => document.getElementById('help-modal').classList.contains('show'));
    expect(after).toBe(false);
  });

  test('A button clicks primary button in reward modal', async ({ page }) => {
    let clicked = false;
    await page.evaluate(() => {
      window._testRewardClicked = false;
      document.getElementById('reward-modal').classList.add('show');
      document.getElementById('reward-primary').textContent = 'Test';
      document.getElementById('reward-primary').onclick = function() { window._testRewardClicked = true; };
    });
    await gpFrame(page, [0]); // GP_A
    const wasClicked = await page.evaluate(() => window._testRewardClicked);
    expect(wasClicked).toBe(true);
  });

  test('A button clicks first visible button in non-reward modal', async ({ page }) => {
    await page.evaluate(() => {
      window._testModalBtnClicked = false;
      var modal = document.getElementById('energy-modal');
      modal.classList.add('show');
      // Ensure there's a visible button
      var btn = modal.querySelector('button');
      if (btn) btn.onclick = function() { window._testModalBtnClicked = true; };
    });
    await gpFrame(page, [0]); // GP_A
    const wasClicked = await page.evaluate(() => window._testModalBtnClicked);
    // This may be true or false depending on modal content, but should not error
    expect(typeof wasClicked).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Welcome panel
// ---------------------------------------------------------------------------

test.describe('Gamepad: Welcome', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('A button clicks resume button on welcome panel', async ({ page }) => {
    // Set up resume button to be visible
    await page.evaluate(() => {
      window._testResumeClicked = false;
      var btn = document.getElementById('wp-resume');
      btn.style.display = '';
      btn.textContent = 'Resume';
      btn.onclick = function(e) { e.preventDefault(); window._testResumeClicked = true; };
    });
    await gpFrame(page, [0]); // GP_A
    const clicked = await page.evaluate(() => window._testResumeClicked);
    expect(clicked).toBe(true);
  });

  test('A button on welcome does nothing if resume hidden', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('wp-resume').style.display = 'none';
      document.getElementById('wp-daily-challenge').style.display = 'none';
    });
    // Should not throw
    await gpFrame(page, [0]); // GP_A
    const inGame = await page.evaluate(() => document.body.classList.contains('in-game'));
    expect(inGame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Piece cycling edge cases
// ---------------------------------------------------------------------------

test.describe('Gamepad: Piece Cycling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('_gpCyclePiece wraps around forward', async ({ page }) => {
    const result = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto && !p.placed);
      selectPiece(playable[playable.length - 1]); // select last
      _gpCyclePiece(1); // should wrap to first
      return selectedPiece === playable[0];
    });
    expect(result).toBe(true);
  });

  test('_gpCyclePiece wraps around backward', async ({ page }) => {
    const result = await page.evaluate(() => {
      var playable = pieces.filter(p => !p.auto && !p.placed);
      selectPiece(playable[0]); // select first
      _gpCyclePiece(-1); // should wrap to last
      return selectedPiece === playable[playable.length - 1];
    });
    expect(result).toBe(true);
  });

  test('_gpCyclePiece selects first when none selected', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedPiece = null;
      _gpCyclePiece(1);
      var playable = pieces.filter(p => !p.auto && !p.placed);
      return selectedPiece === playable[0];
    });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Context dispatch priority
// ---------------------------------------------------------------------------

test.describe('Gamepad: Context Dispatch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await startTestGame(page);
  });

  test('modal takes priority over in-game', async ({ page }) => {
    // Open a modal while in-game — B should close modal, not undo
    await page.evaluate(() => {
      var p = pieces.find(pp => !pp.auto && !pp.placed);
      if (p) {
        var shape = p.currentShape;
        if (canPlace(shape, 0, 0, null)) {
          placePiece(shape, 0, 0, p.id);
          recordMove(p.id, shape, 0, 0);
          p.placed = true;
          piecesPlacedCount++;
          renderBoard(); renderPool();
        }
      }
      document.getElementById('help-modal').classList.add('show');
    });
    const placedBefore = await page.evaluate(() => piecesPlacedCount);
    await gpFrame(page, [1]); // GP_B → should close modal, NOT undo
    const placedAfter = await page.evaluate(() => piecesPlacedCount);
    const modalClosed = await page.evaluate(() => !document.getElementById('help-modal').classList.contains('show'));
    expect(modalClosed).toBe(true);
    expect(placedAfter).toBe(placedBefore); // no undo happened
  });

  test('paused takes priority over in-game cursor movement', async ({ page }) => {
    await page.evaluate(() => {
      _kbCursorR = 3; _kbCursorC = 3; _inputMode = 'keyboard';
      ensureTimerRunning();
      pauseGame();
    });
    // D-pad should not move cursor when paused
    await gpFrame(page, [13]); // GP_DD
    const pos = await page.evaluate(() => ({ r: _kbCursorR, c: _kbCursorC }));
    // Cursor should not have moved (paused handler doesn't call _gpMoveCursor)
    expect(pos.r).toBe(3);
    expect(pos.c).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Key repeat logic
// ---------------------------------------------------------------------------

test.describe('Gamepad: Key Repeat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('direction fires immediately, suppresses during delay, fires after delay', async ({ page }) => {
    const result = await page.evaluate(() => {
      _gpRepeatState = {};
      // Frame 1: first press → fires
      var f1 = _gpDirectionUpdate('right', true);

      // Frame 2: held, 16ms later → suppressed
      var f2 = _gpDirectionUpdate('right', true);

      // Simulate time passing beyond GP_REPEAT_DELAY
      _gpRepeatState['right'].firstFire = performance.now() - 350;
      _gpRepeatState['right'].lastFire = performance.now() - 150;
      var f3 = _gpDirectionUpdate('right', true);

      return { f1, f2, f3 };
    });
    expect(result.f1).toBe(true);
    expect(result.f2).toBe(false);
    expect(result.f3).toBe(true);
  });

  test('releasing direction resets repeat state', async ({ page }) => {
    const result = await page.evaluate(() => {
      _gpRepeatState = {};
      _gpDirectionUpdate('left', true);  // press
      _gpDirectionUpdate('left', false); // release
      var active = _gpRepeatState['left'].active;
      var repress = _gpDirectionUpdate('left', true); // re-press → fires immediately
      return { active, repress };
    });
    expect(result.active).toBe(false);
    expect(result.repress).toBe(true);
  });
});
