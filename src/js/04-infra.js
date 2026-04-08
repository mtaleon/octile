// --- Cloudflare Turnstile (invisible, loaded only on valid web origins) ---
var CF_TURNSTILE_SITE_KEY = '0x4AAAAAACuir272GuoMUfnx';  // overridden by config.json turnstileSiteKey
let _turnstileToken = null;
let _turnstileReady = false;

function _shouldLoadTurnstile() {
  if (!CF_TURNSTILE_SITE_KEY || !WORKER_URL) return false;
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return false;
  // Turnstile only works on http/https origins, not file:// (WebView apps)
  return location.protocol === 'https:' || location.protocol === 'http:';
}

function _loadTurnstileScript() {
  if (!_shouldLoadTurnstile()) return;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=_onTurnstileLoad&render=explicit';
  script.async = true;
  document.head.appendChild(script);
}

function _onTurnstileLoad() {
  if (typeof turnstile === 'undefined') return;
  turnstile.render('#cf-turnstile', {
    sitekey: CF_TURNSTILE_SITE_KEY,
    size: 'compact',
    callback: (token) => { _turnstileToken = token; _turnstileReady = true; },
    'error-callback': (errorCode) => {
      console.warn('[Octile] Turnstile challenge failed:', errorCode);
      _turnstileReady = false;
      // 110xxx = config error (domain not authorized) — stop retrying
      if (typeof errorCode === 'string' && errorCode.startsWith('110')) {
        if (typeof turnstile !== 'undefined') turnstile.remove('#cf-turnstile');
      }
    },
    'refresh-expired': 'auto',
  });
}

function getTurnstileToken() {
  if (!_shouldLoadTurnstile()) return null;
  if (!_turnstileReady) return null;
  const token = _turnstileToken;
  _turnstileToken = null;
  _turnstileReady = false;
  if (typeof turnstile !== 'undefined') turnstile.reset('#cf-turnstile');
  return token;
}

// Load Turnstile after page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _loadTurnstileScript);
} else {
  _loadTurnstileScript();
}

// --- In-app update check (native apps only, not web) ---
function checkForUpdate() {
  // Only check for updates in native app context (file:// protocol).
  // On the web (https://), the page itself IS the latest version.
  if (location.protocol !== 'file:') return;
  fetch(SITE_URL + 'version.json?t=' + Date.now())
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .then(data => {
      if (!data) return;
      var url = data.playStoreUrl || data.apkUrl;

      // --- Force update check (non-dismissible blocker) ---
      var minVer = data.minVersionCode || 0;
      if (minVer > APP_VERSION_CODE) {
        // Check grace period
        var enforce = !data.enforceAfter || new Date(data.enforceAfter) <= new Date();
        if (enforce) {
          document.getElementById('update-text').textContent = t('update_required');
          document.getElementById('update-btn').textContent = t('update_now');
          document.getElementById('update-btn').onclick = () => { if (url) window.open(url, '_blank'); };
          document.getElementById('update-dismiss').style.display = 'none';
          document.getElementById('update-banner').classList.add('show', 'force');
          // Block back button dismiss
          document.getElementById('update-banner').onclick = function(e) { e.stopPropagation(); };
          return; // Don't show normal banner on top of force update
        }
      }

      // --- Normal update banner (dismissible) ---
      var storeVersion = data.playStoreVersionCode || data.versionCode;
      if (storeVersion <= APP_VERSION_CODE) return;
      var dismissed = localStorage.getItem('update_dismissed_v' + storeVersion);
      if (dismissed) return;
      var lang = currentLang || 'en';
      var notes = (data.releaseNotes && data.releaseNotes[lang]) || data.releaseNotes?.en || '';
      document.getElementById('update-text').textContent = t('update_available') + (notes ? ' — ' + notes : '');
      document.getElementById('update-btn').textContent = t('update_btn');
      document.getElementById('update-dismiss').textContent = t('update_later');
      document.getElementById('update-dismiss').style.display = '';
      document.getElementById('update-btn').onclick = () => { if (url) window.open(url, '_blank'); };
      document.getElementById('update-dismiss').onclick = () => {
        document.getElementById('update-banner').classList.remove('show');
        localStorage.setItem('update_dismissed_v' + storeVersion, '1');
      };
      document.getElementById('update-banner').classList.add('show');
    });
}
setTimeout(checkForUpdate, 3000);

// --- OTA update ready (called by native Android after background download) ---
window.onOtaUpdateReady = function(version) {
  var banner = document.getElementById('update-banner');
  document.getElementById('update-text').textContent = t('ota_ready');
  document.getElementById('update-btn').textContent = t('ota_restart');
  document.getElementById('update-btn').onclick = function() { location.reload(); };
  document.getElementById('update-dismiss').textContent = t('update_later');
  document.getElementById('update-dismiss').onclick = function() {
    banner.classList.remove('show');
  };
  banner.classList.add('show');
};

function getBrowserUUID() {
  // Electron: always use local browser UUID for stable identity (no cookie drift)
  if (_isElectron) {
    let uuid = localStorage.getItem('octile_browser_uuid');
    if (!uuid) {
      uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      localStorage.setItem('octile_browser_uuid', uuid);
    }
    return uuid;
  }
  // Prefer Worker-issued cookie UUID (set via X-Cookie-UUID response header)
  let uuid = localStorage.getItem('octile_cookie_uuid');
  if (uuid) return uuid;
  // Fallback to legacy client-generated UUID
  uuid = localStorage.getItem('octile_browser_uuid');
  if (!uuid) {
    uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('octile_browser_uuid', uuid);
  }
  return uuid;
}

// Capture cookie UUID from Worker response headers (called after first API response)
function _captureCookieUUID(response) {
  if (!response || !response.headers) return response;
  const cookieUUID = response.headers.get('X-Cookie-UUID');
  if (cookieUUID && cookieUUID !== localStorage.getItem('octile_cookie_uuid')) {
    localStorage.setItem('octile_cookie_uuid', cookieUUID);
  }
  return response;
}

// Compact 2-char piece ID for solution encoding
// Compact solution: 8 base-92 chars (mixed-radix: position+direction per piece)
const _P92 = [];
for (let i = 33; i < 127; i++) { if (i !== 39 && i !== 92) _P92.push(String.fromCharCode(i)); }
const _ENC = [
  { id:'red1',  r:2,c:3,sq:0 }, { id:'red2',  r:1,c:4,sq:0 },
  { id:'white1',r:1,c:5,sq:0 }, { id:'white2',r:2,c:2,sq:1 },
  { id:'blue1', r:2,c:5,sq:0 }, { id:'blue2', r:3,c:4,sq:0 },
  { id:'yel1',  r:3,c:3,sq:1 }, { id:'yel2',  r:2,c:4,sq:0 },
];
for (const p of _ENC) { p.hN = (9-p.r)*(9-p.c); p.N = p.sq ? p.hN : p.hN*2; }

function encodeSolution() {
  const bounds = {};
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const id = board[r][c]; if (!bounds[id]) bounds[id] = [r,c,r,c];
    else { if (r < bounds[id][0]) bounds[id][0]=r; if (c < bounds[id][1]) bounds[id][1]=c;
           if (r > bounds[id][2]) bounds[id][2]=r; if (c > bounds[id][3]) bounds[id][3]=c; }
  }
  let n = 0;
  for (let i = 7; i >= 0; i--) {
    const p = _ENC[i], b = bounds[p.id], h = b[2]-b[0]+1;
    let pi;
    if (p.sq || h === p.r) pi = b[0]*(9-p.c) + b[1];
    else pi = p.hN + b[0]*(9-p.r) + b[1];
    n = n * p.N + pi;
  }
  let s = '';
  for (let i = 0; i < 8; i++) { s += _P92[n % 92]; n = Math.floor(n / 92); }
  return s;
}

// --- Move log: record each placement for anti-cheat ---
// Encoding: tile(0-7) × 128 + direction(0-1) × 64 + position(0-63) = 0-1023
// Each move → 2 base-92 chars (92² = 8464 > 1024)
const _TILE_IDX = {};
for (let i = 0; i < _ENC.length; i++) _TILE_IDX[_ENC[i].id] = i;

function recordMove(pieceId, shape, row, col) {
  const ti = _TILE_IDX[pieceId];
  if (ti === undefined) return; // grey pieces, ignore
  const dir = (!_ENC[ti].sq && shape.length > shape[0].length) ? 1 : 0;
  const pos = row * 8 + col;
  _moveLog.push(ti * 128 + dir * 64 + pos);
  _placementOrder.push(pieceId);
}

function encodeMoveLog() {
  // Strip last 4 placements — once 4 pieces are correctly placed, the rest is trivial.
  // The final board state is already in `solution`, so the tail is redundant.
  const log = _moveLog.length > 4 ? _moveLog.slice(0, _moveLog.length - 4) : _moveLog;
  let s = '';
  for (let i = 0; i < log.length; i++) {
    const v = log[i];
    s += _P92[v % 92] + _P92[Math.floor(v / 92)];
  }
  return s;
}

// --- Offline score queue ---
const SCORE_QUEUE_KEY = 'octile_score_queue';

function getScoreQueue() {
  try { return JSON.parse(localStorage.getItem(SCORE_QUEUE_KEY)) || []; }
  catch { return []; }
}

function saveScoreQueue(queue) {
  localStorage.setItem(SCORE_QUEUE_KEY, JSON.stringify(queue));
}

async function sendOneScore(entry) {
  const url = SCORE_API_URL;
  var headers = { 'Content-Type': 'application/json' };
  if (isAuthenticated()) {
    var token = localStorage.getItem('octile_auth_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(entry),
  });
  if (res.status === 409) {
    // Puzzle data version mismatch — refresh data_version
    try {
      var data = await res.json();
      if (data.current_version) _serverDataVersion = data.current_version;
    } catch(e) {}
    console.warn('[Octile] Score rejected: puzzle data outdated, refreshing');
    return; // don't throw — score is lost but game continues
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

let _flushTimer = null;
async function flushScoreQueue() {
  const queue = getScoreQueue();
  if (!queue.length) return;
  // Send one entry at a time; schedule next after rate-limit window
  const entry = queue[0];
  try {
    await sendOneScore(entry);
    saveScoreQueue(queue.slice(1));
    // Schedule next queued entry after 35s (past 30s rate limit)
    if (queue.length > 1 && !_flushTimer) {
      _flushTimer = setTimeout(() => { _flushTimer = null; flushScoreQueue(); }, SCORE_QUEUE_RETRY_MS);
    }
  } catch {
    // Failed — retry later (on next solve or online event)
  }
}

async function submitScore(puzzleNumber, resolveTime) {
  const moves = encodeMoveLog();
  const entry = {
    puzzle_number: puzzleNumber,
    resolve_time: resolveTime,
    browser_uuid: getBrowserUUID(),
    solution: encodeSolution(),
    moves: moves || undefined,
    timestamp_utc: new Date().toISOString(), // legacy: keeps compat with old server
  };
  if (_serverDataVersion) entry.data_version = _serverDataVersion;
  if (_isDailyChallenge) { entry.daily_challenge = true; entry.daily_date = _dailyDate; }
  // Attach Turnstile token when Worker proxy is configured
  const cfToken = getTurnstileToken();
  if (cfToken) entry.cf_turnstile_token = cfToken;
  if (!isOnline()) {
    const queue = getScoreQueue();
    queue.push(entry);
    saveScoreQueue(queue);
    console.info('[Octile] Offline — score queued for later');
    return;
  }
  try {
    await sendOneScore(entry);
    // Check if we're #1 on this puzzle's scoreboard (background, non-blocking)
    checkRank1(puzzleNumber);
    // Flush queued scores after rate-limit window
    if (!_flushTimer) {
      _flushTimer = setTimeout(() => { _flushTimer = null; flushScoreQueue(); }, SCORE_QUEUE_RETRY_MS);
    }
  } catch (e) {
    console.warn('[Octile] Score submission failed, queuing:', e.message);
    const queue = getScoreQueue();
    queue.push(entry);
    saveScoreQueue(queue);
  }
}

async function checkRank1(puzzleNumber) {
  try {
    const data = await sbFetch({ puzzle: String(puzzleNumber), best: 'true', limit: '1' });
    if (data.scores && data.scores.length && data.scores[0].browser_uuid === getBrowserUUID()) {
      const unlocked = getUnlockedAchievements();
      if (!unlocked['rank_1']) {
        unlocked['rank_1'] = Date.now();
        saveUnlockedAchievements(unlocked);
        const ach = ACHIEVEMENTS.find(a => a.id === 'rank_1');
        if (ach) showAchieveToast(ach);
      }
    }
  } catch {}
}

// Re-check backend on network change
window.addEventListener('online', () => {
  refreshBackendStatus().then(() => { flushScoreQueue(); updateOnlineUI(); });
});
window.addEventListener('offline', () => {
  _backendOnline = false;
  updateOnlineUI();
});

// --- Avatar & Cute Name System ---
function hashUUID(uuid) {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) - h + uuid.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateAvatar(uuid, size) {
  size = size || 64;
  const h = hashUUID(uuid);
  const bgColors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e','#e91e63','#00bcd4','#8bc34a','#ff5722'];
  const bg = bgColors[h % bgColors.length];
  const faceY = size * 0.42;
  const r = size * 0.38;
  // Eyes
  const eyeType = (h >> 4) % 5;
  const eyeL = size * 0.35;
  const eyeR = size * 0.65;
  const eyeY = faceY - r * 0.1;
  let eyes = '';
  if (eyeType === 0) { // dots
    eyes = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.045}" fill="#fff"/><circle cx="${eyeR}" cy="${eyeY}" r="${size*0.045}" fill="#fff"/>`;
  } else if (eyeType === 1) { // big round
    eyes = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.065}" fill="#fff"/><circle cx="${eyeR}" cy="${eyeY}" r="${size*0.065}" fill="#fff"/><circle cx="${eyeL+size*0.015}" cy="${eyeY-size*0.01}" r="${size*0.03}" fill="#333"/><circle cx="${eyeR+size*0.015}" cy="${eyeY-size*0.01}" r="${size*0.03}" fill="#333"/>`;
  } else if (eyeType === 2) { // happy (arcs)
    eyes = `<path d="M${eyeL-size*0.05} ${eyeY} Q${eyeL} ${eyeY-size*0.07} ${eyeL+size*0.05} ${eyeY}" stroke="#fff" stroke-width="${size*0.03}" fill="none" stroke-linecap="round"/><path d="M${eyeR-size*0.05} ${eyeY} Q${eyeR} ${eyeY-size*0.07} ${eyeR+size*0.05} ${eyeY}" stroke="#fff" stroke-width="${size*0.03}" fill="none" stroke-linecap="round"/>`;
  } else if (eyeType === 3) { // wink
    eyes = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.05}" fill="#fff"/><path d="M${eyeR-size*0.05} ${eyeY} Q${eyeR} ${eyeY-size*0.06} ${eyeR+size*0.05} ${eyeY}" stroke="#fff" stroke-width="${size*0.03}" fill="none" stroke-linecap="round"/>`;
  } else { // star eyes
    eyes = `<text x="${eyeL}" y="${eyeY+size*0.02}" text-anchor="middle" font-size="${size*0.12}" fill="#fff">★</text><text x="${eyeR}" y="${eyeY+size*0.02}" text-anchor="middle" font-size="${size*0.12}" fill="#fff">★</text>`;
  }
  // Mouth
  const mouthType = (h >> 8) % 5;
  const mouthY = faceY + r * 0.35;
  let mouth = '';
  if (mouthType === 0) { // smile
    mouth = `<path d="M${size*0.38} ${mouthY} Q${size*0.5} ${mouthY+size*0.1} ${size*0.62} ${mouthY}" stroke="#fff" stroke-width="${size*0.025}" fill="none" stroke-linecap="round"/>`;
  } else if (mouthType === 1) { // big grin
    mouth = `<path d="M${size*0.35} ${mouthY} Q${size*0.5} ${mouthY+size*0.15} ${size*0.65} ${mouthY}" stroke="#fff" stroke-width="${size*0.025}" fill="rgba(255,255,255,0.2)" stroke-linecap="round"/>`;
  } else if (mouthType === 2) { // O mouth
    mouth = `<circle cx="${size*0.5}" cy="${mouthY+size*0.02}" rx="${size*0.05}" ry="${size*0.06}" fill="rgba(255,255,255,0.25)" stroke="#fff" stroke-width="${size*0.02}"/>`;
  } else if (mouthType === 3) { // cat mouth
    mouth = `<path d="M${size*0.42} ${mouthY} L${size*0.5} ${mouthY+size*0.06} L${size*0.58} ${mouthY}" stroke="#fff" stroke-width="${size*0.02}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else { // flat
    mouth = `<line x1="${size*0.4}" y1="${mouthY}" x2="${size*0.6}" y2="${mouthY}" stroke="#fff" stroke-width="${size*0.025}" stroke-linecap="round"/>`;
  }
  // Accessory
  const accType = (h >> 12) % 7;
  let acc = '';
  if (accType === 1) { // blush
    acc = `<circle cx="${eyeL-size*0.02}" cy="${eyeY+size*0.1}" r="${size*0.05}" fill="rgba(255,150,150,0.35)"/><circle cx="${eyeR+size*0.02}" cy="${eyeY+size*0.1}" r="${size*0.05}" fill="rgba(255,150,150,0.35)"/>`;
  } else if (accType === 2) { // glasses
    acc = `<circle cx="${eyeL}" cy="${eyeY}" r="${size*0.09}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="${size*0.015}"/><circle cx="${eyeR}" cy="${eyeY}" r="${size*0.09}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="${size*0.015}"/><line x1="${eyeL+size*0.09}" y1="${eyeY}" x2="${eyeR-size*0.09}" y2="${eyeY}" stroke="rgba(255,255,255,0.5)" stroke-width="${size*0.015}"/>`;
  } else if (accType === 3) { // hat
    acc = `<rect x="${size*0.25}" y="${size*0.05}" width="${size*0.5}" height="${size*0.13}" rx="${size*0.03}" fill="rgba(255,255,255,0.25)"/><rect x="${size*0.15}" y="${size*0.15}" width="${size*0.7}" height="${size*0.04}" rx="${size*0.02}" fill="rgba(255,255,255,0.25)"/>`;
  } else if (accType === 4) { // bow
    acc = `<path d="M${size*0.5} ${size*0.12} L${size*0.38} ${size*0.05} L${size*0.5} ${size*0.12} L${size*0.62} ${size*0.05} Z" fill="rgba(255,200,200,0.5)"/><circle cx="${size*0.5}" cy="${size*0.12}" r="${size*0.025}" fill="rgba(255,200,200,0.7)"/>`;
  } else if (accType === 5) { // freckles
    acc = `<circle cx="${eyeL+size*0.02}" cy="${eyeY+size*0.12}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/><circle cx="${eyeL-size*0.03}" cy="${eyeY+size*0.1}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/><circle cx="${eyeR-size*0.02}" cy="${eyeY+size*0.12}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/><circle cx="${eyeR+size*0.03}" cy="${eyeY+size*0.1}" r="${size*0.012}" fill="rgba(255,255,255,0.3)"/>`;
  } else if (accType === 6) { // rosy cheeks + sparkle
    acc = `<circle cx="${eyeL-size*0.04}" cy="${eyeY+size*0.1}" r="${size*0.04}" fill="rgba(255,200,200,0.3)"/><circle cx="${eyeR+size*0.04}" cy="${eyeY+size*0.1}" r="${size*0.04}" fill="rgba(255,200,200,0.3)"/><text x="${size*0.78}" y="${size*0.2}" font-size="${size*0.1}" fill="rgba(255,255,255,0.6)">✦</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size*0.15}" fill="${bg}"/><circle cx="${size*0.5}" cy="${faceY}" r="${r}" fill="rgba(255,255,255,0.12)"/>${eyes}${mouth}${acc}</svg>`;
}


function generateCuteName(uuid) {
  const h = hashUUID(uuid);
  const adjs = t('cute_adj');
  const anis = t('cute_ani');
  const adj = adjs[h % adjs.length];
  const ani = anis[(h >> 8) % anis.length];
  return currentLang === 'zh' ? (adj + ani) : (adj + ' ' + ani);
}

// Dragging state
let dragPiece = null;
let dragOffsetRow = 0;
let dragOffsetCol = 0;
let dragFromBoard = false; // true when dragging a piece off the board
let dragPointerId = null;  // for pointer capture
let selectedPiece = null;  // tap-to-select mode for mobile
let dragStartX = 0;
let dragStartY = 0;
const TAP_THRESHOLD = 10; // px - distinguish tap from drag

