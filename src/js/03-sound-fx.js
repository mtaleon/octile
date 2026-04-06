// --- Sound System (Web Audio API synthesis, zero file size) ---
var _soundEnabled = localStorage.getItem('octile_sound') !== '0';
var _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
  return _audioCtx;
}
function playSound(type) {
  if (!_soundEnabled) return;
  var ctx = _getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  var o = ctx.createOscillator();
  var g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  var t = ctx.currentTime;
  switch (type) {
    case 'place':
      o.frequency.setValueAtTime(440, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.start(t); o.stop(t + 0.06);
      break;
    case 'rotate':
      o.frequency.setValueAtTime(880, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      o.start(t); o.stop(t + 0.03);
      break;
    case 'remove':
      o.frequency.setValueAtTime(330, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t); o.stop(t + 0.08);
      break;
    case 'select':
      o.frequency.setValueAtTime(660, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.start(t); o.stop(t + 0.04);
      break;
    case 'win': {
      // C-E-G arpeggio
      var notes = [523, 659, 784];
      for (var i = 0; i < 3; i++) {
        var oi = ctx.createOscillator();
        var gi = ctx.createGain();
        oi.connect(gi); gi.connect(ctx.destination);
        oi.frequency.setValueAtTime(notes[i], t + i * 0.12);
        oi.type = 'sine';
        gi.gain.setValueAtTime(0.15, t + i * 0.12);
        gi.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
        oi.start(t + i * 0.12); oi.stop(t + i * 0.12 + 0.3);
      }
      return;
    }
    case 'hint':
      o.frequency.setValueAtTime(1200, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.15);
      break;
    case 'achieve': {
      var o2 = ctx.createOscillator();
      var g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o.frequency.setValueAtTime(523, t); o.type = 'sine';
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.15);
      o2.frequency.setValueAtTime(659, t + 0.1); o2.type = 'sine';
      g2.gain.setValueAtTime(0.12, t + 0.1); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o2.start(t + 0.1); o2.stop(t + 0.25);
      return;
    }
    case 'error':
      o.frequency.setValueAtTime(200, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.start(t); o.stop(t + 0.05);
      break;
    case 'toast':
      o.frequency.setValueAtTime(520, t);
      o.type = 'sine';
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t); o.stop(t + 0.08);
      break;
    default: return;
  }
}
function _updateSoundBtn() {
  var btn = document.getElementById('sound-btn');
  if (!btn) return;
  btn.textContent = _soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
  btn.classList.toggle('muted', !_soundEnabled);
}
function toggleSound() {
  _soundEnabled = !_soundEnabled;
  localStorage.setItem('octile_sound', _soundEnabled ? '1' : '0');
  _updateSoundBtn();
  if (_soundEnabled) playSound('select');
}

// --- Visual Snap Animation ---
function triggerSnap() {
  var cells = document.querySelectorAll('#board .cell.occupied:not(.snap-done)');
  cells.forEach(function(c) {
    if (!c.classList.contains('snap-done')) {
      c.classList.add('snap', 'snap-done');
      setTimeout(function() { c.classList.remove('snap'); }, 200);
    }
  });
}
function triggerBoardPulse() {
  var board = document.getElementById('board');
  board.classList.add('win-pulse');
  setTimeout(function() { board.classList.remove('win-pulse'); }, 400);
}
function spawnFloat(text, cls) {
  var el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  var rect = document.getElementById('exp-display').getBoundingClientRect();
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', function() { el.remove(); });
}

// --- Canvas Particle FX Engine ---
var _fxCanvas, _fxCtx, _fxParticles = [], _fxRunning = false;
var _FX_MAX = 400;

function _fxInit() {
  _fxCanvas = document.getElementById('fx-canvas');
  if (!_fxCanvas) return;
  _fxCtx = _fxCanvas.getContext('2d');
  _fxResize();
  window.addEventListener('resize', _fxResize);
}

function _fxResize() {
  if (!_fxCanvas) return;
  var dpr = window.devicePixelRatio || 1;
  _fxCanvas.width = window.innerWidth * dpr;
  _fxCanvas.height = window.innerHeight * dpr;
  _fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function _fxEmit(opts) {
  if (!_fxCtx) return;
  var count = Math.min(opts.count || 10, _FX_MAX - _fxParticles.length);
  for (var i = 0; i < count; i++) {
    var angle = (opts.angle || 0) + (Math.random() - 0.5) * (opts.spread || Math.PI * 2);
    var speed = (opts.speed || 80) * (0.5 + Math.random() * 0.5);
    _fxParticles.push({
      x: opts.x || 0, y: opts.y || 0,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: (opts.life || 1) * (0.7 + Math.random() * 0.3), maxLife: opts.life || 1,
      size: (opts.size || 4) * (0.5 + Math.random() * 0.5),
      color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
      gravity: opts.gravity || 0, type: opts.type || 'circle',
      rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 4
    });
  }
  if (!_fxRunning) { _fxRunning = true; _fxLastTime = performance.now(); requestAnimationFrame(_fxLoop); }
}

var _fxLastTime = 0;
function _fxLoop(now) {
  var dt = Math.min((now - _fxLastTime) / 1000, 0.05);
  _fxLastTime = now;
  _fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (var i = _fxParticles.length - 1; i >= 0; i--) {
    var p = _fxParticles[i];
    p.life -= dt;
    if (p.life <= 0) { _fxParticles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotation += p.rotSpeed * dt;
    var alpha = Math.min(1, p.life / (p.maxLife * 0.3));
    _fxCtx.save();
    _fxCtx.globalAlpha = alpha;
    _fxCtx.fillStyle = p.color;
    _fxCtx.translate(p.x, p.y);
    _fxCtx.rotate(p.rotation);
    if (p.type === 'sparkle') {
      _fxDrawStar(_fxCtx, p.size);
    } else if (p.type === 'rect') {
      _fxCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    } else {
      _fxCtx.beginPath();
      _fxCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      _fxCtx.fill();
    }
    _fxCtx.restore();
  }
  if (_fxParticles.length > 0) {
    requestAnimationFrame(_fxLoop);
  } else {
    _fxRunning = false;
  }
}

function _fxDrawStar(ctx, size) {
  ctx.beginPath();
  for (var i = 0; i < 4; i++) {
    var a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    var b = a + Math.PI / 4;
    ctx.lineTo(Math.cos(b) * size * 0.35, Math.sin(b) * size * 0.35);
  }
  ctx.closePath();
  ctx.fill();
}

function fxDiamondSparkle(el) {
  if (!_fxCtx || !el) return;
  var r = el.getBoundingClientRect();
  _fxEmit({
    x: r.left + r.width / 2, y: r.top + r.height / 2,
    count: 30, colors: ['#5dade2', '#85c1e9', '#fff', '#aee0ff'],
    speed: 40, life: 2.5, size: 8, gravity: 15,
    spread: Math.PI * 2, type: 'sparkle'
  });
}

function fxGoldBurst(x, y) {
  // Wave 1: big slow sparkles
  _fxEmit({
    x: x, y: y, count: 40,
    colors: ['#f1c40f', '#f9e547', '#fff', '#e67e22', '#ffd700'],
    speed: 60, life: 3, size: 10, gravity: 20,
    spread: Math.PI * 2, type: 'sparkle'
  });
  // Wave 2: medium circles after 400ms
  setTimeout(function() {
    _fxEmit({
      x: x, y: y, count: 25,
      colors: ['#f1c40f', '#fff', '#ffd700'],
      speed: 35, life: 2.5, size: 6, gravity: 12,
      spread: Math.PI * 2, type: 'circle'
    });
  }, 400);
  // Wave 3: lingering tiny sparkles after 800ms
  setTimeout(function() {
    _fxEmit({
      x: x, y: y, count: 15,
      colors: ['#fff', '#f9e547'],
      speed: 20, life: 2, size: 4, gravity: 8,
      spread: Math.PI * 2, type: 'sparkle'
    });
  }, 800);
}

function fxAchieveBurst(el) {
  if (!_fxCtx || !el) return;
  var r = el.getBoundingClientRect();
  _fxEmit({
    x: r.left + r.width / 2, y: r.top + r.height / 2,
    count: 35, colors: ['#f1c40f', '#f0e68c', '#fff', '#ffd700'],
    speed: 45, life: 2.5, size: 8, gravity: 15,
    spread: Math.PI * 2, type: 'sparkle'
  });
}

// --- Haptic Feedback ---
function haptic(pattern) {
  if (!_soundEnabled) return; // tie haptics to sound toggle
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// --- Debug state (declared early, handlers set up later) ---
let _debugForceOffline = false;
let _debugUnlimitedHints = false;
let _debugUnlimitedEnergy = false;
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  try {
    const _dbg = JSON.parse(localStorage.getItem('octile_debug') || '{}');
    _debugForceOffline = !!_dbg.offline;
    _debugUnlimitedHints = !!_dbg.hints;
    _debugUnlimitedEnergy = !!_dbg.energy;
  } catch {}
}
function _saveDebugConfig() {
  try { localStorage.setItem('octile_debug', JSON.stringify({ offline: _debugForceOffline, hints: _debugUnlimitedHints, energy: _debugUnlimitedEnergy })); } catch {}
}

