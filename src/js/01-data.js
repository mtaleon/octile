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

var _serverDataVersion = null; // fetched from /version endpoint

async function checkBackendHealth() {
  if (_debugForceOffline) return false;
  try {
    const res = await fetch(WORKER_URL + '/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    // Fetch data_version for score compatibility
    if (!_serverDataVersion) {
      try {
        const vr = await fetch(WORKER_URL + '/version', { signal: AbortSignal.timeout(3000) });
        if (vr.ok) { const vd = await vr.json(); _serverDataVersion = vd.data_version || null; }
      } catch(e) {}
    }
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
function _setBackendOnline(val) { _backendOnline = val; }

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

var DEMO_LEVEL_CAPS = { easy: 50, medium: 20, hard: 10, hell: 5 };

function getEffectiveLevelTotal(level) {
  const total = _levelTotals[level] || 0;
  if (!isOnline()) return Math.min(total, OFFLINE_LEVEL_MAX);
  if (_isDemoMode) return Math.min(total, DEMO_LEVEL_CAPS[level] || 50);
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

    // Current chapter info
    var chSize = getChapterSize(level);
    var currentChapter = Math.floor(completed / chSize);
    var chapterInProgress = completed - currentChapter * chSize;
    var chapterTotal = Math.min(chSize, total - currentChapter * chSize);
    if (completed >= total) currentChapter = chapters - 1;

    let statusText = '';
    if (!unlocked) {
      statusText = t('wp_unlock_req').replace('{level}', t('level_' + LEVELS[i - 1]));
    } else if (isComplete) {
      statusText = '\u2713 ' + t('wp_completed');
    } else {
      statusText = t('wp_chapter_progress')
        .replace('{ch}', currentChapter + 1)
        .replace('{total}', chapters)
        .replace('{done}', chapterInProgress)
        .replace('{size}', chapterTotal);
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
        '<div class="world-counts">' + statusText + '</div>' +
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
    // Add last played time if available
    var _lastPlayed = localStorage.getItem('octile_last_played');
    if (_lastPlayed) {
      var _ago = formatRelativeTime(parseInt(_lastPlayed));
      resumeBtn.innerHTML += '<span class="wp-resume-ago">' + _ago + '</span>';
    }
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
  _isDailyChallenge = false;
  _dailyChallengeLevel = null;
  _dailyDate = null;
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
const PIECE_CELL_PX = 28; // mobile default; overridden dynamically on desktop


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
var MAX_HINTS = 3;
var HINT_DIAMOND_COST = 100;
var UNLOCK_PUZZLE_DIAMOND_COST = 50;

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
let _moveLog = []; // [combined, combined, ...] — each placement recorded for anti-cheat
let _placementOrder = []; // piece IDs in placement order, for undo

// --- Daily Challenge (Steam-exclusive) ---
const OFFLINE_PUZZLE_SET = new Set(OFFLINE_PUZZLE_NUMS);

function getDailyChallengeDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyChallengeSlot(level, dateStr) {
  var key = dateStr + ':' + level;
  var h = 2166136261;
  for (var i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  var total = _levelTotals[level] || _getOfflineTotals()[level];
  return ((h >>> 0) % total) + 1;
}

