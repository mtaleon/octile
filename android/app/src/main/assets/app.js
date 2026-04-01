'use strict';
// ──────────────────────────────────────────────
// Octile — app.js (source)
//
// After editing, rebuild the minified version:
//   npx terser app.js -o app.min.js --compress --mangle
//
// index.html loads app.min.js, NOT app.js.
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

// --- Puzzle data: 88 offline puzzles + API fetch for online ---
let PUZZLE_API; // set after config is loaded
const TOTAL_PUZZLE_COUNT = 91024;
const OFFLINE_PUZZLE_NUMS = [1,1035,2069,3104,4138,5172,6207,7241,8275,9310,10344,11379,12413,13447,14482,15516,16550,17585,18619,19653,20688,21722,22757,23791,24825,25860,26894,27928,28963,29997,31031,32066,33100,34135,35169,36203,37238,38272,39306,40341,41375,42409,43444,44478,45513,46547,47581,48616,49650,50684,51719,52753,53787,54822,55856,56891,57925,58959,59994,61028,62062,63097,64131,65165,66200,67234,68269,69303,70337,71372,72406,73440,74475,75509,76543,77578,78612,79647,80681,81715,82750,83784,84818,85853,86887,87921,88956,89990];
// --- Offline level data: 22 puzzles per level ---
const OFFLINE_LEVEL_TOTALS_8 = {easy:23008,medium:22520,hard:31848,hell:13648};
const OFFLINE_LEVEL_TOTALS_1 = {easy:2876,medium:2815,hard:3981,hell:1706};
function _getOfflineTotals() { return getTransforms() === 1 ? OFFLINE_LEVEL_TOTALS_1 : OFFLINE_LEVEL_TOTALS_8; }
const OFFLINE_LEVEL_PUZZLES = {
  easy: { nums: [2,10,11,16,58,61,65,66,87,89,94,95,232,235,239,240,279,282,290,295,297,309], cells: '!"#$,4!"#,-.!"#-./!"#-5=!"#LMN!"#JRZ!"#NV^!"#OW_!#$>FN!#$IJK!#$MU]!#$NV^!\'(JKL!\'(MNO!\'(LT\\!\'(MU]!"*<DL!"*@HP!"*LMN!"*LT\\!"*NV^!#+678' },
  medium: { nums: [99,558,668,671,1684,1878,2100,2123,2168,2232,2450,2462,2749,2920,2975,3054,4752,4766,4772,4985,5142,5197], cells: '!$%&\'(!+,3;C!/0JKL!/0KS[!NOKS["#$=>?"34!)1"56!)1"4<3;C"?@LMN"LM5=E"MN!)1#$%STU#+,MU]#/08@H#-5IQY$/0=EM$/0YZ[$,4-./$19%-5$9:<DL$<=#+3' },
  hard: { nums: [73,334,383,1017,2874,3206,3223,3971,4603,4905,4961,5013,5200,5463,6359,6674,7225,8359,9231,9332,10317,10513], cells: '!"#Z[\\!$,%-5!%-:;<!5=:;<#(0YZ[#78+3;#78TUV#OP123$!)?GO$12FGH$783;C$19LT\\$<=123$AB@HP$]^19A+@H<DL,12KS[,]^FGH45=67849:EFG4S[?GO4YZ\\]^' },
  hell: { nums: [953,3531,6634,6838,6868,7090,8364,9389,9861,4346,5441,5699,6731,7900,10541,1540,1562,6861,7498,11256,6413,7576], cells: '!78?GO#@H-5=+>?123+MU!"#+PXKS[,!)IQY,^_(084<=YZ[4FNIQY#YZCKS$@HLT\\$HP9:;+DL!"#,MNIQY4[\\ABC!GHIJK!FN$,4+PX123,?@9:;<GO!"#$_`JKL,<DKS[' },
};
const OFFLINE_CELLS = '!"#$%&!5=\\]^"*2IJK#08PX`#WXIJK$:;BCD$X`345,348@H,YZ$%&48@VWX4T\\,-.(08@HP(FE9AI0/.#+38_^[ZY8RZ#+3@-5,4<@ZY6>F?6>^]\\?!)@HP>^]JRZ>:9?GO`_^]\\[`LD%$#_WO876^QI1)!^*)876]GF?>=])!NMLUNMIA9U(\']\\[MIA+*)M-%UTSYQIA91Y;<H@8QRS^VNI"#&\'(I/\'^VNATLUMEA\'(KC;BKC#$%B`XA91C#$7/\'CGHB:2(\'&%$#(4<]\\[\'/7PON&)1IQY&RQPON%?>GFE%QY654-6519A-`_%$#519SRQ5U]-,+`XPH@8`>=A91XWV[SKP\'&#"!P*"[SKHUMTLDH"!NF>GNF&%$GYQH@8F&%2*"FBAG?7YZ[\\]^YME$%&ZRJ123[XP80([/0123\\BC:;<\\0(KLMTKLPH@T!"\\]^LPH./0L,$TUV!)19AI!CD@HP)*+&.61Z[^_`1W_&.69,4-5=9_`3;C:3;[\\]:(09AI;[\\OW_;?@:BJ';
const PUZZLE_COUNT = TOTAL_PUZZLE_COUNT;
function getEffectivePuzzleCount() { return _appConfig.puzzleSet === 11378 ? 11378 : TOTAL_PUZZLE_COUNT; }

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

// Decode offline level puzzles: slot (1-based) -> { puzzle_number, cells }
const _OFFLINE_LEVEL_MAP = {};
for (const level of ['easy','medium','hard','hell']) {
  const lp = OFFLINE_LEVEL_PUZZLES[level];
  _OFFLINE_LEVEL_MAP[level] = {};
  for (let i = 0; i < lp.nums.length; i++) {
    const o = i * 6;
    const cells = [
      lp.cells.charCodeAt(o) - 33, lp.cells.charCodeAt(o+1) - 33,
      lp.cells.charCodeAt(o+2) - 33, lp.cells.charCodeAt(o+3) - 33,
      lp.cells.charCodeAt(o+4) - 33, lp.cells.charCodeAt(o+5) - 33,
    ];
    _OFFLINE_LEVEL_MAP[level][i + 1] = { puzzle_number: lp.nums[i], cells };
    _puzzleCache[lp.nums[i]] = cells;
  }
}

// Get puzzle cells: offline lookup or API fetch
async function getPuzzleCells(puzzleNumber) {
  if (_puzzleCache[puzzleNumber]) return _puzzleCache[puzzleNumber];
  try {
    if (_debugForceOffline) throw new Error('forced offline');
    const res = await fetch(PUZZLE_API + puzzleNumber, { signal: AbortSignal.timeout(3000) });
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
    return _OFFLINE_MAP[fallback];
  }
}

// Check if backend is reachable (cached result, refreshed periodically)
let _backendOnline = null; // null = unknown, true/false = checked
let _healthCheckPromise = null;

async function checkBackendHealth() {
  if (_debugForceOffline) return false;
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
    _backendOnline = _debugForceOffline ? false : ok;
    _healthCheckPromise = null;
    if (ok !== prev) {
      fetchLevelTotals().then(() => updateWelcomeLevels());
    }
    return ok;
  });
  return _healthCheckPromise;
}

function isOnline() { return _backendOnline === true; }

// Get a valid puzzle number for current mode
function getRandomPuzzleNumber() {
  if (_backendOnline === false) return OFFLINE_PUZZLE_NUMS[Math.floor(Math.random() * OFFLINE_PUZZLE_NUMS.length)];
  return Math.floor(Math.random() * TOTAL_PUZZLE_COUNT) + 1;
}

function getMaxPuzzleNumber() {
  return _backendOnline === false ? OFFLINE_PUZZLE_NUMS.length : TOTAL_PUZZLE_COUNT;
}

// Convert display index (1-based) to puzzle number
function displayToPuzzleNumber(displayVal) {
  if (_backendOnline !== false) return displayVal;
  const idx = Math.max(0, Math.min(displayVal - 1, OFFLINE_PUZZLE_NUMS.length - 1));
  return OFFLINE_PUZZLE_NUMS[idx];
}

function puzzleNumberToDisplay(puzzleNumber) {
  if (_backendOnline !== false) return puzzleNumber;
  const idx = OFFLINE_PUZZLE_NUMS.indexOf(puzzleNumber);
  return idx >= 0 ? idx + 1 : 1;
}

// --- Level-based game flow ---
const LEVELS = ['easy', 'medium', 'hard', 'hell'];
const LEVEL_COLORS = { easy: '#2ecc71', medium: '#3498db', hard: '#e67e22', hell: '#9b59b6' };
const LEVEL_DOTS = { easy: '🟢', medium: '🔵', hard: '🟠', hell: '🟣' };
const CHAPTER_SIZES_8 = { easy: 800, medium: 800, hard: 1000, hell: 500 };
const CHAPTER_SIZES_1 = { easy: 100, medium: 100, hard: 125, hell: 65 };
const SUB_PAGE_SIZE = 100;
function getChapterSize(level) {
  var sizes = getTransforms() === 1 ? CHAPTER_SIZES_1 : CHAPTER_SIZES_8;
  return sizes[level] || (getTransforms() === 1 ? 100 : 800);
}
const WORLD_THEMES = {
  easy: { icon: '🌿', gradient: 'linear-gradient(135deg, #27ae60, #2ecc71)' },
  medium: { icon: '🌊', gradient: 'linear-gradient(135deg, #2980b9, #3498db)' },
  hard: { icon: '🌋', gradient: 'linear-gradient(135deg, #d35400, #e67e22)' },
  hell: { icon: '🌌', gradient: 'linear-gradient(135deg, #8e44ad, #9b59b6)' },
};
let _levelTotals = {}; // { easy: 23008, medium: 22520, ... }
const OFFLINE_LEVEL_MAX = 22; // number of bundled puzzles per level
let currentLevel = null; // null = free play, 'easy'/'medium'/'hard'/'hell'
let currentSlot = 0; // 1-based slot within current level

function getEffectiveLevelTotal(level) {
  const total = _levelTotals[level] || 0;
  if (!isOnline()) return Math.min(total, OFFLINE_LEVEL_MAX);
  return total;
}

function getLevelProgress(level) {
  return parseInt(localStorage.getItem('octile_level_' + level) || '0');
}

function setLevelProgress(level, completed) {
  localStorage.setItem('octile_level_' + level, completed);
}

async function fetchLevelTotals() {
  try {
    if (_debugForceOffline) throw new Error('forced offline');
    const res = await fetch(WORKER_URL + '/levels?transforms=' + getTransforms(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    _levelTotals = await res.json();
    // If backend doesn't support transforms param, divide client-side
    if (getTransforms() === 1 && _levelTotals.easy > 11378) {
      for (var k in _levelTotals) _levelTotals[k] = Math.floor(_levelTotals[k] / 8);
    }
  } catch {
    if (!_levelTotals.easy) _levelTotals = {..._getOfflineTotals()};
  }
}

async function fetchLevelPuzzle(level, slot) {
  try {
    if (_debugForceOffline) throw new Error('forced offline');
    const res = await fetch(WORKER_URL + '/level/' + level + '/puzzle/' + slot + '?transforms=' + getTransforms(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    _puzzleCache[data.puzzle_number] = data.cells;
    return data;
  } catch {
    const offline = _OFFLINE_LEVEL_MAP[level] && _OFFLINE_LEVEL_MAP[level][slot];
    if (offline) return { puzzle_number: offline.puzzle_number, level, slot, total: _levelTotals[level] || 0, cells: offline.cells };
    throw new Error('Puzzle not available offline');
  }
}

function isLevelUnlocked(level) {
  if (!isBlockUnsolved()) return true; // all levels unlocked when free
  const idx = LEVELS.indexOf(level);
  if (idx <= 0) return true; // easy is always unlocked
  const prev = LEVELS[idx - 1];
  const prevTotal = getEffectiveLevelTotal(prev);
  return prevTotal > 0 && getLevelProgress(prev) >= prevTotal;
}

// --- 3-Tier Navigation ---
let _navWorld = null;   // current world (level key) for tier 2/3
let _navChapter = null; // current chapter index (0-based) for tier 3
let _navSubPage = 0;    // current sub-page (0-based) for tier 3 pagination

function getChapterCount(level) {
  return Math.ceil(getEffectiveLevelTotal(level) / getChapterSize(level));
}

function getChapterProgress(level, chapterIdx) {
  const completed = getLevelProgress(level);
  const chSize = getChapterSize(level);
  const chapterStart = chapterIdx * chSize;
  const total = getEffectiveLevelTotal(level);
  const chapterTotal = Math.min(chSize, total - chapterStart);
  const chapterDone = Math.max(0, Math.min(chapterTotal, completed - chapterStart));
  return { done: chapterDone, total: chapterTotal };
}

// Tier 1: World Hub (horizontal carousel)
let _carouselIdx = 0;

function _goToSlide(idx) {
  idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
  _carouselIdx = idx;
  const track = document.querySelector('.carousel-track');
  if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
  document.querySelectorAll('.carousel-dots .dot').forEach(function(d, i) {
    d.classList.toggle('active', i === idx);
  });
  var arrows = document.querySelectorAll('.carousel-arrow');
  if (arrows.length === 2) {
    arrows[0].disabled = idx === 0;
    arrows[1].disabled = idx === LEVELS.length - 1;
  }
}

function renderWorldHub() {
  if (!_levelTotals.easy) _levelTotals = {..._getOfflineTotals()};
  const container = document.getElementById('wp-world-map');
  container.innerHTML = '';
  let firstIncomplete = 0;

  // Build slides
  var trackHtml = '';
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const total = getEffectiveLevelTotal(level);
    const completed = getLevelProgress(level);
    const pct = total > 0 ? Math.min(100, completed / total * 100) : 0;
    const unlocked = isLevelUnlocked(level);
    const isComplete = total > 0 && completed >= total;
    const theme = WORLD_THEMES[level];
    const color = LEVEL_COLORS[level];
    const chapters = getChapterCount(level);

    if (unlocked && !isComplete && firstIncomplete === 0 && i > 0) firstIncomplete = i;
    // If first world is incomplete, firstIncomplete stays 0

    let statusText = '';
    if (!unlocked) {
      statusText = t('wp_unlock_req').replace('{level}', t('level_' + LEVELS[i - 1]));
    } else if (isComplete) {
      statusText = '\u2713 ' + t('wp_completed');
    } else {
      statusText = completed.toLocaleString() + ' / ' + total.toLocaleString() + ' ' + t('wp_solved');
    }

    var cls = 'world-slide';
    if (!unlocked) cls += ' locked';
    if (isComplete) cls += ' completed';
    if (unlocked && !isComplete) cls += ' active';

    trackHtml += '<div class="' + cls + '" data-level="' + level + '" data-idx="' + i + '">' +
      '<div class="world-landscape">' +
        '<span class="world-badge">' + (i + 1) + '</span>' +
        '<span class="world-emoji">' + theme.icon + '</span>' +
        (!unlocked ? '<span class="world-lock">\uD83D\uDD12</span>' : '') +
      '</div>' +
      '<div class="world-details">' +
        '<div class="world-name">' + t('world_' + level) + '</div>' +
        '<div class="world-subtitle">' + t('level_' + level) + '</div>' +
        '<div class="world-counts">' + t('wp_world_counts').replace('{puzzles}', total.toLocaleString()).replace('{chapters}', chapters) + '</div>' +
        '<div class="world-status">' + statusText + '</div>' +
        '<div class="world-bar"><div class="world-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></div></div>' +
        '<div class="world-pct" style="color:' + color + '">' + Math.floor(pct) + '%</div>' +
      '</div>' +
    '</div>';
  }

  container.innerHTML =
    '<div class="carousel-track">' + trackHtml + '</div>' +
    '<div class="carousel-nav">' +
      '<button class="carousel-arrow left" aria-label="Previous">\u25C0</button>' +
      '<div class="carousel-dots">' +
        LEVELS.map(function(_, i) { return '<span class="dot' + (i === firstIncomplete ? ' active' : '') + '"></span>'; }).join('') +
      '</div>' +
      '<button class="carousel-arrow right" aria-label="Next">\u25B6</button>' +
    '</div>';

  // Click handlers for slides
  container.querySelectorAll('.world-slide:not(.locked)').forEach(function(slide) {
    slide.addEventListener('click', function() {
      openChapterGrid(slide.dataset.level);
    });
  });

  // Arrow navigation
  container.querySelector('.carousel-arrow.left').addEventListener('click', function(e) {
    e.stopPropagation();
    _goToSlide(_carouselIdx - 1);
  });
  container.querySelector('.carousel-arrow.right').addEventListener('click', function(e) {
    e.stopPropagation();
    _goToSlide(_carouselIdx + 1);
  });

  // Dot navigation
  container.querySelectorAll('.carousel-dots .dot').forEach(function(dot, i) {
    dot.addEventListener('click', function(e) {
      e.stopPropagation();
      _goToSlide(i);
    });
  });

  // Touch/pointer swipe
  var track = container.querySelector('.carousel-track');
  var startX = 0, startY = 0, dragging = false, dx = 0, swiping = false;
  track.addEventListener('pointerdown', function(e) {
    startX = e.clientX; startY = e.clientY; dragging = true; dx = 0; swiping = false;
  });
  track.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (!swiping && Math.abs(dx) > 10) {
      swiping = true;
      track.setPointerCapture(e.pointerId);
      track.style.transition = 'none';
    }
    if (!swiping) return;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return;
    var base = -_carouselIdx * 100;
    var offset = dx / container.offsetWidth * 100;
    track.style.transform = 'translateX(' + (base + offset) + '%)';
  });
  function endSwipe() {
    if (!dragging) return;
    dragging = false;
    if (!swiping) return;
    swiping = false;
    track.style.transition = '';
    if (dx > 50) _goToSlide(_carouselIdx - 1);
    else if (dx < -50) _goToSlide(_carouselIdx + 1);
    else _goToSlide(_carouselIdx);
  }
  track.addEventListener('pointerup', endSwipe);
  track.addEventListener('pointercancel', endSwipe);

  // Set initial slide
  _carouselIdx = firstIncomplete;
  _goToSlide(firstIncomplete);

  // Keyboard nav when world hub is visible
  container._keyHandler = function(e) {
    if (document.getElementById('welcome-panel').classList.contains('hidden')) return;
    if (document.getElementById('chapter-modal').classList.contains('show')) return;
    if (e.key === 'ArrowLeft') _goToSlide(_carouselIdx - 1);
    else if (e.key === 'ArrowRight') _goToSlide(_carouselIdx + 1);
  };
  document.removeEventListener('keydown', container._prevKeyHandler);
  document.addEventListener('keydown', container._keyHandler);
  container._prevKeyHandler = container._keyHandler;

  // Quick resume
  const resumeBtn = document.getElementById('wp-resume');
  let resumeLevel = null;
  for (const level of LEVELS) {
    const total = getEffectiveLevelTotal(level);
    const completed = getLevelProgress(level);
    if (isLevelUnlocked(level) && total > 0 && completed < total) {
      resumeLevel = level;
      break;
    }
  }
  if (resumeLevel) {
    const slot = getLevelProgress(resumeLevel) + 1;
    resumeBtn.innerHTML = '\u25B6 ' + t('wp_resume').replace('{level}', t('level_' + resumeLevel)).replace('{n}', slot);
    resumeBtn.style.display = '';
    resumeBtn.onclick = () => startLevel(resumeLevel);
  } else {
    resumeBtn.style.display = 'none';
  }
}

// Tier 2: Chapter Grid (full-screen modal)
function openChapterGrid(level) {
  _navWorld = level;
  const total = getEffectiveLevelTotal(level);
  const completed = getLevelProgress(level);
  const chapters = getChapterCount(level);
  const color = LEVEL_COLORS[level];

  document.getElementById('chapter-title').textContent = t('world_' + level);
  document.getElementById('chapter-progress').textContent = completed.toLocaleString() + ' / ' + total.toLocaleString();

  const grid = document.getElementById('chapter-grid');
  grid.innerHTML = '';

  // Find active chapter (first incomplete)
  let activeChapter = -1;
  for (let c = 0; c < chapters; c++) {
    const cp = getChapterProgress(level, c);
    if (cp.done < cp.total) { activeChapter = c; break; }
  }

  for (let c = 0; c < chapters; c++) {
    const cp = getChapterProgress(level, c);
    const pct = cp.total > 0 ? (cp.done / cp.total * 100) : 0;
    const isDone = cp.done >= cp.total;
    const isChapterActive = c === activeChapter;
    const isLocked = c > 0 && !isDone && c > activeChapter;

    const tile = document.createElement('button');
    tile.className = 'chapter-tile' + (isDone ? ' done' : '') + (isChapterActive ? ' active' : '') + (isLocked ? ' locked' : '');
    tile.style.setProperty('--ch-color', color);
    tile.disabled = isLocked;

    if (isDone) {
      tile.innerHTML = '<span class="ch-num">' + (c + 1) + '</span><span class="ch-check">\u2713</span>';
    } else if (pct > 0) {
      // Ring progress
      const deg = Math.round(pct * 3.6);
      tile.style.setProperty('--ch-deg', deg + 'deg');
      tile.innerHTML = '<span class="ch-num">' + (c + 1) + '</span>';
      tile.classList.add('partial');
    } else {
      tile.innerHTML = '<span class="ch-num">' + (c + 1) + '</span>';
    }

    if (!isLocked) {
      tile.addEventListener('click', () => openPuzzlePath(level, c));
    }
    grid.appendChild(tile);
  }

  // Fill empty slots up to 35 (7x5 grid)
  const gridSlots = 35;
  for (let i = chapters; i < gridSlots; i++) {
    const filler = document.createElement('div');
    filler.className = 'chapter-tile filler';
    grid.appendChild(filler);
  }

  // Show modal (no scroll needed — grid fits in view)
  document.getElementById('chapter-modal').classList.add('show');
}

// Tier 3: Puzzle Path (Snake, full-screen modal) with sub-page pagination
function openPuzzlePath(level, chapterIdx) {
  _navWorld = level;
  _navChapter = chapterIdx;

  const total = getEffectiveLevelTotal(level);
  const completed = getLevelProgress(level);
  const chSize = getChapterSize(level);
  const chapterStart = chapterIdx * chSize;
  const chapterTotal = Math.min(chSize, total - chapterStart);
  const chapterDone = Math.max(0, Math.min(chapterTotal, completed - chapterStart));
  const totalPages = Math.ceil(chapterTotal / SUB_PAGE_SIZE);

  // Auto-detect correct sub-page: page containing next unsolved puzzle
  const nextUnsolved = chapterDone; // 0-based index within chapter
  _navSubPage = Math.min(Math.floor(nextUnsolved / SUB_PAGE_SIZE), totalPages - 1);

  renderPuzzlePage(level, chapterIdx, _navSubPage);

  document.getElementById('path-modal').classList.add('show');
  setTimeout(() => {
    const nextNode = document.getElementById('path-grid').querySelector('.path-node.next');
    if (nextNode) nextNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 100);
}

function renderPuzzlePage(level, chapterIdx, subPage) {
  const total = getEffectiveLevelTotal(level);
  const completed = getLevelProgress(level);
  const chSize = getChapterSize(level);
  const chapterStart = chapterIdx * chSize;
  const chapterTotal = Math.min(chSize, total - chapterStart);
  const chapterDone = Math.max(0, Math.min(chapterTotal, completed - chapterStart));
  const color = LEVEL_COLORS[level];
  const totalPages = Math.ceil(chapterTotal / SUB_PAGE_SIZE);

  document.getElementById('path-title').textContent = t('world_' + level) + ' \u2014 ' + t('wp_chapter') + ' ' + (chapterIdx + 1);
  document.getElementById('path-progress').textContent = chapterDone + ' / ' + chapterTotal;

  // Sub-page range
  const pageStart = subPage * SUB_PAGE_SIZE; // 0-based within chapter
  const pageEnd = Math.min(pageStart + SUB_PAGE_SIZE, chapterTotal);
  const pageCount = pageEnd - pageStart;

  const pathEl = document.getElementById('path-grid');
  pathEl.innerHTML = '';

  // Pagination bar (if more than 1 page)
  if (totalPages > 1) {
    const paginationEl = document.createElement('div');
    paginationEl.className = 'path-pagination';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'path-page-btn';
    prevBtn.textContent = '\u25C0';
    prevBtn.disabled = subPage <= 0;
    prevBtn.addEventListener('click', () => { _navSubPage = subPage - 1; renderPuzzlePage(level, chapterIdx, _navSubPage); });
    const label = document.createElement('span');
    label.className = 'path-page-label';
    label.textContent = (subPage + 1) + ' / ' + totalPages;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'path-page-btn';
    nextBtn.textContent = '\u25B6';
    nextBtn.disabled = subPage >= totalPages - 1;
    nextBtn.addEventListener('click', () => { _navSubPage = subPage + 1; renderPuzzlePage(level, chapterIdx, _navSubPage); });
    paginationEl.appendChild(prevBtn);
    paginationEl.appendChild(label);
    paginationEl.appendChild(nextBtn);
    pathEl.appendChild(paginationEl);
  }

  const COLS = 5;
  const rows = Math.ceil(pageCount / COLS);

  for (let r = 0; r < rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'path-row' + (r % 2 === 1 ? ' reverse' : '');

    for (let c = 0; c < COLS; c++) {
      const idxInPage = r * COLS + c;
      if (idxInPage >= pageCount) break;
      const idxInChapter = pageStart + idxInPage;
      const slot = chapterStart + idxInChapter + 1; // 1-based global slot
      const isSolved = slot <= completed;
      const isNext = isBlockUnsolved() && slot === completed + 1;
      const isNodeLocked = isBlockUnsolved() && slot > completed + 1;

      const node = document.createElement('button');
      node.className = 'path-node' + (isSolved ? ' solved' : '') + (isNext ? ' next' : '') + (isNodeLocked ? ' locked' : '');
      node.style.setProperty('--node-color', color);

      // Display number within chapter (1-based)
      const displayNum = idxInChapter + 1;
      if (isSolved) {
        node.innerHTML = '<span class="node-check">\u2713</span>';
      } else {
        node.innerHTML = '<span class="node-num">' + displayNum + '</span>';
      }

      if (!isNodeLocked) {
        node.addEventListener('click', async () => {
          document.getElementById('path-modal').classList.remove('show');
          document.getElementById('chapter-modal').classList.remove('show');
          currentLevel = level;
          currentSlot = slot;
          try {
            const data = await fetchLevelPuzzle(level, slot);
            currentPuzzleNumber = data.puzzle_number;
            startGame(currentPuzzleNumber);
          } catch (e) {
            console.warn('[Octile] Puzzle fetch failed:', e.message);
            alert(t('offline_level_limit'));
          }
        });
      }

      rowEl.appendChild(node);

      // Add connector between nodes (except last in row)
      if (c < COLS - 1 && idxInPage + 1 < pageCount) {
        const conn = document.createElement('div');
        conn.className = 'path-conn' + (slot < completed ? ' done' : slot === completed ? ' active' : '');
        rowEl.appendChild(conn);
      }
    }

    pathEl.appendChild(rowEl);

    // Add vertical connector between rows
    if (r < rows - 1) {
      const vconn = document.createElement('div');
      vconn.className = 'path-vconn' + (r % 2 === 1 ? ' left' : ' right');
      const lastInRow = Math.min((r + 1) * COLS, pageCount);
      const slotAtEnd = chapterStart + pageStart + lastInRow;
      vconn.classList.toggle('done', slotAtEnd <= completed);
      pathEl.appendChild(vconn);
    }
  }

  // Play Next button
  const playBtn = document.getElementById('path-play-next');
  if (chapterDone < chapterTotal) {
    const nextSlot = chapterStart + chapterDone + 1;
    playBtn.textContent = '\u25B6 ' + t('wp_play_next');
    playBtn.style.display = '';
    playBtn.onclick = async () => {
      document.getElementById('path-modal').classList.remove('show');
      document.getElementById('chapter-modal').classList.remove('show');
      currentLevel = level;
      currentSlot = nextSlot;
      try {
        const data = await fetchLevelPuzzle(level, nextSlot);
        currentPuzzleNumber = data.puzzle_number;
        startGame(currentPuzzleNumber);
      } catch (e) {
        console.warn('[Octile] Puzzle fetch failed:', e.message);
        alert(t('offline_level_limit'));
      }
    };
  } else {
    playBtn.style.display = 'none';
  }
}

function showTier1() {
  _navWorld = null;
  _navChapter = null;
  renderWorldHub();
}

// Kept for compatibility — delegates to new system
function updateWelcomeLevels() {
  renderWorldHub();
}

async function startLevel(level) {
  if (!isLevelUnlocked(level)) return;
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const total = getEffectiveLevelTotal(level);
  if (total === 0) return; // level data not loaded
  currentLevel = level;
  currentSlot = getLevelProgress(level) + 1;
  if (currentSlot > total) {
    showLevelComplete(level, total);
    return;
  }
  try {
    const data = await fetchLevelPuzzle(level, currentSlot);
    currentPuzzleNumber = data.puzzle_number;
    startGame(currentPuzzleNumber);
  } catch (e) {
    console.warn('[Octile] Level puzzle fetch failed:', e.message);
    currentLevel = null;
    alert(t('offline_level_limit'));
  }
}

function advanceLevelProgress() {
  if (!currentLevel) return;
  const completed = getLevelProgress(currentLevel);
  if (currentSlot > completed) {
    setLevelProgress(currentLevel, currentSlot);
  }
}

function updateLevelNav() {
  const nav = document.getElementById('level-nav');
  if (!currentLevel) { nav.style.display = 'none'; return; }
  nav.style.display = '';
  const total = getEffectiveLevelTotal(currentLevel);
  const completed = getLevelProgress(currentLevel);
  document.getElementById('level-label').textContent =
    (LEVEL_DOTS[currentLevel] || '') + ' ' + t('level_' + currentLevel) + ' #' + currentSlot;
  document.getElementById('level-prev').disabled = currentSlot <= 1;
  // When blockUnsolved: can only advance to next unsolved (completed + 1)
  // When free: can navigate anywhere up to total
  document.getElementById('level-next').disabled = currentSlot >= total;
}

async function goLevelSlot(slot) {
  if (!currentLevel) return;
  const total = getEffectiveLevelTotal(currentLevel);
  const completed = getLevelProgress(currentLevel);
  if (slot < 1 || slot > total) return;
  if (isBlockUnsolved() && slot > completed + 1) return;
  currentSlot = slot;
  try {
    const data = await fetchLevelPuzzle(currentLevel, currentSlot);
    currentPuzzleNumber = data.puzzle_number;
    await resetGame(currentPuzzleNumber);
    updateLevelNav();
  } catch (e) {
    console.warn('[Octile] Level puzzle fetch failed:', e.message);
    alert(t('offline_level_limit'));
  }
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

function _systemLang() { return /^(zh|ko|ja)/.test(navigator.language) ? 'zh' : 'en'; }
let _langPref = localStorage.getItem('octile_lang') || 'system';
let currentLang = _langPref === 'system' ? _systemLang() : _langPref;
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
const HINT_DIAMOND_COST = 100;
const UNLOCK_PUZZLE_DIAMOND_COST = 50;

function _loadHintData() {
  try { return JSON.parse(localStorage.getItem('octile_daily_hints') || '{}'); }
  catch { return {}; }
}

function _saveHintData(data) {
  localStorage.setItem('octile_daily_hints', JSON.stringify(data));
}

// Called when a new puzzle starts — roll over to today if date changed
function rolloverDailyHints() {
  const today = new Date().toISOString().slice(0, 10);
  const data = _loadHintData();
  if (data.date !== today) {
    _saveHintData({ date: today, used: 0 });
  }
}

function getHintsUsedToday() {
  if (_debugUnlimitedHints) return 0;
  return _loadHintData().used || 0;
}

function useHint() {
  if (_debugUnlimitedHints) return;
  const data = _loadHintData();
  data.used = (data.used || 0) + 1;
  _saveHintData(data);
}
let timerStarted = false;
let piecesPlacedCount = 0; // track for tutorial

// --- API endpoints ---
const WORKER_URL = 'https://octile.owen-ouyang.workers.dev';
const SCORE_API_URL = WORKER_URL + '/score';
PUZZLE_API = WORKER_URL + '/puzzle/';
const SITE_URL = 'https://mtaleon.github.io/octile/';
const APP_VERSION_CODE = 21;
const APP_VERSION_NAME = '1.13.0';

// --- App config (loaded from config.json) ---
var _appConfig = { auth: true, blockUnsolved: true, puzzleSet: 91024 };
var _configReady = new Promise(function(resolve) {
  var url = location.protocol === 'file:' ? 'config.json' : 'config.json?t=' + Date.now();
  // Try fetch first, fall back to XMLHttpRequest for file:// compatibility
  function tryXHR() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'config.json', true);
      xhr.onload = function() {
        try { _appConfig = Object.assign(_appConfig, JSON.parse(xhr.responseText)); } catch(e) {}
        resolve();
      };
      xhr.onerror = function() { resolve(); };
      xhr.send();
    } catch(e) { resolve(); }
  }
  try {
    fetch(url).then(function(r) { return r.ok ? r.json() : null; }).then(function(c) {
      if (c) { _appConfig = Object.assign(_appConfig, c); resolve(); }
      else tryXHR();
    }).catch(function() { tryXHR(); });
  } catch(e) { tryXHR(); }
});

function isAuthEnabled() { return !!_appConfig.auth; }
function isBlockUnsolved() { return !!_appConfig.blockUnsolved; }
function getTransforms() { return _appConfig.puzzleSet === 11378 ? 1 : 8; }

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

// --- Cloudflare Turnstile (invisible, loaded only on valid web origins) ---
const CF_TURNSTILE_SITE_KEY = '0x4AAAAAACuir272GuoMUfnx';  // Set to your Turnstile site key
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
  const left = Math.max(0, MAX_HINTS - getHintsUsedToday());
  if (left <= 0) {
    btn.textContent = t('hint') + ' (\uD83D\uDC8E' + HINT_DIAMOND_COST + ')';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = 'pointer';
  } else {
    btn.textContent = t('hint') + ' (' + left + ')';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = 'pointer';
  }
}

function showHint() {
  if (gameOver || hintTimeout) return;
  if (getHintsUsedToday() >= MAX_HINTS) {
    showDiamondPurchase(t('hint_buy_name'), HINT_DIAMOND_COST, () => {
      _grantBonusHint();
      _doShowHint();
    });
    return;
  }
  _doShowHint();
}

function _grantBonusHint() {
  const data = _loadHintData();
  data.used = Math.max(0, (data.used || 0) - 1);
  _saveHintData(data);
  updateHintBtn();
}

function _doShowHint() {
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

  playSound('hint'); haptic(20);
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

async function loadRandomPuzzle() {
  if (!hasEnoughEnergy()) { showEnergyModal(true); return; }
  const num = getRandomPuzzleNumber();
  currentLevel = null;
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
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    maybeShowEncourageToast();
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
    playSound('rotate'); haptic(8);
  } else {
    selectedPiece = piece;
    playSound('select'); haptic(10);
  }
  renderPool();
}

const POOL_CELL_PX = PIECE_CELL_PX; // same size as original

function renderPool() {
  const poolEl = document.getElementById('pool');
  poolEl.innerHTML = '';
  pieces.filter(p => !p.auto).forEach(p => {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-wrapper' + (p.placed ? ' placed' : '');

    const el = document.createElement('div');
    el.className = 'piece' + (selectedPiece === p ? ' selected' : '');
    el.dataset.id = p.id;
    const shape = p.currentShape;
    const rows = shape.length, cols = shape[0].length;
    el.style.gridTemplateColumns = `repeat(${cols}, ${POOL_CELL_PX}px)`;
    el.style.gridTemplateRows = `repeat(${rows}, ${POOL_CELL_PX}px)`;
    el.style.setProperty('--cols', cols);
    el.style.setProperty('--rows', rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        cell.style.width = POOL_CELL_PX + 'px';
        cell.style.height = POOL_CELL_PX + 'px';
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
  updatePoolScrollHints();
  requestAnimationFrame(updatePoolScrollHints);
}

function updatePoolScrollHints() {
  const pool = document.getElementById('pool');
  const wrap = document.getElementById('pool-scroll');
  if (!pool || !wrap) return;
  const atStart = pool.scrollLeft <= 2;
  const atEnd = pool.scrollLeft + pool.clientWidth >= pool.scrollWidth - 2;
  wrap.classList.toggle('at-start', atStart);
  wrap.classList.toggle('at-end', atEnd);
  var leftBtn = document.getElementById('pool-left');
  var rightBtn = document.getElementById('pool-right');
  if (leftBtn) leftBtn.disabled = atStart;
  if (rightBtn) rightBtn.disabled = atEnd;
}

let _poolHintShown = false;
function showPoolScrollHint() {
  if (_poolHintShown) return;
  const pool = document.getElementById('pool');
  const hint = document.getElementById('pool-hint');
  if (!pool || !hint) return;
  const overflows = pool.scrollWidth > pool.clientWidth + 4;
  hint.textContent = overflows ? t('pool_scroll_hint') : t('pool_rotate_hint');
  hint.classList.remove('hidden');
  _poolHintShown = true;
  setTimeout(dismissPoolScrollHint, 8000);
}
function dismissPoolScrollHint() {
  const hint = document.getElementById('pool-hint');
  if (hint) hint.classList.add('hidden');
}

// Listen for pool scroll to update fade hints and dismiss scroll hint
document.getElementById('pool').addEventListener('scroll', () => {
  updatePoolScrollHints();
  dismissPoolScrollHint();
}, { passive: true });

// Pool arrow buttons (mobile)
function scrollPool(dir) {
  var pool = document.getElementById('pool');
  if (!pool) return;
  pool.scrollBy({ left: dir * pool.clientWidth * 0.6, behavior: 'smooth' });
}
document.getElementById('pool-left').addEventListener('click', () => scrollPool(-1));
document.getElementById('pool-right').addEventListener('click', () => scrollPool(1));

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
  playSound('remove'); haptic(10);
  renderBoard();

  buildGhost(piece);
  moveGhost(e.clientX, e.clientY);
}

function onPiecePointerDown(e, piece) {
  if (gameOver || paused) return;
  ensureTimerRunning();
  dismissPoolScrollHint();
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // Store piece and offset info for potential drag
  const shape = piece.currentShape;
  const cols = shape[0].length;
  const pieceEl = e.currentTarget;
  const rect = pieceEl.getBoundingClientRect();
  const cellW = POOL_CELL_PX + 1;
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
      if (!dragPiece) return;
      const { row, col } = getBoardPosForGhost(ue.clientX, ue.clientY);
      const sh = dragPiece.currentShape;
      const startR = row - dragOffsetRow;
      const startC = col - dragOffsetCol;
      if (canPlace(sh, startR, startC, null)) {
        placePiece(sh, startR, startC, dragPiece.id);
        dragPiece.placed = true;
        piecesPlacedCount++;
        playSound('place'); haptic(15);
        renderBoard();
        renderPool();
        maybeShowEncourageToast();
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
    playSound('place'); haptic(15);
    renderBoard(); triggerSnap();
    renderPool();
    maybeShowEncourageToast();
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
  if (totalUnique === 1) msgs.push(...t('motiv_first').map(s => s.replace('{remain}', (getEffectivePuzzleCount() - 1).toLocaleString())));
  else if (totalUnique === 10) msgs.push(...t('motiv_10'));
  else if (totalUnique === 50) msgs.push(...t('motiv_50'));
  else if (totalUnique === 100) msgs.push(...t('motiv_100'));
  else if (totalUnique === 500) msgs.push(...t('motiv_500'));
  else if (totalUnique === 1000) msgs.push(...t('motiv_1000'));
  else if (totalUnique % 100 === 0) msgs.push(...t('motiv_hundred').map(s => s.replace('{n}', totalUnique)));
  // Progress
  const pct = (totalUnique / getEffectivePuzzleCount() * 100).toFixed(1);
  if (totalUnique > 1 && !msgs.length) {
    msgs.push(...t('motiv_progress').map(s => s.replace('{n}', totalUnique).replace('{total}', getEffectivePuzzleCount().toLocaleString()).replace('{pct}', pct)));
  }
  return msgs.length ? msgs[Math.floor(Math.random() * msgs.length)] : '';
}

// --- Energy System ---
const ENERGY_MAX = 5;
const ENERGY_RESTORE_COST = 50;
const ENERGY_RECOVERY_PERIOD = 10 * 60 * 60; // 10 hours full refill (1 per 2h)
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
  if (_debugUnlimitedEnergy) return;
  const state = getEnergyState();
  const newPoints = Math.max(0, state.points - cost);
  saveEnergyState(newPoints);
  updateEnergyDisplay();
}

function hasEnoughEnergy() {
  if (_debugUnlimitedEnergy) return true;
  // First puzzle of the day is always free
  const stats = getDailyStats();
  if (stats.puzzles === 0) return true;
  return getEnergyState().points >= 1;
}

function energyCost(_elapsedSec) {
  // First puzzle of the day is free
  const stats = getDailyStats();
  if (stats.puzzles === 0) return 0;
  return 1; // flat cost
}

function updateEnergyDisplay() {
  const state = getEnergyState();
  const pts = state.points;
  const plays = Math.floor(pts);
  const display = document.getElementById('energy-display');
  const valueEl = document.getElementById('energy-value');
  // Show as plays remaining; add +1 visual if first daily puzzle is free
  const stats = getDailyStats();
  const freePlay = stats.puzzles === 0 ? 1 : 0;
  valueEl.textContent = plays + freePlay;
  display.classList.remove('low', 'empty');
  if (plays + freePlay <= 0) display.classList.add('empty');
  else if (plays + freePlay <= 2) display.classList.add('low');
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
  const plays = Math.floor(pts);
  const stats = getDailyStats();
  const freePlay = stats.puzzles === 0 ? 1 : 0;
  const totalPlays = plays + freePlay;

  const titleEl = document.getElementById('energy-modal-title');
  titleEl.textContent = isOutOfEnergy ? t('energy_break_title') : t('energy_title');

  const bar = document.getElementById('energy-bar');
  const pct = (pts / ENERGY_MAX) * 100;
  bar.style.width = pct + '%';
  bar.classList.remove('low', 'empty');
  if (totalPlays <= 0) bar.classList.add('empty');
  else if (totalPlays <= 2) bar.classList.add('low');

  // Plays remaining
  document.getElementById('energy-points-display').textContent = t('energy_plays').replace('{n}', totalPlays);

  // Recovery info
  const recoveryEl = document.getElementById('energy-recovery-info');
  if (pts >= ENERGY_MAX) {
    recoveryEl.style.display = 'none';
  } else {
    const secsToNext = Math.ceil((Math.ceil(pts) + 1 - pts) / ENERGY_PER_SECOND);
    const secsToFull = Math.ceil((ENERGY_MAX - pts) / ENERGY_PER_SECOND);
    recoveryEl.style.display = '';
    recoveryEl.innerHTML = t('energy_next_play').replace('{time}', formatTimeHMS(secsToNext)) +
      '<br>' + t('energy_full_in').replace('{time}', formatTimeHMS(secsToFull));
  }

  // Daily stats
  document.getElementById('energy-daily-stats').textContent = t('energy_today').replace('{n}', stats.puzzles).replace('{cost}', stats.spent);

  // Tip area — context-sensitive messaging
  const tipEl = document.getElementById('energy-tip');
  tipEl.style.display = '';
  if (isOutOfEnergy) {
    // "Take a break" — caring, with time info
    const secsToNext = Math.ceil((1 - (pts % 1 || 0)) / ENERGY_PER_SECOND);
    tipEl.innerHTML = t('energy_break_msg').replace('{time}', formatTimeHMS(secsToNext)).replace(/\n/g, '<br>')
      + '<br><br><em>' + t('energy_break_quote') + '</em>';
  } else if (totalPlays === 1) {
    // Soft warning — "1 puzzle left, break might be nice"
    tipEl.innerHTML = t('energy_last_one');
  } else if (freePlay) {
    tipEl.innerHTML = t('energy_free_hint').replace(/\n/g, '<br>');
  } else {
    tipEl.textContent = t('energy_tip');
    tipEl.style.display = totalPlays <= 3 ? '' : 'none';
  }

  // Energy restore button
  var restoreBtn = document.getElementById('energy-restore-btn');
  if (totalPlays < ENERGY_MAX) {
    restoreBtn.textContent = t('energy_restore').replace('{cost}', ENERGY_RESTORE_COST);
    restoreBtn.classList.add('show');
    restoreBtn.onclick = () => {
      document.getElementById('energy-modal').classList.remove('show');
      showDiamondPurchase(t('energy_restore_item'), ENERGY_RESTORE_COST, () => {
        // Add 1 energy point
        var st = getEnergyState();
        var newPts = Math.min(ENERGY_MAX, st.points + 1);
        localStorage.setItem('octile_energy', JSON.stringify({ points: newPts, ts: Date.now() }));
        updateEnergyDisplay();
        showEnergyModal(false);
      });
    };
  } else {
    restoreBtn.classList.remove('show');
  }

  document.getElementById('energy-modal').classList.add('show');
}

// --- Achievement System ---
// --- EXP + Diamond System ---
const EXP_BASE = { easy: 100, medium: 250, hard: 750, hell: 2000 };
const PAR_TIMES = { easy: 60, medium: 90, hard: 120, hell: 180 };

// Migrate old coins to EXP on first load
(function _migrateCoinsToExp() {
  if (localStorage.getItem('octile_exp') === null && localStorage.getItem('octile_coins') !== null) {
    localStorage.setItem('octile_exp', localStorage.getItem('octile_coins'));
  }
})();

function getExp() {
  return parseInt(localStorage.getItem('octile_exp') || '0');
}

function addExp(amount) {
  const total = getExp() + amount;
  localStorage.setItem('octile_exp', total);
  updateExpDisplay();
  return total;
}

function updateExpDisplay() {
  const el = document.getElementById('exp-value');
  if (el) el.textContent = getExp().toLocaleString();
}

function getDiamonds() {
  return parseInt(localStorage.getItem('octile_diamonds') || '0');
}

function addDiamonds(amount) {
  const total = getDiamonds() + amount;
  localStorage.setItem('octile_diamonds', total);
  updateDiamondDisplay();
  return total;
}

function updateDiamondDisplay() {
  const el = document.getElementById('diamond-value');
  if (el) el.textContent = getDiamonds().toLocaleString();
}

// --- Diamond Purchase Confirmation Dialog ---
let _dpOnConfirm = null;
function showDiamondPurchase(itemName, cost, onConfirm) {
  _dpOnConfirm = onConfirm;
  const balance = getDiamonds();
  document.getElementById('dp-title').textContent = t('dp_title');
  document.getElementById('dp-item-name').textContent = itemName;
  document.getElementById('dp-cost-label').textContent = t('dp_cost_label');
  document.getElementById('dp-cost-value').textContent = cost.toLocaleString() + ' \uD83D\uDC8E';
  document.getElementById('dp-balance-label').textContent = t('dp_balance_label');
  document.getElementById('dp-balance-value').textContent = balance.toLocaleString() + ' \uD83D\uDC8E';
  const insuffEl = document.getElementById('dp-insufficient');
  const confirmBtn = document.getElementById('dp-confirm');
  if (balance < cost) {
    insuffEl.textContent = t('dp_insufficient');
    confirmBtn.disabled = true;
  } else {
    insuffEl.textContent = '';
    confirmBtn.disabled = false;
  }
  document.getElementById('dp-cancel').textContent = t('dp_cancel');
  confirmBtn.textContent = t('dp_confirm');
  confirmBtn.onclick = () => {
    addDiamonds(-cost);
    document.getElementById('diamond-purchase-modal').classList.remove('show');
    if (_dpOnConfirm) _dpOnConfirm();
    _dpOnConfirm = null;
  };
  document.getElementById('diamond-purchase-modal').classList.add('show');
}
document.getElementById('dp-cancel').addEventListener('click', () => {
  document.getElementById('diamond-purchase-modal').classList.remove('show');
  _dpOnConfirm = null;
});
document.getElementById('diamond-purchase-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('show');
    _dpOnConfirm = null;
  }
});

// Skill grade: S/A/B based on par time and hints
function calcSkillGrade(level, elapsed) {
  const par = PAR_TIMES[level] || 90;
  const noHint = getHintsUsedToday() === 0;
  if (elapsed <= par && noHint) return 'S';
  if (elapsed <= par * 2 || noHint) return 'A';
  return 'B';
}

function gradeMultiplier(grade) {
  if (grade === 'S') return 2.0;
  if (grade === 'A') return 1.5;
  return 1.0;
}

function calcPuzzleExp(level, elapsed) {
  const base = EXP_BASE[level] || 100;
  const grade = calcSkillGrade(level, elapsed);
  return Math.round(base * gradeMultiplier(grade));
}

function getChaptersCompleted() {
  return parseInt(localStorage.getItem('octile_chapters_completed') || '0');
}

function incrementChaptersCompleted() {
  const n = getChaptersCompleted() + 1;
  localStorage.setItem('octile_chapters_completed', n);
  return n;
}

// Daily check-in with streak combo
function getDailyCheckin() {
  try { return JSON.parse(localStorage.getItem('octile_daily_checkin') || '{}'); }
  catch { return {}; }
}

function doDailyCheckin() {
  const today = new Date().toISOString().slice(0, 10);
  const data = getDailyCheckin();
  if (data.lastDate === today) return null; // already checked in today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let combo = 1;
  if (data.lastDate === yesterday) {
    combo = (data.combo || 0) + 1;
  }
  const baseDiamonds = 5;
  // Combo bonus: day1=5, day2=10, day3=15... capped at day7=35, then repeats
  const comboDay = Math.min(combo, 7);
  const reward = baseDiamonds * comboDay;
  const newData = { lastDate: today, combo: combo };
  localStorage.setItem('octile_daily_checkin', JSON.stringify(newData));
  addDiamonds(reward);
  return { reward, combo };
}

function showDailyCheckinToast(reward, combo) {
  const toast = document.getElementById('achieve-toast');
  toast.querySelector('.toast-icon').textContent = '\uD83D\uDC8E';
  toast.querySelector('.toast-label').textContent = t('daily_checkin');
  toast.querySelector('.toast-name').textContent = t('daily_checkin_reward').replace('{diamonds}', reward).replace('{combo}', combo);
  toast.classList.add('show');
  if (achieveToastTimer) clearTimeout(achieveToastTimer);
  achieveToastTimer = setTimeout(() => { toast.classList.remove('show'); achieveToastTimer = null; }, 3500);
}

function getClaimedAchievements() {
  try { return JSON.parse(localStorage.getItem('octile_ach_claimed') || '{}'); }
  catch { return {}; }
}

function claimAchievementDiamonds(achId) {
  const claimed = getClaimedAchievements();
  if (claimed[achId]) return 0;
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach) return 0;
  claimed[achId] = Date.now();
  localStorage.setItem('octile_ach_claimed', JSON.stringify(claimed));
  addDiamonds(ach.diamonds);
  return ach.diamonds;
}

const ACHIEVEMENTS = [
  // Milestone: unique puzzles solved
  { id: 'first_solve',   icon: '\uD83C\uDFAF', cat: 'milestone', diamonds: 50,   check: s => s.unique >= 1 },
  { id: 'solve_10',      icon: '\u2B50',         cat: 'milestone', diamonds: 100,  check: s => s.unique >= 10 },
  { id: 'solve_50',      icon: '\uD83C\uDF1F',   cat: 'milestone', diamonds: 200,  check: s => s.unique >= 50 },
  { id: 'solve_100',     icon: '\uD83D\uDD25',   cat: 'milestone', diamonds: 500,  check: s => s.unique >= 100 },
  { id: 'solve_500',     icon: '\uD83D\uDC8E',   cat: 'milestone', diamonds: 1000, check: s => s.unique >= 500 },
  { id: 'solve_1000',    icon: '\uD83D\uDC51',   cat: 'milestone', diamonds: 2000, check: s => s.unique >= 1000 },
  { id: 'solve_5000',    icon: '\uD83C\uDFC6',   cat: 'milestone', diamonds: 5000, check: s => s.unique >= 5000 },
  { id: 'solve_all',     icon: '\uD83C\uDF0C',   cat: 'milestone', diamonds: 50000,check: s => s.unique >= getEffectivePuzzleCount() },
  // Speed
  { id: 'speed_60',      icon: '\u23F1\uFE0F',   cat: 'speed', diamonds: 100,  check: s => s.elapsed <= 60 },
  { id: 'speed_45',      icon: '\u23F3',          cat: 'speed', diamonds: 200,  check: s => s.elapsed <= 45 },
  { id: 'speed_30',      icon: '\u26A1',          cat: 'speed', diamonds: 300,  check: s => s.elapsed <= 30 },
  { id: 'speed_15',      icon: '\uD83D\uDE80',   cat: 'speed', diamonds: 500,  check: s => s.elapsed <= 15 },
  // Dedication
  { id: 'total_20',      icon: '\uD83D\uDD01',   cat: 'dedication', diamonds: 100,  check: s => s.total >= 20 },
  { id: 'total_100',     icon: '\uD83D\uDCAA',   cat: 'dedication', diamonds: 300,  check: s => s.total >= 100 },
  { id: 'total_500',     icon: '\uD83C\uDFCB\uFE0F', cat: 'dedication', diamonds: 500,  check: s => s.total >= 500 },
  { id: 'total_1000',    icon: '\uD83C\uDF96\uFE0F', cat: 'dedication', diamonds: 1000, check: s => s.total >= 1000 },
  // Streak (consecutive days)
  { id: 'streak_3',      icon: '\uD83D\uDD25',   cat: 'streak', diamonds: 50,   check: s => s.streak >= 3 },
  { id: 'streak_7',      icon: '\uD83C\uDF08',   cat: 'streak', diamonds: 100,  check: s => s.streak >= 7 },
  { id: 'streak_30',     icon: '\u2604\uFE0F',   cat: 'streak', diamonds: 300,  check: s => s.streak >= 30 },
  { id: 'streak_100',    icon: '\uD83C\uDF0B',   cat: 'streak', diamonds: 500,  check: s => s.streak >= 100 },
  { id: 'streak_200',    icon: '\uD83C\uDF0A',   cat: 'streak', diamonds: 1000, check: s => s.streak >= 200 },
  { id: 'streak_300',    icon: '\uD83C\uDF0D',   cat: 'streak', diamonds: 1500, check: s => s.streak >= 300 },
  { id: 'streak_365',    icon: '\uD83C\uDF89',   cat: 'streak', diamonds: 2000, check: s => s.streak >= 365 },
  // Special
  { id: 'no_hint',       icon: '\uD83E\uDDD0',   cat: 'special', diamonds: 100,  check: s => s.noHint },
  { id: 'five_in_day',   icon: '\uD83C\uDF86',   cat: 'special', diamonds: 150,  check: s => s.dailyCount >= 5 },
  { id: 'ten_in_day',    icon: '\uD83D\uDCAF',   cat: 'special', diamonds: 300,  check: s => s.dailyCount >= 10 },
  { id: 'night_owl',     icon: '\uD83E\uDD89',   cat: 'special', diamonds: 100,  check: s => { const h = new Date().getHours(); return h >= 0 && h < 5 && s.justSolved; } },
  { id: 'night_100',     icon: '\uD83C\uDF19',   cat: 'special', diamonds: 500,  check: s => s.nightSolves >= 100 },
  { id: 'morning_100',   icon: '\uD83C\uDF05',   cat: 'special', diamonds: 500,  check: s => s.morningSolves >= 100 },
  { id: 'rank_1',        icon: '\uD83E\uDD47',   cat: 'special', diamonds: 1000, check: s => s.isRank1 },
  { id: 'weekend',       icon: '\uD83C\uDFD6\uFE0F', cat: 'special', diamonds: 50,   check: s => { const d = new Date().getDay(); return (d === 0 || d === 6) && s.justSolved; } },
  // Level progress
  { id: 'easy_100',      icon: '\uD83C\uDF3F',   cat: 'levels', diamonds: 200,  check: s => s.levelEasy >= 100 },
  { id: 'easy_1000',     icon: '\uD83C\uDF3E',   cat: 'levels', diamonds: 1000, check: s => s.levelEasy >= 1000 },
  { id: 'medium_100',    icon: '\uD83D\uDD36',   cat: 'levels', diamonds: 300,  check: s => s.levelMedium >= 100 },
  { id: 'medium_1000',   icon: '\uD83D\uDD37',   cat: 'levels', diamonds: 1500, check: s => s.levelMedium >= 1000 },
  { id: 'hard_100',      icon: '\uD83D\uDD38',   cat: 'levels', diamonds: 500,  check: s => s.levelHard >= 100 },
  { id: 'hard_1000',     icon: '\uD83D\uDD39',   cat: 'levels', diamonds: 2000, check: s => s.levelHard >= 1000 },
  { id: 'hell_100',      icon: '\uD83D\uDD3A',   cat: 'levels', diamonds: 800,  check: s => s.levelHell >= 100 },
  { id: 'hell_1000',     icon: '\uD83D\uDD3B',   cat: 'levels', diamonds: 3000, check: s => s.levelHell >= 1000 },
  // Chapter milestones
  { id: 'chapter_1',     icon: '\uD83D\uDCD6',   cat: 'milestone', diamonds: 100,  check: s => s.chaptersCompleted >= 1 },
  { id: 'chapter_10',    icon: '\uD83D\uDCDA',   cat: 'milestone', diamonds: 500,  check: s => s.chaptersCompleted >= 10 },
  { id: 'chapter_50',    icon: '\uD83C\uDFF0',   cat: 'milestone', diamonds: 2000, check: s => s.chaptersCompleted >= 50 },
  { id: 'chapter_100',   icon: '\uD83C\uDF1F',   cat: 'milestone', diamonds: 5000, check: s => s.chaptersCompleted >= 100 },
  // World Conqueror (one per world)
  { id: 'conquer_easy',  icon: '\uD83C\uDF3F',   cat: 'special', diamonds: 2000,  check: s => s.levelEasy >= s.totalEasy && s.totalEasy > 0 },
  { id: 'conquer_medium',icon: '\uD83C\uDF0A',   cat: 'special', diamonds: 3000,  check: s => s.levelMedium >= s.totalMedium && s.totalMedium > 0 },
  { id: 'conquer_hard',  icon: '\uD83C\uDF0B',   cat: 'special', diamonds: 5000,  check: s => s.levelHard >= s.totalHard && s.totalHard > 0 },
  { id: 'conquer_hell',  icon: '\uD83C\uDF0C',   cat: 'special', diamonds: 10000, check: s => s.levelHell >= s.totalHell && s.totalHell > 0 },
  // Monthly: solve at least one puzzle in each month
  { id: 'month_1',  icon: '\u2744\uFE0F',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[0] },
  { id: 'month_2',  icon: '\uD83C\uDF38',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[1] },
  { id: 'month_3',  icon: '\uD83C\uDF31',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[2] },
  { id: 'month_4',  icon: '\uD83C\uDF27\uFE0F', cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[3] },
  { id: 'month_5',  icon: '\uD83C\uDF3B',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[4] },
  { id: 'month_6',  icon: '\u2600\uFE0F',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[5] },
  { id: 'month_7',  icon: '\uD83C\uDF34',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[6] },
  { id: 'month_8',  icon: '\uD83C\uDF1E',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[7] },
  { id: 'month_9',  icon: '\uD83C\uDF42',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[8] },
  { id: 'month_10', icon: '\uD83C\uDF83',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[9] },
  { id: 'month_11', icon: '\uD83C\uDF41',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[10] },
  { id: 'month_12', icon: '\uD83C\uDF84',   cat: 'monthly', diamonds: 50,  check: s => s.months && s.months[11] },
  { id: 'spring',     icon: '\uD83C\uDF38', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[2] && s.months[3] && s.months[4] },
  { id: 'summer',     icon: '\u2600\uFE0F', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[5] && s.months[6] && s.months[7] },
  { id: 'autumn',     icon: '\uD83C\uDF42', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[8] && s.months[9] && s.months[10] },
  { id: 'winter',     icon: '\u2744\uFE0F', cat: 'monthly', diamonds: 200,  check: s => s.months && s.months[11] && s.months[0] && s.months[1] },
  { id: 'half_year',  icon: '\uD83C\uDF17', cat: 'monthly', diamonds: 500,  check: s => s.months && s.months.filter(Boolean).length >= 6 },
  { id: 'all_months', icon: '\uD83C\uDF0D', cat: 'monthly', diamonds: 1000, check: s => s.months && s.months.every(Boolean) },
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
  playSound('achieve'); haptic([30, 20, 60]);
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
    // Add to message center
    for (var _mi = 0; _mi < newlyUnlocked.length; _mi++) {
      var _ach = newlyUnlocked[_mi];
      addMessage('achievement', _ach.icon, 'achieve_unlocked', 'ach_' + _ach.id, { achId: _ach.id });
    }
  }
  return newlyUnlocked;
}

let _achieveTab = 'main';

function _renderAchieveCards(filtered) {
  const unlocked = getUnlockedAchievements();
  const claimed = getClaimedAchievements();
  const grid = document.getElementById('achieve-grid');
  grid.innerHTML = '';
  for (const ach of filtered) {
    const isUnlocked = !!unlocked[ach.id];
    const isClaimed = !!claimed[ach.id];
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
    descDiv.textContent = t('ach_' + ach.id + '_desc').replace('{total}', getEffectivePuzzleCount().toLocaleString());

    const expDiv = document.createElement('div');
    expDiv.className = 'achieve-exp';
    expDiv.textContent = '\uD83D\uDC8E ' + ach.diamonds;

    card.appendChild(iconDiv);
    card.appendChild(nameDiv);
    card.appendChild(descDiv);
    card.appendChild(expDiv);

    if (isUnlocked) {
      if (isClaimed) {
        const claimedDiv = document.createElement('div');
        claimedDiv.className = 'achieve-claimed';
        claimedDiv.textContent = '\u2713 ' + t('ach_claimed');
        card.appendChild(claimedDiv);
      } else {
        const claimBtn = document.createElement('button');
        claimBtn.className = 'achieve-claim';
        claimBtn.textContent = t('ach_claim') + ' \uD83D\uDC8E' + ach.diamonds;
        claimBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          claimAchievementDiamonds(ach.id);
          _renderAchieveCards(filtered);
          renderAchieveModal();
        });
        card.appendChild(claimBtn);
      }
      const dateDiv = document.createElement('div');
      dateDiv.className = 'achieve-date';
      dateDiv.textContent = new Date(unlocked[ach.id]).toLocaleDateString();
      card.appendChild(dateDiv);
    }

    grid.appendChild(card);
  }
}

function _renderProgressTab() {
  const grid = document.getElementById('achieve-grid');
  grid.innerHTML = '';

  // Fetch level totals if not loaded yet
  if (!_levelTotals.easy) {
    if (isOnline()) {
      grid.innerHTML = '<div style="text-align:center;color:#888;padding:20px">' + t('sb_loading') + '</div>';
      fetchLevelTotals().then(() => _renderProgressTab());
      return;
    }
    _levelTotals = {..._getOfflineTotals()};
  }

  const container = document.createElement('div');
  container.className = 'progress-levels';

  for (const level of LEVELS) {
    const total = getEffectiveLevelTotal(level);
    const completed = getLevelProgress(level);
    const pct = total > 0 ? (completed / total * 100) : 0;
    const color = LEVEL_COLORS[level];

    const card = document.createElement('div');
    card.className = 'progress-level-card';

    card.innerHTML = '<div class="progress-level-header">'
      + '<span class="progress-level-dot" style="background:' + color + '"></span>'
      + '<span class="progress-level-name">' + t('level_' + level) + '</span>'
      + '<span class="progress-level-count">' + completed + ' / ' + total + '</span>'
      + '</div>'
      + '<div class="progress-level-bar"><div class="progress-level-fill" style="width:' + Math.min(100, pct).toFixed(1) + '%;background:' + color + '"></div></div>'
      + '<div class="progress-level-pct">' + pct.toFixed(1) + '%</div>';

    container.appendChild(card);
  }

  // Total across all levels
  const totalAll = LEVELS.reduce((s, l) => s + getEffectiveLevelTotal(l), 0);
  const completedAll = LEVELS.reduce((s, l) => s + getLevelProgress(l), 0);
  const pctAll = totalAll > 0 ? (completedAll / totalAll * 100) : 0;

  const totalCard = document.createElement('div');
  totalCard.className = 'progress-level-card progress-total';
  totalCard.innerHTML = '<div class="progress-level-header">'
    + '<span class="progress-level-name">' + t('progress_total') + '</span>'
    + '<span class="progress-level-count">' + completedAll + ' / ' + totalAll + '</span>'
    + '</div>'
    + '<div class="progress-level-bar"><div class="progress-level-fill" style="width:' + Math.min(100, pctAll).toFixed(1) + '%;background:#3498db"></div></div>'
    + '<div class="progress-level-pct">' + pctAll.toFixed(1) + '%</div>';
  container.appendChild(totalCard);

  grid.appendChild(container);
}

function _renderAchieveGrid(tab) {
  if (tab === 'progress') {
    _renderProgressTab();
  } else if (tab === 'calendar') {
    _renderAchieveCards(ACHIEVEMENTS.filter(a => a.cat === 'monthly'));
  } else {
    _renderAchieveCards(ACHIEVEMENTS.filter(a => a.cat !== 'monthly'));
  }
}

function renderAchieveModal() {
  const unlocked = getUnlockedAchievements();
  const unlockedCount = Object.keys(unlocked).length;
  const totalCount = ACHIEVEMENTS.length;

  document.getElementById('achieve-modal-title').textContent = t('achieve_title');
  document.getElementById('achieve-summary').innerHTML = t('achieve_summary').replace('{n}', unlockedCount).replace('{total}', totalCount)
    + ' &nbsp;\u2B50 ' + getExp().toLocaleString() + ' &nbsp;\uD83D\uDC8E ' + getDiamonds().toLocaleString();

  const tabs = document.getElementById('achieve-tabs');
  const tabLabels = {
    main: t('achieve_tab_main'),
    progress: t('achieve_tab_progress'),
    calendar: t('achieve_tab_calendar'),
  };
  tabs.querySelectorAll('.achieve-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _achieveTab);
    btn.textContent = tabLabels[btn.dataset.tab] || btn.dataset.tab;
  });

  _renderAchieveGrid(_achieveTab);
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

function sbAvatarHTML(uuid, size, picture) {
  if (picture) {
    return '<div class="sb-avatar" style="width:' + size + 'px;height:' + size + 'px"><img src="' + picture + '" width="' + size + '" height="' + size + '" style="border-radius:' + Math.round(size * 0.22) + 'px;object-fit:cover" referrerpolicy="no-referrer"></div>';
  }
  return '<div class="sb-avatar" style="width:' + size + 'px;height:' + size + 'px">' + generateAvatar(uuid, size) + '</div>';
}

function escapeHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function sbDisplayName(uuid, serverName) {
  if (serverName) return serverName;
  var authUser = getAuthUser();
  if (authUser && authUser.display_name && uuid === getBrowserUUID()) return authUser.display_name;
  return generateCuteName(uuid);
}

function sbPicture(uuid, serverPicture) {
  if (serverPicture) return serverPicture;
  var authUser = getAuthUser();
  if (authUser && authUser.picture && uuid === getBrowserUUID()) return authUser.picture;
  return null;
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
  // Hide league tab for anonymous users
  document.getElementById('sb-tab-league').style.display = isAuthenticated() ? '' : 'none';
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
  else if (tab === 'league') renderLeagueTab();
}

async function renderGlobalTab() {
  const panel = document.getElementById('sb-panel-global');
  panel.innerHTML = sbLoading();
  try {
    const res = await fetch(WORKER_URL + '/leaderboard?limit=100', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const ranked = data.leaderboard || [];
    if (!ranked.length) { panel.innerHTML = sbEmpty(t('sb_no_scores')); return; }
    const myUUID = getBrowserUUID();
    const myIdx = ranked.findIndex(p => p.browser_uuid === myUUID);
    const totalPlayers = data.total_players || ranked.length;

    let html = '';
    // My rank card
    if (myIdx >= 0) {
      const me = ranked[myIdx];
      const pct = Math.max(1, Math.round((myIdx + 1) / totalPlayers * 100));
      html += '<div class="sb-my-rank">';
      html += sbAvatarHTML(myUUID, 40, sbPicture(myUUID, me.picture));
      html += '<div class="sb-my-info"><div class="sb-my-name">' + sbDisplayName(myUUID, me.display_name) + '</div>';
      html += '<div class="sb-my-detail">⭐ ' + (me.total_exp || 0).toLocaleString() + ' · ' + me.puzzles + ' ' + t('sb_puzzles') + ' · ' + sbFormatTime(me.avg_time) + ' ' + t('sb_avg') + '</div></div>';
      html += '<div class="sb-rank-badge"><div class="sb-rank-num">#' + (myIdx + 1) + '</div><div class="sb-rank-pct">' + t('sb_top').replace('{pct}', pct) + '</div></div>';
      html += '</div>';
    }
    html += '<div class="sb-summary">' + t('sb_total_players').replace('{n}', totalPlayers) + '</div>';
    // Leaderboard
    html += '<div class="sb-list">';
    const show = Math.min(ranked.length, 50);
    for (let i = 0; i < show; i++) {
      const p = ranked[i];
      const isMe = p.browser_uuid === myUUID;
      const crown = i < 3 ? ' sb-crown' : '';
      const me = isMe ? ' sb-me' : '';
      const posLabel = i === 0 ? '\uD83D\uDC51' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : '#' + (i + 1);
      html += '<div class="sb-row' + crown + me + '">';
      html += '<div class="sb-pos">' + posLabel + '</div>';
      html += sbAvatarHTML(p.browser_uuid, 32, sbPicture(p.browser_uuid, p.picture));
      html += '<div class="sb-name">' + sbDisplayName(p.browser_uuid, p.display_name) + (isMe ? ' (' + t('sb_you') + ')' : '') + '</div>';
      html += '<div class="sb-val"><strong>⭐ ' + (p.total_exp || 0).toLocaleString() + '</strong></div>';
      html += '<div class="sb-val">' + p.puzzles + ' ' + t('sb_puzzles') + '</div>';
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
      html += sbAvatarHTML(s.browser_uuid, 32, sbPicture(s.browser_uuid, s.picture));
      html += '<div class="sb-name">' + sbDisplayName(s.browser_uuid, s.display_name) + (isMe ? ' (' + t('sb_you') + ')' : '') + '</div>';
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
    var myPic = sbPicture(myUUID, null);
    let html = '<div class="sb-profile">';
    html += '<div class="sb-avatar-lg">' + (myPic ? '<img src="' + myPic + '" width="80" height="80" style="border-radius:18px;object-fit:cover" referrerpolicy="no-referrer">' : generateAvatar(myUUID, 80)) + '</div>';
    html += '<div class="sb-profile-name">' + sbDisplayName(myUUID, null) + '</div>';
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

// --- Team League Tab ---

var LEAGUE_TIERS_CLIENT = [
  { icon: '\uD83D\uDFE4', name: 'Bronze' },
  { icon: '\u26AA', name: 'Silver' },
  { icon: '\uD83D\uDFE1', name: 'Gold' },
  { icon: '\uD83D\uDD35', name: 'Sapphire' },
  { icon: '\uD83D\uDD34', name: 'Ruby' },
  { icon: '\uD83D\uDFE2', name: 'Emerald' },
  { icon: '\uD83D\uDFE3', name: 'Amethyst' },
  { icon: '\u26AB', name: 'Obsidian' }
];

function leagueSettlementCountdown() {
  // Time until 00:05 UTC
  var now = new Date();
  var target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  var diff = Math.floor((target - now) / 1000);
  var h = Math.floor(diff / 3600);
  var m = Math.floor((diff % 3600) / 60);
  return h + 'h ' + m + 'm';
}

async function renderLeagueTab() {
  var panel = document.getElementById('sb-panel-league');
  if (!navigator.onLine) {
    panel.innerHTML = '<div class="league-prompt">'
      + '<div class="league-prompt-icon">\uD83D\uDCF6</div>'
      + '<div class="league-prompt-title">' + t('league_title') + '</div>'
      + '<div class="league-prompt-desc">' + t('league_offline') + '</div>'
      + '</div>';
    return;
  }
  if (!isAuthenticated()) {
    panel.innerHTML = '<div class="league-prompt">'
      + '<div class="league-prompt-icon">\uD83D\uDC8E</div>'
      + '<div class="league-prompt-title">' + t('league_title') + '</div>'
      + '<div class="league-prompt-desc">' + t('league_signin_prompt') + '</div>'
      + '<button class="league-signin-btn" onclick="showAuthModal()">' + t('auth_signin') + '</button>'
      + '</div>';
    return;
  }
  panel.innerHTML = '<div style="text-align:center;padding:40px;color:#666">' + t('league_loading') + '</div>';
  try {
    var res = await fetch(WORKER_URL + '/league/my-team', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('octile_auth_token') }
    });
    var data = await res.json();
    if (data.status === 'not_joined' || data.status === 'no_team') {
      panel.innerHTML = '<div class="league-prompt">'
        + '<div class="league-prompt-icon">\uD83D\uDC8E</div>'
        + '<div class="league-prompt-title">' + t('league_title') + '</div>'
        + '<div class="league-prompt-desc">' + t('league_join_desc') + '</div>'
        + '<button class="league-join-btn" id="league-join-btn">' + t('league_join_btn') + '</button>'
        + '</div>';
      document.getElementById('league-join-btn').addEventListener('click', leagueJoin);
      return;
    }
    if (data.status !== 'ok') throw new Error(data.status);
    panel.innerHTML = renderLeagueTeamView(data);

    // Detect tier change for message center
    var cachedTier = parseInt(localStorage.getItem('octile_league_tier') || '-1');
    if (cachedTier >= 0 && data.tier !== cachedTier) {
      var tierName = t('league_tier_' + data.tier);
      if (data.tier > cachedTier) {
        addMessage('league', '\uD83D\uDD3A', 'league_promoted_title', 'league_promoted_body', { tier: tierName });
      } else {
        addMessage('league', '\uD83D\uDD3B', 'league_demoted_title', 'league_demoted_body', { tier: tierName });
        // Demotion consolation: 2x multiplier
        addClaimableMultiplier(2);
      }
    }
    localStorage.setItem('octile_league_tier', data.tier);
  } catch (e) {
    console.warn('[Octile] League fetch failed:', e.message);
    panel.innerHTML = '<div style="text-align:center;padding:40px;color:#666">' + t('league_error') + '</div>';
  }
}

function renderLeagueTeamView(data) {
  var tierInfo = LEAGUE_TIERS_CLIENT[data.tier] || LEAGUE_TIERS_CLIENT[0];
  var html = '';

  // Tier header
  html += '<div class="league-tier-header" style="--tier-color:' + data.tier_color + '">';
  html += '<div class="league-tier-badge">' + tierInfo.icon + '</div>';
  html += '<div class="league-tier-name">' + t('league_tier_' + data.tier) + '</div>';
  html += '</div>';

  // Settlement countdown
  html += '<div class="league-countdown">' + t('league_resets_in').replace('{time}', leagueSettlementCountdown()) + '</div>';

  // Promotion/demotion streak or waiting message
  var _needMore = data.active_count < (data.min_active || 3);
  if (_needMore) {
    html += '<div class="league-streak" style="background:rgba(241,196,15,0.1);color:#f0e68c">\u23F3 ' + t('league_waiting').replace('{n}', (data.min_active || 3) - data.active_count) + '</div>';
  } else if (data.promo_streak > 0) {
    html += '<div class="league-streak league-promo">\uD83D\uDD3A ' + t('league_promo_streak').replace('{n}', data.promo_streak).replace('{req}', 3) + '</div>';
  } else if (data.demote_streak > 0) {
    html += '<div class="league-streak league-demote">\uD83D\uDD3B ' + t('league_demote_streak').replace('{n}', data.demote_streak).replace('{req}', 3) + '</div>';
  }

  // Team label
  html += '<div class="league-team-label">' + t('league_today_exp') + ' \u2014 ' + escapeHtml(data.team_name || '') + '</div>';

  // Member list
  html += '<div class="sb-list">';
  var authUser = getAuthUser();
  var myId = authUser ? authUser.id : null;
  var totalExp = 0;
  var activeCount = 0;

  for (var i = 0; i < data.members.length; i++) {
    var m = data.members[i];
    var isMe = m.user_id === myId;
    var isTop2 = i < 2;
    var isInactive = (m.inactive_days || 0) >= 2;
    var cls = 'sb-row';
    if (isMe) cls += ' sb-me';
    if (isTop2 && !isInactive) cls += ' league-top2';
    if (isInactive) cls += ' league-inactive';

    var posIcon = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : '#' + (i + 1);

    html += '<div class="' + cls + '">';
    html += '<div class="sb-pos">' + posIcon + '</div>';
    html += sbAvatarHTML(m.user_id, 32, m.picture);
    html += '<div class="sb-name">' + escapeHtml(m.display_name || 'Player') + (isMe ? ' (' + t('sb_you') + ')' : '') + (isInactive ? ' <span style="color:#666;font-size:11px">' + t('league_inactive') + '</span>' : '') + '</div>';
    html += '<div class="sb-val"><strong>\u2B50 ' + (m.exp_today || 0).toLocaleString() + '</strong></div>';
    html += '</div>';

    totalExp += m.exp_today || 0;
    if (!isInactive) activeCount++;
  }
  html += '</div>';

  // Average line (excluding inactive)
  var avgExp = activeCount > 0 ? Math.round(totalExp / activeCount) : 0;
  html += '<div class="league-avg-line">' + t('league_avg') + ': \u2B50 ' + avgExp.toLocaleString() + '</div>';

  return html;
}

async function leagueJoin() {
  try {
    var res = await fetch(WORKER_URL + '/league/join', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('octile_auth_token'), 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    localStorage.setItem('octile_league_tier', data.tier || 0);
    addMessage('league', '\uD83D\uDC8E', 'league_joined_title', 'league_joined_body', {});
    renderLeagueTab();
  } catch (e) {
    console.warn('[Octile] League join failed:', e.message);
  }
}

// --- Encouragement Toasts (during gameplay) ---
var _encourageShown = false;
var _lastPlaceTime = 0;
function maybeShowEncourageToast() {
  if (_encourageShown || gameOver) return;
  if (!localStorage.getItem('octile_onboarded')) return; // skip first-timer
  if (Math.random() > 0.3) return; // 30% chance
  var placed = piecesPlacedCount;
  var msgs;
  var now = Date.now();
  var fast = (now - _lastPlaceTime) < 3000 && _lastPlaceTime > 0;
  _lastPlaceTime = now;
  if (placed === 2) {
    msgs = t('encourage_start');
  } else if (placed >= 4 && placed <= 5) {
    msgs = t('encourage_mid');
  } else if (placed === 7) {
    msgs = t('encourage_almost');
  } else if (fast && placed >= 3) {
    msgs = t('encourage_fast');
  } else {
    return;
  }
  if (!msgs || !msgs.length) return;
  _encourageShown = true;
  var msg = Array.isArray(msgs) ? msgs[Math.floor(Math.random() * msgs.length)] : msgs;
  var el = document.getElementById('encourage-toast');
  el.textContent = msg;
  el.classList.add('show');
  playSound('toast');
  setTimeout(function() { el.classList.remove('show'); }, 2500);
}

// --- 3-Step Win Flow ---
var _winStep = 0;
var _winData = {};
function _showWinStep(step) {
  _winStep = step;
  document.getElementById('win-step1').style.display = step === 1 ? '' : 'none';
  document.getElementById('win-step2').style.display = step === 2 ? '' : 'none';
  document.getElementById('win-step3').style.display = step === 3 ? '' : 'none';
  if (step === 2 || step === 1) {
    // Re-trigger pop animation
    var card = document.getElementById('win-step' + step);
    card.style.animation = 'none';
    card.offsetHeight; // reflow
    card.style.animation = '';
  }
}

function checkWin() {
  const allPlaced = pieces.every(p => p.placed);
  if (!allPlaced) return;
  gameOver = true;
  clearInterval(timerInterval);
  dismissAllHints();

  // Mark onboarding complete after first ever win
  if (!localStorage.getItem('octile_onboarded')) {
    localStorage.setItem('octile_onboarded', '1');
  }

  // Track unique solved puzzles
  const solved = getSolvedSet();
  const isFirstClear = !solved.has(currentPuzzleNumber);
  solved.add(currentPuzzleNumber);
  saveSolvedSet(solved);
  const totalUnique = solved.size;

  // Total solve count (including re-solves)
  const totalSolved = parseInt(localStorage.getItem('octile_total_solved') || '0') + 1;
  localStorage.setItem('octile_total_solved', totalSolved);

  // Cumulative time + grade tracking for profile
  localStorage.setItem('octile_total_time', parseFloat(localStorage.getItem('octile_total_time') || '0') + elapsed);
  var _gKey = 'octile_grades';
  var _grades = JSON.parse(localStorage.getItem(_gKey) || '{"S":0,"A":0,"B":0}');
  var _g = calcSkillGrade(currentLevel || 'easy', elapsed);
  _grades[_g] = (_grades[_g] || 0) + 1;
  localStorage.setItem(_gKey, JSON.stringify(_grades));

  const bestKey = 'octile_best_' + currentPuzzleNumber;
  const prevBest = parseInt(localStorage.getItem(bestKey) || '0');
  const isNewBest = prevBest === 0 || elapsed < prevBest;
  const improvement = prevBest > 0 ? prevBest - elapsed : 0;
  if (isNewBest) localStorage.setItem(bestKey, elapsed);

  // Deduct energy
  const cost = energyCost(elapsed);
  deductEnergy(cost);
  updateDailyStats(cost);
  const remainingPlays = Math.floor(getEnergyState().points);
  const dailyStatsNow = getDailyStats();
  const freePlayLeft = dailyStatsNow.puzzles === 0 ? 1 : 0; // after deduct, before next
  const totalLeft = remainingPlays + freePlayLeft;
  const winEnergyEl = document.getElementById('win-energy-cost');
  if (cost === 0) {
    // Flow 4: just used the free puzzle — soft continue prompt
    winEnergyEl.textContent = t('energy_continue');
  } else if (totalLeft === 1) {
    winEnergyEl.textContent = t('energy_last_one');
  } else if (totalLeft <= 0) {
    winEnergyEl.innerHTML = t('energy_brand_quote');
  } else {
    winEnergyEl.textContent = t('win_energy_plays').replace('{left}', totalLeft);
  }

  // Award EXP + Diamonds
  const lvl = currentLevel || 'easy';
  const grade = calcSkillGrade(lvl, elapsed);
  const expEarned = calcPuzzleExp(lvl, elapsed);
  addExp(expEarned);
  var _mult = getActiveMultiplier();
  addDiamonds(applyDiamondMultiplier(1)); // 1 diamond × multiplier

  // Check chapter completion bonus
  let chapterBonus = 0;
  if (currentLevel) {
    const chSize = getChapterSize(currentLevel);
    // After advancing progress, check if we just completed a chapter boundary
    const newProgress = currentSlot; // will be set as new progress
    if (newProgress > 0 && newProgress % chSize === 0) {
      chapterBonus = chSize;
      addDiamonds(applyDiamondMultiplier(chapterBonus));
      incrementChaptersCompleted();
    }
    // Also check if this is the last puzzle in the level (partial chapter completion)
    const levelTotal = getEffectiveLevelTotal(currentLevel);
    if (newProgress === levelTotal && newProgress % chSize !== 0) {
      chapterBonus = newProgress % chSize;
      addDiamonds(applyDiamondMultiplier(chapterBonus));
      incrementChaptersCompleted();
    }
  }

  // --- Daily Tasks & Multiplier hooks ---
  updateDailyTaskCounters(grade, elapsed, currentLevel || 'easy');
  updateDailyTaskProgress();
  checkConsecutiveAGrades(grade);

  // Track monthly solves
  const monthIdx = new Date().getMonth();
  const monthsData = JSON.parse(localStorage.getItem('octile_months') || '[]');
  if (!monthsData[monthIdx]) { monthsData[monthIdx] = true; localStorage.setItem('octile_months', JSON.stringify(monthsData)); }

  // Track night/morning solves
  const now = new Date();
  const hour = now.getHours(), mins = now.getMinutes(), timeVal = hour * 60 + mins;
  if (timeVal >= 22 * 60 || timeVal < 4 * 60 + 30) {
    localStorage.setItem('octile_night_solves', parseInt(localStorage.getItem('octile_night_solves') || '0') + 1);
  }
  if (timeVal >= 4 * 60 + 30 && timeVal < 9 * 60) {
    localStorage.setItem('octile_morning_solves', parseInt(localStorage.getItem('octile_morning_solves') || '0') + 1);
  }

  // Check achievements
  const streakCount = updateStreak();
  const dailyStats = getDailyStats();
  const achStats = {
    unique: totalUnique, total: totalSolved, elapsed: elapsed, streak: streakCount,
    noHint: getHintsUsedToday() === 0 && isFirstClear, dailyCount: dailyStats.puzzles, justSolved: true,
    nightSolves: parseInt(localStorage.getItem('octile_night_solves') || '0'),
    morningSolves: parseInt(localStorage.getItem('octile_morning_solves') || '0'),
    months: JSON.parse(localStorage.getItem('octile_months') || '[]'),
    levelEasy: getLevelProgress('easy'), levelMedium: getLevelProgress('medium'),
    levelHard: getLevelProgress('hard'), levelHell: getLevelProgress('hell'),
    chaptersCompleted: getChaptersCompleted(),
    totalEasy: getEffectiveLevelTotal('easy'), totalMedium: getEffectiveLevelTotal('medium'),
    totalHard: getEffectiveLevelTotal('hard'), totalHell: getEffectiveLevelTotal('hell'),
  };
  const newlyUnlocked = checkAchievements(achStats);
  advanceLevelProgress();

  const levelTotal = currentLevel ? getEffectiveLevelTotal(currentLevel) : 0;
  const isLevelComplete = currentLevel && levelTotal > 0 && currentSlot >= levelTotal;

  // Store win data for 3-step flow
  _winData = {
    elapsed, isNewBest, prevBest, grade, expEarned, chapterBonus,
    totalUnique, totalSolved, isFirstClear, improvement,
    newlyUnlocked, isLevelComplete, levelTotal,
    cost, totalLeft, motivation: getWinMotivation(totalUnique, isFirstClear, isNewBest, prevBest, elapsed, improvement),
    fact: (function() { var f = getWinFacts(); return f[Math.floor(Math.random() * f.length)]; })(),
  };

  // --- Step 1: Celebration ---
  var gradeColors = { S: '#f1c40f', A: '#2ecc71', B: '#3498db' };
  if (currentLevel) {
    document.getElementById('win-puzzle-num').textContent = (LEVEL_DOTS[currentLevel] || '') + ' ' + t('level_' + currentLevel) + ' #' + currentSlot;
  } else {
    document.getElementById('win-puzzle-num').textContent = t('win_puzzle') + currentPuzzleNumber;
  }
  document.getElementById('win-time').textContent = formatTime(elapsed);
  var bestEl = document.getElementById('win-best');
  if (isNewBest && prevBest > 0) {
    bestEl.textContent = t('win_new_best') + ' (' + t('win_best') + formatTime(prevBest) + ')';
    bestEl.className = 'win-best-new';
    bestEl.style.display = '';
  } else if (isNewBest) {
    bestEl.textContent = t('win_new_best');
    bestEl.className = 'win-best-new';
    bestEl.style.display = '';
  } else if (prevBest) {
    bestEl.textContent = t('win_best') + formatTime(prevBest);
    bestEl.className = '';
    bestEl.style.display = '';
  } else {
    bestEl.style.display = 'none';
  }
  var gradeDescKey = grade === 'S' ? 'grade_s_desc' : grade === 'A' ? 'grade_a_desc' : 'grade_b_desc';
  document.getElementById('win-grade').innerHTML = '<span class="win-grade-letter">' + grade + '</span><span class="win-grade-desc">' + t(gradeDescKey) + '</span>';
  document.getElementById('win-grade').style.color = gradeColors[grade] || '#3498db';

  var lcEl = document.getElementById('win-level-complete');
  if (isLevelComplete) {
    var lcMsg = t('level_complete_msg').replace('{level}', t('level_' + currentLevel)).replace('{total}', levelTotal);
    lcEl.innerHTML = '<div class="level-complete-banner">' + (LEVEL_DOTS[currentLevel] || '') + ' ' + lcMsg + '</div>';
    lcEl.style.display = '';
    document.getElementById('win-step1-title').textContent = t('level_complete_title');
  } else {
    lcEl.style.display = 'none';
    document.getElementById('win-step1-title').textContent = t('win_title');
  }
  document.getElementById('win-tap1').textContent = t('win_tap_continue');

  // --- Step 2: Rewards (populated but hidden) ---
  document.getElementById('win-step2-title').textContent = t('win_rewards_title');
  var rewardsHtml = '';
  var expReason = t('reward_exp_grade').replace('{grade}', grade).replace('{level}', t('level_' + (currentLevel || 'easy')));
  rewardsHtml += '<div class="win-reward-line" style="animation-delay:0s">\u2B50 +' + expEarned + ' EXP <span class="win-reward-reason">' + expReason + '</span></div>';
  var diamondReason = chapterBonus > 0 ? t('reward_diamond_chapter') : t('reward_diamond_base');
  rewardsHtml += '<div class="win-reward-line" style="animation-delay:0.2s">\uD83D\uDC8E +' + (1 + chapterBonus) + ' ' + t('win_diamonds_label') + ' <span class="win-reward-reason">' + diamondReason + '</span></div>';
  if (newlyUnlocked.length > 0) {
    for (var ni = 0; ni < newlyUnlocked.length; ni++) {
      var ach = newlyUnlocked[ni];
      rewardsHtml += '<div class="win-reward-line" style="animation-delay:' + (0.4 + ni * 0.2) + 's">\uD83C\uDFC6 ' + t('ach_' + ach.id) + '</div>';
    }
  }
  document.getElementById('win-rewards').innerHTML = rewardsHtml;
  document.getElementById('win-achievement').innerHTML = '';
  document.getElementById('win-tap2').textContent = t('win_tap_continue');

  // --- Step 3: What's Next (populated but hidden) ---
  if (isLevelComplete) {
    document.getElementById('win-step3-title').textContent = t('level_complete_title');
    document.getElementById('win-next-btn').innerHTML = t('level_complete_back');
  } else {
    var progressText = currentLevel
      ? (LEVEL_DOTS[currentLevel] || '') + ' ' + currentSlot + ' / ' + levelTotal
      : t('motiv_unique_count').replace('{n}', totalUnique).replace('{total}', getEffectivePuzzleCount());
    document.getElementById('win-step3-title').textContent = progressText;
    document.getElementById('win-next-btn').innerHTML = t('win_next');
  }
  document.getElementById('win-energy-cost').textContent = '\u26A1 ' + t('win_energy_plays').replace('{left}', totalLeft);
  var motivEl = document.getElementById('win-motivation');
  motivEl.textContent = _winData.motivation;
  motivEl.style.display = _winData.motivation ? '' : 'none';
  document.getElementById('win-fact').textContent = _winData.fact;
  document.getElementById('win-prev-btn').style.display = (currentLevel && currentSlot > 1) ? '' : 'none';
  document.getElementById('win-share-btn').innerHTML = t('win_share');
  document.getElementById('win-view-btn').textContent = t('win_view_board');
  document.getElementById('win-random-btn').style.display = 'none';
  document.getElementById('win-menu-btn').textContent = t('win_menu');
  document.getElementById('win-back-btn').textContent = t('win_back');

  // Show step 1
  _showWinStep(1);
  triggerBoardPulse();
  var overlay = document.getElementById('win-overlay');
  overlay.classList.add('show');
  playSound('win'); haptic([50, 30, 50, 30, 100]);
  spawnConfetti();

  submitScore(currentPuzzleNumber, elapsed);
  if (isAuthenticated()) syncProgress();
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

async function nextPuzzle() {
  document.getElementById('win-overlay').classList.remove('show');
  if (currentLevel) {
    const total = getEffectiveLevelTotal(currentLevel);
    if (total > 0 && currentSlot >= total) {
      // Level complete — return to welcome menu
      returnToWelcome();
      return;
    }
    currentSlot++;
    try {
      const data = await fetchLevelPuzzle(currentLevel, currentSlot);
      currentPuzzleNumber = data.puzzle_number;
      startGame(currentPuzzleNumber);
      return;
    } catch (e) {
      currentLevel = null;
      alert(t('offline_level_limit'));
      returnToWelcome();
      return;
    }
  }
  startGame((currentPuzzleNumber % TOTAL_PUZZLE_COUNT) + 1);
}

function showLevelComplete(level, total) {
  currentLevel = null;
  gameStarted = false;
  const boardEl = document.getElementById('board');
  boardEl.style.display = 'none';
  document.getElementById('pool-section').style.display = 'none';
  document.getElementById('action-bar').style.display = 'none';
  document.getElementById('pause-btn').style.display = 'none';
  clearInterval(timerInterval);

  const welcome = document.getElementById('welcome-panel');
  welcome.classList.remove('hidden');
  welcome.innerHTML = '<div class="level-complete">'
    + '<div class="level-complete-icon">' + (LEVEL_DOTS[level] || '') + '</div>'
    + '<h2>' + t('level_complete_title') + '</h2>'
    + '<p>' + t('level_complete_msg').replace('{level}', t('level_' + level)).replace('{total}', total) + '</p>'
    + '<button class="btn-random" id="level-complete-btn">' + t('level_complete_back') + '</button>'
    + '</div>';
  document.getElementById('level-complete-btn').addEventListener('click', () => {
    welcome.innerHTML = '';
    // Rebuild welcome panel (re-insert level cards)
    location.reload();
  });
}

function winRandom() {
  document.getElementById('win-overlay').classList.remove('show');
  currentLevel = null;
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
  const puzzleLabel = currentLevel
    ? t('level_' + currentLevel) + ' #' + currentSlot
    : '#' + num;
  const text = t('share_win_prefix') + puzzleLabel + t('share_win_mid') + time + t('share_win_suffix');
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
      const screenshotLabel = currentLevel
        ? t('level_' + currentLevel) + ' #' + currentSlot
        : '#' + puzzleNum;
      ctx.fillText(screenshotLabel, SIZE - PAD, 28);

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
  rolloverDailyHints();
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
  _encourageShown = false;
  _lastPlaceTime = 0;
  document.querySelectorAll('.snap-done').forEach(function(c) { c.classList.remove('snap-done'); });
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
  setTimeout(() => {
    splash.remove();
    // First-time user: skip welcome panel, jump straight into Easy #1
    if (!localStorage.getItem('octile_onboarded')) {
      if (!_levelTotals.easy) _levelTotals = {..._getOfflineTotals()};
      startLevel('easy');
    }
  }, 600);
}

// Auto-dismiss: 5s for first-timers (get them playing fast), 3s for returning
setTimeout(dismissSplash, localStorage.getItem('octile_onboarded') ? 3000 : 5000);
document.addEventListener('pointerdown', dismissSplash, { once: true });
document.addEventListener('keydown', dismissSplash, { once: true });

// --- Welcome Panel / Game Flow ---
let gameStarted = false;

function showWelcomeState() {
  // Player stats header
  const streak = getStreak();
  const statsEl = document.getElementById('wp-stats');
  statsEl.innerHTML =
    '<span class="wp-stat"><span class="wp-stat-icon">\u2B50</span><span class="wp-stat-value">' + getExp().toLocaleString() + '</span></span>' +
    '<span class="wp-stat"><span class="wp-stat-icon">\uD83D\uDC8E</span><span class="wp-stat-value">' + getDiamonds().toLocaleString() + '</span></span>' +
    '<span class="wp-stat"><span class="wp-stat-icon">\uD83D\uDD25</span><span class="wp-stat-value">' + (streak.count || 0) + '</span> ' + t('wp_days') + '</span>' +
    '<span class="wp-stat"><span class="wp-stat-icon">\u26A1</span><span class="wp-stat-value">' + Math.floor(getEnergyState().points) + '</span></span>';

  showTier1();
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
  document.body.classList.add('in-game');
  currentPuzzleNumber = puzzleNumber;

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
  updateLevelNav();
  setTimeout(showPoolScrollHint, 800);

  // Flow 3: "First puzzle of the day. Take your time." hint
  const _dailyStatsAtStart = getDailyStats();
  if (_dailyStatsAtStart.puzzles === 0) {
    tutorialTimeouts.push(setTimeout(() => {
      if (gameOver) return;
      showHintTooltip(t('win_energy_free'), document.getElementById('board-container'), 'daily-free');
      setTimeout(() => dismissHint('daily-free'), 5000);
    }, 600));
  }

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
  document.body.classList.remove('in-game');
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

// welcomeRandom/welcomeGo removed — replaced by level-based flow

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
  // puzzle-input row removed — level-based flow
  document.getElementById('settings-scoreboard-label').textContent = t('menu_scoreboard');
  document.getElementById('scoreboard-title').textContent = t('sb_title');
  document.getElementById('sb-tab-global').textContent = t('sb_tab_global');
  document.getElementById('sb-tab-me').textContent = t('sb_tab_me');
  document.getElementById('sb-tab-league').textContent = t('league_tab');

  // Settings modal
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  var _langSelect = document.getElementById('settings-lang-select');
  _langSelect.value = _langPref;
  var _langKeys = { system: 'lang_system', en: 'lang_en', zh: 'lang_zh' };
  for (var _li = 0; _li < _langSelect.options.length; _li++) {
    var _lk = _langKeys[_langSelect.options[_li].value];
    if (_lk) _langSelect.options[_li].textContent = t(_lk);
  }
  document.getElementById('settings-theme-label').textContent = t('menu_theme');
  renderThemeGrid();

  // Control bar
  // ctrl-go removed — level-based flow
  document.getElementById('ctrl-restart').title = t('restart');
  document.getElementById('ctrl-random').textContent = t('random');
  updateHintBtn();

  // Pool label
  const poolLabel = document.querySelector('#pool-section h2');
  if (poolLabel) poolLabel.textContent = t('pieces_label');
  document.getElementById('pause-label').textContent = t('paused');

  // Welcome panel
  // Level card names are updated in updateWelcomeLevels()
  const wpDivider = document.querySelector('#welcome-panel .wp-divider');
  if (wpDivider) wpDivider.textContent = t('wp_or');
  updateWelcomeLevels();
  updateLevelNav();

  // Splash (if still present) — update text then reveal
  const _splashEl = document.getElementById('splash');
  const splashTagline = document.querySelector('#splash .tagline');
  if (splashTagline) splashTagline.innerHTML = t('splash_tagline');
  const splashTap = document.querySelector('#splash .tap-hint');
  if (splashTap) splashTap.textContent = t('splash_tap');
  if (_splashEl && !_splashEl.classList.contains('splash-ready')) {
    setTimeout(() => { if (_splashEl) _splashEl.classList.add('splash-ready'); }, 300);
  }

  // Help & story modal bodies
  document.getElementById('help-body').innerHTML = t('help_body');
  var storeLink = '';
  if (/android/i.test(navigator.userAgent)) {
    storeLink = 'https://play.google.com/store/apps/details?id=com.octile.app';
  } else if (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) {
    storeLink = 'https://apps.apple.com/app/com.octile.app';
  }
  var supportHtml = '<div class="about-support">'
    + '<p class="about-support-title">' + t('about_support') + '</p>'
    + (storeLink ? '<a class="about-rate-btn" href="#" onclick="window.open(\'' + storeLink + '\');return false">⭐ ' + t('about_rate') + '</a>' : '')
    + '<p class="about-feedback">' + t('about_feedback') + ' <a href="mailto:octileapp@googlegroups.com">octileapp@googlegroups.com</a> · <a href="#" onclick="window.open(\'feedback.html\');return false">' + t('about_feedback_form') + '</a></p>'
    + '</div>';
  document.getElementById('story-body').innerHTML = t('story_body')
    + '<p class="app-version">v' + APP_VERSION_NAME + '</p>'
    + supportHtml
    + '<p class="about-links"><a href="#" onclick="window.open(\'privacy.html\');return false">' + t('privacy_link') + '</a> · <a href="#" onclick="window.open(\'terms.html\');return false">' + t('terms_link') + '</a></p>';

  // Win flow static text
  document.getElementById('win-step1-title').textContent = t('win_title');
  document.getElementById('win-tap1').textContent = t('win_tap_continue');
  document.getElementById('win-step2-title').textContent = t('win_rewards_title');
  document.getElementById('win-tap2').textContent = t('win_tap_continue');
  document.getElementById('win-share-btn').innerHTML = t('win_share');
  document.getElementById('win-view-btn').textContent = t('win_view_board');
  document.getElementById('win-back-btn').textContent = t('win_back');
  document.getElementById('win-prev-btn').textContent = t('win_prev');
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

  // Daily Tasks & Messages buttons
  document.getElementById('settings-tasks-label').textContent = t('menu_tasks');
  document.getElementById('settings-messages-label').textContent = t('menu_messages');

  // Profile button
  document.getElementById('settings-profile-label').textContent = t('menu_profile');

  // Update banner
  document.getElementById('update-btn').textContent = t('update_btn');
  document.getElementById('update-dismiss').textContent = t('update_later');

  // Refresh tagline
  const taglines = getTaglines();
  const wpTagline = document.getElementById('wp-tagline');
  if (wpTagline) wpTagline.innerHTML = taglines[Math.floor(Math.random() * taglines.length)];
}

function setLang(pref) {
  _langPref = pref;
  localStorage.setItem('octile_lang', pref);
  currentLang = pref === 'system' ? _systemLang() : pref;
  applyLanguage();
}

// --- Auth ---

function getAuthUser() {
  try { return JSON.parse(localStorage.getItem('octile_auth_user') || 'null'); }
  catch { return null; }
}

function isAuthenticated() {
  return !!localStorage.getItem('octile_auth_token');
}

function getAuthHeaders() {
  var token = localStorage.getItem('octile_auth_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Keys preserved across logout (device-level, not user-level)
var _AUTH_KEEP_KEYS = [
  'octile_lang', 'octile-theme', 'octile_unlocked_themes',
  'octile_browser_uuid', 'octile_onboarded', 'octile_tutorial_seen',
  'octile_debug', 'octile_sound',
];

function _clearGameProgress() {
  var toRemove = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.startsWith('octile') && _AUTH_KEEP_KEYS.indexOf(k) < 0) {
      toRemove.push(k);
    }
  }
  for (var j = 0; j < toRemove.length; j++) localStorage.removeItem(toRemove[j]);
  // Refresh all displays to show zeroed state
  updateExpDisplay();
  updateDiamondDisplay();
  updateEnergyDisplay();
  updateWelcomeLevels();
}

function authLogout() {
  localStorage.removeItem('octile_auth_token');
  localStorage.removeItem('octile_auth_user');
  _clearGameProgress();
}

function _authShowForm(name) {
  var forms = ['login', 'register', 'verify', 'forgot', 'reset'];
  for (var i = 0; i < forms.length; i++) {
    document.getElementById('auth-form-' + forms[i]).style.display = forms[i] === name ? '' : 'none';
  }
  document.getElementById('auth-error').textContent = '';
}

function _authSetError(msg) {
  document.getElementById('auth-error').textContent = msg;
}

function _authSetLoading(btnId, loading) {
  var btn = document.getElementById(btnId);
  btn.disabled = loading;
  if (loading) btn.dataset.origText = btn.textContent;
  btn.textContent = loading ? '...' : (btn.dataset.origText || btn.textContent);
}

function showAuthModal() {
  _authShowForm('login');
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-title').textContent = t('auth_signin');
  document.getElementById('auth-login-btn').textContent = t('auth_signin');
  document.getElementById('auth-show-register').textContent = t('auth_create');
  document.getElementById('auth-show-forgot').textContent = t('auth_forgot');
  document.getElementById('auth-register-btn').textContent = t('auth_create');
  document.getElementById('auth-show-login').textContent = t('auth_have_account');
  document.getElementById('auth-verify-btn').textContent = t('auth_verify');
  document.getElementById('auth-forgot-btn').textContent = t('auth_send_code');
  document.getElementById('auth-show-login2').textContent = t('auth_back_signin');
  document.getElementById('auth-reset-btn').textContent = t('auth_reset');
  document.getElementById('auth-google-label').textContent = t('auth_google');
  // Agree checkbox: reset state, apply translations
  var agreeCheck = document.getElementById('auth-agree-check');
  agreeCheck.checked = false;
  document.getElementById('auth-google-btn').disabled = true;
  document.getElementById('auth-login-btn').disabled = true;
  document.getElementById('auth-agree-text').innerHTML = t('auth_agree')
    .replace('{terms}', t('terms_link'))
    .replace('{privacy}', t('privacy_link'));
  document.getElementById('auth-modal').classList.add('show');
}

function _authOnSuccess(data) {
  localStorage.setItem('octile_auth_token', data.access_token);
  localStorage.setItem('octile_auth_user', JSON.stringify(data.user));
  document.getElementById('auth-modal').classList.remove('show');
  // Sync: push local progress (may include anonymous play) then pull+merge
  syncProgress().then(() => {
    if (document.getElementById('profile-modal').classList.contains('show')) {
      showProfileModal();
    }
  });
}

var _authVerifyEmail = '';

async function _authDoRegister() {
  var name = document.getElementById('auth-reg-name').value.trim();
  var email = document.getElementById('auth-reg-email').value.trim();
  var password = document.getElementById('auth-reg-password').value;
  if (!email || !password || password.length < 6) {
    _authSetError(t('auth_err_fields'));
    return;
  }
  _authSetLoading('auth-register-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, display_name: name || email.split('@')[0], browser_uuid: getBrowserUUID() }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(data.detail || 'Error'); return; }
    _authVerifyEmail = email;
    document.getElementById('auth-verify-msg').textContent = t('auth_check_email').replace('{email}', email);
    document.getElementById('auth-title').textContent = t('auth_verify');
    _authShowForm('verify');
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-register-btn', false);
  }
}

async function _authDoVerify() {
  var otp = document.getElementById('auth-otp').value.trim();
  if (!otp || otp.length !== 6) { _authSetError(t('auth_err_otp')); return; }
  _authSetLoading('auth-verify-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _authVerifyEmail, otp_code: otp }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(data.detail || 'Error'); return; }
    _authOnSuccess(data);
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-verify-btn', false);
  }
}

async function _authDoLogin() {
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  if (!email || !password) { _authSetError(t('auth_err_fields')); return; }
  _authSetLoading('auth-login-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password, browser_uuid: getBrowserUUID() }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(data.detail || 'Error'); return; }
    _authOnSuccess(data);
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-login-btn', false);
  }
}

async function _authDoForgot() {
  var email = document.getElementById('auth-forgot-email').value.trim();
  if (!email) { _authSetError(t('auth_err_fields')); return; }
  _authSetLoading('auth-forgot-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(data.detail || 'Error'); return; }
    _authVerifyEmail = email;
    document.getElementById('auth-reset-msg').textContent = t('auth_check_email').replace('{email}', email);
    document.getElementById('auth-title').textContent = t('auth_reset');
    _authShowForm('reset');
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-forgot-btn', false);
  }
}

async function _authDoReset() {
  var otp = document.getElementById('auth-reset-otp').value.trim();
  var password = document.getElementById('auth-reset-password').value;
  if (!otp || otp.length !== 6 || !password || password.length < 6) {
    _authSetError(t('auth_err_fields'));
    return;
  }
  _authSetLoading('auth-reset-btn', true);
  _authSetError('');
  try {
    var res = await fetch(WORKER_URL + '/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _authVerifyEmail, otp_code: otp, new_password: password }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(data.detail || 'Error'); return; }
    document.getElementById('auth-title').textContent = t('auth_signin');
    _authShowForm('login');
    _authSetError('');
  } catch (e) {
    _authSetError(t('auth_err_network'));
  } finally {
    _authSetLoading('auth-reset-btn', false);
  }
}

// --- Google OAuth ---

function loginWithGoogle() {
  var uuid = getBrowserUUID();
  if (window.OctileBridge) {
    // Android WebView — use Credential Manager native bottom sheet
    try {
      OctileBridge.startGoogleLogin(uuid);
    } catch (e) {
      alert('Bridge error: ' + e.message);
    }
  } else {
    // Browser/PWA — redirect to worker auth endpoint
    var returnUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = WORKER_URL + '/auth/google?source=web&browser_uuid=' + encodeURIComponent(uuid) + '&return_url=' + returnUrl;
  }
}

// Handle web redirect callback (URL has ?auth_token=...&auth_name=...)
function _checkAuthCallback() {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('auth_token');
  var name = params.get('auth_name');
  var error = params.get('auth_error');
  if (error) {
    console.warn('[Octile] Google auth error:', error);
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
    return;
  }
  if (token) {
    // Decode name (URL-encoded)
    name = name ? decodeURIComponent(name) : '';
    _authOnSuccess({ access_token: token, user: { display_name: name, email: '' } });
    // Fetch full user info to get email
    fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data) localStorage.setItem('octile_auth_user', JSON.stringify(data));
      })
      .catch(function() {});
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
  }
}

// Handle Android deep link callback (native injects this)
window.onGoogleAuthSuccess = function(token, name) {
  _authOnSuccess({ access_token: token, user: { display_name: name, email: '' } });
  // Fetch full user info
  fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data) localStorage.setItem('octile_auth_user', JSON.stringify(data));
    })
    .catch(function() {});
};

window.onGoogleAuthError = function(errorType) {
  console.warn('[Octile] Google auth error:', errorType);
  var msg = errorType || 'Unknown error';
  if (msg.indexOf('Canceled') >= 0 || msg.indexOf('cancelled') >= 0) return; // user cancelled, no toast
  alert('Google Sign-In: ' + msg);
};

// Check for pending auth from cold-launch deep link (native set _pendingAuth before onGoogleAuthSuccess was defined)
function _checkPendingAuth() {
  if (window._pendingAuth) {
    var pa = window._pendingAuth;
    delete window._pendingAuth;
    window.onGoogleAuthSuccess(pa.token, pa.name);
  }
}

// =====================================================================
// MESSAGE CENTER
// =====================================================================

var MSG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getMessages() {
  try {
    var data = JSON.parse(localStorage.getItem('octile_messages') || '{"items":[],"lastReadAt":0}');
    // Prune old messages
    var cutoff = Date.now() - MSG_MAX_AGE_MS;
    data.items = data.items.filter(function(m) { return m.timestamp > cutoff; });
    return data;
  } catch(e) { return { items: [], lastReadAt: 0 }; }
}
function saveMessages(data) { localStorage.setItem('octile_messages', JSON.stringify(data)); }

function addMessage(type, icon, titleKey, bodyKey, extraData) {
  var data = getMessages();
  var msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: type, icon: icon, titleKey: titleKey, bodyKey: bodyKey || '',
    timestamp: Date.now(), read: false, data: extraData || {}
  };
  data.items.unshift(msg);
  // Keep max 50 messages
  if (data.items.length > 50) data.items = data.items.slice(0, 50);
  saveMessages(data);
  updateMessageBadge();
  return msg;
}

function addClaimableMultiplier(value) {
  var data = getMessages();
  // Check limit: max 1 pending 2x and 1 pending 3x
  var existing = data.items.filter(function(m) { return m.type === 'multiplier_claim' && !m.data.claimed && m.data.value === value; });
  if (existing.length >= 1) return; // already has one pending
  var expiresAt = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3 days
  var msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'multiplier_claim', icon: '\uD83D\uDC8E',
    titleKey: value === 3 ? 'multiplier_3x_title' : 'multiplier_2x_title',
    bodyKey: value === 3 ? 'multiplier_3x_desc' : 'multiplier_2x_desc',
    timestamp: Date.now(), read: false,
    data: { value: value, expiresAt: expiresAt, claimed: false }
  };
  data.items.unshift(msg);
  saveMessages(data);
  updateMessageBadge();
}

function claimMultiplierFromMessage(msgId) {
  var data = getMessages();
  var msg = data.items.find(function(m) { return m.id === msgId; });
  if (!msg || msg.data.claimed || msg.data.expiresAt < Date.now()) return;
  msg.data.claimed = true;
  saveMessages(data);
  showMultiplierConfirm(msg.data.value);
}

function getUnreadCount() {
  var data = getMessages();
  return data.items.filter(function(m) { return !m.read; }).length;
}

function updateMessageBadge() {
  var count = getUnreadCount();
  var badge = document.getElementById('messages-badge');
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

function formatRelativeTime(ts) {
  var diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return t('messages_time_now');
  if (diff < 3600) return t('messages_time_min').replace('{n}', Math.floor(diff / 60));
  if (diff < 86400) return t('messages_time_hour').replace('{n}', Math.floor(diff / 3600));
  return t('messages_time_day').replace('{n}', Math.floor(diff / 86400));
}

function _msgTranslate(key, params) {
  var s = t(key);
  if (s === key) return key; // key not found, return as-is
  if (params) {
    for (var k in params) {
      if (params.hasOwnProperty(k)) s = s.replace('{' + k + '}', params[k]);
    }
  }
  return s;
}

function renderMessages() {
  var data = getMessages();
  var list = document.getElementById('messages-list');
  var empty = document.getElementById('messages-empty');
  if (data.items.length === 0) {
    list.innerHTML = '';
    empty.textContent = t('messages_empty');
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  var html = '';
  for (var i = 0; i < data.items.length; i++) {
    var m = data.items[i];
    var cls = m.read ? '' : ' unread';
    html += '<div class="msg-item' + cls + '" data-id="' + m.id + '">';
    html += '<div class="msg-icon">' + m.icon + '</div>';
    html += '<div class="msg-body">';
    // Resolve translation keys at render time (not at save time)
    var _msgTitle = m.titleKey ? _msgTranslate(m.titleKey, m.data) : (m.title || '');
    var _msgBody = m.bodyKey ? _msgTranslate(m.bodyKey, m.data) : (m.body || '');
    html += '<div class="msg-title">' + escapeHtml(_msgTitle) + '</div>';
    if (_msgBody) html += '<div class="msg-desc">' + escapeHtml(_msgBody) + '</div>';
    html += '<div class="msg-time">' + formatRelativeTime(m.timestamp) + '</div>';
    // Actions
    html += '<div class="msg-actions">';
    // Type-specific actions
    if (m.type === 'multiplier_claim' && !m.data.claimed && m.data.expiresAt > Date.now()) {
      var expDays = Math.ceil((m.data.expiresAt - Date.now()) / 86400000);
      html += '<button class="msg-action-btn msg-claim-btn" data-id="' + m.id + '">' + t('tasks_claim') + ' (' + expDays + 'd)</button>';
    } else if (m.type === 'multiplier_claim' && m.data.claimed) {
      html += '<span class="task-claimed-tag">' + t('tasks_claimed') + '</span>';
    } else if (m.type === 'multiplier_claim' && m.data.expiresAt <= Date.now()) {
      html += '<span class="msg-desc" style="color:#e74c3c">' + t('league_inactive') + '</span>';
    }
    if (m.type === 'achievement') {
      var _achClaimed = getClaimedAchievements();
      if (m.data && m.data.achId && !_achClaimed[m.data.achId]) {
        html += '<button class="msg-action-btn msg-ach-claim-btn" data-achid="' + m.data.achId + '">' + t('tasks_claim') + ' \uD83D\uDC8E</button>';
      }
    }
    // Share button for all message types
    html += '<button class="msg-action-btn msg-share-btn" data-id="' + m.id + '">' + t('messages_share') + '</button>';
    html += '</div>';
    html += '</div></div>';
  }
  list.innerHTML = html;
  // Bind claim buttons
  list.querySelectorAll('.msg-claim-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      claimMultiplierFromMessage(this.getAttribute('data-id'));
      document.getElementById('messages-modal').classList.remove('show');
    });
  });
  list.querySelectorAll('.msg-ach-claim-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var achId = this.getAttribute('data-achid');
      claimAchievementDiamonds(achId);
      renderMessages(); // re-render to hide claim button
    });
  });
  list.querySelectorAll('.msg-share-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var msgId = this.getAttribute('data-id');
      var msg = data.items.find(function(m) { return m.id === msgId; });
      if (msg && navigator.share) {
        var shareTitle = msg.titleKey ? _msgTranslate(msg.titleKey, msg.data) : (msg.title || '');
        var shareBody = msg.bodyKey ? _msgTranslate(msg.bodyKey, msg.data) : (msg.body || '');
        navigator.share({ title: 'Octile', text: shareTitle + ': ' + shareBody }).catch(function(){});
      }
    });
  });
}

function showMessagesModal() {
  document.getElementById('messages-modal-title').textContent = t('messages_title');
  renderMessages();
  document.getElementById('messages-modal').classList.add('show');
  // Mark all read after 500ms
  setTimeout(function() {
    var data = getMessages();
    data.items.forEach(function(m) { m.read = true; });
    data.lastReadAt = Date.now();
    saveMessages(data);
    updateMessageBadge();
  }, 500);
}

// =====================================================================
// DAILY SPECIAL TASKS
// =====================================================================

var DAILY_TASK_POOL = [
  { id: 'finish_2_puzzles', target: 2, reward: 15, counter: 'solves' },
  { id: 'finish_3_puzzles', target: 3, reward: 20, counter: 'solves' },
  { id: 'get_2_a_grades',   target: 2, reward: 30, counter: 'aGrades' },
  { id: 'get_3_a_grades',   target: 3, reward: 50, counter: 'aGrades' },
  { id: 'play_10_min',      target: 10, reward: 20, counter: 'playMinutes' },
  { id: 'solve_under_par',  target: 1, reward: 25, counter: 'underPar' },
  { id: 'solve_no_hints',   target: 1, reward: 25, counter: 'noHints' },
  { id: 'try_hard',         target: 1, reward: 20, counter: 'hardSolves' },
  { id: 'try_nightmare',    target: 1, reward: 30, counter: 'hellSolves' },
  { id: 'streak_3_puzzles', target: 3, reward: 35, counter: 'sessionStreak' }
];
var DAILY_TASK_BONUS = 50;
var _sessionStreak = 0; // consecutive solves this session

function dailyTaskSeed(dateStr) {
  var h = 0;
  for (var i = 0; i < dateStr.length; i++) h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getTodayStr() { return new Date().toISOString().slice(0, 10); }

function getDailyTaskCounters() {
  try {
    var d = JSON.parse(localStorage.getItem('octile_daily_task_counters') || '{}');
    if (d.date !== getTodayStr()) return { date: getTodayStr(), solves: 0, aGrades: 0, underPar: 0, noHints: 0, hardSolves: 0, hellSolves: 0, playMinutes: 0, sessionStreak: 0 };
    return d;
  } catch(e) { return { date: getTodayStr(), solves: 0, aGrades: 0, underPar: 0, noHints: 0, hardSolves: 0, hellSolves: 0, playMinutes: 0, sessionStreak: 0 }; }
}
function saveDailyTaskCounters(c) { localStorage.setItem('octile_daily_task_counters', JSON.stringify(c)); }

function updateDailyTaskCounters(grade, elapsed, level) {
  var c = getDailyTaskCounters();
  c.solves = (c.solves || 0) + 1;
  if (grade === 'S' || grade === 'A') c.aGrades = (c.aGrades || 0) + 1;
  var par = (PAR_TIMES || {})[level] || 90;
  if (elapsed <= par) c.underPar = (c.underPar || 0) + 1;
  if (typeof getHintsUsedToday === 'function' && getHintsUsedToday() === 0) c.noHints = (c.noHints || 0) + 1;
  if (level === 'hard') c.hardSolves = (c.hardSolves || 0) + 1;
  if (level === 'hell') c.hellSolves = (c.hellSolves || 0) + 1;
  c.playMinutes = Math.round(((c.playMinutes || 0) + elapsed / 60) * 10) / 10;
  _sessionStreak++;
  c.sessionStreak = _sessionStreak;
  c.date = getTodayStr();
  saveDailyTaskCounters(c);
}

function getDailyTasks() {
  try {
    var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}');
    if (d.date === getTodayStr() && d.tasks && d.tasks.length === 3) return d;
  } catch(e) {}
  return generateDailyTasks();
}

function generateDailyTasks() {
  var dateStr = getTodayStr();
  var seed = dailyTaskSeed(dateStr);
  // Fisher-Yates shuffle with seed
  var pool = DAILY_TASK_POOL.slice();
  for (var i = pool.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    var j = seed % (i + 1);
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  var picked = pool.slice(0, 3);
  var tasks = picked.map(function(p) {
    return { id: p.id, target: p.target, progress: 0, reward: p.reward, claimed: false, counter: p.counter };
  });
  var data = { date: dateStr, tasks: tasks, bonusClaimed: false };
  localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
  return data;
}

function updateDailyTaskProgress() {
  var data = getDailyTasks();
  var counters = getDailyTaskCounters();
  for (var i = 0; i < data.tasks.length; i++) {
    var task = data.tasks[i];
    task.progress = Math.min(counters[task.counter] || 0, task.target);
  }
  localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
  checkDailyTaskNotification();
}

function claimDailyTaskReward(idx) {
  var data = getDailyTasks();
  var task = data.tasks[idx];
  if (!task || task.claimed || task.progress < task.target) return;
  task.claimed = true;
  addDiamonds(task.reward);
  localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
  // Check if all 3 claimed for bonus
  var allClaimed = data.tasks.every(function(t) { return t.claimed; });
  if (allClaimed && !data.bonusClaimed) {
    data.bonusClaimed = true;
    addDiamonds(DAILY_TASK_BONUS);
    localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
    addMessage('daily_tasks', '\u2705', 'tasks_bonus_claimed', '', { diamonds: DAILY_TASK_BONUS });
  }
  renderDailyTasks();
}

function checkDailyTaskNotification() {
  var data = getDailyTasks();
  var dot = document.querySelector('.tasks-dot');
  if (!dot) return;
  var hasClaimable = data.tasks.some(function(task) { return task.progress >= task.target && !task.claimed; });
  dot.classList.toggle('show', hasClaimable);
}

function getDailyTaskResetCountdown() {
  var now = new Date();
  var midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  var diff = Math.floor((midnight - now) / 1000);
  var h = Math.floor(diff / 3600);
  var m = Math.floor((diff % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function renderDailyTasks() {
  var data = getDailyTasks();
  var grid = document.getElementById('tasks-grid');
  var html = '';
  for (var i = 0; i < data.tasks.length; i++) {
    var task = data.tasks[i];
    var pct = Math.min(100, Math.round(task.progress / task.target * 100));
    var done = task.progress >= task.target;
    var cls = task.claimed ? 'task-card claimed' : done ? 'task-card completed' : 'task-card';
    html += '<div class="' + cls + '">';
    html += '<div class="task-name">' + t('task_' + task.id) + '</div>';
    html += '<div class="task-progress-bar"><div class="task-progress-fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="task-footer">';
    html += '<span class="task-reward">\uD83D\uDC8E ' + task.reward + '</span>';
    var _dispProg = Number.isInteger(task.progress) ? task.progress : parseFloat(task.progress.toFixed(1));
    html += '<span>' + _dispProg + '/' + task.target + '</span>';
    if (task.claimed) {
      html += '<span class="task-claimed-tag">' + t('tasks_claimed') + '</span>';
    } else if (done) {
      html += '<button class="task-claim-btn" data-idx="' + i + '">' + t('tasks_claim') + '</button>';
    }
    html += '</div></div>';
  }
  grid.innerHTML = html;
  // Bonus section
  var bonus = document.getElementById('tasks-bonus');
  if (data.bonusClaimed) {
    bonus.innerHTML = '<strong>' + t('tasks_bonus_claimed').replace('{diamonds}', DAILY_TASK_BONUS) + '</strong>';
  } else {
    bonus.innerHTML = t('tasks_bonus').replace('{diamonds}', DAILY_TASK_BONUS);
  }
  // Timer
  document.getElementById('tasks-reset-timer').textContent = t('tasks_reset').replace('{time}', getDailyTaskResetCountdown());
  // Bind claim buttons
  grid.querySelectorAll('.task-claim-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { claimDailyTaskReward(parseInt(this.getAttribute('data-idx'))); });
  });
}

function showDailyTasksModal() {
  document.getElementById('tasks-modal-title').textContent = t('tasks_title');
  updateDailyTaskProgress();
  renderDailyTasks();
  document.getElementById('tasks-modal').classList.add('show');
}

// =====================================================================
// DIAMOND MULTIPLIER (2x / 3x)
// =====================================================================

var MULTIPLIER_DURATION_MS = 10 * 60 * 1000; // 10 minutes
var MULTIPLIER_TIME_WINDOWS = [{ start: 12, end: 13 }, { start: 20, end: 21 }];
var CONSECUTIVE_A_FOR_3X = 3;
var _multiplierInterval = null;

function getMultiplierState() {
  try {
    var s = JSON.parse(localStorage.getItem('octile_multiplier') || '{}');
    if (s.expiresAt && s.expiresAt <= Date.now()) {
      // Expired — clear
      localStorage.removeItem('octile_multiplier');
      return { type: null, value: 1, expiresAt: null };
    }
    return s.value ? s : { type: null, value: 1, expiresAt: null };
  } catch(e) { return { type: null, value: 1, expiresAt: null }; }
}
function saveMultiplierState(s) { localStorage.setItem('octile_multiplier', JSON.stringify(s)); }

function getMultiplierDaily() {
  try {
    var d = JSON.parse(localStorage.getItem('octile_multiplier_daily') || '{}');
    if (d.date !== getTodayStr()) return { date: getTodayStr(), threeXUsed: false, consecutiveAGrades: 0 };
    return d;
  } catch(e) { return { date: getTodayStr(), threeXUsed: false, consecutiveAGrades: 0 }; }
}
function saveMultiplierDaily(d) { localStorage.setItem('octile_multiplier_daily', JSON.stringify(d)); }

function getActiveMultiplier() {
  var s = getMultiplierState();
  return (s.value && s.expiresAt && s.expiresAt > Date.now()) ? s.value : 1;
}

function isInTimeWindow() {
  var h = new Date().getHours();
  return MULTIPLIER_TIME_WINDOWS.some(function(w) { return h >= w.start && h < w.end; });
}

function checkTimeWindowMultiplier() {
  if (!isInTimeWindow()) return;
  var current = getActiveMultiplier();
  if (current >= 2) return; // already have equal or better
  // Check if we already offered 2x this hour (avoid spamming)
  var daily = getMultiplierDaily();
  var lastOffer = daily._lastTimeWindowOffer || 0;
  var hour = new Date().getHours();
  if (lastOffer === hour) return;
  daily._lastTimeWindowOffer = hour;
  saveMultiplierDaily(daily);
  showMultiplierConfirm(2);
}

function checkConsecutiveAGrades(grade) {
  var daily = getMultiplierDaily();
  if (grade === 'S' || grade === 'A') {
    daily.consecutiveAGrades = (daily.consecutiveAGrades || 0) + 1;
  } else {
    daily.consecutiveAGrades = 0;
  }
  saveMultiplierDaily(daily);
  if (daily.consecutiveAGrades >= CONSECUTIVE_A_FOR_3X && !daily.threeXUsed) {
    daily.consecutiveAGrades = 0;
    daily.threeXUsed = true; // mark used immediately — once per day
    saveMultiplierDaily(daily);
    var current = getActiveMultiplier();
    if (current >= 3) {
      addClaimableMultiplier(3);
    } else {
      showMultiplierConfirm(3);
    }
  }
}

function showMultiplierConfirm(value) {
  var modal = document.getElementById('multiplier-confirm-modal');
  var content = document.getElementById('multiplier-confirm-content');
  content.className = value === 3 ? 'x3' : '';
  document.getElementById('multiplier-confirm-icon').textContent = value === 3 ? '\uD83D\uDC8E\u2728' : '\uD83D\uDC8E';
  document.getElementById('multiplier-confirm-title').textContent = value === 3 ? t('multiplier_3x_title') : t('multiplier_2x_title');
  document.getElementById('multiplier-confirm-desc').textContent = value === 3 ? t('multiplier_3x_desc') : t('multiplier_2x_desc');
  document.getElementById('multiplier-confirm-duration').textContent = t('multiplier_duration').replace('{minutes}', Math.round(MULTIPLIER_DURATION_MS / 60000));
  document.getElementById('multiplier-confirm-start').textContent = t('multiplier_start');
  document.getElementById('multiplier-confirm-skip').textContent = t('multiplier_skip');
  // Store pending value
  modal._pendingValue = value;
  modal.classList.add('show');
}

function activateMultiplier(value) {
  var state = {
    type: value === 3 ? 'consecutive' : 'time_window',
    value: value,
    expiresAt: Date.now() + MULTIPLIER_DURATION_MS,
    activatedAt: Date.now()
  };
  saveMultiplierState(state);
  if (value === 3) {
    var daily = getMultiplierDaily();
    daily.threeXUsed = true;
    saveMultiplierDaily(daily);
  }
  startMultiplierCountdown();
  updateMultiplierDisplay();
  addMessage('multiplier', '\uD83D\uDC8E', 'multiplier_active', 'multiplier_toast_on', { value: value });
}

function startMultiplierCountdown() {
  if (_multiplierInterval) clearInterval(_multiplierInterval);
  updateMultiplierDisplay();
  _multiplierInterval = setInterval(function() {
    var s = getMultiplierState();
    if (!s.expiresAt || s.expiresAt <= Date.now()) {
      clearInterval(_multiplierInterval);
      _multiplierInterval = null;
      updateMultiplierDisplay();
      return;
    }
    var remaining = Math.ceil((s.expiresAt - Date.now()) / 1000);
    var m = Math.floor(remaining / 60);
    var sec = remaining % 60;
    document.getElementById('multiplier-timer').textContent = m + ':' + (sec < 10 ? '0' : '') + sec;
  }, 1000);
}

function updateMultiplierDisplay() {
  var el = document.getElementById('multiplier-display');
  var s = getMultiplierState();
  if (s.value > 1 && s.expiresAt && s.expiresAt > Date.now()) {
    document.getElementById('multiplier-value').textContent = s.value + 'x';
    el.classList.toggle('x3', s.value === 3);
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

function applyDiamondMultiplier(baseDiamonds) {
  return baseDiamonds * getActiveMultiplier();
}

function checkMultiplierOnLoad() {
  var s = getMultiplierState();
  if (s.value > 1 && s.expiresAt && s.expiresAt > Date.now()) {
    startMultiplierCountdown();
  }
  updateMultiplierDisplay();
  // Periodic time window check
  setInterval(checkTimeWindowMultiplier, 60000);
  checkTimeWindowMultiplier();
}

// --- Progress Sync ---

function _getLocalProgress() {
  var grades = JSON.parse(localStorage.getItem('octile_grades') || '{"S":0,"A":0,"B":0}');
  var streak = getStreak();
  var months = JSON.parse(localStorage.getItem('octile_months') || '[]');
  var unlocked = getUnlockedAchievements();
  return {
    browser_uuid: getBrowserUUID(),
    level_easy: getLevelProgress('easy'),
    level_medium: getLevelProgress('medium'),
    level_hard: getLevelProgress('hard'),
    level_hell: getLevelProgress('hell'),
    exp: getExp(),
    diamonds: getDiamonds(),
    chapters_completed: getChaptersCompleted(),
    achievements: Object.keys(unlocked),
    streak_count: streak.count || 0,
    streak_last_date: streak.lastDate || null,
    months: months,
    total_solved: parseInt(localStorage.getItem('octile_total_solved') || '0'),
    total_time: parseFloat(localStorage.getItem('octile_total_time') || '0'),
    grades_s: grades.S || 0,
    grades_a: grades.A || 0,
    grades_b: grades.B || 0,
    daily_tasks_date: (function() { try { var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}'); return d.date || null; } catch(e) { return null; } })(),
    daily_tasks_claimed: (function() { try { var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}'); return (d.tasks || []).filter(function(t) { return t.claimed; }).map(function(t) { return t.id; }); } catch(e) { return []; } })(),
    daily_tasks_bonus_claimed: (function() { try { var d = JSON.parse(localStorage.getItem('octile_daily_tasks') || '{}'); return !!d.bonusClaimed; } catch(e) { return false; } })(),
  };
}

function _applyServerProgress(p) {
  // MAX merge: only update if server value is higher
  var levels = { easy: 'octile_level_easy', medium: 'octile_level_medium', hard: 'octile_level_hard', hell: 'octile_level_hell' };
  for (var lv in levels) {
    var serverVal = p['level_' + lv] || 0;
    if (serverVal > getLevelProgress(lv)) {
      localStorage.setItem(levels[lv], serverVal);
    }
  }
  if ((p.exp || 0) > getExp()) localStorage.setItem('octile_exp', p.exp);
  if ((p.diamonds || 0) > getDiamonds()) localStorage.setItem('octile_diamonds', p.diamonds);
  if ((p.chapters_completed || 0) > getChaptersCompleted()) localStorage.setItem('octile_chapters_completed', p.chapters_completed);
  if ((p.total_solved || 0) > parseInt(localStorage.getItem('octile_total_solved') || '0')) localStorage.setItem('octile_total_solved', p.total_solved);
  if ((p.total_time || 0) > parseFloat(localStorage.getItem('octile_total_time') || '0')) localStorage.setItem('octile_total_time', p.total_time);

  // Grades: MAX per tier
  var grades = JSON.parse(localStorage.getItem('octile_grades') || '{"S":0,"A":0,"B":0}');
  grades.S = Math.max(grades.S || 0, p.grades_s || 0);
  grades.A = Math.max(grades.A || 0, p.grades_a || 0);
  grades.B = Math.max(grades.B || 0, p.grades_b || 0);
  localStorage.setItem('octile_grades', JSON.stringify(grades));

  // Achievements: union
  if (p.achievements && p.achievements.length) {
    var unlocked = getUnlockedAchievements();
    for (var i = 0; i < p.achievements.length; i++) {
      if (!unlocked[p.achievements[i]]) unlocked[p.achievements[i]] = true;
    }
    saveUnlockedAchievements(unlocked);
  }

  // Months: union
  if (p.months && p.months.length) {
    var localMonths = JSON.parse(localStorage.getItem('octile_months') || '[]');
    var merged = Array.from(new Set(localMonths.concat(p.months))).sort(function(a, b) { return a - b; });
    localStorage.setItem('octile_months', JSON.stringify(merged));
  }

  // Streak: keep higher or more recent
  var localStreak = getStreak();
  if ((p.streak_count || 0) > (localStreak.count || 0) ||
      ((p.streak_count || 0) === (localStreak.count || 0) && (p.streak_last_date || '') >= (localStreak.lastDate || ''))) {
    localStorage.setItem('octile_streak', JSON.stringify({ count: p.streak_count, lastDate: p.streak_last_date }));
  }

  // Daily tasks: merge claimed from server (if same date, union claimed IDs)
  if (p.daily_tasks_date) {
    try {
      var localTasks = getDailyTasks();
      if (p.daily_tasks_date === localTasks.date && p.daily_tasks_claimed) {
        var serverClaimed = p.daily_tasks_claimed;
        for (var ti = 0; ti < localTasks.tasks.length; ti++) {
          if (serverClaimed.indexOf(localTasks.tasks[ti].id) >= 0) {
            localTasks.tasks[ti].claimed = true;
          }
        }
        if (p.daily_tasks_bonus_claimed) localTasks.bonusClaimed = true;
        localStorage.setItem('octile_daily_tasks', JSON.stringify(localTasks));
        checkDailyTaskNotification();
      }
    } catch(e) {}
  }

  // Refresh displays
  updateExpDisplay();
  updateDiamondDisplay();
}

async function _pullProgressOnly() {
  if (!isAuthenticated()) return;
  try {
    var res = await fetch(WORKER_URL + '/sync/pull', { headers: getAuthHeaders() });
    if (res.ok) {
      var data = await res.json();
      if (data.status === 'ok' && data.progress) {
        _applyServerProgress(data.progress);
      }
    }
    console.log('[Octile] Progress pulled');
  } catch (e) {
    console.warn('[Octile] Pull failed:', e.message);
  }
}

async function syncProgress() {
  if (!isAuthenticated()) return;
  var headers = getAuthHeaders();
  headers['Content-Type'] = 'application/json';
  try {
    // Push local → server
    await fetch(WORKER_URL + '/sync/push', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(_getLocalProgress()),
    });
    // Pull server → local
    var res = await fetch(WORKER_URL + '/sync/pull', { headers: getAuthHeaders() });
    if (res.ok) {
      var data = await res.json();
      if (data.status === 'ok' && data.progress) {
        _applyServerProgress(data.progress);
      }
    }
    console.log('[Octile] Progress synced');
  } catch (e) {
    console.warn('[Octile] Sync failed:', e.message);
  }
}

// --- Player Profile ---

// ELO-based rank tiers (used when server ELO is available)
var ELO_RANK_TIERS = [
  { min: 2800, en: 'Grandmaster', zh: '\u5B97\u5E2B' },
  { min: 2400, en: 'Master', zh: '\u5927\u5E2B' },
  { min: 2000, en: 'Expert', zh: '\u5C08\u5BB6' },
  { min: 1600, en: 'Strategist', zh: '\u7B56\u7565\u5BB6' },
  { min: 1200, en: 'Puzzler', zh: '\u89E3\u8B0E\u8005' },
  { min: 800,  en: 'Apprentice', zh: '\u898B\u7FD2\u751F' },
  { min: 0,    en: 'Novice', zh: '\u521D\u5B78\u8005' }
];

// EXP-based rank tiers (fallback when offline)
var EXP_RANK_TIERS = [
  { min: 500000, en: 'Grandmaster', zh: '\u5B97\u5E2B' },
  { min: 150000, en: 'Master', zh: '\u5927\u5E2B' },
  { min: 50000,  en: 'Expert', zh: '\u5C08\u5BB6' },
  { min: 15000,  en: 'Strategist', zh: '\u7B56\u7565\u5BB6' },
  { min: 5000,   en: 'Puzzler', zh: '\u89E3\u8B0E\u8005' },
  { min: 1000,   en: 'Apprentice', zh: '\u898B\u7FD2\u751F' },
  { min: 0,      en: 'Novice', zh: '\u521D\u5B78\u8005' }
];

function _getRankFromTiers(value, tiers) {
  for (var i = 0; i < tiers.length; i++) {
    if (value >= tiers[i].min) return tiers[i][currentLang] || tiers[i].en;
  }
  return tiers[tiers.length - 1][currentLang] || 'Novice';
}

function getRankTitle(exp) { return _getRankFromTiers(exp, EXP_RANK_TIERS); }
function getEloRankTitle(elo) { return _getRankFromTiers(elo, ELO_RANK_TIERS); }

function getRankColor(exp) {
  if (exp >= 500000) return '#f1c40f';
  if (exp >= 150000) return '#e74c3c';
  if (exp >= 50000) return '#9b59b6';
  if (exp >= 15000) return '#e67e22';
  if (exp >= 5000) return '#3498db';
  if (exp >= 1000) return '#2ecc71';
  return '#888';
}

function getEloRankColor(elo) {
  if (elo >= 2800) return '#f1c40f';
  if (elo >= 2400) return '#e74c3c';
  if (elo >= 2000) return '#9b59b6';
  if (elo >= 1600) return '#e67e22';
  if (elo >= 1200) return '#3498db';
  if (elo >= 800) return '#2ecc71';
  return '#888';
}

function getNextRankExp(exp) {
  for (var i = EXP_RANK_TIERS.length - 1; i >= 0; i--) {
    if (EXP_RANK_TIERS[i].min > exp) return EXP_RANK_TIERS[i].min;
  }
  return null;
}

function calcProfileStats() {
  var totalSolves = parseInt(localStorage.getItem('octile_total_solved') || '0');
  var totalTime = parseFloat(localStorage.getItem('octile_total_time') || '0');
  var avgTime = totalSolves > 0 ? totalTime / totalSolves : 0;
  var exp = getExp();
  var grades = JSON.parse(localStorage.getItem('octile_grades') || '{"S":0,"A":0,"B":0}');
  var gradeTotal = grades.S + grades.A + grades.B;

  // Per-world progress
  var worldSolves = {};
  var totalProgress = 0;
  var totalPuzzles = 0;
  for (var i = 0; i < LEVELS.length; i++) {
    var lv = LEVELS[i];
    var prog = getLevelProgress(lv);
    var tot = getEffectiveLevelTotal(lv);
    worldSolves[lv] = prog;
    totalProgress += prog;
    totalPuzzles += tot;
  }

  // Speed: avg par / avg time (weighted by world distribution)
  var weightedPar = 0;
  if (totalProgress > 0) {
    for (var j = 0; j < LEVELS.length; j++) {
      var lvl = LEVELS[j];
      var w = worldSolves[lvl] / totalProgress;
      weightedPar += (PAR_TIMES[lvl] || 90) * w;
    }
  } else {
    weightedPar = 90;
  }
  var speed = avgTime > 0 ? Math.min(100, Math.round(weightedPar / avgTime * 100)) : 0;

  // Mastery: S-grade rate (% of S grades)
  var mastery = gradeTotal > 0 ? Math.round(grades.S / gradeTotal * 100) : 0;

  // Breadth: worlds with progress, weighted by depth
  var worldsPlayed = 0;
  var breadthScore = 0;
  for (var k = 0; k < LEVELS.length; k++) {
    var lk = LEVELS[k];
    var pk = getEffectiveLevelTotal(lk);
    if (worldSolves[lk] > 0) {
      worldsPlayed++;
      breadthScore += Math.min(1, worldSolves[lk] / Math.max(1, pk) * 4);
    }
  }
  var breadth = Math.round(breadthScore / 4 * 100);

  // Dedication: streak + months
  var streak = getStreak().count || 0;
  var months = JSON.parse(localStorage.getItem('octile_months') || '[]');
  var dedication = Math.min(100, Math.round(streak * 2.5 + months.length * 6));

  // Progress: log scale so early progress feels meaningful
  var progress = totalProgress > 0 ? Math.min(100, Math.round(Math.log10(totalProgress + 1) / Math.log10(totalPuzzles + 1) * 100)) : 0;

  return {
    exp: exp, diamonds: getDiamonds(), totalSolves: totalSolves, avgTime: avgTime,
    grades: grades, gradeTotal: gradeTotal,
    worldSolves: worldSolves, totalProgress: totalProgress, totalPuzzles: totalPuzzles,
    streak: streak, months: months,
    achieveCount: Object.keys(getUnlockedAchievements()).length,
    achieveTotal: ACHIEVEMENTS.length,
    radar: { speed: speed, mastery: mastery, breadth: breadth, dedication: dedication, progress: progress }
  };
}

function renderRadarSVG(values) {
  var axes = [
    { key: 'speed', label: t('profile_speed') },
    { key: 'mastery', label: t('profile_mastery') },
    { key: 'breadth', label: t('profile_breadth') },
    { key: 'dedication', label: t('profile_dedication') },
    { key: 'progress', label: t('profile_progress') }
  ];
  var n = axes.length;
  var cx = 120, cy = 120, R = 90;
  var angleOff = -Math.PI / 2;

  function polar(i, r) {
    var a = angleOff + (2 * Math.PI * i / n);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  var svg = '<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">';

  // Grid rings
  for (var ring = 1; ring <= 4; ring++) {
    var r = R * ring / 4;
    var pts = [];
    for (var gi = 0; gi < n; gi++) pts.push(polar(gi, r).join(','));
    svg += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>';
  }

  // Axis lines
  for (var ai = 0; ai < n; ai++) {
    var ep = polar(ai, R);
    svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ep[0] + '" y2="' + ep[1] + '" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>';
  }

  // Data polygon
  var dataPts = [];
  for (var di = 0; di < n; di++) {
    var val = values[axes[di].key] || 0;
    dataPts.push(polar(di, R * val / 100).join(','));
  }
  svg += '<polygon points="' + dataPts.join(' ') + '" fill="rgba(46,204,113,0.2)" stroke="#2ecc71" stroke-width="2"/>';

  // Data dots + labels
  for (var li = 0; li < n; li++) {
    var v = values[axes[li].key] || 0;
    var dp = polar(li, R * v / 100);
    svg += '<circle cx="' + dp[0] + '" cy="' + dp[1] + '" r="3" fill="#2ecc71"/>';

    // Label outside
    var lp = polar(li, R + 22);
    svg += '<text x="' + lp[0] + '" y="' + lp[1] + '" class="profile-radar-labels">' + axes[li].label + '</text>';

    // Value
    var vp = polar(li, R + 12);
    svg += '<text x="' + vp[0] + '" y="' + (vp[1] + 10) + '" class="profile-radar-value">' + v + '</text>';
  }

  svg += '</svg>';
  return svg;
}

function showProfileModal() {
  _configReady.then(function() { _showProfileModalInner(); });
}
function _showProfileModalInner() {
  var stats = calcProfileStats();
  var exp = stats.exp;
  var uuid = getBrowserUUID();
  var authUser = getAuthUser();
  var name = authUser ? authUser.display_name : generateCuteName(uuid);

  // Render immediately with local data, then enhance with server data
  _renderProfileCard(stats, uuid, name, authUser, null);
  document.getElementById('profile-modal').classList.add('show');

  // Fetch server stats (ELO + authoritative grades) in background
  if (isOnline()) {
    fetch(WORKER_URL + '/player/' + uuid + '/stats', { signal: AbortSignal.timeout(5000) })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.status === 'ok') {
          _renderProfileCard(stats, uuid, name, authUser, data);
        }
      })
      .catch(function() {});
  }
}

function _renderProfileCard(stats, uuid, name, authUser, serverStats) {
  var exp = stats.exp;
  var elo = serverStats ? serverStats.elo : null;
  var rankTitle = elo ? getEloRankTitle(elo) : getRankTitle(exp);
  var rankColor = elo ? getEloRankColor(elo) : getRankColor(exp);
  var nextRank = elo ? null : getNextRankExp(exp);

  // Use server grade distribution if available, else local
  var grades = stats.grades;
  var gradeTotal = stats.gradeTotal;
  if (serverStats && serverStats.grade_distribution) {
    grades = serverStats.grade_distribution;
    gradeTotal = (grades.S || 0) + (grades.A || 0) + (grades.B || 0);
  }

  var html = '<h2>' + t('profile_title') + '</h2>';

  // Auth row
  if (isAuthEnabled()) {
    html += '<div class="profile-auth-row">';
    if (authUser) {
      html += '<div class="profile-auth-info">' + authUser.email + '</div>';
      html += '<button class="profile-signout-btn" onclick="authLogout();showProfileModal()">' + t('auth_signout') + '</button>';
    } else {
      html += '<div class="profile-auth-info">' + t('auth_save_prompt') + '</div>';
      html += '<button class="profile-signin-btn" onclick="document.getElementById(\'profile-modal\').classList.remove(\'show\');showAuthModal()">' + t('auth_signin') + '</button>';
    }
    html += '</div>';
  }

  // Header
  html += '<div class="profile-header">';
  html += '<div class="profile-avatar">' + sbAvatarHTML(uuid, 56, authUser ? authUser.picture : null) + '</div>';
  html += '<div class="profile-name">' + name + '</div>';
  var _leagueTier = parseInt(localStorage.getItem('octile_league_tier') || '-1');
  if (_leagueTier >= 0 && LEAGUE_TIERS_CLIENT[_leagueTier]) {
    html += '<div style="text-align:center;margin:4px 0;font-size:14px">' + LEAGUE_TIERS_CLIENT[_leagueTier].icon + ' ' + t('league_tier_' + _leagueTier) + '</div>';
  }
  html += '<div class="profile-rank"><span class="profile-rank-title" style="color:' + rankColor + '">' + rankTitle + '</span></div>';
  html += '<div class="profile-exp-row">';
  if (elo) {
    html += t('profile_elo') + ' ' + Math.round(elo) + ' \u00B7 ';
  }
  html += '\u2B50 ' + exp.toLocaleString() + ' EXP';
  if (nextRank) html += ' \u00B7 ' + t('profile_next_rank').replace('{exp}', nextRank.toLocaleString());
  html += '</div>';
  html += '</div>';

  // Radar chart
  html += '<div class="profile-radar">' + renderRadarSVG(stats.radar) + '</div>';

  // Grade distribution
  if (gradeTotal > 0) {
    var sPct = Math.round((grades.S || 0) / gradeTotal * 100);
    var aPct = Math.round((grades.A || 0) / gradeTotal * 100);
    var bPct = 100 - sPct - aPct;
    html += '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:14px;font-size:12px">';
    html += '<span style="color:#f1c40f">S ' + sPct + '%</span>';
    html += '<span style="color:#2ecc71">A ' + aPct + '%</span>';
    html += '<span style="color:#3498db">B ' + bPct + '%</span>';
    html += '</div>';
  }

  // World progress
  html += '<div class="profile-worlds">';
  for (var i = 0; i < LEVELS.length; i++) {
    var lv = LEVELS[i];
    var total = getEffectiveLevelTotal(lv);
    var done = stats.worldSolves[lv] || 0;
    var pct = total > 0 ? (done / total * 100) : 0;
    var theme = WORLD_THEMES[lv];
    var color = LEVEL_COLORS[lv];
    html += '<div class="profile-world-row">';
    html += '<span class="profile-world-icon">' + theme.icon + '</span>';
    html += '<span class="profile-world-name">' + t('level_' + lv) + '</span>';
    html += '<span class="profile-world-bar"><span class="profile-world-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></span></span>';
    html += '<span class="profile-world-pct">' + pct.toFixed(1) + '%</span>';
    html += '</div>';
  }
  html += '</div>';

  // Footer stats
  html += '<div class="profile-footer">';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDD25 ' + stats.streak + '</div><div class="profile-footer-label">' + t('profile_streak') + '</div></div>';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDC8E ' + stats.diamonds.toLocaleString() + '</div><div class="profile-footer-label">' + t('profile_diamonds') + '</div></div>';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83C\uDFC6 ' + stats.achieveCount + '/' + stats.achieveTotal + '</div><div class="profile-footer-label">' + t('profile_achievements') + '</div></div>';
  html += '</div>';

  document.getElementById('profile-body').innerHTML = html;
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
// Track energy when leaving, show recovery toast on return
let _energyOnHide = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _energyOnHide = Math.floor(getEnergyState().points);
    if (timerStarted && !gameOver && !paused) {
      pauseGame();
    }
  } else {
    // Flow 5: returning to app — check if energy recovered
    const nowPlays = Math.floor(getEnergyState().points);
    if (nowPlays > _energyOnHide && _energyOnHide <= 0) {
      // Was at zero, now has plays — show recovery toast
      const toast = document.getElementById('achieve-toast');
      toast.querySelector('.toast-icon').textContent = '\u2615';
      toast.querySelector('.toast-label').textContent = '';
      toast.querySelector('.toast-name').textContent = t('energy_ready');
      toast.classList.add('show');
      if (achieveToastTimer) clearTimeout(achieveToastTimer);
      achieveToastTimer = setTimeout(() => { toast.classList.remove('show'); achieveToastTimer = null; }, 4000);
    }
    updateEnergyDisplay();
    updateExpDisplay();
    updateDiamondDisplay();
  }
});

function closeSettingsAndDo(fn) {
  document.getElementById('settings-modal').classList.remove('show');
  setTimeout(fn, 150);
}
document.getElementById('help-btn').addEventListener('click', () => closeSettingsAndDo(() => document.getElementById('help-modal').classList.add('show')));
document.getElementById('story-btn').addEventListener('click', () => closeSettingsAndDo(() => document.getElementById('story-modal').classList.add('show')));
document.getElementById('share-btn').addEventListener('click', () => closeSettingsAndDo(shareGame));
document.getElementById('tasks-btn').addEventListener('click', () => closeSettingsAndDo(showDailyTasksModal));
document.getElementById('messages-btn').addEventListener('click', () => closeSettingsAndDo(showMessagesModal));

// Settings modal
const THEMES = [
  { id: 'default', key: 'theme_classic', cost: 0 },
  { id: 'lego', key: 'theme_lego', cost: 0 },
  { id: 'wood', key: 'theme_wood', cost: 0 },
  { id: 'stained-glass', key: 'theme_stained_glass', cost: 500 },
  { id: 'marble-gold', key: 'theme_marble_gold', cost: 800 },
  { id: 'quilt', key: 'theme_quilt', cost: 500 },
  { id: 'deep-sea', key: 'theme_deep_sea', cost: 1000 },
  { id: 'space-galaxy', key: 'theme_space_galaxy', cost: 1500 },
  { id: 'botanical', key: 'theme_botanical', cost: 500 },
  { id: 'cyberpunk', key: 'theme_cyberpunk', cost: 1000 },
  { id: 'ancient-ink', key: 'theme_ancient_ink', cost: 800 },
  { id: 'ukiyo-e', key: 'theme_ukiyo_e', cost: 1000 },
  { id: 'steampunk', key: 'theme_steampunk', cost: 1500 },
  { id: 'frozen', key: 'theme_frozen', cost: 800 },
  { id: 'halloween', key: 'theme_halloween', cost: 800 },
];
const THEME_SWATCHES = {
  'default':       ['#1a1a40','#e74c3c','#3498db','#f1c40f','#ecf0f1','#888','#16213e','#e74c3c','#3498db'],
  'lego':          ['#2d8a4e','#c0392b','#2980b9','#f39c12','#ecf0f1','#7f8c8d','#1a5c2a','#c0392b','#2980b9'],
  'wood':          ['#6b4226','#a63c2e','#2b5e7e','#c49a2a','#d4c5a9','#8b7355','#5c3a1e','#a63c2e','#2b5e7e'],
  'stained-glass': ['#18082a','#b83230','#1e6898','#c8a010','#a8b8c0','#7a6830','#2a1a3a','#b83230','#1e6898'],
  'marble-gold':   ['#ece4d6','#d8c8a8','#c0aa80','#dcc888','#f0ebe0','#b0a090','#c8b898','#d8c8a8','#c0aa80'],
  'quilt':         ['#f0e0cc','#c85040','#4a7c6f','#d8a848','#ecdcc8','#a89080','#6a5040','#c85040','#4a7c6f'],
  'deep-sea':      ['#081420','#186878','#0c4468','#188878','#50c8b8','#1e3a48','#051018','#186878','#0c4468'],
  'space-galaxy':  ['#08041a','#6828a0','#220e50','#8838b8','#b858d8','#3a1860','#08041a','#6828a0','#220e50'],
  'botanical':     ['#1a2e1a','#488838','#2a6228','#70b050','#98d080','#4a6840','#142014','#488838','#2a6228'],
  'cyberpunk':     ['#0a0a16','#ff2a6d','#05d9e8','#c8f0ff','#ff6898','#282838','#0a0a16','#ff2a6d','#05d9e8'],
  'ancient-ink':   ['#efe6d4','#282420','#484440','#b83020','#d8d0c0','#888078','#d4cab8','#282420','#484440'],
  'ukiyo-e':       ['#281a10','#b83828','#285878','#c89838','#dcc898','#5a4030','#281a10','#b83828','#285878'],
  'steampunk':     ['#18100a','#8a6830','#604820','#a88038','#c0a060','#4a3a28','#1a1008','#8a6830','#604820'],
  'frozen':        ['#e4ecf4','#88c0e0','#5898c8','#a8d0e8','#f0f6fc','#98b0c4','#a8c0d8','#88c0e0','#5898c8'],
  'halloween':     ['#18081a','#d85820','#7028a0','#d89818','#e8b848','#3a1a3a','#180a18','#d85820','#7028a0'],
};
function getUnlockedThemes() {
  try { return JSON.parse(localStorage.getItem('octile_unlocked_themes') || '[]'); } catch(e) { return []; }
}
function isThemeUnlocked(id) {
  var th = THEMES.find(t => t.id === id);
  if (!th || th.cost === 0) return true;
  return getUnlockedThemes().indexOf(id) >= 0;
}
function unlockTheme(id) {
  var list = getUnlockedThemes();
  if (list.indexOf(id) < 0) { list.push(id); localStorage.setItem('octile_unlocked_themes', JSON.stringify(list)); }
}
const ALL_THEME_CLASSES = THEMES.filter(t => t.id !== 'default').map(t => t.id + '-theme');
function getCurrentTheme() {
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].id !== 'default' && document.body.classList.contains(THEMES[i].id + '-theme')) return THEMES[i].id;
  }
  return 'default';
}
function setTheme(theme) {
  ALL_THEME_CLASSES.forEach(c => document.body.classList.remove(c));
  if (theme !== 'default') document.body.classList.add(theme + '-theme');
  try { localStorage.setItem('octile-theme', theme); } catch(e) {}
}
var _themeScrollIdx = 0;
function _themeVisibleCount() {
  var scroll = document.getElementById('theme-scroll');
  if (!scroll) return 3;
  return Math.max(1, Math.floor(scroll.clientWidth / 84));
}
function _updateThemeScroll() {
  var grid = document.getElementById('theme-grid');
  var leftBtn = document.getElementById('theme-left');
  var rightBtn = document.getElementById('theme-right');
  if (!grid) return;
  var vis = _themeVisibleCount();
  var maxIdx = Math.max(0, THEMES.length - vis);
  _themeScrollIdx = Math.max(0, Math.min(_themeScrollIdx, maxIdx));
  grid.style.transform = 'translateX(' + (-_themeScrollIdx * 84) + 'px)';
  if (leftBtn) leftBtn.disabled = _themeScrollIdx <= 0;
  if (rightBtn) rightBtn.disabled = _themeScrollIdx >= maxIdx;
}
function renderThemeGrid() {
  var grid = document.getElementById('theme-grid');
  if (!grid) return;
  var cur = getCurrentTheme();
  var html = '';
  THEMES.forEach(th => {
    var unlocked = isThemeUnlocked(th.id);
    var active = th.id === cur;
    var cls = 'theme-tile' + (active ? ' active' : '') + (!unlocked ? ' locked' : '');
    var swatch = THEME_SWATCHES[th.id] || THEME_SWATCHES['default'];
    html += '<div class="' + cls + '" data-theme="' + th.id + '">';
    if (active) html += '<span class="theme-check">\u2714</span>';
    html += '<div class="theme-swatch">';
    for (var s = 0; s < 9; s++) html += '<span style="background:' + swatch[s] + '"></span>';
    html += '</div>';
    html += '<div class="theme-name">' + t(th.key) + '</div>';
    if (!unlocked) html += '<div class="theme-lock">' + t('theme_locked').replace('{cost}', th.cost) + '</div>';
    html += '</div>';
  });
  grid.innerHTML = html;
  // Scroll to active theme on first render
  var activeIdx = THEMES.findIndex(th => th.id === cur);
  if (activeIdx >= 0) {
    var vis = _themeVisibleCount();
    _themeScrollIdx = Math.max(0, activeIdx - Math.floor(vis / 2));
  }
  _updateThemeScroll();
  grid.querySelectorAll('.theme-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      var id = tile.dataset.theme;
      if (!isThemeUnlocked(id)) {
        var th = THEMES.find(t => t.id === id);
        document.getElementById('settings-modal').classList.remove('show');
        showDiamondPurchase(t(th.key), th.cost, () => {
          unlockTheme(id);
          setTheme(id);
          document.getElementById('settings-modal').classList.add('show');
          renderThemeGrid();
        });
        return;
      }
      setTheme(id);
      renderThemeGrid();
    });
  });
}
document.getElementById('theme-left').addEventListener('click', () => { _themeScrollIdx--; _updateThemeScroll(); });
document.getElementById('theme-right').addEventListener('click', () => { _themeScrollIdx++; _updateThemeScroll(); });
function updateSettingsLabels() {
  document.getElementById('settings-title').textContent = t('menu_title');
  document.getElementById('settings-lang-label').textContent = t('menu_lang');
  var langSelect = document.getElementById('settings-lang-select');
  langSelect.value = _langPref;
  var langKeys = { system: 'lang_system', en: 'lang_en', zh: 'lang_zh' };
  for (var li = 0; li < langSelect.options.length; li++) {
    var lk = langKeys[langSelect.options[li].value];
    if (lk) langSelect.options[li].textContent = t(lk);
  }
  document.getElementById('settings-theme-label').textContent = t('menu_theme');
  renderThemeGrid();
}
document.getElementById('sound-btn').addEventListener('click', toggleSound);
_updateSoundBtn();
document.getElementById('settings-btn').addEventListener('click', () => {
  updateSettingsLabels();
  if (_isDebugEnv()) _updateDebugUI();
  document.getElementById('settings-modal').classList.add('show');
});
document.getElementById('settings-close').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('show'));
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
document.getElementById('settings-lang-select').addEventListener('change', (e) => {
  setLang(e.target.value);
  updateSettingsLabels();
});
// Theme grid handles its own clicks via renderThemeGrid()
// --- Debug panel (local/dev only) --- (handlers below, vars declared near Turnstile)

function _isDebugEnv() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

function _updateDebugUI() {
  const offBtn = document.getElementById('debug-offline-btn');
  const hintBtn = document.getElementById('debug-hints-btn');
  const energyBtn = document.getElementById('debug-energy-btn');
  if (offBtn) offBtn.textContent = _debugForceOffline ? 'ON' : 'OFF';
  if (hintBtn) hintBtn.textContent = _debugUnlimitedHints ? 'ON' : 'OFF';
  if (energyBtn) energyBtn.textContent = _debugUnlimitedEnergy ? 'ON' : 'OFF';
}

if (_isDebugEnv()) {
  const dbg = document.getElementById('debug-section');
  if (dbg) dbg.style.display = '';

  document.getElementById('debug-offline-btn').addEventListener('click', () => {
    _debugForceOffline = !_debugForceOffline;
    if (_debugForceOffline) {
      _backendOnline = false;
      _levelTotals = {..._getOfflineTotals()};
    } else {
      refreshBackendStatus();
      fetchLevelTotals().then(() => updateWelcomeLevels());
    }
    updateWelcomeLevels();
    _saveDebugConfig();
    _updateDebugUI();
  });

  document.getElementById('debug-hints-btn').addEventListener('click', () => {
    _debugUnlimitedHints = !_debugUnlimitedHints;
    updateHintBtn();
    _saveDebugConfig();
    _updateDebugUI();
  });

  document.getElementById('debug-energy-btn').addEventListener('click', () => {
    _debugUnlimitedEnergy = !_debugUnlimitedEnergy;
    updateEnergyDisplay();
    _saveDebugConfig();
    _updateDebugUI();
  });
}

// Restore saved theme
try {
  const saved = localStorage.getItem('octile-theme');
  if (saved && saved !== 'default') setTheme(saved);
} catch(e) {}

// Control bar
document.getElementById('ctrl-random').addEventListener('click', loadRandomPuzzle);
document.getElementById('ctrl-restart').addEventListener('click', () => resetGame(currentPuzzleNumber));
document.getElementById('hint-btn').addEventListener('click', showHint);

// Level navigation
document.getElementById('level-prev').addEventListener('click', () => goLevelSlot(currentSlot - 1));
document.getElementById('level-next').addEventListener('click', () => {
  if (!currentLevel) return;
  const nextSlot = currentSlot + 1;
  const total = getEffectiveLevelTotal(currentLevel);
  const completed = getLevelProgress(currentLevel);
  if (nextSlot <= total && isBlockUnsolved() && nextSlot > completed + 1) {
    showDiamondPurchase(t('unlock_puzzle_name'), UNLOCK_PUZZLE_DIAMOND_COST, () => {
      setLevelProgress(currentLevel, nextSlot - 1);
      goLevelSlot(nextSlot);
    });
    return;
  }
  goLevelSlot(nextSlot);
});

// 3-tier navigation: modal back buttons + backdrop close
document.getElementById('chapter-back').addEventListener('click', () => document.getElementById('chapter-modal').classList.remove('show'));
document.getElementById('path-back').addEventListener('click', () => {
  document.getElementById('path-modal').classList.remove('show');
});
document.getElementById('chapter-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('chapter-modal')) document.getElementById('chapter-modal').classList.remove('show');
});
document.getElementById('path-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('path-modal')) document.getElementById('path-modal').classList.remove('show');
});

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
// Win step advancement: tap step 1 → step 2 → step 3
document.getElementById('win-step1').addEventListener('click', function() {
  if (_winStep === 1) {
    _showWinStep(2);
    playSound('achieve'); haptic([30, 20, 60]);
    // Float animations for rewards
    if (_winData.expEarned) spawnFloat('+' + _winData.expEarned + ' EXP', 'exp-float');
    setTimeout(function() { if (_winData.chapterBonus >= 0) spawnFloat('+' + (1 + (_winData.chapterBonus || 0)) + ' \uD83D\uDC8E', 'diamond-float'); }, 300);
  }
});
document.getElementById('win-step2').addEventListener('click', function() {
  if (_winStep === 2) { _showWinStep(3); playSound('select'); }
});
document.getElementById('win-prev-btn').addEventListener('click', () => {
  document.getElementById('win-overlay').classList.remove('show');
  goLevelSlot(currentSlot - 1);
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
document.getElementById('achieve-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.achieve-tab');
  if (!btn) return;
  _achieveTab = btn.dataset.tab;
  renderAchieveModal();
});

// Profile modal
document.getElementById('profile-btn').addEventListener('click', () => closeSettingsAndDo(showProfileModal));
document.getElementById('profile-close').addEventListener('click', () => document.getElementById('profile-modal').classList.remove('show'));
document.getElementById('profile-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
// Tasks modal
document.getElementById('tasks-close').addEventListener('click', () => document.getElementById('tasks-modal').classList.remove('show'));
document.getElementById('tasks-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
// Messages modal
document.getElementById('messages-close').addEventListener('click', () => document.getElementById('messages-modal').classList.remove('show'));
document.getElementById('messages-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
// Multiplier confirm modal
document.getElementById('multiplier-confirm-start').addEventListener('click', () => {
  var modal = document.getElementById('multiplier-confirm-modal');
  var value = modal._pendingValue || 2;
  modal.classList.remove('show');
  activateMultiplier(value);
});
document.getElementById('multiplier-confirm-skip').addEventListener('click', () => {
  var modal = document.getElementById('multiplier-confirm-modal');
  var value = modal._pendingValue || 2;
  modal.classList.remove('show');
  // Save to message center for later claiming
  addClaimableMultiplier(value);
});

// Auth modal
document.getElementById('auth-close').addEventListener('click', () => document.getElementById('auth-modal').classList.remove('show'));
document.getElementById('auth-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
});
document.getElementById('auth-agree-check').addEventListener('change', function() {
  document.getElementById('auth-google-btn').disabled = !this.checked;
  document.getElementById('auth-login-btn').disabled = !this.checked;
});
document.getElementById('auth-google-btn').addEventListener('click', loginWithGoogle);
document.getElementById('auth-login-btn').addEventListener('click', _authDoLogin);
document.getElementById('auth-register-btn').addEventListener('click', _authDoRegister);
document.getElementById('auth-verify-btn').addEventListener('click', _authDoVerify);
document.getElementById('auth-forgot-btn').addEventListener('click', _authDoForgot);
document.getElementById('auth-reset-btn').addEventListener('click', _authDoReset);
document.getElementById('auth-show-register').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = t('auth_create');
  _authShowForm('register');
});
document.getElementById('auth-show-login').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = t('auth_signin');
  _authShowForm('login');
});
document.getElementById('auth-show-forgot').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = t('auth_forgot');
  _authShowForm('forgot');
});
document.getElementById('auth-show-login2').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = t('auth_signin');
  _authShowForm('login');
});
// Enter key submits forms
document.getElementById('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') _authDoLogin(); });
document.getElementById('auth-reg-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') _authDoRegister(); });
document.getElementById('auth-otp').addEventListener('keydown', (e) => { if (e.key === 'Enter') _authDoVerify(); });
document.getElementById('auth-reset-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') _authDoReset(); });

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

// Android back button handler — returns true if handled
var _modalIds = ['diamond-purchase-modal', 'auth-modal', 'profile-modal', 'help-modal', 'story-modal', 'energy-modal', 'achieve-modal', 'scoreboard-modal', 'chapter-modal', 'path-modal', 'tasks-modal', 'messages-modal', 'multiplier-confirm-modal', 'settings-modal'];
function handleAndroidBack() {
  // 1. Close any open modal (highest priority first)
  for (var i = 0; i < _modalIds.length; i++) {
    var el = document.getElementById(_modalIds[i]);
    if (el && el.classList.contains('show')) {
      el.classList.remove('show');
      return true;
    }
  }
  // 2. Close win overlay
  var win = document.getElementById('win-overlay');
  if (win && win.classList.contains('show')) {
    win.classList.remove('show');
    return true;
  }
  // 3. If in gameplay, return to welcome
  var menuBtn = document.getElementById('menu-btn');
  if (menuBtn && menuBtn.style.display !== 'none') {
    returnToWelcome();
    return true;
  }
  // 4. Not handled — let Android exit
  return false;
}

// Escape key closes modals and win overlay
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('help-modal').classList.remove('show');
    document.getElementById('story-modal').classList.remove('show');
    document.getElementById('energy-modal').classList.remove('show');
    document.getElementById('achieve-modal').classList.remove('show');
    document.getElementById('scoreboard-modal').classList.remove('show');
    document.getElementById('chapter-modal').classList.remove('show');
    document.getElementById('path-modal').classList.remove('show');
    document.getElementById('diamond-purchase-modal').classList.remove('show');
    if (document.getElementById('win-overlay').classList.contains('show')) {
      document.getElementById('win-overlay').classList.remove('show');
    }
  }
});

// Init — show offline defaults first, then update after health check
showWelcomeState();
applyLanguage();
updateEnergyDisplay();
updateExpDisplay();
updateDiamondDisplay();
_checkAuthCallback();
_checkPendingAuth();
// Init new features
getDailyTasks(); // generate if new day
checkDailyTaskNotification();
updateMessageBadge();
checkMultiplierOnLoad();

// Daily check-in (show toast after splash dismisses)
const _pendingCheckin = doDailyCheckin();
if (_pendingCheckin) {
  const _showCheckinAfterSplash = () => {
    if (!splashDismissed) { setTimeout(_showCheckinAfterSplash, 1000); return; }
    setTimeout(() => showDailyCheckinToast(_pendingCheckin.reward, _pendingCheckin.combo), 800);
  };
  _showCheckinAfterSplash();
}
setInterval(updateEnergyDisplay, 60000);
// Wait for config, then fetch level totals and check backend health
_configReady.then(() => Promise.all([fetchLevelTotals(), refreshBackendStatus()])).then(() => {
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
