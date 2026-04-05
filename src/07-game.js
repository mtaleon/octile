// --- World Scoreboard ---
let SB_API = WORKER_URL + '/scoreboard';
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
  return '<div class="sb-error"><div class="sb-error-icon">⚠️</div><div>' + t('sb_error') + '</div><button class="sb-retry" data-retry="' + escapeHtml(retryFn) + '">' + t('sb_retry') + '</button></div>';
}
function _bindRetryButtons(container) {
  container.querySelectorAll('.sb-retry[data-retry]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var fn = btn.getAttribute('data-retry');
      if (/^[a-zA-Z_]+\(\)$/.test(fn)) { (new Function(fn))(); }
    });
  });
}
function sbEmpty(msg) {
  return '<div class="sb-empty"><div class="sb-empty-icon">🏆</div><div>' + msg + '</div></div>';
}

function _safePictureUrl(input) {
  if (!input || typeof input !== 'string') return '';
  try {
    var u = new URL(input);
    if (u.protocol !== 'https:') return '';
    return u.toString();
  } catch(e) { return ''; }
}

function sbAvatarHTML(uuid, size, picture) {
  var safePic = _safePictureUrl(picture);
  if (safePic) {
    return '<div class="sb-avatar" style="width:' + size + 'px;height:' + size + 'px"><img src="' + escapeHtml(safePic) + '" width="' + size + '" height="' + size + '" style="border-radius:' + Math.round(size * 0.22) + 'px;object-fit:cover" referrerpolicy="no-referrer"></div>';
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
  _maybeShowSignInHint();
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
    html += '<div class="sb-summary">' + t('sb_total_players').replace('{n}', totalPlayers) + ' · ' + t('sb_all_time') + '</div>';
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
    panel.innerHTML = sbError('renderGlobalTab()'); _bindRetryButtons(panel);
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
    panel.innerHTML = sbError('renderPuzzleTab()'); _bindRetryButtons(panel);
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
    var safePic = _safePictureUrl(myPic);
    html += '<div class="sb-avatar-lg">' + (safePic ? '<img src="' + escapeHtml(safePic) + '" width="80" height="80" style="border-radius:18px;object-fit:cover" referrerpolicy="no-referrer">' : generateAvatar(myUUID, 80)) + '</div>';
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
    panel.innerHTML = sbError('renderMyStatsTab()'); _bindRetryButtons(panel);
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
        showRewardModal({
          title: t('league_promoted_title'),
          reason: t('league_promoted_body').replace('{tier}', tierName),
          rewards: [],
          primary: { text: t('reward_continue'), action: function() {} }
        });
      } else {
        addMessage('league', '\uD83D\uDD3B', 'league_demoted_title', 'league_demoted_body', { tier: tierName });
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
  var safeTierColor = /^#[0-9a-fA-F]{3,6}$/.test(data.tier_color) ? data.tier_color : '#888';
  html += '<div class="league-tier-header" style="--tier-color:' + safeTierColor + '">';
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
function _showWinRewardModal() {
  if (!_winData) return;
  // Hide all win steps and overlay so reward modal (z-index 300) isn't blocked by win-overlay (z-index 2000)
  _showWinStep(0);
  document.getElementById('win-overlay').classList.remove('show');
  var d = _winData;
  var gradeText = d.grade === 'S' ? t('grade_s_desc') : d.grade === 'A' ? t('grade_a_desc') : t('grade_b_desc');
  var rewards = [];
  rewards.push({ icon: '\u2B50', value: d.expEarned, label: 'EXP' });
  var diamonds = 1 + (d.chapterBonus || 0);
  var _mult = typeof getActiveMultiplier === 'function' ? getActiveMultiplier() : 1;
  rewards.push({ icon: '\uD83D\uDC8E', value: diamonds * _mult, label: _mult > 1 ? '(' + _mult + 'x)' : '' });
  if (d.newlyUnlocked && d.newlyUnlocked.length > 0) {
    rewards.push({ icon: '\uD83C\uDFC6', value: d.newlyUnlocked[0].diamonds || 0, label: t('ach_' + d.newlyUnlocked[0].id) });
  }
  var title = d.isLevelComplete ? t('level_complete_title') : t('win_title');
  var reason = d.grade + ' ' + gradeText;
  if (d.isNewBest && d.prevBest > 0) reason += ' \u00B7 ' + t('win_new_best');

  showRewardModal({
    title: title,
    reason: reason,
    rewards: rewards,
    primary: { text: t('win_next'), action: function() {
      document.getElementById('win-overlay').classList.add('show');
      _showWinStep(3);
      playSound('select');
    }},
    secondary: { text: t('win_view_board'), action: function() {
      document.getElementById('win-overlay').classList.remove('show');
      clearConfetti();
      document.getElementById('win-back-btn').style.display = 'block';
    }}
  });
}

function _showWinStep(step) {
  _winStep = step;
  document.getElementById('win-step1').style.display = step === 1 ? '' : 'none';
  document.getElementById('win-step2').style.display = step === 2 ? '' : 'none';
  document.getElementById('win-step3').style.display = step === 3 ? '' : 'none';
  if (step === 2 || step === 1) {
    var card = document.getElementById('win-step' + step);
    if (card.animate) {
      card.style.animation = 'none';
      card.animate([
        { transform: 'scale(0.2) translateY(60px) rotate(-5deg)', opacity: 0 },
        { transform: 'scale(1.15) translateY(-15px) rotate(2deg)', opacity: 1, offset: 0.4 },
        { transform: 'scale(0.92) translateY(6px) rotate(-1deg)', offset: 0.6 },
        { transform: 'scale(1.05) translateY(-3px) rotate(0.5deg)', offset: 0.8 },
        { transform: 'scale(1) translateY(0) rotate(0)' }
      ], { duration: 800, easing: 'ease-out', fill: 'forwards' });
    } else {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = '';
    }
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
  var _grades; try { _grades = JSON.parse(localStorage.getItem(_gKey) || '{}'); } catch(e) { _grades = {}; }
  if (!_grades.S && !_grades.A && !_grades.B) _grades = { S: 0, A: 0, B: 0 };
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
      _maybeShowSignInHint(); // first chapter completed
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
  var monthsData; try { monthsData = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { monthsData = []; }
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

  // Onboarding tutorial hooks
  onTutorialWin(totalSolved, grade);

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
  document.getElementById('win-grade').innerHTML = '<span class="win-grade-letter grade-' + grade.toLowerCase() + '">' + grade + '</span><span class="win-grade-desc">' + t(gradeDescKey) + '</span>';
  document.getElementById('win-grade').style.color = gradeColors[grade] || '#3498db';
  if (grade === 'S') {
    setTimeout(function() {
      var gl = document.querySelector('.win-grade-letter');
      if (gl) { var r = gl.getBoundingClientRect(); fxGoldBurst(r.left + r.width / 2, r.top + r.height / 2); }
    }, 300);
  }

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
  if (!_fxCtx) return;
  var colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#ecf0f1', '#9b59b6', '#e67e22', '#ff69b4'];
  var w = window.innerWidth;
  var pts = [0.1, 0.3, 0.5, 0.7, 0.9];
  for (var s = 0; s < pts.length; s++) {
    (function(idx) {
      setTimeout(function() {
        _fxEmit({
          x: w * pts[idx], y: -20,
          count: 25, colors: colors,
          speed: 80, life: 5, size: 10, gravity: 60,
          angle: Math.PI / 2, spread: Math.PI * 0.8,
          type: idx % 3 === 0 ? 'sparkle' : idx % 2 === 0 ? 'rect' : 'circle'
        });
      }, idx * 150);
    })(s);
  }
}

async function nextPuzzle() {
  if (!hasEnoughEnergy()) {
    document.getElementById('win-overlay').classList.remove('show');
    clearConfetti();
    showEnergyModal(true);
    return;
  }
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
  _moveLog = [];
  if (puzzleNumber === undefined) puzzleNumber = currentPuzzleNumber;
  await loadPuzzle(puzzleNumber);
  renderBoard();
  renderPool();
  updateHintBtn();
}

