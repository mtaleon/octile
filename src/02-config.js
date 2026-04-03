// --- API endpoints (default, overridden by config.json workerUrl) ---
let WORKER_URL = 'https://octile.owen-ouyang.workers.dev';
let SCORE_API_URL = WORKER_URL + '/score';
PUZZLE_API = WORKER_URL + '/puzzle/';
var SITE_URL = 'https://mtaleon.github.io/octile/';
const APP_VERSION_CODE = 23;
const APP_VERSION_NAME = '1.15.0';

// --- Send X-App-Version on all API calls (for worker force-update gate) ---
var _origFetch = window.fetch;
window.fetch = function(url, opts) {
  if (typeof url === 'string' && url.indexOf(WORKER_URL) === 0) {
    opts = opts || {};
    opts.headers = opts.headers instanceof Headers ? opts.headers : new Headers(opts.headers || {});
    opts.headers.set('X-App-Version', String(APP_VERSION_CODE));
  }
  return _origFetch.call(this, url, opts);
};

// --- App config (loaded from config.json) ---
var _appConfig = { auth: true, blockUnsolved: true, puzzleSet: 91024 };
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
}
var _configReady = new Promise(function(resolve) {
  var url = location.protocol === 'file:' ? 'config.json' : 'config.json?t=' + Date.now();
  // Try fetch first, fall back to XMLHttpRequest for file:// compatibility
  function tryXHR() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'config.json', true);
      xhr.onload = function() {
        try { _appConfig = Object.assign(_appConfig, JSON.parse(xhr.responseText)); } catch(e) {}
        _applyConfig();
        resolve();
      };
      xhr.onerror = function() { resolve(); };
      xhr.send();
    } catch(e) { resolve(); }
  }
  try {
    fetch(url).then(function(r) { return r.ok ? r.json() : null; }).then(function(c) {
      if (c) { _appConfig = Object.assign(_appConfig, c); _applyConfig(); resolve(); }
      else tryXHR();
    }).catch(function() { tryXHR(); });
  } catch(e) { tryXHR(); }
});

function isAuthEnabled() { return !!_appConfig.auth; }
function isBlockUnsolved() { return !!_appConfig.blockUnsolved; }
function getTransforms() { return _appConfig.puzzleSet === 11378 ? 1 : 8; }

