'use strict';

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

// --- Puzzle data: 88 offline puzzles + API fetch for online ---
let PUZZLE_API; // set after config is loaded
const TOTAL_PUZZLE_COUNT = 91024;
const OFFLINE_PUZZLE_NUMS = [1,1035,2069,3104,4138,5172,6207,7241,8275,9310,10344,11379,12413,13447,14482,15516,16550,17585,18619,19653,20688,21722,22757,23791,24825,25860,26894,27928,28963,29997,31031,32066,33100,34135,35169,36203,37238,38272,39306,40341,41375,42409,43444,44478,45513,46547,47581,48616,49650,50684,51719,52753,53787,54822,55856,56891,57925,58959,59994,61028,62062,63097,64131,65165,66200,67234,68269,69303,70337,71372,72406,73440,74475,75509,76543,77578,78612,79647,80681,81715,82750,83784,84818,85853,86887,87921,88956,89990];
const OFFLINE_CELLS = '!"#$%&!5=\\]^"*2IJK#08PX`#WXIJK$:;BCD$X`345,348@H,YZ$%&48@VWX4T\\,-.(08@HP(FE9AI0/.#+38_^[ZY8RZ#+3@-5,4<@ZY6>F?6>^]\\?!)@HP>^]JRZ>:9?GO`_^]\\[`LD%$#_WO876^QI1)!^*)876]GF?>=])!NMLUNMIA9U(\']\\[MIA+*)M-%UTSYQIA91Y;<H@8QRS^VNI"#&\'(I/\'^VNATLUMEA\'(KC;BKC#$%B`XA91C#$7/\'CGHB:2(\'&%$#(4<]\\[\'/7PON&)1IQY&RQPON%?>GFE%QY654-6519A-`_%$#519SRQ5U]-,+`XPH@8`>=A91XWV[SKP\'&#"!P*"[SKHUMTLDH"!NF>GNF&%$GYQH@8F&%2*"FBAG?7YZ[\\]^YME$%&ZRJ123[XP80([/0123\\BC:;<\\0(KLMTKLPH@T!"\\]^LPH./0L,$TUV!)19AI!CD@HP)*+&.61Z[^_`1W_&.69,4-5=9_`3;C:3;[\\]:(09AI;[\\OW_;?@:BJ';
const PUZZLE_COUNT = TOTAL_PUZZLE_COUNT;

// Decode offline puzzle cells from packed string
const _OFFLINE_MAP = {};
for (let i = 0; i < OFFLINE_PUZZLE_NUMS.length; i++) {
  const o = i * 6;
  _OFFLINE_MAP[OFFLINE_PUZZLE_NUMS[i]] = [
    OFFLINE_CELLS.charCodeAt(o) - 33, OFFLINE_CELLS.charCodeAt(o+1) - 33,
    OFFLINE_CELLS.charCodeAt(o+2) - 33, OFFLINE_CELLS.charCodeAt(o+3) - 33,
    OFFLINE_CELLS.charCodeAt(o+4) - 33, OFFLINE_CELLS.charCodeAt(o+5) - 33,
  ];
}

// Puzzle cell cache (puzzle_number -> [6 cell indices])
const _puzzleCache = {..._OFFLINE_MAP};

// Get puzzle cells: offline lookup or API fetch
async function getPuzzleCells(puzzleNumber) {
  if (_puzzleCache[puzzleNumber]) return _puzzleCache[puzzleNumber];
  try {
    const res = await fetch(PUZZLE_API + puzzleNumber);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    _puzzleCache[puzzleNumber] = data.cells;
    return data.cells;
  } catch (e) {
    console.warn('Puzzle fetch failed for #' + puzzleNumber + ':', e.message);
    // Fall back to nearest offline puzzle
    const fallback = OFFLINE_PUZZLE_NUMS.reduce((a, b) =>
      Math.abs(b - puzzleNumber) < Math.abs(a - puzzleNumber) ? b : a);
    currentPuzzleNumber = fallback;
    document.getElementById('puzzle-input').value = puzzleNumberToDisplay(fallback);
    return _OFFLINE_MAP[fallback];
  }
}

// Check if backend is reachable (cached result, refreshed periodically)
let _backendOnline = null; // null = unknown, true/false = checked
let _healthCheckPromise = null;

async function checkBackendHealth() {
  try {
    const res = await fetch(WORKER_URL + '/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch { return false; }
}

function refreshBackendStatus() {
  if (_healthCheckPromise) return _healthCheckPromise;
  _healthCheckPromise = checkBackendHealth().then(ok => {
    const prev = _backendOnline;
    _backendOnline = ok;
    _healthCheckPromise = null;
    if (ok !== prev) {
      const max = getMaxPuzzleNumber();
      document.getElementById('wp-puzzle-total').textContent = '/ ' + max;
      const wpInput = document.getElementById('wp-puzzle-input');
      if (wpInput) wpInput.max = max;
      initPuzzleSelect();
    }
    return ok;
  });
  return _healthCheckPromise;
}

function isOnline() { return _backendOnline === true; }

// Get a valid puzzle number for current mode
function getRandomPuzzleNumber() {
  if (isOnline()) return Math.floor(Math.random() * TOTAL_PUZZLE_COUNT) + 1;
  return OFFLINE_PUZZLE_NUMS[Math.floor(Math.random() * OFFLINE_PUZZLE_NUMS.length)];
}

function getMaxPuzzleNumber() {
  return isOnline() ? TOTAL_PUZZLE_COUNT : OFFLINE_PUZZLE_NUMS.length;
}

// Convert display index (1-based) to puzzle number
function displayToPuzzleNumber(displayVal) {
  if (isOnline()) return displayVal;
  const idx = Math.max(0, Math.min(displayVal - 1, OFFLINE_PUZZLE_NUMS.length - 1));
  return OFFLINE_PUZZLE_NUMS[idx];
}

function puzzleNumberToDisplay(puzzleNumber) {
  if (isOnline()) return puzzleNumber;
  const idx = OFFLINE_PUZZLE_NUMS.indexOf(puzzleNumber);
  return idx >= 0 ? idx + 1 : 1;
}

const BOARD_SIZE = 8;
const PIECE_CELL_PX = 28;


// Backtracking solver for hint (non-grey pieces, sorted largest first)
const SOLVER_PIECES = [
  { id: 'blue2',  base: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3]] },
  { id: 'blue1',  base: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,2],[1,3],[1,4]] },
  { id: 'yel1',   base: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]] },
  { id: 'yel2',   base: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]] },
  { id: 'red1',   base: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]] },
  { id: 'white1', base: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { id: 'red2',   base: [[0,0],[0,1],[0,2],[0,3]] },
  { id: 'white2', base: [[0,0],[0,1],[1,0],[1,1]] },
];

function solverGetRotations(cells) {
  const seen = new Set(), results = [];
  let cur = cells;
  for (let r = 0; r < 4; r++) {
    const minR = Math.min(...cur.map(c => c[0]));
    const minC = Math.min(...cur.map(c => c[1]));
    const norm = cur.map(c => [c[0] - minR, c[1] - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const key = norm.toString();
    if (!seen.has(key)) { seen.add(key); results.push(norm); }
    cur = cur.map(c => [c[1], -c[0]]);
  }
  return results;
}

const SOLVER_SHAPES = SOLVER_PIECES.map(p => ({
  id: p.id,
  rotations: solverGetRotations(p.base)
}));

function solvePuzzle(greyBoard) {
  const bd = greyBoard.map(r => [...r]);
  const placed = new Array(SOLVER_SHAPES.length).fill(false);

  function solve() {
    let er = -1, ec = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!bd[r][c]) { er = r; ec = c; r = 8; break; }
      }
    }
    if (er === -1) return true;

    for (let pi = 0; pi < SOLVER_SHAPES.length; pi++) {
      if (placed[pi]) continue;
      const sp = SOLVER_SHAPES[pi];
      for (const rot of sp.rotations) {
        for (const [ar, ac] of rot) {
          const offR = er - ar, offC = ec - ac;
          let fits = true;
          for (const [sr, sc] of rot) {
            const r = sr + offR, c = sc + offC;
            if (r < 0 || r >= 8 || c < 0 || c >= 8 || bd[r][c]) { fits = false; break; }
          }
          if (!fits) continue;
          placed[pi] = true;
          for (const [sr, sc] of rot) bd[sr + offR][sc + offC] = sp.id;
          if (solve()) return true;
          placed[pi] = false;
          for (const [sr, sc] of rot) bd[sr + offR][sc + offC] = null;
        }
      }
    }
    return false;
  }

  solve();
  return bd;
}




// Taglines, facts, quotes, nicknames — all loaded from translations.json

let currentLang = localStorage.getItem('octile_lang') || (/^(zh|ko|ja)/.test(navigator.language) ? 'zh' : 'en');
let motivationShown = false;
let motivationTimeout = null;

function getTaglines() { return t('taglines'); }
function getWinFacts() { return t('win_facts'); }
function getMotivationQuotes() { return t('motivation_quotes'); }

let board = []; // 8x8, null or pieceId string
let pieces = [];
let timerInterval = null;
let startTime = 0;
let elapsed = 0;
let elapsedBeforePause = 0;
let paused = false;
let gameOver = false;
let currentPuzzleNumber = 1;
let currentSolution = null; // 8x8 array of piece IDs for hint
let hintTimeout = null;
const MAX_HINTS = 3;

function getDailyHints() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem('octile_daily_hints') || '{}');
    if (raw.date === today) return raw;
  } catch {}
  return { date: today, used: 0 };
}

function saveDailyHints(data) {
  localStorage.setItem('octile_daily_hints', JSON.stringify(data));
}

function getHintsUsedToday() {
  return getDailyHints().used;
}

function useHint() {
  const data = getDailyHints();
  data.used++;
  saveDailyHints(data);
}

function resetDailyHints() {
  const today = new Date().toISOString().slice(0, 10);
  saveDailyHints({ date: today, used: 0 });
}
let timerStarted = false;
let piecesPlacedCount = 0; // track for tutorial

// --- API endpoints ---
const WORKER_URL = 'https://octile.owen-ouyang.workers.dev';
const SCORE_API_URL = WORKER_URL + '/score';
PUZZLE_API = WORKER_URL + '/puzzle/';
const SITE_URL = 'https://mtaleon.github.io/octile/';
const APP_VERSION_CODE = 8;
const APP_VERSION_NAME = '1.7.0';

// --- Cloudflare Turnstile (invisible, loaded only on valid web origins) ---
const CF_TURNSTILE_SITE_KEY = '0x4AAAAAACuir272GuoMUfnx';  // Set to your Turnstile site key
let _turnstileToken = null;
let _turnstileReady = false;

function _shouldLoadTurnstile() {
  if (!CF_TURNSTILE_SITE_KEY || !WORKER_URL) return false;
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
    'error-callback': () => { console.warn('[Octile] Turnstile challenge failed'); _turnstileReady = false; },
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
      if (!data || data.versionCode <= APP_VERSION_CODE) return;
      const dismissed = localStorage.getItem('update_dismissed_v' + data.versionCode);
      if (dismissed) return;
      const lang = currentLang || 'en';
      const notes = (data.releaseNotes && data.releaseNotes[lang]) || data.releaseNotes?.en || '';
      document.getElementById('update-text').textContent = t('update_available') + (notes ? ' — ' + notes : '');
      document.getElementById('update-btn').textContent = t('update_btn');
      document.getElementById('update-dismiss').textContent = t('update_later');
      const url = data.playStoreUrl || data.apkUrl;
      document.getElementById('update-btn').onclick = () => { if (url) window.open(url, '_blank'); };
      document.getElementById('update-dismiss').onclick = () => {
        document.getElementById('update-banner').classList.remove('show');
        localStorage.setItem('update_dismissed_v' + data.versionCode, '1');
      };
      document.getElementById('update-banner').classList.add('show');
    });
}
setTimeout(checkForUpdate, 3000);

function getBrowserUUID() {
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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
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
      _flushTimer = setTimeout(() => { _flushTimer = null; flushScoreQueue(); }, 35000);
    }
  } catch {
    // Failed — retry later (on next solve or online event)
  }
}

async function submitScore(puzzleNumber, resolveTime) {
  const entry = {
    puzzle_number: puzzleNumber,
    resolve_time: resolveTime,
    browser_uuid: getBrowserUUID(),
    solution: encodeSolution(),
    timestamp_utc: new Date().toISOString(), // legacy: keeps compat with old server
  };
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
      _flushTimer = setTimeout(() => { _flushTimer = null; flushScoreQueue(); }, 35000);
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

// --- Lazy Timer ---
function ensureTimerRunning() {
  if (timerStarted || gameOver || paused) return;
  timerStarted = true;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = elapsedBeforePause + Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
  }, 250);
  document.getElementById('pause-btn').style.display = '';
}

function pauseGame() {
  if (!timerStarted || gameOver || paused) return;
  paused = true;
  clearInterval(timerInterval);
  timerInterval = null;
  elapsedBeforePause = elapsed;
  document.getElementById('pause-overlay').classList.add('show');
  document.getElementById('timer').style.opacity = '0.4';
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = elapsedBeforePause + Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('timer').textContent = formatTime(elapsed);
  }, 250);
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('timer').style.opacity = '';
}

function rotateShape(shape) {
  const rows = shape.length, cols = shape[0].length;
  const rotated = [];
  for (let c = 0; c < cols; c++) {
    rotated[c] = [];
    for (let r = rows - 1; r >= 0; r--) {
      rotated[c].push(shape[r][c]);
    }
  }
  return rotated;
}

function initBoard() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));
}

function canPlace(shape, startR, startC, ignorePieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const br = startR + r, bc = startC + c;
      if (br < 0 || br >= 8 || bc < 0 || bc >= 8) return false;
      if (board[br][bc] !== null && board[br][bc] !== ignorePieceId) return false;
    }
  }
  return true;
}

function placePiece(shape, startR, startC, pieceId) {
  const rows = shape.length, cols = shape[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      board[startR + r][startC + c] = pieceId;
    }
  }
}

function removePiece(pieceId) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === pieceId) board[r][c] = null;
    }
  }
}

function getPieceById(id) {
  return pieces.find(p => p.id === id);
}

function getColorForCell(r, c) {
  const pid = board[r][c];
  if (!pid) return null;
  const p = getPieceById(pid);
  return p ? p.color : null;
}

// Load a puzzle by number (1-based)
async function loadPuzzle(puzzleNumber) {
  const cellIndices = await getPuzzleCells(puzzleNumber);
  // cellIndices: [g1, g2a, g2b, g3a, g3b, g3c]
  const greyCells = {
    grey1: [cellIndices[0]],
    grey2: [cellIndices[1], cellIndices[2]],
    grey3: [cellIndices[3], cellIndices[4], cellIndices[5]],
  };
  currentSolution = null; // solved lazily on hint
  initBoard();
  const greys = pieces.filter(p => p.auto);
  for (const g of greys) {
    const indices = greyCells[g.id];
    if (!indices) continue;
    const cells = indices.map(i => [Math.floor(i / 8), i % 8]);
    const minR = Math.min(...cells.map(c => c[0]));
    const minC = Math.min(...cells.map(c => c[1]));
    const maxR = Math.max(...cells.map(c => c[0]));
    const maxC = Math.max(...cells.map(c => c[1]));
    const rows = maxR - minR + 1, cols = maxC - minC + 1;
    const shape = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const [r, c] of cells) shape[r - minR][c - minC] = 1;
    g.currentShape = shape;
    g.placed = true;
    g.boardR = minR;
    g.boardC = minC;
    placePiece(shape, minR, minC, g.id);
  }
}

function updateHintBtn() {
  const btn = document.getElementById('hint-btn');
  const left = MAX_HINTS - getHintsUsedToday();
  btn.textContent = t('hint') + ' (' + left + ')';
  btn.disabled = left <= 0;
  btn.style.opacity = left <= 0 ? '0.4' : '';
  btn.style.cursor = left <= 0 ? 'default' : 'pointer';
}

function showHint() {
  if (gameOver || hintTimeout || getHintsUsedToday() >= MAX_HINTS) return;
  // Solve lazily on first hint request
  if (!currentSolution) {
    const greyBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const pid = board[r][c];
        if (pid && (pid === 'grey1' || pid === 'grey2' || pid === 'grey3'))
          greyBoard[r][c] = pid;
      }
    currentSolution = solvePuzzle(greyBoard);
  }
  if (!currentSolution) return;

  // Pick one random unplaced non-grey piece
  const unplaced = pieces.filter(p => !p.auto && !p.placed);
  if (unplaced.length === 0) return;
  const hintPiece = unplaced[Math.floor(Math.random() * unplaced.length)];

  // Find that piece's cells in the solution
  const hintCells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (currentSolution[r][c] === hintPiece.id) hintCells.push([r, c]);

  // Flash those cells on the board as ghost overlays
  const boardEl = document.getElementById('board');
  const overlays = [];
  for (const [r, c] of hintCells) {
    const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (!cell) continue;
    cell.classList.add('hint-flash');
    cell.dataset.hintColor = hintPiece.color;
    overlays.push(cell);
  }

  useHint();
  updateHintBtn();

  hintTimeout = setTimeout(() => {
    overlays.forEach(cell => {
      cell.classList.remove('hint-flash');
      delete cell.dataset.hintColor;
    });
    hintTimeout = null;
  }, 800);
}

function initPuzzleSelect() {
  const max = getMaxPuzzleNumber();
  const input = document.getElementById('puzzle-input');
  input.max = max;
  document.getElementById('puzzle-total').textContent = '/ ' + max;
}

async function loadSelectedPuzzle() {
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const input = document.getElementById('puzzle-input');
  const max = getMaxPuzzleNumber();
  let val = parseInt(input.value);
  if (isNaN(val) || val < 1) val = 1;
  if (val > max) val = max;
  input.value = val;
  currentPuzzleNumber = isOnline() ? val : OFFLINE_PUZZLE_NUMS[val - 1];
  await resetGame(currentPuzzleNumber);
}

async function loadRandomPuzzle() {
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const num = getRandomPuzzleNumber();
  document.getElementById('puzzle-input').value = puzzleNumberToDisplay(num);
  currentPuzzleNumber = num;
  await resetGame(num);
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      const pid = board[r][c];
      if (pid) {
        const color = getColorForCell(r, c);
        cell.classList.add('occupied');
        cell.dataset.color = color;
        cell.dataset.pieceId = pid;
        // Piece outline borders: add border where neighbor is different piece or edge
        if (r === 0 || board[r-1][c] !== pid) cell.classList.add('border-top');
        if (r === 7 || board[r+1][c] !== pid) cell.classList.add('border-bottom');
        if (c === 0 || board[r][c-1] !== pid) cell.classList.add('border-left');
        if (c === 7 || board[r][c+1] !== pid) cell.classList.add('border-right');
        // Allow dragging non-grey pieces off the board
        const piece = getPieceById(pid);
        if (piece && !piece.auto) {
          cell.addEventListener('pointerdown', (e) => startDragFromBoard(e, piece));
        }
      }
      // Tap empty cell to place selected piece
      if (!pid && !gameOver) {
        cell.addEventListener('pointerup', (e) => onBoardCellTap(e, r, c));
      }
      boardEl.appendChild(cell);
    }
  }
  // Show preview for selected piece on board
  if (selectedPiece && !selectedPiece.placed) {
    updateSelectedPreview();
  }
}

function onBoardCellTap(e, row, col) {
  if (paused) return;
  if (!selectedPiece || selectedPiece.placed || dragPiece) return;
  ensureTimerRunning();
  const shape = selectedPiece.currentShape;
  const rows = shape.length, cols = shape[0].length;
  // Place piece centered on tapped cell
  const startR = Math.max(0, Math.min(row - Math.floor(rows / 2), 8 - rows));
  const startC = Math.max(0, Math.min(col - Math.floor(cols / 2), 8 - cols));
  if (canPlace(shape, startR, startC, null)) {
    placePiece(shape, startR, startC, selectedPiece.id);
    selectedPiece.placed = true;
    selectedPiece = null;
    piecesPlacedCount++;
    renderBoard();
    renderPool();
    checkWin();
    showTutorialHint2(); maybeCompleteTutorial();
  }
}

function updateSelectedPreview() {
  // No persistent preview for tap mode - user taps to place
}

function selectPiece(piece) {
  if (selectedPiece === piece) {
    // Already selected — rotate it
    piece.currentShape = rotateShape(piece.currentShape);
  } else {
    selectedPiece = piece;
  }
  renderPool();
}

function renderPool() {
  const poolEl = document.getElementById('pool');
  poolEl.innerHTML = '';
  pieces.filter(p => !p.auto).forEach(p => {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-wrapper';

    const el = document.createElement('div');
    el.className = 'piece' + (p.placed ? ' placed' : '') + (selectedPiece === p ? ' selected' : '');
    el.dataset.id = p.id;
    const shape = p.currentShape;
    const rows = shape.length, cols = shape[0].length;
    el.style.gridTemplateColumns = `repeat(${cols}, ${PIECE_CELL_PX}px)`;
    el.style.gridTemplateRows = `repeat(${rows}, ${PIECE_CELL_PX}px)`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        if (shape[r][c]) {
          cell.dataset.color = p.color;
        } else {
          cell.style.visibility = 'hidden';
        }
        el.appendChild(cell);
      }
    }

    // Tap to select OR drag to place
    if (!p.placed) {
      el.addEventListener('pointerdown', (e) => onPiecePointerDown(e, p));
    }

    wrapper.appendChild(el);
    poolEl.appendChild(wrapper);
  });
}

function getCellSize() {
  const boardEl = document.getElementById('board');
  const rect = boardEl.getBoundingClientRect();
  // account for padding (3px each side) and gaps (7 gaps * 2px)
  return (rect.width - 6 - 14) / 8;
}

function buildGhost(piece) {
  const shape = piece.currentShape;
  const rows = shape.length, cols = shape[0].length;
  const ghost = document.getElementById('drag-ghost');
  const cellSize = getCellSize();
  ghost.style.setProperty('--cell-size', cellSize + 'px');
  ghost.style.display = 'grid';
  ghost.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  ghost.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
  ghost.style.gap = '2px';
  ghost.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      if (shape[r][c]) {
        cell.dataset.color = piece.color;
      } else {
        cell.style.visibility = 'hidden';
      }
      cell.style.width = cellSize + 'px';
      cell.style.height = cellSize + 'px';
      ghost.appendChild(cell);
    }
  }
}

function capturePointer(e) {
  dragPointerId = e.pointerId;
  // Capture on a persistent element so events survive re-renders
  const boardEl = document.getElementById('board');
  try { boardEl.setPointerCapture(e.pointerId); } catch (err) { console.warn('Pointer capture failed:', err.message); }
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragCancel);
}

function releasePointer() {
  if (dragPointerId !== null) {
    const boardEl = document.getElementById('board');
    try { boardEl.releasePointerCapture(dragPointerId); } catch (err) { console.warn('Pointer release failed:', err.message); }
    dragPointerId = null;
  }
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', onDragEnd);
  document.removeEventListener('pointercancel', onDragCancel);
}

function onDragCancel(e) {
  if (!dragPiece) return;
  releasePointer();
  const ghost = document.getElementById('drag-ghost');
  ghost.style.display = 'none';
  clearPreview();
  // Return piece to pool if it was dragged from board
  if (dragFromBoard) {
    dragPiece.placed = false;
  }
  renderBoard();
  renderPool();
  dragPiece = null;
  dragFromBoard = false;
}

function startDragFromBoard(e, piece) {
  if (gameOver || paused) return;
  ensureTimerRunning();
  e.preventDefault();
  selectedPiece = null;
  dragPiece = piece;
  dragFromBoard = true;

  // Figure out offset based on which cell of the piece was clicked
  const clickedR = parseInt(e.currentTarget.dataset.row);
  const clickedC = parseInt(e.currentTarget.dataset.col);
  // Find top-left of this piece on the board
  let minR = 8, minC = 8;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === piece.id) {
        if (r < minR) minR = r;
        if (c < minC) minC = c;
      }
    }
  }
  dragOffsetRow = clickedR - minR;
  dragOffsetCol = clickedC - minC;

  // Capture pointer BEFORE re-rendering destroys the target element
  capturePointer(e);

  // Remove piece from board
  removePiece(piece.id);
  renderBoard();

  buildGhost(piece);
  moveGhost(e.clientX, e.clientY);
}

function onPiecePointerDown(e, piece) {
  if (gameOver || paused) return;
  ensureTimerRunning();
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // Store piece and offset info for potential drag
  const shape = piece.currentShape;
  const cols = shape[0].length;
  const pieceEl = e.currentTarget;
  const rect = pieceEl.getBoundingClientRect();
  const cellW = PIECE_CELL_PX + 1;
  const relX = e.clientX - rect.left;
  const relY = e.clientY - rect.top;
  const offC = Math.min(Math.floor(relX / cellW), cols - 1);
  const offR = Math.min(Math.floor(relY / cellW), shape.length - 1);

  // Use a pending state: start actual drag only after movement threshold
  let started = false;
  const onMove = (me) => {
    const dx = me.clientX - dragStartX;
    const dy = me.clientY - dragStartY;
    if (!started && Math.sqrt(dx*dx + dy*dy) > TAP_THRESHOLD) {
      started = true;
      // Begin real drag
      dragPiece = piece;
      dragFromBoard = false;
      dragOffsetCol = offC;
      dragOffsetRow = offR;
      selectedPiece = null;
      buildGhost(piece);
      moveGhost(me.clientX, me.clientY);
      renderPool();
    }
    if (started) {
      me.preventDefault();
      moveGhost(me.clientX, me.clientY);
      const { row, col } = getBoardPosForGhost(me.clientX, me.clientY);
      if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        showPreview(dragPiece, row, col);
      } else {
        clearPreview();
      }
    }
  };
  const onUp = (ue) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (!started) {
      // It was a tap — select/deselect piece
      selectPiece(piece);
    } else {
      // End drag
      const ghost = document.getElementById('drag-ghost');
      ghost.style.display = 'none';
      clearPreview();
      const { row, col } = getBoardPosForGhost(ue.clientX, ue.clientY);
      const sh = dragPiece.currentShape;
      const startR = row - dragOffsetRow;
      const startC = col - dragOffsetCol;
      if (canPlace(sh, startR, startC, null)) {
        placePiece(sh, startR, startC, dragPiece.id);
        dragPiece.placed = true;
        piecesPlacedCount++;
        renderBoard();
        renderPool();
        checkWin();
        showTutorialHint2(); maybeCompleteTutorial();
      }
      dragPiece = null;
    }
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

function moveGhost(x, y) {
  const ghost = document.getElementById('drag-ghost');
  const cellSize = getCellSize();
  const gapSize = 2;
  const offsetX = dragOffsetCol * (cellSize + gapSize) + cellSize / 2;
  const offsetY = dragOffsetRow * (cellSize + gapSize) + cellSize / 2;
  // On touch devices, lift ghost above finger so it's visible
  const touchLift = ('ontouchstart' in window) ? 60 : 0;
  ghost.style.left = (x - offsetX) + 'px';
  ghost.style.top = (y - offsetY - touchLift) + 'px';
}

function getBoardPosForGhost(x, y) {
  // Account for touch lift when calculating board position
  const touchLift = ('ontouchstart' in window) ? 60 : 0;
  return getBoardPos(x, y - touchLift);
}

function getBoardPos(x, y) {
  const boardEl = document.getElementById('board');
  const rect = boardEl.getBoundingClientRect();
  const cellSize = getCellSize();
  const padGap = 3; // padding
  const gap = 2;
  const relX = x - rect.left - padGap;
  const relY = y - rect.top - padGap;
  const col = Math.floor(relX / (cellSize + gap));
  const row = Math.floor(relY / (cellSize + gap));
  return { row, col };
}

function clearPreview() {
  document.querySelectorAll('.cell.preview-valid, .cell.preview-invalid').forEach(c => {
    c.classList.remove('preview-valid', 'preview-invalid');
  });
}

function showPreview(piece, boardRow, boardCol) {
  clearPreview();
  const shape = piece.currentShape;
  const startR = boardRow - dragOffsetRow;
  const startC = boardCol - dragOffsetCol;
  const valid = canPlace(shape, startR, startC, null);
  const rows = shape.length, cols = shape[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue;
      const br = startR + r, bc = startC + c;
      if (br < 0 || br >= 8 || bc < 0 || bc >= 8) continue;
      const cell = document.querySelector(`.cell[data-row="${br}"][data-col="${bc}"]`);
      if (cell) cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
    }
  }
}

function onDragMove(e) {
  if (!dragPiece) return;
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);

  const { row, col } = getBoardPosForGhost(e.clientX, e.clientY);
  if (row >= 0 && row < 8 && col >= 0 && col < 8) {
    showPreview(dragPiece, row, col);
  } else {
    clearPreview();
  }
}

function onDragEnd(e) {
  if (!dragPiece) return;
  e.preventDefault();
  releasePointer();

  const ghost = document.getElementById('drag-ghost');
  ghost.style.display = 'none';
  clearPreview();

  const { row, col } = getBoardPosForGhost(e.clientX, e.clientY);
  const shape = dragPiece.currentShape;
  const startR = row - dragOffsetRow;
  const startC = col - dragOffsetCol;

  if (canPlace(shape, startR, startC, null)) {
    placePiece(shape, startR, startC, dragPiece.id);
    dragPiece.placed = true;
    piecesPlacedCount++;
    renderBoard();
    renderPool();
    checkWin();
    showTutorialHint2(); maybeCompleteTutorial();
  } else if (dragFromBoard) {
    // Dropped outside or invalid spot — return to pool
    dragPiece.placed = false;
    renderBoard();
    renderPool();
  }

  dragPiece = null;
  dragFromBoard = false;
}

function getSolvedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('octile_solved') || '[]')); }
  catch { return new Set(); }
}

function saveSolvedSet(s) {
  localStorage.setItem('octile_solved', JSON.stringify([...s]));
}

function getWinMotivation(totalUnique, isFirstClear, isNewBest, prevBest, elapsed, improvement) {
  const msgs = [];
  // First time solving this puzzle
  if (isFirstClear) {
    msgs.push(...t('motiv_first_clear'));
  }
  // New personal best (on re-solve)
  if (!isFirstClear && isNewBest) {
    const saved = improvement;
    if (saved >= 60) {
      msgs.push(...t('motiv_big_improve').map(s => s.replace('{saved}', formatTime(saved))));
    } else if (saved > 0) {
      msgs.push(...t('motiv_improve').map(s => s.replace('{saved}', saved + 's')));
    }
  }
  // Speed achievements
  if (elapsed <= 30) msgs.push(...t('motiv_speed_30'));
  else if (elapsed <= 60) msgs.push(...t('motiv_speed_60'));
  // Milestone achievements
  if (totalUnique === 1) msgs.push(...t('motiv_first'));
  else if (totalUnique === 10) msgs.push(...t('motiv_10'));
  else if (totalUnique === 50) msgs.push(...t('motiv_50'));
  else if (totalUnique === 100) msgs.push(...t('motiv_100'));
  else if (totalUnique === 500) msgs.push(...t('motiv_500'));
  else if (totalUnique === 1000) msgs.push(...t('motiv_1000'));
  else if (totalUnique % 100 === 0) msgs.push(...t('motiv_hundred').map(s => s.replace('{n}', totalUnique)));
  // Progress
  const pct = (totalUnique / TOTAL_PUZZLE_COUNT * 100).toFixed(1);
  if (totalUnique > 1 && !msgs.length) {
    msgs.push(...t('motiv_progress').map(s => s.replace('{n}', totalUnique).replace('{pct}', pct)));
  }
  return msgs.length ? msgs[Math.floor(Math.random() * msgs.length)] : '';
}

// --- Energy System ---
const ENERGY_MAX = 25;
const ENERGY_RECOVERY_PERIOD = 4 * 60 * 60; // 4 hours in seconds
const ENERGY_PER_SECOND = ENERGY_MAX / ENERGY_RECOVERY_PERIOD;

function getEnergyState() {
  try {
    const raw = localStorage.getItem('octile_energy');
    if (raw) {
      const state = JSON.parse(raw);
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - state.ts) / 1000);
      const recovered = elapsedSec * ENERGY_PER_SECOND;
      const points = Math.min(ENERGY_MAX, state.points + recovered);
      return { points, ts: now };
    }
  } catch (e) {}
  return { points: ENERGY_MAX, ts: Date.now() };
}

function saveEnergyState(points) {
  localStorage.setItem('octile_energy', JSON.stringify({ points, ts: Date.now() }));
}

function deductEnergy(cost) {
  const state = getEnergyState();
  const newPoints = Math.max(0, state.points - cost);
  saveEnergyState(newPoints);
  updateEnergyDisplay();
}

function hasEnoughEnergy() {
  return getEnergyState().points >= 1;
}

function energyCost(elapsedSec) {
  if (elapsedSec <= 60) return 1;
  if (elapsedSec <= 120) return 2;
  if (elapsedSec <= 180) return 3;
  if (elapsedSec <= 300) return 4;
  return 5;
}

function updateEnergyDisplay() {
  const state = getEnergyState();
  const pts = state.points;
  const display = document.getElementById('energy-display');
  const valueEl = document.getElementById('energy-value');
  valueEl.textContent = Math.floor(pts);
  display.classList.remove('low', 'empty');
  if (pts <= 0) display.classList.add('empty');
  else if (pts < 10) display.classList.add('low');

  // Welcome panel energy status
  const wpStatus = document.getElementById('wp-energy-status');
  if (wpStatus) {
    const badgeClass = pts <= 0 ? 'empty' : pts < 10 ? 'low' : '';
    wpStatus.innerHTML = '<span>' + t('energy_title') + ': </span><span class="energy-badge ' + badgeClass + '">' + Math.floor(pts) + ' / ' + ENERGY_MAX + '</span>';
  }
}

function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem('octile_energy_day');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date === today) return data;
    }
  } catch (e) {}
  return { date: today, puzzles: 0, spent: 0 };
}

function updateDailyStats(cost) {
  const stats = getDailyStats();
  stats.puzzles += 1;
  stats.spent += cost;
  localStorage.setItem('octile_energy_day', JSON.stringify(stats));
}

function formatTimeHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function showEnergyModal(isOutOfEnergy) {
  const state = getEnergyState();
  const pts = state.points;

  const titleEl = document.getElementById('energy-modal-title');
  titleEl.textContent = isOutOfEnergy ? t('energy_out_title') : t('energy_title');

  const bar = document.getElementById('energy-bar');
  const pct = (pts / ENERGY_MAX) * 100;
  bar.style.width = pct + '%';
  bar.classList.remove('low', 'empty');
  if (pts <= 0) bar.classList.add('empty');
  else if (pts < 10) bar.classList.add('low');

  document.getElementById('energy-points-display').textContent = t('energy_points').replace('{pts}', pts.toFixed(1)).replace('{max}', ENERGY_MAX);

  // Recovery info
  const recoveryEl = document.getElementById('energy-recovery-info');
  if (pts >= ENERGY_MAX) {
    recoveryEl.textContent = t('energy_full_in').replace('{time}', '--:--:--');
    recoveryEl.style.display = 'none';
  } else {
    const secsToNext = Math.ceil((Math.ceil(pts) + 1 - pts) / ENERGY_PER_SECOND);
    const secsToFull = Math.ceil((ENERGY_MAX - pts) / ENERGY_PER_SECOND);
    recoveryEl.style.display = '';
    recoveryEl.innerHTML = t('energy_next_point').replace('{time}', formatTimeHMS(secsToNext)) +
      '<br>' + t('energy_full_in').replace('{time}', formatTimeHMS(secsToFull));
  }

  // Daily stats
  const stats = getDailyStats();
  document.getElementById('energy-daily-stats').textContent = t('energy_today').replace('{n}', stats.puzzles).replace('{cost}', stats.spent);

  // Tip
  const tipEl = document.getElementById('energy-tip');
  tipEl.textContent = isOutOfEnergy ? t('energy_out_msg') : t('energy_tip');
  tipEl.style.display = isOutOfEnergy || pts < 10 ? '' : 'none';

  document.getElementById('energy-modal').classList.add('show');
}

// --- Achievement System ---
const ACHIEVEMENTS = [
  // Milestone: unique puzzles solved
  { id: 'first_solve',   icon: '\uD83C\uDFAF', cat: 'milestone', check: s => s.unique >= 1 },
  { id: 'solve_10',      icon: '\u2B50',         cat: 'milestone', check: s => s.unique >= 10 },
  { id: 'solve_50',      icon: '\uD83C\uDF1F',   cat: 'milestone', check: s => s.unique >= 50 },
  { id: 'solve_100',     icon: '\uD83D\uDD25',   cat: 'milestone', check: s => s.unique >= 100 },
  { id: 'solve_500',     icon: '\uD83D\uDC8E',   cat: 'milestone', check: s => s.unique >= 500 },
  { id: 'solve_1000',    icon: '\uD83D\uDC51',   cat: 'milestone', check: s => s.unique >= 1000 },
  { id: 'solve_5000',    icon: '\uD83C\uDFC6',   cat: 'milestone', check: s => s.unique >= 5000 },
  { id: 'solve_all',     icon: '\uD83C\uDF0C',   cat: 'milestone', check: s => s.unique >= 91024 },
  // Speed
  { id: 'speed_60',      icon: '\u23F1\uFE0F',   cat: 'speed', check: s => s.elapsed <= 60 },
  { id: 'speed_30',      icon: '\u26A1',          cat: 'speed', check: s => s.elapsed <= 30 },
  { id: 'speed_15',      icon: '\uD83D\uDE80',   cat: 'speed', check: s => s.elapsed <= 15 },
  // Dedication
  { id: 'total_20',      icon: '\uD83D\uDD01',   cat: 'dedication', check: s => s.total >= 20 },
  { id: 'total_100',     icon: '\uD83D\uDCAA',   cat: 'dedication', check: s => s.total >= 100 },
  { id: 'total_500',     icon: '\uD83C\uDFCB\uFE0F', cat: 'dedication', check: s => s.total >= 500 },
  // Streak (consecutive days)
  { id: 'streak_3',      icon: '\uD83D\uDD25',   cat: 'streak', check: s => s.streak >= 3 },
  { id: 'streak_7',      icon: '\uD83C\uDF08',   cat: 'streak', check: s => s.streak >= 7 },
  { id: 'streak_30',     icon: '\u2604\uFE0F',   cat: 'streak', check: s => s.streak >= 30 },
  { id: 'streak_100',    icon: '\uD83C\uDF0B',   cat: 'streak', check: s => s.streak >= 100 },
  { id: 'streak_200',    icon: '\uD83C\uDF0A',   cat: 'streak', check: s => s.streak >= 200 },
  { id: 'streak_300',    icon: '\uD83C\uDF0D',   cat: 'streak', check: s => s.streak >= 300 },
  { id: 'streak_365',    icon: '\uD83C\uDF89',   cat: 'streak', check: s => s.streak >= 365 },
  // Special
  { id: 'no_hint',       icon: '\uD83E\uDDD0',   cat: 'special', check: s => s.noHint },
  { id: 'five_in_day',   icon: '\uD83C\uDF86',   cat: 'special', check: s => s.dailyCount >= 5 },
  { id: 'night_owl',     icon: '\uD83E\uDD89',   cat: 'special', check: s => { const h = new Date().getHours(); return h >= 0 && h < 5 && s.justSolved; } },
  { id: 'night_100',    icon: '\uD83C\uDF19',   cat: 'special', check: s => s.nightSolves >= 100 },
  { id: 'morning_100',  icon: '\uD83C\uDF05',   cat: 'special', check: s => s.morningSolves >= 100 },
  // Scoreboard rank
  { id: 'rank_1',       icon: '\uD83E\uDD47',   cat: 'special', check: s => s.isRank1 },
];

function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem('octile_achievements') || '{}'); }
  catch { return {}; }
}

function saveUnlockedAchievements(data) {
  localStorage.setItem('octile_achievements', JSON.stringify(data));
}

function getStreak() {
  try {
    const data = JSON.parse(localStorage.getItem('octile_streak') || '{}');
    const today = new Date().toISOString().slice(0, 10);
    if (data.lastDate === today) return data;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (data.lastDate === yesterday) return { lastDate: today, count: data.count + 1 };
    return { lastDate: today, count: 1 };
  } catch { return { lastDate: new Date().toISOString().slice(0, 10), count: 1 }; }
}

function updateStreak() {
  const streak = getStreak();
  streak.lastDate = new Date().toISOString().slice(0, 10);
  localStorage.setItem('octile_streak', JSON.stringify(streak));
  return streak.count;
}

let achieveToastTimer = null;
function showAchieveToast(achievement) {
  const toast = document.getElementById('achieve-toast');
  toast.querySelector('.toast-icon').textContent = achievement.icon;
  toast.querySelector('.toast-label').textContent = t('achieve_unlocked');
  toast.querySelector('.toast-name').textContent = t('ach_' + achievement.id);
  toast.classList.add('show');
  if (achieveToastTimer) clearTimeout(achieveToastTimer);
  achieveToastTimer = setTimeout(() => { toast.classList.remove('show'); achieveToastTimer = null; }, 3500);
}

function checkAchievements(stats) {
  const unlocked = getUnlockedAchievements();
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (unlocked[ach.id]) continue;
    if (ach.check(stats)) {
      unlocked[ach.id] = Date.now();
      newlyUnlocked.push(ach);
    }
  }
  if (newlyUnlocked.length) {
    saveUnlockedAchievements(unlocked);
    // Show toast for first new achievement (queue not needed for simplicity)
    showAchieveToast(newlyUnlocked[0]);
    // Show notification dot
    const dot = document.querySelector('#trophy-btn .trophy-dot');
    if (dot) dot.classList.add('show');
  }
  return newlyUnlocked;
}

function renderAchieveModal() {
  const unlocked = getUnlockedAchievements();
  const unlockedCount = Object.keys(unlocked).length;
  const totalCount = ACHIEVEMENTS.length;

  document.getElementById('achieve-modal-title').textContent = t('achieve_title');
  document.getElementById('achieve-summary').textContent = t('achieve_summary').replace('{n}', unlockedCount).replace('{total}', totalCount);

  const grid = document.getElementById('achieve-grid');
  grid.innerHTML = '';
  for (const ach of ACHIEVEMENTS) {
    const isUnlocked = !!unlocked[ach.id];
    const card = document.createElement('div');
    card.className = 'achieve-card ' + (isUnlocked ? 'unlocked' : 'locked');

    const iconDiv = document.createElement('div');
    iconDiv.className = 'achieve-icon';
    iconDiv.textContent = ach.icon;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'achieve-name';
    nameDiv.textContent = t('ach_' + ach.id);

    const descDiv = document.createElement('div');
    descDiv.className = 'achieve-desc';
    descDiv.textContent = t('ach_' + ach.id + '_desc');

    card.appendChild(iconDiv);
    card.appendChild(nameDiv);
    card.appendChild(descDiv);

    if (isUnlocked) {
      const dateDiv = document.createElement('div');
      dateDiv.className = 'achieve-date';
      dateDiv.textContent = new Date(unlocked[ach.id]).toLocaleDateString();
      card.appendChild(dateDiv);
    }

    grid.appendChild(card);
  }
}

function showAchieveModal() {
  renderAchieveModal();
  // Clear notification dot
  const dot = document.querySelector('#trophy-btn .trophy-dot');
  if (dot) dot.classList.remove('show');
  document.getElementById('achieve-modal').classList.add('show');
}

function renderWinAchievements(newlyUnlocked) {
  const el = document.getElementById('win-achievement');
  if (!newlyUnlocked.length) { el.innerHTML = ''; return; }
  let html = '<div class="win-badge-row">';
  for (const ach of newlyUnlocked) {
    html += '<div class="win-badge-item">' + ach.icon + ' ' + t('ach_' + ach.id) + '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// --- World Scoreboard ---
const SB_API = WORKER_URL + '/scoreboard';
const SB_CACHE_MS = 3 * 60 * 1000;
const sbCache = {};

async function sbFetch(params) {
  const key = JSON.stringify(params);
  const now = Date.now();
  if (sbCache[key] && now - sbCache[key].ts < SB_CACHE_MS) return sbCache[key].data;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(SB_API + '?' + qs);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  sbCache[key] = { data, ts: now };
  return data;
}

function sbLoading() {
  return '<div class="sb-loading"><div class="sb-spinner"></div>' + t('sb_loading') + '</div>';
}
function sbError(retryFn) {
  return '<div class="sb-error"><div class="sb-error-icon">⚠️</div><div>' + t('sb_error') + '</div><button class="sb-retry" onclick="' + retryFn + '">' + t('sb_retry') + '</button></div>';
}
function sbEmpty(msg) {
  return '<div class="sb-empty"><div class="sb-empty-icon">🏆</div><div>' + msg + '</div></div>';
}

function sbAvatarHTML(uuid, size) {
  return '<div class="sb-avatar" style="width:' + size + 'px;height:' + size + 'px">' + generateAvatar(uuid, size) + '</div>';
}

function sbFormatTime(sec) {
  if (sec < 60) return sec.toFixed(1) + 's';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function updateOnlineUI() {
  const btn = document.getElementById('scoreboard-btn');
  if (!isOnline()) {
    btn.style.opacity = '0.35';
    btn.style.pointerEvents = 'none';
  } else {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }
}

function showScoreboardModal() {
  if (!isOnline()) return;
  document.getElementById('scoreboard-modal').classList.add('show');
  // Activate first tab
  switchSbTab('global');
}

function switchSbTab(tab) {
  document.querySelectorAll('.sb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.sb-tab-content').forEach(p => p.classList.toggle('active', p.id === 'sb-panel-' + tab));
  if (tab === 'global') renderGlobalTab();
  else if (tab === 'puzzle') renderPuzzleTab();
  else if (tab === 'me') renderMyStatsTab();
}

async function renderGlobalTab() {
  const panel = document.getElementById('sb-panel-global');
  panel.innerHTML = sbLoading();
  try {
    const data = await sbFetch({ best: 'true', limit: '200' });
    const scores = data.scores || [];
    if (!scores.length) { panel.innerHTML = sbEmpty(t('sb_no_scores')); return; }
    // Group by uuid: count puzzles, compute avg time
    const players = {};
    for (const s of scores) {
      if (!players[s.browser_uuid]) players[s.browser_uuid] = { uuid: s.browser_uuid, puzzles: 0, totalTime: 0, bestTime: Infinity };
      const p = players[s.browser_uuid];
      p.puzzles++;
      p.totalTime += s.resolve_time;
      if (s.resolve_time < p.bestTime) p.bestTime = s.resolve_time;
    }
    const ranked = Object.values(players).sort((a, b) => b.puzzles - a.puzzles || (a.totalTime / a.puzzles) - (b.totalTime / b.puzzles));
    const myUUID = getBrowserUUID();
    const myIdx = ranked.findIndex(p => p.uuid === myUUID);
    const totalPlayers = ranked.length;

    let html = '';
    // My rank card
    if (myIdx >= 0) {
      const me = ranked[myIdx];
      const pct = Math.max(1, Math.round((myIdx + 1) / totalPlayers * 100));
      html += '<div class="sb-my-rank">';
      html += sbAvatarHTML(myUUID, 40);
      html += '<div class="sb-my-info"><div class="sb-my-name">' + generateCuteName(myUUID) + '</div>';
      html += '<div class="sb-my-detail">' + me.puzzles + ' ' + t('sb_puzzles') + ' · ' + sbFormatTime(me.totalTime / me.puzzles) + ' ' + t('sb_avg') + '</div></div>';
      html += '<div class="sb-rank-badge"><div class="sb-rank-num">#' + (myIdx + 1) + '</div><div class="sb-rank-pct">' + t('sb_top').replace('{pct}', pct) + '</div></div>';
      html += '</div>';
    }
    html += '<div class="sb-summary">' + t('sb_total_players').replace('{n}', totalPlayers) + '</div>';
    // Leaderboard
    html += '<div class="sb-list">';
    const show = Math.min(ranked.length, 50);
    for (let i = 0; i < show; i++) {
      const p = ranked[i];
      const isMe = p.uuid === myUUID;
      const crown = i < 3 ? ' sb-crown' : '';
      const me = isMe ? ' sb-me' : '';
      const posLabel = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
      html += '<div class="sb-row' + crown + me + '">';
      html += '<div class="sb-pos">' + posLabel + '</div>';
      html += sbAvatarHTML(p.uuid, 32);
      html += '<div class="sb-name">' + generateCuteName(p.uuid) + (isMe ? ' (' + t('sb_you') + ')' : '') + '</div>';
      const rowPct = Math.max(1, Math.round((i + 1) / totalPlayers * 100));
      html += '<div class="sb-val"><strong>' + p.puzzles + '</strong> ' + t('sb_puzzles') + '</div>';
      html += '<div class="sb-val">' + sbFormatTime(p.totalTime / p.puzzles) + '</div>';
      html += '<div class="sb-val sb-row-pct">' + t('sb_top').replace('{pct}', rowPct) + '</div>';
      html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  } catch (e) {
    console.warn('[Octile] Scoreboard fetch failed:', e.message);
    panel.innerHTML = sbError('renderGlobalTab()');
  }
}

async function renderPuzzleTab() {
  const panel = document.getElementById('sb-panel-puzzle');
  const puzzleNum = currentPuzzleNumber;
  document.getElementById('sb-tab-puzzle').textContent = t('sb_tab_puzzle').replace('{n}', puzzleNum);
  panel.innerHTML = sbLoading();
  try {
    const data = await sbFetch({ puzzle: String(puzzleNum), best: 'true', limit: '50' });
    const scores = data.scores || [];
    if (!scores.length) { panel.innerHTML = sbEmpty(t('sb_no_puzzle_scores')); return; }
    const myUUID = getBrowserUUID();
    let html = '<div class="sb-summary">' + t('sb_puzzle_header').replace('{n}', puzzleNum).replace('{total}', data.total || scores.length) + '</div>';
    html += '<div class="sb-list">';
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      const isMe = s.browser_uuid === myUUID;
      const crown = i < 3 ? ' sb-crown' : '';
      const me = isMe ? ' sb-me' : '';
      const posLabel = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
      html += '<div class="sb-row' + crown + me + '">';
      html += '<div class="sb-pos">' + posLabel + '</div>';
      html += sbAvatarHTML(s.browser_uuid, 32);
      html += '<div class="sb-name">' + generateCuteName(s.browser_uuid) + (isMe ? ' (' + t('sb_you') + ')' : '') + '</div>';
      html += '<div class="sb-val"><strong>' + sbFormatTime(s.resolve_time) + '</strong></div>';
      html += '</div>';
    }
    html += '</div>';
    panel.innerHTML = html;
  } catch (e) {
    console.warn('[Octile] Puzzle scoreboard failed:', e.message);
    panel.innerHTML = sbError('renderPuzzleTab()');
  }
}

async function renderMyStatsTab() {
  const panel = document.getElementById('sb-panel-me');
  const myUUID = getBrowserUUID();
  panel.innerHTML = sbLoading();
  try {
    const data = await sbFetch({ uuid: myUUID, best: 'true', limit: '200' });
    const scores = data.scores || [];
    // Profile header
    let html = '<div class="sb-profile">';
    html += '<div class="sb-avatar-lg">' + generateAvatar(myUUID, 80) + '</div>';
    html += '<div class="sb-profile-name">' + generateCuteName(myUUID) + '</div>';
    html += '<div class="sb-profile-id">ID: ' + myUUID.slice(0, 4) + '...' + myUUID.slice(-4) + '</div>';
    html += '</div>';

    const totalPuzzles = scores.length;
    const totalTime = scores.reduce((sum, s) => sum + s.resolve_time, 0);
    const avgTime = totalPuzzles > 0 ? totalTime / totalPuzzles : 0;
    const bestScore = scores.reduce((best, s) => s.resolve_time < best.resolve_time ? s : best, scores[0] || { resolve_time: 0, puzzle_number: '-' });
    const totalSolves = parseInt(localStorage.getItem('octile_total_solved') || '0');

    // Stats grid
    html += '<div class="sb-stats-grid">';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + totalPuzzles + '</div><div class="sb-stat-label">' + t('sb_stat_puzzles') + '</div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + (avgTime > 0 ? sbFormatTime(avgTime) : '-') + '</div><div class="sb-stat-label">' + t('sb_stat_avg') + '</div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + (bestScore && bestScore.resolve_time ? sbFormatTime(bestScore.resolve_time) : '-') + '</div><div class="sb-stat-label">' + t('sb_stat_best') + '</div><div class="sb-stat-sub">' + (bestScore && bestScore.puzzle_number ? '#' + bestScore.puzzle_number : '') + '</div></div>';
    html += '<div class="sb-stat-card"><div class="sb-stat-val">' + totalSolves + '</div><div class="sb-stat-label">' + t('sb_stat_total') + '</div></div>';
    html += '</div>';

    // Recent solves
    if (scores.length > 0) {
      const recent = [...scores].sort((a, b) => new Date(b.created_at || b.timestamp_utc) - new Date(a.created_at || a.timestamp_utc)).slice(0, 10);
      html += '<div class="sb-recent"><h4>' + t('sb_recent') + '</h4>';
      for (const s of recent) {
        html += '<div class="sb-recent-item"><span>' + t('sb_puzzle_label') + ' #' + s.puzzle_number + '</span><span>' + sbFormatTime(s.resolve_time) + '</span></div>';
      }
      html += '</div>';
    } else {
      html += sbEmpty(t('sb_no_my_scores'));
    }
    panel.innerHTML = html;
  } catch (e) {
    console.warn('[Octile] My stats failed:', e.message);
    panel.innerHTML = sbError('renderMyStatsTab()');
  }
}

function checkWin() {
  const allPlaced = pieces.every(p => p.placed);
  if (!allPlaced) return;
  gameOver = true;
  clearInterval(timerInterval);
  dismissAllHints();

  // Track unique solved puzzles
  const solved = getSolvedSet();
  const isFirstClear = !solved.has(currentPuzzleNumber);
  solved.add(currentPuzzleNumber);
  saveSolvedSet(solved);
  const totalUnique = solved.size;

  // Total solve count (including re-solves)
  const totalSolved = parseInt(localStorage.getItem('octile_total_solved') || '0') + 1;
  localStorage.setItem('octile_total_solved', totalSolved);

  const bestKey = 'octile_best_' + currentPuzzleNumber;
  const prevBest = parseInt(localStorage.getItem(bestKey) || '0');
  const isNewBest = prevBest === 0 || elapsed < prevBest;
  const improvement = prevBest > 0 ? prevBest - elapsed : 0;
  if (isNewBest) localStorage.setItem(bestKey, elapsed);

  // Deduct energy
  const cost = energyCost(elapsed);
  deductEnergy(cost);
  updateDailyStats(cost);
  const remainingEnergy = getEnergyState().points;
  document.getElementById('win-energy-cost').textContent = t('win_energy_cost').replace('{cost}', cost).replace('{left}', Math.floor(remainingEnergy));

  // Populate win card
  document.getElementById('win-puzzle-num').textContent = t('win_puzzle') + (currentPuzzleNumber);
  document.getElementById('win-time').textContent = t('win_time') + formatTime(elapsed);
  document.getElementById('win-best').textContent = isNewBest ? t('win_new_best') : t('win_best') + formatTime(prevBest);
  document.getElementById('win-best').style.display = isNewBest || prevBest ? '' : 'none';
  if (isNewBest) {
    document.getElementById('win-best').className = 'win-best';
  } else {
    document.getElementById('win-best').className = '';
  }
  document.getElementById('win-total-solved').textContent = t('motiv_unique_count').replace('{n}', totalUnique).replace('{total}', TOTAL_PUZZLE_COUNT);

  // Motivational message
  const motivation = getWinMotivation(totalUnique, isFirstClear, isNewBest, prevBest, elapsed, improvement);
  const motivEl = document.getElementById('win-motivation');
  motivEl.textContent = motivation;
  motivEl.style.display = motivation ? '' : 'none';

  // Random win fact
  const facts = getWinFacts();
  document.getElementById('win-fact').textContent = facts[Math.floor(Math.random() * facts.length)];

  // Track night solves (22:00–04:29) and morning solves (04:30–08:59)
  const now = new Date();
  const hour = now.getHours();
  const mins = now.getMinutes();
  const timeVal = hour * 60 + mins;
  if (timeVal >= 22 * 60 || timeVal < 4 * 60 + 30) {
    const nightCount = parseInt(localStorage.getItem('octile_night_solves') || '0') + 1;
    localStorage.setItem('octile_night_solves', nightCount);
  }
  if (timeVal >= 4 * 60 + 30 && timeVal < 9 * 60) {
    const morningCount = parseInt(localStorage.getItem('octile_morning_solves') || '0') + 1;
    localStorage.setItem('octile_morning_solves', morningCount);
  }

  // Check achievements
  const streakCount = updateStreak();
  const dailyStats = getDailyStats();
  const achStats = {
    unique: totalUnique,
    total: totalSolved,
    elapsed: elapsed,
    streak: streakCount,
    noHint: getHintsUsedToday() === 0 && isFirstClear,
    dailyCount: dailyStats.puzzles,
    justSolved: true,
    nightSolves: parseInt(localStorage.getItem('octile_night_solves') || '0'),
    morningSolves: parseInt(localStorage.getItem('octile_morning_solves') || '0'),
  };
  const newlyUnlocked = checkAchievements(achStats);
  renderWinAchievements(newlyUnlocked);

  const overlay = document.getElementById('win-overlay');
  overlay.classList.add('show');
  spawnConfetti();

  // Reset daily hints after completing a game
  resetDailyHints();

  submitScore(currentPuzzleNumber, elapsed);
  // Invalidate scoreboard cache so next open shows the latest data
  for (const key in sbCache) delete sbCache[key];
}

function clearConfetti() {
  document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
}

function spawnConfetti() {
  clearConfetti();
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#ecf0f1', '#9b59b6', '#e67e22'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = -10 + 'px';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = (2 + Math.random() * 2) + 's';
    el.style.animationDelay = Math.random() * 0.8 + 's';
    el.style.width = (6 + Math.random() * 6) + 'px';
    el.style.height = (6 + Math.random() * 6) + 'px';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

function nextPuzzle() {
  const num = (currentPuzzleNumber % TOTAL_PUZZLE_COUNT) + 1;
  document.getElementById('win-overlay').classList.remove('show');
  startGame(num);
}

function winRandom() {
  document.getElementById('win-overlay').classList.remove('show');
  startGame(getRandomPuzzleNumber());
}

function shareGame() {
  if (gameStarted) {
    const num = currentPuzzleNumber;
    const puzzleUrl = SITE_URL + '?p=' + num;
    const text = t('share_text');
    if (navigator.share) {
      navigator.share({ text: text, url: puzzleUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text + ' ' + puzzleUrl).then(() => {
        showCopiedToast();
      }).catch(() => {});
    }
  } else {
    doShare(t('share_text'));
  }
}

function shareWin() {
  const num = currentPuzzleNumber;
  const time = formatTime(elapsed);
  const text = t('share_win_prefix') + num + t('share_win_mid') + time + t('share_win_suffix');
  const puzzleUrl = SITE_URL + '?p=' + num;
  captureBoardScreenshot(num).then(file => {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ text: text, url: puzzleUrl, files: [file] }).catch(() => {});
    } else if (navigator.share) {
      navigator.share({ text: text, url: puzzleUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text + '\n' + puzzleUrl).then(() => {
        showCopiedToast();
      }).catch(() => {});
    }
  });
}

function captureBoardScreenshot(puzzleNum) {
  return new Promise(resolve => {
    try {
      const SIZE = 480;
      const CELLS = 8;
      const PAD = 40;
      const CELL_SIZE = (SIZE - PAD * 2) / CELLS;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE + 48;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Color map
      const colors = { grey: '#888', red: '#e74c3c', white: '#ecf0f1', blue: '#3498db', yellow: '#f1c40f' };
      const emptyColor = '#16213e';

      // Draw cells
      for (let r = 0; r < CELLS; r++) {
        for (let c = 0; c < CELLS; c++) {
          const x = PAD + c * CELL_SIZE;
          const y = PAD + r * CELL_SIZE;
          const pid = board[r][c];
          if (pid) {
            const p = getPieceById(pid);
            ctx.fillStyle = p ? (colors[p.color] || emptyColor) : emptyColor;
          } else {
            ctx.fillStyle = emptyColor;
          }
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

          // Piece borders
          if (pid) {
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 2;
            if (r === 0 || board[r-1][c] !== pid) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL_SIZE, y); ctx.stroke(); }
            if (r === 7 || board[r+1]?.[c] !== pid) { ctx.beginPath(); ctx.moveTo(x, y + CELL_SIZE); ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE); ctx.stroke(); }
            if (c === 0 || board[r][c-1] !== pid) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL_SIZE); ctx.stroke(); }
            if (c === 7 || board[r][c+1] !== pid) { ctx.beginPath(); ctx.moveTo(x + CELL_SIZE, y); ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE); ctx.stroke(); }
          }
        }
      }

      // Title and puzzle number
      ctx.fillStyle = '#eee';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Octile', PAD, 28);
      ctx.textAlign = 'right';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText('#' + puzzleNum, SIZE - PAD, 28);

      // Bottom text
      ctx.textAlign = 'center';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#888';
      const baseUrl = location.href.split('?')[0].split('#')[0];
      ctx.fillText(baseUrl + '?p=' + puzzleNum, SIZE / 2, SIZE + 36);

      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], 'octile-' + puzzleNum + '.png', { type: 'image/png' }));
        } else {
          resolve(null);
        }
      }, 'image/png');
    } catch (e) {
      resolve(null);
    }
  });
}

function doShare(text) {
  if (navigator.share) {
    navigator.share({ text: text, url: SITE_URL }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text + ' ' + SITE_URL).then(() => {
      showCopiedToast();
    }).catch(() => {});
  }
}

let toastTimer = null;
function showCopiedToast() {
  let toast = document.getElementById('copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = t('copied');
  toast.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; toastTimer = null; }, 2000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

async function resetGame(puzzleNumber) {
  if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
  if (motivationTimeout) { clearTimeout(motivationTimeout); motivationTimeout = null; }
  tutorialTimeouts.forEach(t => clearTimeout(t));
  tutorialTimeouts = [];
  motivationShown = false;
  clearConfetti();
  clearInterval(timerInterval);
  timerInterval = null;
  timerStarted = false;
  elapsed = 0;
  elapsedBeforePause = 0;
  paused = false;
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('timer').style.opacity = '';
  piecesPlacedCount = 0;
  document.getElementById('timer').textContent = '0:00';
  selectedPiece = null;
  gameOver = false;
  document.getElementById('win-overlay').classList.remove('show');
  document.getElementById('win-back-btn').style.display = 'none';
  pieces = PIECES.map(p => ({
    ...p,
    currentShape: p.shape.map(r => [...r]),
    placed: false,
    boardR: -1,
    boardC: -1,
  }));
  if (puzzleNumber === undefined) puzzleNumber = currentPuzzleNumber;
  await loadPuzzle(puzzleNumber);
  renderBoard();
  renderPool();
  updateHintBtn();
}

// --- Splash (auto-dismiss) ---
let splashDismissed = false;

function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 600);
}

// Auto-dismiss after 30s, or on tap/key
setTimeout(dismissSplash, 30000);
document.addEventListener('pointerdown', dismissSplash, { once: true });
document.addEventListener('keydown', dismissSplash, { once: true });

// --- Welcome Panel / Game Flow ---
let gameStarted = false;

function showWelcomeState() {
  // Update totals
  const max = getMaxPuzzleNumber();
  document.getElementById('wp-puzzle-total').textContent = '/ ' + max;
  const wpInput = document.getElementById('wp-puzzle-input');
  wpInput.max = max;
  // Random tagline
  const taglines = getTaglines();
  document.getElementById('wp-tagline').innerHTML = taglines[Math.floor(Math.random() * taglines.length)];
  updateEnergyDisplay();
}

function startGame(puzzleNumber) {
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const welcome = document.getElementById('welcome-panel');
  if (welcome && !welcome.classList.contains('hidden')) {
    welcome.classList.add('anim-out');
    setTimeout(() => {
      welcome.classList.add('hidden');
      welcome.classList.remove('anim-out');
      revealGame(puzzleNumber);
    }, 300);
  } else {
    revealGame(puzzleNumber);
  }
}

async function revealGame(puzzleNumber) {
  gameStarted = true;
  currentPuzzleNumber = puzzleNumber;
  document.getElementById('puzzle-input').value = puzzleNumberToDisplay(puzzleNumber);

  const boardEl = document.getElementById('board');
  const poolEl = document.getElementById('pool-section');
  const actionBarEl = document.getElementById('action-bar');
  const menuBtn = document.getElementById('menu-btn');

  boardEl.style.display = '';
  poolEl.style.display = '';
  actionBarEl.style.display = '';
  menuBtn.style.display = '';

  // Staggered fade-in
  boardEl.classList.add('game-fade-in');
  poolEl.classList.add('game-fade-in');
  poolEl.style.animationDelay = '0.1s';
  actionBarEl.classList.add('game-fade-in');
  actionBarEl.style.animationDelay = '0.15s';

  setTimeout(() => {
    boardEl.classList.remove('game-fade-in');
    poolEl.classList.remove('game-fade-in');
    poolEl.style.animationDelay = '';
    actionBarEl.classList.remove('game-fade-in');
    actionBarEl.style.animationDelay = '';
  }, 500);

  await resetGame(puzzleNumber);

  // Tutorial hints (tracked for cleanup)
  tutorialTimeouts.push(setTimeout(() => showTutorialHint1(), 800));
  tutorialTimeouts.push(setTimeout(() => showTutorialHint3(), 60000));

  // Motivational quote after 120s if stuck
  if (motivationTimeout) clearTimeout(motivationTimeout);
  motivationTimeout = setTimeout(() => {
    if (gameOver || !gameStarted || motivationShown || piecesPlacedCount > 1) return;
    motivationShown = true;
    const quotes = getMotivationQuotes();
    const text = quotes[Math.floor(Math.random() * quotes.length)];
    showHintTooltip(text, document.getElementById('board-container'), 'motivation');
    // Auto-dismiss after 8s
    setTimeout(() => dismissHint('motivation'), 8000);
  }, 120000);
}

function returnToWelcome() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerStarted = false;
  paused = false;
  elapsedBeforePause = 0;
  gameOver = true;
  gameStarted = false;
  dismissAllHints();
  clearConfetti();
  tutorialTimeouts.forEach(t => clearTimeout(t));
  tutorialTimeouts = [];
  if (motivationTimeout) { clearTimeout(motivationTimeout); motivationTimeout = null; }

  document.getElementById('win-overlay').classList.remove('show');
  document.getElementById('win-back-btn').style.display = 'none';
  document.getElementById('board').style.display = 'none';
  document.getElementById('pool-section').style.display = 'none';
  document.getElementById('action-bar').style.display = 'none';
  document.getElementById('menu-btn').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('timer').style.opacity = '';
  document.getElementById('timer').textContent = '0:00';

  const welcome = document.getElementById('welcome-panel');
  welcome.classList.remove('hidden');
  showWelcomeState();
}

function welcomeRandom() {
  startGame(getRandomPuzzleNumber());
}

function welcomeGo() {
  const input = document.getElementById('wp-puzzle-input');
  const max = getMaxPuzzleNumber();
  let val = parseInt(input.value);
  if (isNaN(val) || val < 1) val = 1;
  if (val > max) val = max;
  input.value = val;
  startGame(isOnline() ? val : OFFLINE_PUZZLE_NUMS[val - 1]);
}

// --- Tutorial Hints ---
let activeHints = [];
let tutorialTimeouts = [];

function isTutorialSeen() {
  return localStorage.getItem('octile_tutorial_seen') === '1';
}
function markTutorialSeen() {
  localStorage.setItem('octile_tutorial_seen', '1');
}

function showHintTooltip(text, targetEl, id) {
  if (!targetEl) return;
  dismissHint(id);
  const hint = document.createElement('div');
  hint.className = 'tutorial-hint';
  hint.dataset.hintId = id;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'hint-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', () => dismissHint(id));
  const span = document.createElement('span');
  span.textContent = text;
  hint.appendChild(span);
  hint.appendChild(closeBtn);

  // Position relative to target
  const container = targetEl.closest('#main-area') || document.body;
  container.style.position = 'relative';
  container.appendChild(hint);

  const targetRect = targetEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  hint.style.left = (targetRect.left - containerRect.left + 10) + 'px';
  hint.style.top = (targetRect.top - containerRect.top - 8) + 'px';

  activeHints.push({ id, element: hint, timer: setTimeout(() => dismissHint(id), 6000) });
}

function dismissHint(id) {
  const idx = activeHints.findIndex(h => h.id === id);
  if (idx === -1) return;
  const h = activeHints[idx];
  clearTimeout(h.timer);
  if (h.element.parentNode) h.element.parentNode.removeChild(h.element);
  activeHints.splice(idx, 1);
}

function dismissAllHints() {
  [...activeHints].forEach(h => dismissHint(h.id));
}

function showTutorialHint1() {
  if (isTutorialSeen() || gameOver || !gameStarted) return;
  const pool = document.getElementById('pool-section');
  showHintTooltip(t('hint1'), pool, 'hint1');
}

function showTutorialHint2() {
  if (isTutorialSeen() || gameOver) return;
  if (piecesPlacedCount !== 1) return; // only after first placement
  dismissHint('hint1');
  const pool = document.getElementById('pool-section');
  showHintTooltip(t('hint2'), pool, 'hint2');
}

function showTutorialHint3() {
  if (isTutorialSeen() || gameOver || !gameStarted) return;
  if (piecesPlacedCount > 1) return;
  dismissHint('hint1');
  dismissHint('hint2');
  const hintBtn = document.getElementById('hint-btn');
  showHintTooltip(t('hint3'), hintBtn, 'hint3');
  markTutorialSeen(); // shown all hints, mark as seen
}

// Mark tutorial as seen after any hint3 or after placing 2+ pieces
function maybeCompleteTutorial() {
  if (piecesPlacedCount >= 2 && !isTutorialSeen()) {
    markTutorialSeen();
    dismissAllHints();
  }
}

// --- i18n (loaded from translations.json) ---
let TRANSLATIONS = { en: {}, zh: {} };
(function loadTranslations() {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'translations.json', false); // sync load — local file, instant
  try { xhr.send(); if (xhr.status === 200 || xhr.status === 0) TRANSLATIONS = JSON.parse(xhr.responseText); } catch(e) {}
})();

function t(key) { return TRANSLATIONS[currentLang][key] || TRANSLATIONS.en[key] || key; }

function applyLanguage() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-Hant' : 'en';
  // Header
  document.getElementById('settings-help-label').textContent = t('menu_help');
  document.getElementById('settings-story-label').textContent = t('menu_about');
  document.getElementById('settings-share-label').textContent = t('menu_share');
  document.getElementById('settings-puzzle-label').textContent = t('menu_puzzle');
  document.getElementById('settings-scoreboard-label').textContent = t('menu_scoreboard');
  document.getElementById('scoreboard-title').textContent = t('sb_title');
  document.getElementById('sb-tab-global').textContent = t('sb_tab_global');
  document.getElementById('sb-tab-me').textContent = t('sb_tab_me');

  // Settings modal
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  document.getElementById('settings-theme-label').textContent = t('menu_theme');

  // Control bar
  document.getElementById('ctrl-go').textContent = t('go');
  document.getElementById('ctrl-random').textContent = t('random');
  updateHintBtn();

  // Pool label
  document.querySelector('#pool-section h2').textContent = t('pieces_label');
  document.getElementById('pause-label').textContent = t('paused');

  // Welcome panel
  document.getElementById('wp-random-btn').textContent = t('wp_random');
  document.querySelector('#welcome-panel .wp-divider').textContent = t('wp_or');
  document.getElementById('wp-go-btn').textContent = t('wp_go');

  // Splash (if still present)
  const splashTagline = document.querySelector('#splash .tagline');
  if (splashTagline) splashTagline.innerHTML = t('splash_tagline');
  const splashTap = document.querySelector('#splash .tap-hint');
  if (splashTap) splashTap.textContent = t('splash_tap');

  // Help & story modal bodies
  document.getElementById('help-body').innerHTML = t('help_body');
  document.getElementById('story-body').innerHTML = t('story_body') + '<p class="app-version">v' + APP_VERSION_NAME + '</p>' + '<p class="about-links"><a href="privacy.html" target="_blank">' + t('privacy_link') + '</a> · <a href="terms.html" target="_blank">' + t('terms_link') + '</a></p>';

  // Win card static text
  document.querySelector('#win-card h2').textContent = t('win_title');
  document.getElementById('win-share-btn').innerHTML = t('win_share');
  document.getElementById('win-view-btn').textContent = t('win_view_board');
  document.getElementById('win-back-btn').textContent = t('win_back');
  document.getElementById('win-next-btn').innerHTML = t('win_next');
  document.getElementById('win-random-btn').textContent = t('win_random');
  document.getElementById('win-menu-btn').textContent = t('win_menu');

  // Energy display
  document.getElementById('energy-display').title = t('energy_title');
  document.getElementById('energy-modal-title').textContent = t('energy_title');
  updateEnergyDisplay();

  // Achievement button & modal
  document.getElementById('settings-trophy-label').textContent = t('achieve_title');
  document.getElementById('achieve-modal-title').textContent = t('achieve_title');

  // Update banner
  document.getElementById('update-btn').textContent = t('update_btn');
  document.getElementById('update-dismiss').textContent = t('update_later');

  // Refresh tagline
  const taglines = getTaglines();
  const wpTagline = document.getElementById('wp-tagline');
  if (wpTagline) wpTagline.innerHTML = taglines[Math.floor(Math.random() * taglines.length)];
}

function toggleLang() {
  currentLang = currentLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('octile_lang', currentLang);
  applyLanguage();
}

// --- Event listeners (replaces inline onclick) ---

// Header buttons
document.getElementById('menu-btn').addEventListener('click', returnToWelcome);
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('pause-play-btn').addEventListener('click', resumeGame);
document.getElementById('pause-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) resumeGame();
});

// Auto-pause on visibility change (tab hidden, app backgrounded)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && timerStarted && !gameOver && !paused) {
    pauseGame();
  }
});

function closeSettingsAndDo(fn) {
  document.getElementById('settings-modal').classList.remove('show');
  setTimeout(fn, 150);
}
document.getElementById('help-btn').addEventListener('click', () => closeSettingsAndDo(() => document.getElementById('help-modal').classList.add('show')));
document.getElementById('story-btn').addEventListener('click', () => closeSettingsAndDo(() => document.getElementById('story-modal').classList.add('show')));
document.getElementById('share-btn').addEventListener('click', () => closeSettingsAndDo(shareGame));

// Settings modal
const THEMES = ['default', 'lego', 'wood'];
const THEME_KEYS = { default: 'theme_classic', lego: 'theme_lego', wood: 'theme_wood' };
function getCurrentTheme() {
  if (document.body.classList.contains('lego-theme')) return 'lego';
  if (document.body.classList.contains('wood-theme')) return 'wood';
  return 'default';
}
function setTheme(theme) {
  document.body.classList.remove('lego-theme', 'wood-theme');
  if (theme === 'lego') document.body.classList.add('lego-theme');
  else if (theme === 'wood') document.body.classList.add('wood-theme');
  try { localStorage.setItem('octile-theme', theme); } catch(e) {}
}
function updateSettingsLabels() {
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  document.getElementById('settings-lang-btn').textContent = t('menu_lang_value');
  document.getElementById('settings-theme-label').textContent = t('menu_theme');
  const theme = getCurrentTheme();
  document.getElementById('settings-theme-btn').textContent = t(THEME_KEYS[theme]);
}
document.getElementById('settings-btn').addEventListener('click', () => {
  updateSettingsLabels();
  document.getElementById('settings-modal').classList.add('show');
});
document.getElementById('settings-close').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('show'));
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
document.getElementById('settings-lang-btn').addEventListener('click', () => {
  toggleLang();
  updateSettingsLabels();
});
document.getElementById('settings-theme-btn').addEventListener('click', () => {
  const cur = getCurrentTheme();
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  setTheme(next);
  updateSettingsLabels();
});
// Restore saved theme
try {
  const saved = localStorage.getItem('octile-theme');
  if (saved && saved !== 'default') setTheme(saved);
} catch(e) {}

// Control bar
document.getElementById('ctrl-go').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('show');
  loadSelectedPuzzle();
});
document.getElementById('ctrl-random').addEventListener('click', loadRandomPuzzle);
document.getElementById('hint-btn').addEventListener('click', showHint);

// Welcome panel
document.getElementById('wp-random-btn').addEventListener('click', welcomeRandom);
document.getElementById('wp-go-btn').addEventListener('click', welcomeGo);

// Win card
document.getElementById('win-share-btn').addEventListener('click', shareWin);
document.getElementById('win-view-btn').addEventListener('click', () => {
  document.getElementById('win-overlay').classList.remove('show');
  clearConfetti();
  document.getElementById('win-back-btn').style.display = 'block';
});
document.getElementById('win-back-btn').addEventListener('click', () => {
  document.getElementById('win-back-btn').style.display = 'none';
  document.getElementById('win-overlay').classList.add('show');
});
document.getElementById('win-next-btn').addEventListener('click', nextPuzzle);
document.getElementById('win-random-btn').addEventListener('click', winRandom);
document.getElementById('win-menu-btn').addEventListener('click', returnToWelcome);

// Energy display & modal
document.getElementById('energy-display').addEventListener('click', () => showEnergyModal(false));
document.getElementById('energy-close').addEventListener('click', () => document.getElementById('energy-modal').classList.remove('show'));

// Achievement modal
document.getElementById('trophy-btn').addEventListener('click', () => closeSettingsAndDo(showAchieveModal));
document.getElementById('achieve-close').addEventListener('click', () => document.getElementById('achieve-modal').classList.remove('show'));

// Scoreboard modal
updateOnlineUI();
document.getElementById('scoreboard-btn').addEventListener('click', () => closeSettingsAndDo(showScoreboardModal));
document.getElementById('scoreboard-close').addEventListener('click', () => document.getElementById('scoreboard-modal').classList.remove('show'));
document.querySelectorAll('.sb-tab').forEach(btn => {
  btn.addEventListener('click', () => switchSbTab(btn.dataset.tab));
});

// Modal backdrop click (with stopPropagation on content)
['help-modal', 'story-modal', 'energy-modal', 'achieve-modal', 'scoreboard-modal'].forEach(id => {
  const modal = document.getElementById(id);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
});
document.getElementById('help-close').addEventListener('click', () => document.getElementById('help-modal').classList.remove('show'));
document.getElementById('story-close').addEventListener('click', () => document.getElementById('story-modal').classList.remove('show'));

// Escape key closes modals and win overlay
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('help-modal').classList.remove('show');
    document.getElementById('story-modal').classList.remove('show');
    document.getElementById('energy-modal').classList.remove('show');
    document.getElementById('achieve-modal').classList.remove('show');
    document.getElementById('scoreboard-modal').classList.remove('show');
    if (document.getElementById('win-overlay').classList.contains('show')) {
      document.getElementById('win-overlay').classList.remove('show');
    }
  }
});

// Keyboard input
document.getElementById('puzzle-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadSelectedPuzzle();
});
document.getElementById('wp-puzzle-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') welcomeGo();
});

// Init — show offline defaults first, then update after health check
initPuzzleSelect();
showWelcomeState();
applyLanguage();
updateEnergyDisplay();
setInterval(updateEnergyDisplay, 60000);
// Check backend health, update puzzle count and UI accordingly
refreshBackendStatus().then(() => {
  initPuzzleSelect();
  showWelcomeState();
  updateOnlineUI();
});
// Re-check backend health every 5 minutes
setInterval(() => refreshBackendStatus().then(updateOnlineUI), 300000);

// URL parameter: ?p=N skips splash/welcome, starts puzzle N directly
(function handleUrlParam() {
  const params = new URLSearchParams(location.search);
  const p = parseInt(params.get('p'));
  if (p >= 1 && p <= TOTAL_PUZZLE_COUNT) {
    // Skip splash immediately
    splashDismissed = true;
    const splash = document.getElementById('splash');
    if (splash) splash.remove();
    // Start game directly
    startGame(p);
  }
})();

// Service worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
