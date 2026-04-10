// --- API endpoints (default, overridden by config.json workerUrl) ---
let WORKER_URL = 'https://api.octile.eu.cc';
let SCORE_API_URL = WORKER_URL + '/score';
PUZZLE_API = WORKER_URL + '/puzzle/';
var SITE_URL = 'https://app.octile.eu.cc/';
const APP_VERSION_CODE = 24;
const APP_VERSION_NAME = '2.0.0';

// --- Send X-App-Version + credentials on all API calls ---
var _origFetch = window.fetch;
window.fetch = function(url, opts) {
  if (typeof url === 'string' && url.indexOf(WORKER_URL) === 0) {
    opts = opts || {};
    opts.headers = opts.headers instanceof Headers ? opts.headers : new Headers(opts.headers || {});
    opts.headers.set('X-App-Version', String(APP_VERSION_CODE));
    // Send cookies cross-origin so Worker can set/read octile_uid HttpOnly cookie
    if (!opts.credentials) opts.credentials = 'include';
    // Capture cookie UUID from response header (for local display use)
    return _origFetch.call(this, url, opts).then(function(resp) {
      if (typeof _captureCookieUUID === 'function') _captureCookieUUID(resp);
      return resp;
    });
  }
  return _origFetch.call(this, url, opts);
};

// --- Config-driven variables (defaults here, overridden by _applyConfig) ---
var LEADERBOARD_LIMIT = 100;
var SCORE_QUEUE_RETRY_MS = 35000;
var SPLASH_DISMISS_RETURNING = 3000;
var SPLASH_DISMISS_NEW = 5000;
var STORE_LINKS = [];
var SHOW_KB_SHORTCUTS = 'auto';
var TIER_ACTIVE = 10;
var TIER_EXPERT = 200;
var TIER_EXPERT_STREAK = 14;
var SKIP_TUTORIAL = false;

// --- App config (loaded from config.json) ---
var _appConfig = { auth: true, blockUnsolved: true, puzzleSet: 91024 };
function _safeMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (var key in source) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (source.hasOwnProperty(key)) target[key] = source[key];
  }
  return target;
}
function _cfg(path, fallback) {
  var parts = path.split('.');
  var v = _appConfig;
  for (var i = 0; i < parts.length; i++) {
    if (v == null) return fallback;
    v = v[parts[i]];
  }
  return v !== undefined ? v : fallback;
}
function _applyConfig() {
  if (_appConfig.workerUrl) {
    WORKER_URL = _appConfig.workerUrl;
    SCORE_API_URL = WORKER_URL + '/score';
    PUZZLE_API = WORKER_URL + '/puzzle/';
    SB_API = WORKER_URL + '/scoreboard';
  }
  if (_appConfig.siteUrl) SITE_URL = _appConfig.siteUrl;
  // Override game constants from config
  ENERGY_MAX = _cfg('energy.max', 5);
  ENERGY_RESTORE_COST = _cfg('energy.restoreCost', 50);
  ENERGY_RECOVERY_PERIOD = _cfg('energy.recoveryHours', 10) * 3600;
  ENERGY_PER_SECOND = ENERGY_MAX / ENERGY_RECOVERY_PERIOD;
  MAX_HINTS = _cfg('hints.maxPerDay', 3);
  HINT_DIAMOND_COST = _cfg('hints.diamondCost', 100);
  UNLOCK_PUZZLE_DIAMOND_COST = _cfg('hints.unlockPuzzleCost', 50);
  EXP_BASE = _cfg('exp', { easy: 100, medium: 250, hard: 750, hell: 2000 });
  PAR_TIMES = _cfg('parTimes', { easy: 60, medium: 90, hard: 120, hell: 180 });
  MULTIPLIER_DURATION_MS = _cfg('multiplier.durationMinutes', 10) * 60000;
  MULTIPLIER_TIME_WINDOWS = _cfg('multiplier.happyHours', [{ start: 12, end: 13 }, { start: 20, end: 21 }]);
  CONSECUTIVE_A_FOR_3X = _cfg('multiplier.consecutiveAForTriple', 3);
  CF_TURNSTILE_SITE_KEY = _cfg('turnstileSiteKey', '0x4AAAAAACuir272GuoMUfnx');
  DAILY_TASK_BONUS = _cfg('dailyTaskBonus', 50);
  MSG_MAX_AGE_MS = _cfg('messageMaxAgeDays', 14) * 24 * 60 * 60 * 1000;
  SB_CACHE_MS = _cfg('scoreboardCacheMs', 180000);
  LEADERBOARD_LIMIT = _cfg('leaderboardLimit', 100);
  SCORE_QUEUE_RETRY_MS = _cfg('scoreQueueRetryMs', 35000);
  SPLASH_DISMISS_RETURNING = _cfg('splashDismissMs.returning', 3000);
  SPLASH_DISMISS_NEW = _cfg('splashDismissMs.new', 5000);
  STORE_LINKS = Array.isArray(_cfg('storeLinks', [])) ? _cfg('storeLinks', []) : [];
  SHOW_KB_SHORTCUTS = _cfg('showKeyboardShortcuts', 'auto');
  var _tiers = _cfg('playerTiers', {});
  if (_tiers && typeof _tiers === 'object') {
    if (Number.isFinite(_tiers.active)) TIER_ACTIVE = _tiers.active;
    if (Number.isFinite(_tiers.expert)) TIER_EXPERT = _tiers.expert;
    if (Number.isFinite(_tiers.expertStreak)) TIER_EXPERT_STREAK = _tiers.expertStreak;
  }
  SKIP_TUTORIAL = !!_cfg('skipTutorial', false);
  if (SKIP_TUTORIAL) localStorage.setItem('octile_tut_step', '9');
  // Pack public key for signature verification
  if (_cfg('pack.publicKey', '')) _setPackPublicKey(_cfg('pack.publicKey', ''));
  // Pure mode: config flag for clean puzzle-only experience
  _isPureMode = !!_cfg('pure', false);
  // Demo mode: Electron + config flag (or window.steam.demo)
  _isDemoMode = _isElectron && (!!_cfg('demo', false) || !!(window.steam && window.steam.demo));
}
var _configReady = new Promise(function(resolve) {
  var url = location.protocol === 'file:' ? 'config.json' : 'config.json?t=' + Date.now();
  // Try fetch first, fall back to XMLHttpRequest for file:// compatibility
  function tryXHR() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'config.json', true);
      xhr.onload = function() {
        try { _safeMerge(_appConfig, JSON.parse(xhr.responseText)); } catch(e) {}
        _applyConfig();
        resolve();
      };
      xhr.onerror = function() { resolve(); };
      xhr.send();
    } catch(e) { resolve(); }
  }
  try {
    fetch(url).then(function(r) { return r.ok ? r.json() : null; }).then(function(c) {
      if (c) { _safeMerge(_appConfig, c); _applyConfig(); resolve(); }
      else tryXHR();
    }).catch(function() { tryXHR(); });
  } catch(e) { tryXHR(); }
});

// --- Demo mode (Electron + config flag) ---
var _isDemoMode = false; // set after config loads; true = demo build with limited content
var _isPureMode = false; // set after config loads; true = pure puzzle mode (no meta)
function _noMeta() { return _isElectron || _isPureMode; }
function _isSteam() { return _isElectron; }

function isAuthEnabled() { return !!_appConfig.auth; }
function isBlockUnsolved() { return !!_appConfig.blockUnsolved; }
function getTransforms() { return _appConfig.puzzleSet === 11378 ? 1 : 8; }

// --- Unified feature flags ---
// Each feature can be explicitly enabled/disabled via config.json features block.
// Default: on for normal web, off for pure mode / Electron.
function _feature(name) {
  if (_appConfig.features && typeof _appConfig.features[name] === 'boolean') {
    return _appConfig.features[name];
  }
  return !_noMeta();
}
// Legacy alias — _steamFeature now reads the same unified flags
function _steamFeature(name) { return _feature(name); }

var _steamConfigInterval = null;

function _applySteamFlags(data) {
  var f = data && data.steam && data.steam.features;
  if (!f || typeof f !== 'object') return;
  if (!_appConfig.features) _appConfig.features = {};
  for (var k in f) {
    if (f.hasOwnProperty(k) && typeof f[k] === 'boolean') {
      _appConfig.features[k] = f[k];
    }
  }
  _appConfig._steamPhase = (data.steam && data.steam.phase) || null;
  _appConfig._steamConfigStatus = 'ok';
  _appConfig._steamConfigFetchedAt = Date.now();
  // Server-side demo toggle
  if (typeof data.demo === 'boolean') {
    _appConfig.demo = data.demo;
    _isDemoMode = _isElectron && data.demo;
  }
  var ttl = data.steam && data.steam.ttl_seconds;
  if (typeof ttl === 'number' && ttl >= 30 && ttl <= 3600) {
    _appConfig._steamTtl = ttl;
    if (_steamConfigInterval) {
      clearInterval(_steamConfigInterval);
      _steamConfigInterval = setInterval(_fetchSteamConfig, ttl * 1000);
    }
  }
}

function _fetchSteamConfig() {
  return fetch(WORKER_URL + '/config/steam', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(c) { if (c) _applySteamFlags(c); })
    .catch(function() {
      _appConfig._steamConfigStatus = 'failed';
      _appConfig._steamConfigFetchedAt = Date.now();
    });
}

var _steamConfigReady = _configReady.then(function() {
  if (!_isElectron) return;
  return _fetchSteamConfig().then(function() {
    if (!_steamConfigInterval) {
      var ttl = (_appConfig._steamTtl || 300) * 1000;
      _steamConfigInterval = setInterval(_fetchSteamConfig, ttl);
    }
  });
});

