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

// Player tier for progressive disclosure (new / active / expert)
function getPlayerTier() {
  var totalSolved = parseInt(localStorage.getItem('octile_total_solved') || '0');
  var streak = getStreak().count || 0;
  if (totalSolved > TIER_EXPERT || streak >= TIER_EXPERT_STREAK) return 'expert';
  if (totalSolved >= TIER_ACTIVE) return 'active';
  return 'new';
}

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
  var grades; try { grades = JSON.parse(localStorage.getItem('octile_grades') || '{}'); } catch(e) { grades = {}; }
  if (!grades.S) grades = { S: 0, A: 0, B: 0 };
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
  var months; try { months = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { months = []; }
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
  _maybeShowSignInHint();
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
  var tier = getPlayerTier();

  // Use server grade distribution if available, else local
  var grades = stats.grades;
  var gradeTotal = stats.gradeTotal;
  if (serverStats && serverStats.grade_distribution) {
    grades = serverStats.grade_distribution;
    gradeTotal = (grades.S || 0) + (grades.A || 0) + (grades.B || 0);
  }

  var html = '<h2>' + t('profile_title') + '</h2>';

  // Auth row (signed-out: sign-in prompt; signed-in: Account & Data section at bottom)
  if (isAuthEnabled() && !authUser) {
    html += '<div class="profile-auth-row">';
    html += '<div class="profile-auth-info">' + t('auth_save_prompt_detail') + '</div>';
    html += '<button class="profile-signin-btn" onclick="document.getElementById(\'profile-modal\').classList.remove(\'show\');showAuthModal()">' + t('auth_signin') + '</button>';
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

  // --- New player: simplified view ---
  if (tier === 'new') {
    // Quick stats instead of radar
    html += '<div class="profile-new-summary">';
    html += '<div class="profile-new-stat">' + stats.totalSolves + ' ' + t('profile_new_solved') + '</div>';
    if (stats.streak > 0) html += '<div class="profile-new-stat">\uD83D\uDD25 ' + stats.streak + ' ' + t('profile_streak') + '</div>';
    html += '</div>';

    // CTA: continue playing
    html += '<div class="profile-new-cta">';
    html += '<button class="profile-cta-btn" onclick="document.getElementById(\'profile-modal\').classList.remove(\'show\');returnToWelcome()">\u25B6 ' + t('profile_continue') + '</button>';
    html += '</div>';

    // Minimal world progress (only worlds with progress)
    var hasAnyProgress = false;
    for (var ni = 0; ni < LEVELS.length; ni++) {
      if (stats.worldSolves[LEVELS[ni]] > 0) { hasAnyProgress = true; break; }
    }
    if (hasAnyProgress) {
      html += '<div class="profile-worlds">';
      html += '<div class="profile-worlds-title">' + t('profile_difficulty') + '</div>';
      for (var nj = 0; nj < LEVELS.length; nj++) {
        var nlv = LEVELS[nj];
        var ndone = stats.worldSolves[nlv] || 0;
        if (ndone === 0) continue;
        var ntotal = getEffectiveLevelTotal(nlv);
        var npct = ntotal > 0 ? (ndone / ntotal * 100) : 0;
        var ntheme = WORLD_THEMES[nlv];
        var ncolor = LEVEL_COLORS[nlv];
        html += '<div class="profile-world-row">';
        html += '<span class="profile-world-icon">' + ntheme.icon + '</span>';
        html += '<span class="profile-world-name">' + t('level_' + nlv) + '</span>';
        html += '<span class="profile-world-bar"><span class="profile-world-fill" style="width:' + npct.toFixed(1) + '%;background:' + ncolor + '"></span></span>';
        html += '<span class="profile-world-pct">' + npct.toFixed(1) + '%</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    // Footer: just diamonds
    html += '<div class="profile-footer">';
    html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDC8E ' + stats.diamonds.toLocaleString() + '</div><div class="profile-footer-label">' + t('profile_diamonds') + '</div></div>';
    html += '</div>';

    html += _renderAccountSection(authUser);
    document.getElementById('profile-body').innerHTML = html;
    return;
  }

  // --- Active & Expert: full view ---

  // Radar chart
  var radarTotal = stats.radar.speed + stats.radar.mastery + stats.radar.breadth + stats.radar.dedication + stats.radar.progress;
  if (radarTotal > 0) {
    html += '<div class="profile-radar">' + renderRadarSVG(stats.radar) + '</div>';
  } else {
    html += '<div class="profile-radar-empty">';
    html += '<div class="profile-radar-empty-icon">\uD83D\uDCCA</div>';
    html += t('profile_radar_empty');
    html += '</div>';
  }

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
  html += '<div class="profile-worlds-title">' + t('profile_difficulty') + '</div>';
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
    if (done === 0) {
      html += '<span class="profile-world-pct profile-world-empty">' + t('profile_world_not_tried') + '</span>';
    } else {
      html += '<span class="profile-world-pct">' + pct.toFixed(1) + '%</span>';
    }
    html += '</div>';
  }
  html += '</div>';

  // Footer stats
  html += '<div class="profile-footer">';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDD25 ' + stats.streak + '</div><div class="profile-footer-label">' + t('profile_streak') + '</div></div>';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83D\uDC8E ' + stats.diamonds.toLocaleString() + '</div><div class="profile-footer-label">' + t('profile_diamonds') + '</div></div>';
  html += '<div class="profile-footer-item"><div class="profile-footer-val">\uD83C\uDFC6 ' + stats.achieveCount + '/' + stats.achieveTotal + '</div><div class="profile-footer-label">' + t('profile_achievements') + '</div></div>';
  html += '</div>';

  // --- Expert: advanced stats (collapsed) ---
  if (tier === 'expert') {
    var sRate = gradeTotal > 0 ? Math.round((grades.S || 0) / gradeTotal * 100) : 0;
    var aRate = gradeTotal > 0 ? Math.round(((grades.S || 0) + (grades.A || 0)) / gradeTotal * 100) : 0;
    html += '<details class="profile-advanced">';
    html += '<summary>' + t('profile_advanced') + '</summary>';
    html += '<div class="profile-advanced-grid">';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + sRate + '%</div><div class="profile-adv-label">' + t('profile_s_rate') + '</div></div>';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + aRate + '%</div><div class="profile-adv-label">' + t('profile_a_rate') + '</div></div>';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + (stats.avgTime > 0 ? sbFormatTime(stats.avgTime) : '-') + '</div><div class="profile-adv-label">' + t('sb_stat_avg') + '</div></div>';
    html += '<div class="profile-adv-item"><div class="profile-adv-val">' + stats.totalSolves + '</div><div class="profile-adv-label">' + t('sb_stat_total') + '</div></div>';
    // Difficulty distribution
    var _totalDone = stats.totalProgress || 1;
    for (var ei = 0; ei < LEVELS.length; ei++) {
      var elv = LEVELS[ei];
      var eDone = stats.worldSolves[elv] || 0;
      var eDist = Math.round(eDone / _totalDone * 100);
      html += '<div class="profile-adv-item"><div class="profile-adv-val">' + eDist + '%</div><div class="profile-adv-label">' + t('level_' + elv) + '</div></div>';
    }
    html += '</div></details>';
  }

  html += _renderAccountSection(authUser);
  document.getElementById('profile-body').innerHTML = html;
}

function _renderAccountSection(authUser) {
  if (!isAuthEnabled() || !authUser) return '';
  var h = '<div class="profile-account-section">';
  h += '<div class="profile-account-heading">' + t('account_data') + '</div>';
  h += '<div class="profile-account-label">' + t('signed_in_as') + '</div>';
  h += '<div class="profile-account-email">' + authUser.email + '</div>';
  h += '<button class="profile-logout-btn" onclick="confirmLogout()">' + t('auth_signout') + '</button>';
  h += '<div class="profile-logout-helper">' + t('logout_helper') + '</div>';
  h += '<div class="profile-account-divider"></div>';
  h += '<div class="profile-danger-zone">' + t('danger_zone') + '</div>';
  h += '<a class="profile-delete-link" href="#" onclick="_checkOnlineThenStepA();return false">' + t('delete_account') + '</a>';
  h += '<div class="profile-delete-helper">' + t('delete_account_helper') + '</div>';
  h += '</div>';
  return h;
}

function confirmLogout() {
  var body = document.getElementById('profile-body');
  var h = '<div class="logout-confirm-page">';
  h += '<h2>' + t('logout_confirm_title') + '</h2>';
  h += '<div class="logout-confirm-body">' + t('logout_confirm_body') + '</div>';
  h += '<div class="delete-account-actions">';
  h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  h += '<button class="delete-danger-btn" onclick="authLogout();showProfileModal()">' + t('auth_signout') + '</button>';
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

function showDeleteAccountStepA() {
  var body = document.getElementById('profile-body');
  var h = '<div class="delete-account-page">';
  h += '<h2>' + t('delete_account') + '</h2>';
  h += '<ul class="delete-account-bullets">';
  h += '<li>' + t('delete_account_bullet_1') + '</li>';
  h += '<li>' + t('delete_account_bullet_2') + '</li>';
  h += '<li>' + t('delete_account_bullet_3') + '</li>';
  h += '</ul>';
  h += '<div class="delete-account-warning">' + t('delete_account_irreversible') + '</div>';
  h += '<div class="delete-account-hint">' + t('delete_account_hint_pre') + '<a href="#" onclick="confirmLogout();return false">' + t('delete_account_hint_link') + '</a>' + t('delete_account_hint_post') + '</div>';
  h += '<div class="delete-account-actions">';
  h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  h += '<button class="delete-danger-btn" onclick="_checkOnlineThenDelete(this)">' + t('delete_account_btn') + '</button>';
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

function showDeleteAccountStepB() {
  var body = document.getElementById('profile-body');
  var h = '<div class="delete-account-page">';
  h += '<h2>' + t('delete_account_confirm_title') + '</h2>';
  h += '<div class="delete-account-confirm-body">' + t('delete_account_confirm_body') + '</div>';
  h += '<div class="delete-account-confirm-prompt">' + t('delete_account_confirm_prompt') + '</div>';
  h += '<div class="delete-account-actions">';
  h += '<button class="delete-cancel-btn" id="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  h += '<button class="delete-danger-btn" id="delete-confirm-btn" onclick="executeDeleteAccount()">' + t('delete_account_confirm_btn') + '</button>';
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

function executeDeleteAccount() {
  var cancelBtn = document.getElementById('delete-cancel-btn');
  var confirmBtn = document.getElementById('delete-confirm-btn');
  if (cancelBtn) cancelBtn.disabled = true;
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '...'; }

  fetch(WORKER_URL + '/auth/account', {
    method: 'DELETE',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    credentials: 'include'
  })
  .then(function(r) {
    if (r.ok || r.status === 404) {
      // Success or already deleted — clean up locally
      authLogout();
      document.getElementById('profile-modal').classList.remove('show');
      returnToWelcome();
      var toast = document.getElementById('encourage-toast');
      if (toast) {
        toast.textContent = t('delete_account_success');
        toast.classList.add('show');
        setTimeout(function() { toast.classList.remove('show'); }, 3000);
      }
    } else if (r.status === 401) {
      _showDeleteError(t('delete_account_reauth'), false);
    } else {
      _showDeleteError(t('delete_account_error'), true);
    }
  })
  .catch(function() {
    _showDeleteError(t('delete_account_offline'), true);
  });
}

function _checkOnlineThenStepA() {
  fetch(WORKER_URL + '/auth/me', { method: 'GET', headers: getAuthHeaders(), credentials: 'include' })
    .then(function() { showDeleteAccountStepA(); })
    .catch(function() { _showDeleteError(t('delete_account_offline'), true); });
}

function _checkOnlineThenDelete(btn) {
  btn.disabled = true;
  btn.textContent = '...';
  fetch(WORKER_URL + '/auth/me', { method: 'GET', headers: getAuthHeaders(), credentials: 'include' })
    .then(function() { showDeleteAccountStepB(); })
    .catch(function() { _showDeleteError(t('delete_account_offline'), true); });
}

function _showDeleteError(msg, showRetry) {
  var body = document.getElementById('profile-body');
  var h = '<div class="delete-account-page">';
  h += '<h2>' + t('delete_account') + '</h2>';
  h += '<div class="delete-error-msg">' + msg + '</div>';
  h += '<div class="delete-account-actions">';
  if (showRetry) {
    h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
    h += '<button class="delete-danger-btn" onclick="executeDeleteAccount()">' + t('retry') + '</button>';
  } else {
    h += '<button class="delete-cancel-btn" onclick="showProfileModal()">' + t('cancel') + '</button>';
  }
  h += '</div>';
  h += '</div>';
  body.innerHTML = h;
}

