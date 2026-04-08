// =============================================================================
// 05a-gamepad.js — Gamepad/controller support (Steam/Electron only)
// =============================================================================

var GP_A = 0, GP_B = 1, GP_X = 2, GP_Y = 3, GP_LB = 4, GP_RB = 5;
var GP_START = 9, GP_DU = 12, GP_DD = 13, GP_DL = 14, GP_DR = 15;
var GP_DEADZONE = 0.3;
var GP_REPEAT_DELAY = 300;
var GP_REPEAT_RATE = 100;

var _gpConnected = false;
var _gpPrevButtons = [];
var _gpRafId = null;
var _gpRepeatState = {}; // { direction: { active, firstFire, lastFire } }

function _gpInit() {
  if (!_isElectron || !_steamFeature('gamepad') || !navigator.getGamepads) return;
  window.addEventListener('gamepadconnected', function(e) {
    _gpConnected = true;
    console.log('Gamepad connected: ' + e.gamepad.id);
    if (!_gpRafId) _gpRafId = requestAnimationFrame(_gpPoll);
  });
  window.addEventListener('gamepaddisconnected', function() {
    _gpConnected = false;
    console.log('Gamepad disconnected');
    if (_gpRafId) { cancelAnimationFrame(_gpRafId); _gpRafId = null; }
    _gpPrevButtons = [];
    _gpRepeatState = {};
  });
}

// --- Polling loop ---
function _gpPoll() {
  _gpRafId = requestAnimationFrame(_gpPoll);
  if (!_gpConnected) return;
  var gamepads = navigator.getGamepads();
  var gp = null;
  for (var i = 0; i < gamepads.length; i++) {
    if (gamepads[i] && gamepads[i].connected) { gp = gamepads[i]; break; }
  }
  if (!gp) return;

  // Detect any input to activate keyboard/cursor mode
  var hasInput = false;
  for (var b = 0; b < gp.buttons.length; b++) {
    if (gp.buttons[b].pressed) { hasInput = true; break; }
  }
  if (!hasInput && gp.axes) {
    for (var a = 0; a < gp.axes.length; a++) {
      if (Math.abs(gp.axes[a]) > GP_DEADZONE) { hasInput = true; break; }
    }
  }
  if (hasInput) _gpActivateInputMode();

  // Context dispatch
  if (_isModalOpen()) _gpHandleModal(gp);
  else if (_winStep > 0) _gpHandleWin(gp);
  else if (paused) _gpHandlePaused(gp);
  else if (_isInGame()) _gpHandleInGame(gp);
  else _gpHandleWelcome(gp);

  // Save button state for edge detection
  _gpPrevButtons = [];
  for (var j = 0; j < gp.buttons.length; j++) {
    _gpPrevButtons[j] = gp.buttons[j].pressed;
  }
}

// --- Input helpers ---
function _gpActivateInputMode() {
  if (_inputMode !== 'keyboard') {
    _inputMode = 'keyboard';
    if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; }
    _updateKbCursor();
  }
}

function _gpPressed(gp, idx) {
  return gp.buttons[idx] && gp.buttons[idx].pressed && !_gpPrevButtons[idx];
}

function _gpDigitizeStick(axisX, axisY) {
  return {
    left: axisX < -GP_DEADZONE,
    right: axisX > GP_DEADZONE,
    up: axisY < -GP_DEADZONE,
    down: axisY > GP_DEADZONE
  };
}

function _gpDirectionUpdate(dir, pressed) {
  if (!_gpRepeatState[dir]) _gpRepeatState[dir] = { active: false, firstFire: 0, lastFire: 0 };
  var s = _gpRepeatState[dir];
  var now = performance.now();
  if (!pressed) {
    s.active = false;
    return false;
  }
  if (!s.active) {
    s.active = true;
    s.firstFire = now;
    s.lastFire = now;
    return true; // fire immediately
  }
  // Repeat logic
  var elapsed = now - s.firstFire;
  if (elapsed >= GP_REPEAT_DELAY && now - s.lastFire >= GP_REPEAT_RATE) {
    s.lastFire = now;
    return true;
  }
  return false;
}

function _gpMoveCursor(gp) {
  var dpad = {
    up: gp.buttons[GP_DU] && gp.buttons[GP_DU].pressed,
    down: gp.buttons[GP_DD] && gp.buttons[GP_DD].pressed,
    left: gp.buttons[GP_DL] && gp.buttons[GP_DL].pressed,
    right: gp.buttons[GP_DR] && gp.buttons[GP_DR].pressed
  };
  var stick = _gpDigitizeStick(gp.axes[0] || 0, gp.axes[1] || 0);
  var up = dpad.up || stick.up;
  var down = dpad.down || stick.down;
  var left = dpad.left || stick.left;
  var right = dpad.right || stick.right;

  if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; }
  var moved = false;
  if (_gpDirectionUpdate('up', up)) { _kbCursorR = Math.max(0, _kbCursorR - 1); moved = true; }
  if (_gpDirectionUpdate('down', down)) { _kbCursorR = Math.min(7, _kbCursorR + 1); moved = true; }
  if (_gpDirectionUpdate('left', left)) { _kbCursorC = Math.max(0, _kbCursorC - 1); moved = true; }
  if (_gpDirectionUpdate('right', right)) { _kbCursorC = Math.min(7, _kbCursorC + 1); moved = true; }
  if (moved) _updateKbCursor();
}

function _gpCyclePiece(dir) {
  var playable = pieces.filter(function(p) { return !p.auto && !p.placed; });
  if (playable.length === 0) return;
  var curIdx = selectedPiece ? playable.indexOf(selectedPiece) : -1;
  var nextIdx = curIdx < 0 ? 0 : (curIdx + dir + playable.length) % playable.length;
  selectPiece(playable[nextIdx]);
}

// --- Context handlers ---
function _gpHandleInGame(gp) {
  _gpMoveCursor(gp);
  if (_gpPressed(gp, GP_A)) {
    if (_kbCursorR < 0) { _kbCursorR = 3; _kbCursorC = 3; _updateKbCursor(); }
    _kbPlaceAtCursor();
  }
  if (_gpPressed(gp, GP_B)) _kbUndoLastPlacement();
  if (_gpPressed(gp, GP_X)) _doRotateSelected();
  if (_gpPressed(gp, GP_Y)) showHint();
  if (_gpPressed(gp, GP_LB)) _gpCyclePiece(-1);
  if (_gpPressed(gp, GP_RB)) _gpCyclePiece(1);
  if (_gpPressed(gp, GP_START)) pauseGame();
}

function _gpHandleModal(gp) {
  if (_gpPressed(gp, GP_A)) {
    // Click primary button in reward modal, or first visible button in topmost modal
    var rewardBtn = document.getElementById('reward-primary');
    if (rewardBtn && rewardBtn.offsetParent !== null) { rewardBtn.click(); return; }
    for (var i = 0; i < _modalIds.length; i++) {
      var modal = document.getElementById(_modalIds[i]);
      if (modal && modal.classList.contains('show')) {
        var btn = modal.querySelector('button:not([style*="display: none"]):not([style*="display:none"])');
        if (btn) btn.click();
        return;
      }
    }
  }
  if (_gpPressed(gp, GP_B)) handleAndroidBack();
}

function _gpHandleWin(gp) {
  if (_gpPressed(gp, GP_A)) {
    // Advance through win steps
    for (var step = 1; step <= 3; step++) {
      var el = document.getElementById('win-step' + step);
      if (el && el.style.display !== 'none' && el.offsetParent !== null) { el.click(); return; }
    }
    var nextBtn = document.getElementById('win-next-btn');
    if (nextBtn && nextBtn.offsetParent !== null) nextBtn.click();
  }
}

function _gpHandlePaused(gp) {
  if (_gpPressed(gp, GP_A) || _gpPressed(gp, GP_START)) resumeGame();
  if (_gpPressed(gp, GP_B)) returnToWelcome();
}

function _gpHandleWelcome(gp) {
  if (_gpPressed(gp, GP_A)) {
    var resumeBtn = document.getElementById('wp-resume');
    if (resumeBtn && resumeBtn.style.display !== 'none') { resumeBtn.click(); return; }
    // Fallback: click the daily challenge card if visible
    var dcCard = document.getElementById('wp-daily-challenge');
    if (dcCard && dcCard.style.display !== 'none') dcCard.click();
  }
}
