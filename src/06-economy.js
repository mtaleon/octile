// --- Energy System ---
var ENERGY_MAX = 5;
var ENERGY_RESTORE_COST = 50;
var ENERGY_RECOVERY_PERIOD = 10 * 60 * 60; // 10 hours full refill (1 per 2h)
var ENERGY_PER_SECOND = ENERGY_MAX / ENERGY_RECOVERY_PERIOD;

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

var _lastEnergyValue = -1;
function updateEnergyDisplay() {
  const state = getEnergyState();
  const pts = state.points;
  const plays = Math.floor(pts);
  const display = document.getElementById('energy-display');
  const valueEl = document.getElementById('energy-value');
  // Show as plays remaining; add +1 visual if first daily puzzle is free
  const stats = getDailyStats();
  const freePlay = stats.puzzles === 0 ? 1 : 0;
  var newVal = plays + freePlay;
  valueEl.textContent = newVal;
  display.classList.remove('low', 'empty');
  if (newVal <= 0) display.classList.add('empty');
  else if (newVal <= 2) display.classList.add('low');
  if (_lastEnergyValue >= 0 && newVal !== _lastEnergyValue && display.animate) {
    display.animate([
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.4)', offset: 0.25 },
      { transform: 'scale(0.85)', offset: 0.55 },
      { transform: 'scale(1.1)', offset: 0.8 },
      { transform: 'scale(1)', offset: 1 }
    ], { duration: 600, easing: 'ease-out' });
  }
  _lastEnergyValue = newVal;
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
var EXP_BASE = { easy: 100, medium: 250, hard: 750, hell: 2000 };
var PAR_TIMES = { easy: 60, medium: 90, hard: 120, hell: 180 };

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

var _lastExpValue = 0;
function updateExpDisplay() {
  const el = document.getElementById('exp-value');
  if (!el) return;
  var newVal = getExp();
  el.textContent = newVal.toLocaleString();
  if (newVal > _lastExpValue && _lastExpValue > 0 && el.animate) {
    el.animate([
      { transform: 'scale(1)', color: '#f1c40f' },
      { transform: 'scale(2)', color: '#fff', offset: 0.25 },
      { transform: 'scale(0.85)', color: '#ffe066', offset: 0.6 },
      { transform: 'scale(1.1)', color: '#f1c40f', offset: 0.8 },
      { transform: 'scale(1)', color: '#f1c40f' }
    ], { duration: 800, easing: 'ease-out' });
  }
  _lastExpValue = newVal;
}

function getDiamonds() {
  return parseInt(localStorage.getItem('octile_diamonds') || '0');
}

function addDiamonds(amount) {
  const total = getDiamonds() + amount;
  localStorage.setItem('octile_diamonds', total);
  updateDiamondDisplay();
  if (amount > 0) fxDiamondSparkle(document.getElementById('diamond-display'));
  return total;
}

var _diamondAnimFrame = 0;
function updateDiamondDisplay() {
  const el = document.getElementById('diamond-value');
  if (!el) return;
  var target = getDiamonds();
  var current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (current === target || !el.animate) { el.textContent = target.toLocaleString(); return; }
  if (_diamondAnimFrame) cancelAnimationFrame(_diamondAnimFrame);
  var start = performance.now(), dur = 800;
  var from = current, diff = target - from;
  function tick(now) {
    var t = Math.min((now - start) / dur, 1);
    t = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = Math.round(from + diff * t).toLocaleString();
    if (t < 1) _diamondAnimFrame = requestAnimationFrame(tick);
    else _diamondAnimFrame = 0;
  }
  _diamondAnimFrame = requestAnimationFrame(tick);
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
  const baseDiamonds = _cfg('checkin.baseDiamonds', 5);
  // Combo bonus: day1=5, day2=10, day3=15... capped at day7=35, then repeats
  const comboDay = Math.min(combo, _cfg('checkin.comboCap', 7));
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
  setTimeout(function() { fxAchieveBurst(toast); }, 500);
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

