'use strict';
// ──────────────────────────────────────────────
// Octile — source modules (src/*.js)
//
// Edit files in src/, then rebuild:
//   ./scripts/build.sh          # concat src/*.js → app.js, then minify
//   ./scripts/build.sh --dev    # concat only (skip minify)
//
// Files are numbered for concatenation order:
//   00-core      Error handler, localStorage, piece definitions
//   01-data      Puzzles, levels, navigation, board state
//   02-config    API URLs, version, fetch wrapper, config loader
//   03-sound-fx  Sound system, visual snap, canvas particles, haptics
//   04-infra     Turnstile, update check, OTA, offline queue, avatars
//   05-board     Timer, board rendering, drag/drop, piece placement
//   06-economy   Energy, EXP, diamonds, achievements, daily tasks
//   07-game      Scoreboard, encouragement, win flow, confetti
//   08-ui        Splash, welcome panel, tutorial, settings
//   09-auth      Auth, Google OAuth
//   10-profile   Player profile, ELO ranks
//   11-init      Event listeners, debug panel, startup sequence
//
// index.html loads app.min.js, NOT app.js.

// =====================================================================
// GLOBAL ERROR HANDLER — catches unhandled JS errors
// Shows user-friendly dialog with option to send feedback (policy-safe)
// =====================================================================
var _errorLog = [];
var _errorDialogShown = false;

window.onerror = function(msg, src, line, col, err) {
  var entry = { msg: msg, src: (src || '').split('/').pop(), line: line, col: col, ts: Date.now() };
  _errorLog.push(entry);
  if (_errorLog.length > 10) _errorLog.shift();
  console.error('[Octile Error]', msg, src, line, col);
  if (!_errorDialogShown) _showErrorDialog(entry);
  return true; // prevent default browser error
};

window.addEventListener('unhandledrejection', function(e) {
  var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unknown async error';
  var entry = { msg: msg, src: 'promise', line: 0, col: 0, ts: Date.now() };
  _errorLog.push(entry);
  if (_errorLog.length > 10) _errorLog.shift();
  console.error('[Octile Promise Error]', msg);
});

function _showErrorDialog(entry) {
  _errorDialogShown = true;
  // Build error info (no PII — only technical context)
  var info = 'Error: ' + entry.msg + '\nFile: ' + entry.src + ':' + entry.line +
    '\nVersion: ' + (typeof APP_VERSION_NAME !== 'undefined' ? APP_VERSION_NAME : '?') +
    '\nPlatform: ' + (/android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'web') +
    '\nScreen: ' + window.innerWidth + 'x' + window.innerHeight;
  // Use setTimeout to avoid breaking during init
  setTimeout(function() {
    try {
      var lang = (typeof currentLang !== 'undefined' && currentLang === 'zh') ? 'zh' : 'en';
      var title = lang === 'zh' ? '發生錯誤' : 'Something went wrong';
      var desc = lang === 'zh' ? '遊戲遇到了問題。您可以回報此問題以協助我們修復。' : 'The game encountered an issue. You can report it to help us fix it.';
      var sendLabel = lang === 'zh' ? '回報問題' : 'Report Issue';
      var dismissLabel = lang === 'zh' ? '關閉' : 'Dismiss';
      var el = document.createElement('div');
      el.id = 'error-dialog';
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
      el.innerHTML = '<div style="background:#16213e;border:2px solid #e74c3c;border-radius:12px;padding:24px;max-width:400px;width:100%;color:#ccc;text-align:center">'
        + '<div style="font-size:36px;margin-bottom:8px">&#9888;</div>'
        + '<h3 style="color:#e74c3c;margin-bottom:8px">' + title + '</h3>'
        + '<p style="font-size:13px;margin-bottom:16px">' + desc + '</p>'
        + '<div style="display:flex;gap:10px;justify-content:center">'
        + '<button id="err-send" style="background:#2ecc71;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer">' + sendLabel + '</button>'
        + '<button id="err-dismiss" style="background:transparent;color:#888;border:1px solid #444;border-radius:8px;padding:10px 20px;font-size:14px;cursor:pointer">' + dismissLabel + '</button>'
        + '</div></div>';
      document.body.appendChild(el);
      function _dismissError() {
        el.remove();
        _errorDialogShown = false;
        try { if (typeof returnToWelcome === 'function') returnToWelcome(); } catch(e2) {}
      }
      document.getElementById('err-dismiss').addEventListener('click', _dismissError);
      el.addEventListener('click', function(ev) { if (ev.target === el) _dismissError(); });
      document.getElementById('err-send').addEventListener('click', function() {
        el.remove();
        _errorDialogShown = false;
        // Submit error report via in-app feedback API (same pipeline, no external browser)
        try {
          var payload = {
            message: '[Auto Error Report]\n' + info,
            version: typeof APP_VERSION_NAME !== 'undefined' ? APP_VERSION_NAME : '?',
            lang: typeof currentLang !== 'undefined' ? currentLang : 'en',
            ts: Date.now(),
            context: {
              type: 'error',
              screen: window.innerWidth + 'x' + window.innerHeight,
              platform: /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'web',
              protocol: location.protocol
            }
          };
          try { payload.uuid = getBrowserUUID(); } catch(e3) {}
          if (typeof _queueFeedback === 'function') {
            _queueFeedback(payload);
            if (typeof _flushFeedbackQueue === 'function') _flushFeedbackQueue();
          }
          var ack = lang === 'zh' ? '已記錄，感謝回報！' : 'Recorded. Thank you!';
          var toast = document.getElementById('encourage-toast');
          if (toast) { toast.textContent = ack; toast.classList.add('show'); setTimeout(function() { toast.classList.remove('show'); }, 3000); }
        } catch(e2) {}
        try { if (typeof returnToWelcome === 'function') returnToWelcome(); } catch(e3) {}
      });
    } catch(e) {
      console.error('[Octile] Error dialog failed:', e);
    }
  }, 100);
}

// Safe localStorage wrapper — handles QuotaExceeded
var _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  try {
    _origSetItem(key, value);
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('[Octile] localStorage full, clearing old data');
      // Remove non-critical data to free space
      var expendable = ['octile_messages', 'octile_daily_task_counters', 'octile_multiplier', 'octile_multiplier_daily'];
      for (var i = 0; i < expendable.length; i++) {
        try { localStorage.removeItem(expendable[i]); } catch(e2) {}
      }
      try { _origSetItem(key, value); } catch(e3) {
        console.error('[Octile] localStorage still full after cleanup');
      }
    }
  }
};
// ──────────────────────────────────────────────

const PIECES = [
  { id: 'grey1', color: 'grey', shape: [[1]], auto: true },
  { id: 'grey2', color: 'grey', shape: [[1,1]], auto: true },
  { id: 'grey3', color: 'grey', shape: [[1,1,1]], auto: true },
  { id: 'red1',  color: 'red',  shape: [[1,1,1],[1,1,1]] },
  { id: 'red2',  color: 'red',  shape: [[1,1,1,1]] },
  { id: 'white1',color: 'white',shape: [[1,1,1,1,1]] },
  { id: 'white2',color: 'white',shape: [[1,1],[1,1]] },
  { id: 'blue1', color: 'blue', shape: [[1,1,1,1,1],[1,1,1,1,1]] },
  { id: 'blue2', color: 'blue', shape: [[1,1,1,1],[1,1,1,1],[1,1,1,1]] },
  { id: 'yel1',  color: 'yellow',shape: [[1,1,1],[1,1,1],[1,1,1]] },
  { id: 'yel2',  color: 'yellow',shape: [[1,1,1,1],[1,1,1,1]] },
];

