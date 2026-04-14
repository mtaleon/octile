// --- World Scoreboard ---
let SB_API = WORKER_URL + '/scoreboard';
var SB_CACHE_MS = 180000;  // overridden by config.json scoreboardCacheMs
const sbCache = {};

async function sbFetch(params) {
  const key = JSON.stringify(params);
  const now = Date.now();
  if (sbCache[key] && now - sbCache[key].ts < SB_CACHE_MS) {
    console.log('[DEBUG] sbFetch CACHED', params);
    return sbCache[key].data;
  }
  const qs = new URLSearchParams(params).toString();
  const url = SB_API + '?' + qs;
  console.log('[DEBUG] sbFetch URL:', url);
  const res = await fetch(url, { credentials: 'include' });
  const text = await res.text();
  console.log('[DEBUG] sbFetch response', {
    status: res.status,
    ok: res.ok,
    body: text.slice(0, 300),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = JSON.parse(text);
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
      if (/^[a-zA-Z_]+\([^)]*\)$/.test(fn)) { (new Function(fn))(); }
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
  if (!_feature('scoreboard')) return; // no global scoreboard
  if (!isOnline()) return;
  // Hide league tab for anonymous users or when league feature is off
  document.getElementById('sb-tab-league').style.display = (_feature('league') && isAuthenticated()) ? '' : 'none';
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
    const res = await fetch(WORKER_URL + '/leaderboard?limit=' + LEADERBOARD_LIMIT, { signal: AbortSignal.timeout(8000), credentials: 'include' });
    console.log('[DEBUG] Global leaderboard response', { status: res.status, ok: res.ok });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const ranked = data.leaderboard || [];
    console.log('[DEBUG] Global leaderboard count:', ranked.length);
    console.log('[DEBUG] Global leaderboard top5:', ranked.slice(0, 5).map(s => ({
      uuid: s.browser_uuid || s.uuid,
      total_exp: s.total_exp,
      puzzles: s.puzzles,
      avg_time: s.avg_time,
      avg_time_type: typeof s.avg_time,
    })));
    if (!ranked.length) { panel.innerHTML = sbEmpty(t('sb_no_scores')); return; }
    const myUUID = getBrowserUUID();
    const myIdx = ranked.findIndex(p => p.browser_uuid === myUUID);
    console.log('[DEBUG] Am I in Global leaderboard?', { myUUID, myIdx, total: ranked.length });
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
  console.log('[DEBUG] Fetching stats - UUID:', myUUID);
  console.log('[DEBUG] localStorage octile_browser_uuid:', localStorage.getItem('octile_browser_uuid'));
  console.log('[DEBUG] localStorage octile_cookie_uuid:', localStorage.getItem('octile_cookie_uuid'));
  panel.innerHTML = sbLoading();
  try {
    const data = await sbFetch({ uuid: myUUID, best: 'true', limit: '200' });
    console.log('[DEBUG] Scoreboard raw keys:', Object.keys(data || {}));
    console.log('[DEBUG] Scoreboard raw data:', JSON.stringify(data).slice(0, 800));
    const scores = data.scores || [];
    console.log('[DEBUG] Fetched scores:', scores.length, 'items');
    if (scores.length > 0) console.log('[DEBUG] First score:', scores[0]);
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
  // disable all toast
  return;
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
  var _sDescKey = !_feature('win_meta') ? 'grade_s_desc_steam' : 'grade_s_desc';
  var gradeText = d.grade === 'S' ? t(_sDescKey) : d.grade === 'A' ? t('grade_a_desc') : t('grade_b_desc');
  var title = _isDailyChallenge ? t('daily_challenge_complete') : (d.isLevelComplete ? t('level_complete_title') : t('win_title'));
  var reason = d.grade + ' ' + gradeText;

  // No win_meta: skip reward modal entirely — go straight to step 3
  if (!_feature('win_meta')) {
    document.getElementById('win-overlay').classList.add('show');
    _showWinStep(3);
    playSound('select');
    return;
  }

  var rewards = [];
  if (_feature('win_meta')) {
    rewards.push({ icon: '\u2B50', value: d.expEarned, label: 'EXP' });
    var diamonds = 1 + (d.chapterBonus || 0);
    var _mult = typeof getActiveMultiplier === 'function' ? getActiveMultiplier() : 1;
    var _dcBonus = _isDailyChallenge ? 5 : 0;
    rewards.push({ icon: '\uD83D\uDC8E', value: diamonds * _mult + _dcBonus, label: _dcBonus > 0 ? '(+5 bonus)' : (_mult > 1 ? '(' + _mult + 'x)' : '') });
    if (d.newlyUnlocked && d.newlyUnlocked.length > 0) {
      rewards.push({ icon: '\uD83C\uDFC6', value: d.newlyUnlocked[0].diamonds || 0, label: t('ach_' + d.newlyUnlocked[0].id) });
    }
    if (_isDailyChallenge) reason += ' \u00B7 ' + t('daily_challenge_bonus');
    else if (d.isNewBest && d.prevBest > 0) reason += ' \u00B7 ' + t('win_new_best');
  } else {
    if (d.isNewBest && d.prevBest > 0) reason += ' \u00B7 ' + t('win_new_best');
  }

  // Daily challenge: only show return to menu (no leaderboard in pure mode)
  if (_isDailyChallenge) {
    showRewardModal({
      title: title,
      reason: reason,
      rewards: rewards,
      primary: { text: t('win_menu'), action: function() {
        returnToWelcome();
      }}
    });
  } else {
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

// --- Daily Challenge (Steam-exclusive) ---
async function startDailyChallenge(level) {
  var date = getDailyChallengeDate();

  // Guard: FullPack must be ready for DC
  if (!_fullPackReader || !_fullPackReader.hasOrdering) {
    showSimpleToast('', t('dc_pack_not_ready'));
    return;
  }

  if (_dcHasTryOrDone(date, level)) {
    var done = _dcGetDone(date, level);
    showSimpleToast('', done ? t('daily_challenge_already_done') : t('daily_challenge_already_tried'));
    return;
  }
  // Fetch DC puzzle from backend API (forceAPI=true ensures backend's authoritative puzzle_number)
  try {
    const slot = getDailyChallengeSlot(date, level);
    const data = await fetchLevelPuzzle(level, slot, true);

    // Write try key immediately (locks the attempt)
    var tryData = { date: date, slot: slot, puzzle: data.puzzle_number, startedAt: new Date().toISOString(), v: 2 };
    localStorage.setItem(_dcTryKey(date, level), JSON.stringify(tryData));

    // Set daily challenge flags
    _isDailyChallenge = true;
    _dailyChallengeLevel = level;
    _dailyDate = date;
    currentLevel = null; // not a level-mode game
    currentSlot = 0;
    currentPuzzleNumber = data.puzzle_number;
    if (data.cells) _puzzleCache[data.puzzle_number] = data.cells;

    // Re-render card (row now shows "Locked")
    renderDailyChallengeCard();
    // Start game (bypasses energy check via _isDailyChallenge flag)
    startGame(data.puzzle_number);
  } catch (e) {
    console.warn('[Octile] Daily challenge generation failed:', e.message);
    showSimpleToast('', t('daily_challenge_error'));
    return;
  }
}

var _dcLbPlayerElo = null; // cached player ELO for tab gating

async function _fetchPlayerEloForDcLb() {
  if (_dcLbPlayerElo !== null) return _dcLbPlayerElo;
  try {
    var uuid = getBrowserUUID();
    var res = await fetch(WORKER_URL + '/player/' + uuid + '/elo', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;
    var data = await res.json();
    _dcLbPlayerElo = data.elo || 0;
    return _dcLbPlayerElo;
  } catch (e) { return 0; }
}

async function showDailyChallengeLeaderboard(level, tab) {
  var date = getDailyChallengeDate();
  var modal = document.getElementById('dc-leaderboard-modal');
  if (!modal) return;
  document.getElementById('dc-lb-title').textContent = t('daily_challenge_leaderboard') + ' \u2014 ' + t('level_' + level);
  var body = document.getElementById('dc-lb-body');
  body.innerHTML = sbLoading();
  modal.classList.add('show');

  // Determine if Rating tab is available (ELO >= 2000, feature flag on)
  var playerElo = await _fetchPlayerEloForDcLb();
  var showRatingTab = _feature('rating_leaderboard') && playerElo >= 2000;
  var activeTab = (tab === 'rating' && showRatingTab) ? 'rating' : 'speed';

  // Render tab bar (only if player qualifies for rating tab)
  var tabBarEl = modal.querySelector('.dc-lb-tabs');
  if (tabBarEl) tabBarEl.remove();
  if (showRatingTab) {
    tabBarEl = document.createElement('div');
    tabBarEl.className = 'dc-lb-tabs';
    tabBarEl.innerHTML =
      '<button class="' + (activeTab === 'speed' ? 'active' : '') + '" data-tab="speed">' + t('daily_challenge_tab_speed') + '</button>' +
      '<button class="' + (activeTab === 'rating' ? 'active' : '') + '" data-tab="rating">' + t('daily_challenge_tab_rating') +
      ' <span class="dc-rating-help" title="' + escapeHtml(t('daily_challenge_rating_tooltip')) + '">?</span></button>';
    body.parentNode.insertBefore(tabBarEl, body);
    tabBarEl.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showDailyChallengeLeaderboard(level, btn.getAttribute('data-tab'));
      });
    });
  }

  if (activeTab === 'rating') {
    _renderDcRatingBoard(level, date, body);
  } else {
    _renderDcSpeedBoard(level, date, body);
  }
}

async function _renderDcSpeedBoard(level, date, body) {
  try {
    var res = await fetch(WORKER_URL + '/daily-challenge/scoreboard?level=' + level + '&date=' + date + '&limit=50', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var scores = data.scores || [];
    if (!scores.length) {
      var hasLocalRecord = !!localStorage.getItem(_dcDoneKey(date, level));
      var emptyMsg = hasLocalRecord ? t('dc_lb_updating') : t('sb_no_scores');
      body.innerHTML = sbEmpty(emptyMsg);
      return;
    }
    var myUUID = getBrowserUUID();
    var html = '<div class="sb-table">';
    for (var i = 0; i < scores.length; i++) {
      var s = scores[i];
      var isMe = s.browser_uuid === myUUID;
      html += '<div class="sb-row' + (isMe ? ' sb-me' : '') + '">';
      html += '<span class="sb-rank">' + (i + 1) + '</span>';
      html += sbAvatarHTML(s.browser_uuid, 28, sbPicture(s.browser_uuid, s.picture));
      html += '<span class="sb-name">' + escapeHtml(sbDisplayName(s.browser_uuid, s.display_name)) + '</span>';
      html += '<span class="sb-time">' + sbFormatTime(s.resolve_time) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = sbError('showDailyChallengeLeaderboard(\'' + level + '\')');
    _bindRetryButtons(body);
  }
}

async function _renderDcRatingBoard(level, date, body) {
  try {
    var res = await fetch(WORKER_URL + '/daily-challenge/scoreboard?level=' + level + '&date=' + date + '&limit=50&sort=elo', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var scores = data.scores || [];
    if (!scores.length) {
      var hasLocalRecord = !!localStorage.getItem(_dcDoneKey(date, level));
      var emptyMsg = hasLocalRecord ? t('dc_lb_updating') : t('sb_no_scores');
      body.innerHTML = sbEmpty(emptyMsg);
      return;
    }
    var myUUID = getBrowserUUID();
    var html = '<div class="dc-rating-desc">' + escapeHtml(t('daily_challenge_rating_desc')) + '</div>';
    html += '<div class="sb-table">';
    for (var i = 0; i < scores.length; i++) {
      var s = scores[i];
      var isMe = s.browser_uuid === myUUID;
      var delta = s.elo_delta || 0;
      var deltaClass = delta > 0 ? 'positive' : (delta < 0 ? 'negative' : 'zero');
      var deltaStr = delta > 0 ? '+' + Math.round(delta) : (delta < 0 ? '' + Math.round(delta) : '0');
      html += '<div class="sb-row' + (isMe ? ' sb-me' : '') + '">';
      html += '<span class="sb-rank">' + (i + 1) + '</span>';
      html += sbAvatarHTML(s.browser_uuid, 28, sbPicture(s.browser_uuid, s.picture));
      html += '<span class="sb-name">' + escapeHtml(sbDisplayName(s.browser_uuid, s.display_name)) + '</span>';
      html += '<span class="dc-elo-col">';
      html += '<span class="dc-elo-val">' + Math.round(s.elo || 0) + '</span>';
      html += '<span class="dc-elo-delta ' + deltaClass + '">(' + deltaStr + ')</span>';
      html += '</span>';
      html += '<span class="dc-grade">' + (s.grade || '') + '</span>';
      html += '<span class="sb-time">' + sbFormatTime(s.resolve_time) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = sbError('showDailyChallengeLeaderboard(\'' + level + '\',\'rating\')');
    _bindRetryButtons(body);
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

  // Deduct energy (daily challenge is free; skip entirely on Electron)
  var cost = 0, totalLeft = 99;
  if (_feature('energy')) {
    cost = _isDailyChallenge ? 0 : energyCost(elapsed);
    if (!_isDailyChallenge) deductEnergy(cost);
    if (!_isDailyChallenge) updateDailyStats(cost);
    var remainingPlays = Math.floor(getEnergyState().points);
    var dailyStatsNow = getDailyStats();
    var freePlayLeft = dailyStatsNow.puzzles === 0 ? 1 : 0;
    totalLeft = remainingPlays + freePlayLeft;
  }
  var winEnergyEl = document.getElementById('win-energy-cost');
  if (!_feature('energy')) {
    winEnergyEl.style.display = 'none';
  } else if (cost === 0) {
    winEnergyEl.textContent = t('energy_continue');
  } else if (totalLeft === 1) {
    winEnergyEl.textContent = t('energy_last_one');
  } else if (totalLeft <= 0) {
    winEnergyEl.innerHTML = t('energy_brand_quote');
  } else {
    winEnergyEl.textContent = t('win_energy_plays').replace('{left}', totalLeft);
  }

  // Award EXP + Diamonds
  const lvl = _isDailyChallenge ? _dailyChallengeLevel : (currentLevel || 'easy');
  const grade = calcSkillGrade(lvl, elapsed);
  const expEarned = _isDailyChallenge ? calcPuzzleExp(lvl, elapsed) * 2 : calcPuzzleExp(lvl, elapsed);
  addExp(expEarned);
  var _mult = getActiveMultiplier();
  var _dcDiamondBonus = _isDailyChallenge ? 5 : 0;
  addDiamonds(applyDiamondMultiplier(1) + _dcDiamondBonus);

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
  if (_feature('daily_tasks')) {
    updateDailyTaskCounters(grade, elapsed, currentLevel || 'easy');
    updateDailyTaskProgress();
    checkConsecutiveAGrades(grade);
  }

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
  var newlyUnlocked = [];
  if (_feature('win_meta')) {
    const dailyStats = getDailyStats();
    const achStats = {
      unique: totalUnique, total: totalSolved, elapsed: elapsed, streak: streakCount,
      noHint: _hintsThisPuzzle === 0 && isFirstClear, dailyCount: dailyStats.puzzles, justSolved: true,
      nightSolves: parseInt(localStorage.getItem('octile_night_solves') || '0'),
      morningSolves: parseInt(localStorage.getItem('octile_morning_solves') || '0'),
      months: JSON.parse(localStorage.getItem('octile_months') || '[]'),
      levelEasy: getLevelProgress('easy'), levelMedium: getLevelProgress('medium'),
      levelHard: getLevelProgress('hard'), levelHell: getLevelProgress('hell'),
      chaptersCompleted: getChaptersCompleted(),
      totalEasy: getEffectiveLevelTotal('easy'), totalMedium: getEffectiveLevelTotal('medium'),
      totalHard: getEffectiveLevelTotal('hard'), totalHell: getEffectiveLevelTotal('hell'),
    };
    newlyUnlocked = checkAchievements(achStats);
  }
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
    fact: (function() { var f = getWinFacts(); if (!_feature('hints') && Array.isArray(f)) f = f.filter(function(s) { return s.toLowerCase().indexOf('hint') < 0; }); return f.length > 0 ? f[Math.floor(Math.random() * f.length)] : ''; })(),
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
  var gradeDescKey = grade === 'S' ? (!_feature('win_meta') ? 'grade_s_desc_steam' : 'grade_s_desc') : grade === 'A' ? 'grade_a_desc' : 'grade_b_desc';
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

  // --- Step 2: Rewards (populated but hidden; empty on noMeta) ---
  var rewardsHtml = '';
  if (!_feature('win_meta')) {
    // No win_meta: skip step 2 entirely (no EXP/diamond/achievement display)
    document.getElementById('win-step2-title').textContent = '';
  } else {
    document.getElementById('win-step2-title').textContent = t('win_rewards_title');
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
      ? (!_feature('win_meta')
        ? (LEVEL_DOTS[currentLevel] || '') + ' ' + t('win_puzzle_position').replace('{n}', currentSlot).replace('{total}', levelTotal)
        : (LEVEL_DOTS[currentLevel] || '') + ' ' + currentSlot + ' / ' + levelTotal)
      : t('motiv_unique_count').replace('{n}', totalUnique).replace('{total}', getEffectivePuzzleCount());
    document.getElementById('win-step3-title').textContent = progressText;
    document.getElementById('win-next-btn').innerHTML = t('win_next');
  }
  if (!_feature('energy')) {
    document.getElementById('win-energy-cost').style.display = 'none';
  } else {
    document.getElementById('win-energy-cost').style.display = '';
    document.getElementById('win-energy-cost').textContent = '\u26A1 ' + t('win_energy_plays').replace('{left}', totalLeft);
  }
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

  // Daily challenge: write done key, update streak, show special reward modal
  if (_isDailyChallenge) {
    localStorage.setItem(_dcDoneKey(_dailyDate, _dailyChallengeLevel), JSON.stringify({
      time: elapsed, grade: grade, puzzle: currentPuzzleNumber, v: 2
    }));
    updateDailyChallengeStreak(_dailyDate);
    // First-time daily completion: hint about leaderboard
    if (!localStorage.getItem('octile_dc_hint_seen')) {
      localStorage.setItem('octile_dc_hint_seen', '1');
      setTimeout(function() { showSimpleToast('', t('daily_challenge_lb_hint'), 5000); }, 1500);
    }
    renderDailyChallengeCard();
    // Disable next/restart in post-win UI (one-shot DC)
    document.getElementById('win-next-btn').style.display = 'none';
    document.getElementById('win-prev-btn').style.display = 'none';
    document.getElementById('win-random-btn').style.display = 'none';
    document.getElementById('win-next-kbd').style.display = 'none';
  } else {
    // Normal puzzles: ensure Next button and kbd hint are visible
    document.getElementById('win-next-btn').style.display = '';
    document.getElementById('win-next-kbd').style.display = '';
  }

  if (!_isDemoMode && _feature('score_submission')) submitScore(currentPuzzleNumber, elapsed);
  if (!_isDemoMode && _feature('score_submission')) syncProgress();
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

async function _showDemoCTA() {
  showRewardModal({
    title: t('demo_cta_title'),
    reason: t('demo_cta_body'),
    hideRewards: true,
    primary: { text: t('demo_cta_buy'), action: function() {
      var url = 'https://store.steampowered.com/app/0/Octile/'; // TODO: replace with real Steam App ID
      if (window.steam && window.steam.openURL) window.steam.openURL(url);
      else window.open(url, '_blank');
    }},
    secondary: { text: t('demo_cta_keep'), action: function() { returnToWelcome(); } }
  });
}

async function nextPuzzle() {
  if (_feature('energy') && !hasEnoughEnergy()) {
    document.getElementById('win-overlay').classList.remove('show');
    clearConfetti();
    showEnergyModal(true);
    return;
  }
  // Demo mode: show CTA after 10 total solves or when hitting difficulty cap
  if (_isDemoMode) {
    var _demoSolves = parseInt(localStorage.getItem('octile_total_solved') || '0');
    if (_demoSolves >= 10) {
      document.getElementById('win-overlay').classList.remove('show');
      _showDemoCTA();
      return;
    }
  }
  document.getElementById('win-overlay').classList.remove('show');
  if (currentLevel) {
    const total = getEffectiveLevelTotal(currentLevel);
    if (total > 0 && currentSlot >= total) {
      // Level/demo cap reached — show respectful CTA in demo, otherwise return to welcome
      if (_isDemoMode) {
        showRewardModal({
          title: t('demo_cta_title'),
          reason: t('demo_cap_reached').replace('{level}', t('level_' + currentLevel)),
          hideRewards: true,
          primary: { text: t('demo_cta_buy'), action: function() {
            var url = 'https://store.steampowered.com/app/0/Octile/';
            if (window.steam && window.steam.openURL) window.steam.openURL(url);
            else window.open(url, '_blank');
          }},
          secondary: { text: t('demo_cta_keep'), action: function() { returnToWelcome(); } }
        });
        return;
      }
      returnToWelcome();
      return;
    }
    // Unified navigation: use goLevelSlot as single gate
    await goLevelSlot(currentSlot + 1);
  } else {
    console.warn('[Octile] nextPuzzle called without currentLevel');
  }
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
  _hintsThisPuzzle = 0;
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
  document.body.classList.remove('piece-selected');
  gameOver = false;
  if (typeof _kbCursorR !== 'undefined') { _kbCursorR = -1; _kbCursorC = -1; }
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
  _placementOrder = [];
  if (puzzleNumber === undefined) puzzleNumber = currentPuzzleNumber;
  await loadPuzzle(puzzleNumber);
  renderBoard();
  renderPool();
  updateHintBtn();
  _updateControlButtons();
}

