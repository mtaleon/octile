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
  'octile_browser_uuid', 'octile_cookie_uuid', 'octile_onboarded', 'octile_tutorial_seen', 'octile_tut_step',
  'octile_debug', 'octile_sound',
  'octile_energy', 'octile_energy_day',
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

function _storeAuthUser(data) {
  localStorage.setItem('octile_auth_user', JSON.stringify(data));
  if (data.refreshed_token) localStorage.setItem('octile_auth_token', data.refreshed_token);
  // Refresh profile modal if open
  try { if (document.getElementById('profile-modal').classList.contains('show')) showProfileModal(); } catch(e) {}
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

var _authErrorMap = {
  'Invalid verification code': 'auth_err_invalid_code',
  'Code expired, please register again': 'auth_err_code_expired',
  'Code expired, please request again': 'auth_err_code_expired',
  'Invalid email or password': 'auth_err_invalid_login',
  'Invalid email or password (min 6 chars)': 'auth_err_fields',
  'Email already registered': 'auth_err_already_registered',
  'Account not found': 'auth_err_not_found',
  'Already verified, please login': 'auth_err_already_verified',
  'Too many attempts, try again later': 'auth_err_rate_limit',
  'Failed to send email': 'auth_err_email_failed',
  'Email service unavailable': 'auth_err_email_failed',
};

function _authLocalizeError(detail) {
  if (!detail) return t('auth_err_network');
  var key = _authErrorMap[detail];
  return key ? t(key) : detail;
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

// Subtle sign-in hint — shown once per session at meaningful moments
var _signInHintShown = false;
function _maybeShowSignInHint() {
  if (_noMeta()) return; // no auth UI
  if (isAuthenticated() || _signInHintShown) return;
  _signInHintShown = true;
  var el = document.getElementById('encourage-toast');
  if (el) {
    el.textContent = t('hint_save_progress');
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 4500);
  }
}

function showAuthModal() {
  // Reset magic link state
  _magicAuthDone = false;
  _stopMagicPoll();
  // Show magic link form, hide sent confirmation
  document.getElementById('auth-form-magic').style.display = '';
  document.getElementById('auth-form-magic-sent').style.display = 'none';
  document.getElementById('auth-name').value = '';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-title').textContent = t('auth_signin');
  document.getElementById('auth-magic-desc').textContent = t('auth_magic_desc');
  document.getElementById('auth-magic-btn').textContent = t('auth_magic_send');
  document.getElementById('auth-magic-sent-msg').textContent = t('auth_magic_sent');
  document.getElementById('auth-magic-sent-hint').textContent = t('auth_magic_hint');
  document.getElementById('auth-magic-resend').textContent = t('auth_magic_resend');
  // Agree checkbox
  var agreeCheck = document.getElementById('auth-agree-check');
  agreeCheck.checked = false;
  document.getElementById('auth-magic-btn').disabled = true;
  document.getElementById('auth-agree-text').innerHTML = t('auth_agree')
    .replace('{terms}', t('terms_link'))
    .replace('{privacy}', t('privacy_link'));
  document.getElementById('auth-modal').classList.add('show');
}

var _magicLinkEmail = '';
var _magicRequestId = null;
var _magicPollTimer = null;
var _magicAuthDone = false;

function _stopMagicPoll() {
  if (_magicPollTimer) { clearInterval(_magicPollTimer); _magicPollTimer = null; }
  _magicRequestId = null;
}

function _startMagicPoll(requestId) {
  _stopMagicPoll();
  _magicRequestId = requestId;
  _magicPollTimer = setInterval(async function() {
    if (_magicAuthDone || !_magicRequestId) { _stopMagicPoll(); return; }
    try {
      var res = await fetch(WORKER_URL + '/auth/magic-link/status?id=' + encodeURIComponent(_magicRequestId), {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return;
      var data = await res.json();
      if (data.status === 'verified' && data.access_token) {
        _stopMagicPoll();
        if (_magicAuthDone) return;
        _authOnSuccess({ access_token: data.access_token, user: { display_name: data.display_name || '', email: data.email || '' } });
        // Fetch full user info
        fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + data.access_token } })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(u) { if (u) _storeAuthUser(u); })
          .catch(function() {});
      } else if (data.status === 'expired') {
        _stopMagicPoll();
      }
    } catch(e) { /* network error, retry next interval */ }
  }, 3000);
}

async function _sendMagicLink() {
  var email = document.getElementById('auth-email').value.trim();
  if (!email) return;
  _magicLinkEmail = email;
  _magicAuthDone = false;
  var btn = document.getElementById('auth-magic-btn');
  var errEl = document.getElementById('auth-error');
  btn.disabled = true;
  errEl.textContent = '';
  try {
    var res = await fetch(WORKER_URL + '/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, display_name: document.getElementById('auth-name').value.trim() || null, browser_uuid: getBrowserUUID(), lang: currentLang })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(_authLocalizeError(data.detail));
    // Show "check your email" state with countdown
    document.getElementById('auth-form-magic').style.display = 'none';
    document.getElementById('auth-form-magic-sent').style.display = '';
    document.getElementById('auth-magic-sent-email').textContent = email;
    document.getElementById('auth-magic-resend').style.display = 'none';
    _startMagicLinkCountdown();
    // Start polling if backend returned a request_id
    if (data.request_id) _startMagicPoll(data.request_id);
  } catch(e) {
    var msg = e.message || '';
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network')) {
      errEl.textContent = t('auth_magic_network_error');
    } else {
      errEl.textContent = msg || t('auth_magic_send_failed');
    }
    btn.disabled = false;
  }
}

var _magicCountdownTimer = null;
function _startMagicLinkCountdown() {
  if (_magicCountdownTimer) clearInterval(_magicCountdownTimer);
  var remaining = 120; // 2 minutes
  var cdEl = document.getElementById('auth-magic-countdown');
  var resendBtn = document.getElementById('auth-magic-resend');
  resendBtn.style.display = 'none';
  cdEl.textContent = t('auth_magic_countdown').replace('{sec}', remaining);
  _magicCountdownTimer = setInterval(function() {
    remaining--;
    if (remaining <= 0) {
      clearInterval(_magicCountdownTimer);
      _magicCountdownTimer = null;
      _stopMagicPoll();
      cdEl.textContent = t('auth_magic_expired_hint');
      resendBtn.style.display = '';
    } else {
      cdEl.textContent = t('auth_magic_countdown').replace('{sec}', remaining);
    }
  }, 1000);
}

function _authOnSuccess(data) {
  if (_magicAuthDone) return; // guard against double-fire (poll + postMessage race)
  _magicAuthDone = true;
  _stopMagicPoll();
  if (_magicCountdownTimer) { clearInterval(_magicCountdownTimer); _magicCountdownTimer = null; }
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
      body: JSON.stringify({ email: email, password: password, display_name: name || email.split('@')[0], browser_uuid: getBrowserUUID(), lang: currentLang }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
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
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
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
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
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
      body: JSON.stringify({ email: email, lang: currentLang }),
    });
    var data = await res.json();
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
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
    if (!res.ok) { _authSetError(_authLocalizeError(data.detail)); return; }
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
        if (data) _storeAuthUser(data);
      })
      .catch(function() {});
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
  }
}

// Listen for magic link postMessage from verify page
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'octile-auth' && e.data.token) {
    _authOnSuccess({ access_token: e.data.token, user: { display_name: e.data.name || '', email: '' } });
    fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + e.data.token } })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) { if (data) _storeAuthUser(data); })
      .catch(function() {});
    document.getElementById('auth-modal').classList.remove('show');
  }
});

// Handle Android deep link callback (native injects this)
window.onGoogleAuthSuccess = function(token, name) {
  _authOnSuccess({ access_token: token, user: { display_name: name, email: '' } });
  // Fetch full user info
  fetch(WORKER_URL + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data) _storeAuthUser(data);
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

var MSG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // overridden by config.json messageMaxAgeDays

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
    cls += ' msg-type-' + (m.type || 'system');
    html += '<div class="msg-item' + cls + '" data-id="' + m.id + '">';
    html += '<div class="msg-icon">' + m.icon + '</div>';
    html += '<div class="msg-body">';
    html += '<div class="msg-type-tag">' + t('msg_type_' + (m.type || 'system')) + '</div>';
    // Resolve translation keys at render time (not at save time)
    var _msgTitle = m.titleKey ? _msgTranslate(m.titleKey, m.data) : (m.title || '');
    var _msgBody = m.bodyKey ? _msgTranslate(m.bodyKey, m.data) : (m.body || '');
    html += '<div class="msg-title">' + escapeHtml(_msgTitle) + '</div>';
    if (_msgBody) html += '<div class="msg-desc">' + escapeHtml(_msgBody) + '</div>';
    html += '<div class="msg-time">' + formatRelativeTime(m.timestamp) + '</div>';
    // Actions
    html += '<div class="msg-actions">';
    // Type-specific actions (multiplier claims only when diamond_multiplier feature is on)
    if (m.type === 'multiplier_claim' && (!_noMeta() || _steamFeature('diamond_multiplier'))) {
      if (!m.data.claimed && m.data.expiresAt > Date.now()) {
        var expDays = Math.ceil((m.data.expiresAt - Date.now()) / 86400000);
        html += '<button class="msg-action-btn msg-claim-btn" data-id="' + m.id + '">' + t('tasks_claim') + ' \u00B7 ' + t('msg_expires_in').replace('{n}', expDays) + '</button>';
      } else if (m.data.claimed) {
        html += '<span class="task-claimed-tag">' + t('tasks_claimed') + '</span>';
      } else if (m.data.expiresAt <= Date.now()) {
        html += '<span class="msg-desc" style="color:#e74c3c">' + t('league_inactive') + '</span>';
      }
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
  if (_noMeta()) return;
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
  // Always available
  { id: 'finish_2_puzzles', target: 2, reward: 15, counter: 'solves' },
  { id: 'finish_3_puzzles', target: 3, reward: 20, counter: 'solves' },
  { id: 'finish_5_puzzles', target: 5, reward: 35, counter: 'solves' },
  { id: 'get_1_a_grade',    target: 1, reward: 15, counter: 'aGrades' },
  { id: 'get_2_a_grades',   target: 2, reward: 30, counter: 'aGrades' },
  { id: 'get_3_a_grades',   target: 3, reward: 50, counter: 'aGrades' },
  { id: 'play_5_min',       target: 5, reward: 10, counter: 'playMinutes' },
  { id: 'play_10_min',      target: 10, reward: 20, counter: 'playMinutes' },
  { id: 'solve_under_par',  target: 1, reward: 25, counter: 'underPar' },
  { id: 'solve_2_under_par',target: 2, reward: 40, counter: 'underPar' },
  { id: 'solve_no_hints',   target: 1, reward: 25, counter: 'noHints' },
  { id: 'get_1_s_grade',    target: 1, reward: 40, counter: 'sGrades' },
  { id: 'streak_3_puzzles', target: 3, reward: 35, counter: 'sessionStreak' },
  // Requires medium unlocked
  { id: 'try_medium',       target: 1, reward: 15, counter: 'mediumSolves', req: 'medium' },
  // Requires hard unlocked
  { id: 'try_hard',         target: 1, reward: 20, counter: 'hardSolves', req: 'hard' },
  // Requires hell unlocked
  { id: 'try_nightmare',    target: 1, reward: 30, counter: 'hellSolves', req: 'hell' },
];
var DAILY_TASK_BONUS = 50; // overridden by config.json dailyTaskBonus
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
  if (_noMeta() && !_steamFeature('daily_tasks')) return;
  var c = getDailyTaskCounters();
  c.solves = (c.solves || 0) + 1;
  if (grade === 'S' || grade === 'A') c.aGrades = (c.aGrades || 0) + 1;
  if (grade === 'S') c.sGrades = (c.sGrades || 0) + 1;
  var par = (PAR_TIMES || {})[level] || 90;
  if (elapsed <= par) c.underPar = (c.underPar || 0) + 1;
  if (_hintsThisPuzzle === 0) c.noHints = (c.noHints || 0) + 1;
  if (level === 'medium') c.mediumSolves = (c.mediumSolves || 0) + 1;
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
  // Filter pool by unlocked levels
  var unlocked = { easy: true };
  if (typeof getLevelProgress === 'function' && typeof getEffectiveLevelTotal === 'function') {
    if (getLevelProgress('easy') >= getEffectiveLevelTotal('easy')) unlocked.medium = true;
    if (unlocked.medium && getLevelProgress('medium') >= getEffectiveLevelTotal('medium')) unlocked.hard = true;
    if (unlocked.hard && getLevelProgress('hard') >= getEffectiveLevelTotal('hard')) unlocked.hell = true;
  }
  // Also unlock based on any progress (player may have played via random)
  if (getLevelProgress('medium') > 0) unlocked.medium = true;
  if (getLevelProgress('hard') > 0) unlocked.hard = true;
  if (getLevelProgress('hell') > 0) unlocked.hell = true;
  var pool = DAILY_TASK_POOL.filter(function(t) {
    return !t.req || unlocked[t.req];
  });
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
  var bonusAwarded = false;
  if (allClaimed && !data.bonusClaimed) {
    data.bonusClaimed = true;
    addDiamonds(DAILY_TASK_BONUS);
    localStorage.setItem('octile_daily_tasks', JSON.stringify(data));
    addMessage('daily_tasks', '\u2705', 'tasks_bonus_claimed', '', { diamonds: DAILY_TASK_BONUS });
    bonusAwarded = true;
  }
  // Show unified reward modal
  var rewards = [{ icon: '\uD83D\uDC8E', value: task.reward, label: t('task_' + task.id) }];
  if (bonusAwarded) rewards.push({ icon: '\uD83C\uDF89', value: DAILY_TASK_BONUS, label: t('reward_all_tasks_bonus') });
  showRewardModal({
    title: bonusAwarded ? t('reward_all_done') : t('reward_task_done'),
    reason: t('task_' + task.id),
    rewards: rewards,
    primary: { text: t('reward_continue'), action: function() {} },
    secondary: { text: t('reward_view_goals'), action: function() { showGoalsModal('tasks'); } }
  });
}

function checkDailyTaskNotification() {
  var dot = document.querySelector('.goals-dot');
  if (!dot) return;
  var hasClaimable = false;
  if (!_noMeta() || _steamFeature('daily_tasks')) {
    var data = getDailyTasks();
    hasClaimable = data.tasks.some(function(task) { return task.progress >= task.target && !task.claimed; });
  }
  // Also check unclaimed achievements
  if (!hasClaimable) {
    var unlocked = getUnlockedAchievements();
    var claimed = getClaimedAchievements();
    for (var achId in unlocked) {
      if (unlocked[achId] && !claimed[achId]) { hasClaimable = true; break; }
    }
  }
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
  // Tasks now render inside Goals modal via _renderTasksInGrid()
}

function showDailyTasksModal() {
  if (_noMeta() && !_steamFeature('daily_tasks')) return;
  showGoalsModal('tasks');
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
  if (_noMeta() && !_steamFeature('diamond_multiplier')) return;
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
  if (_noMeta() && !_steamFeature('diamond_multiplier')) return;
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
  setTimeout(function() { fxDiamondSparkle(document.getElementById('multiplier-display')); }, 400);
  addMessage('multiplier', '\uD83D\uDC8E', 'multiplier_active', 'multiplier_toast_on', { value: value });
  // Show unified reward modal
  showRewardModal({
    title: t(value === 3 ? 'multiplier_3x_title' : 'multiplier_2x_title'),
    reason: t(value === 3 ? 'multiplier_3x_desc' : 'multiplier_2x_desc'),
    rewards: [{ icon: '\uD83D\uDC8E', value: value, label: 'x ' + t('reward_multiplier_for').replace('{min}', Math.round(MULTIPLIER_DURATION_MS / 60000)) }],
    primary: { text: t('reward_start_playing'), action: function() {} }
  });
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
  if (_noMeta() && !_steamFeature('diamond_multiplier')) {
    var mEl = document.getElementById('multiplier-display');
    if (mEl) mEl.classList.remove('active');
    return;
  }
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
  var grades; try { grades = JSON.parse(localStorage.getItem('octile_grades') || '{}'); } catch(e) { grades = {}; }
  if (!grades.S) grades = { S: 0, A: 0, B: 0 };
  var streak = getStreak();
  var monthsRaw; try { monthsRaw = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { monthsRaw = []; }
  var months = []; for (var mi = 0; mi < 12; mi++) { if (monthsRaw[mi]) months.push(mi); }
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
    unlocked_themes: (function() { try { return JSON.parse(localStorage.getItem('octile_unlocked_themes') || '[]'); } catch(e) { return []; } })(),
    solved_set: (function() { try { return JSON.parse(localStorage.getItem('octile_solved') || '[]'); } catch(e) { return []; } })(),
    best_times: (function() { try { var all = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.startsWith('octile_best_')) { all[k.substring(12)] = parseFloat(localStorage.getItem(k)); } } return all; } catch(e) { return {}; } })(),
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
  var grades; try { grades = JSON.parse(localStorage.getItem('octile_grades') || '{}'); } catch(e) { grades = {}; }
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

  // Months: union (server sends clean indices [3,5], local may be sparse [null,null,null,true,...])
  if (p.months && p.months.length) {
    var localMonthsRaw; try { localMonthsRaw = JSON.parse(localStorage.getItem('octile_months') || '[]'); } catch(e) { localMonthsRaw = []; }
    // Convert local sparse array to index set
    for (var mi = 0; mi < 12; mi++) { if (localMonthsRaw[mi]) localMonthsRaw[mi] = true; }
    // Apply server months
    for (var si = 0; si < p.months.length; si++) { var idx = p.months[si]; if (idx >= 0 && idx < 12) localMonthsRaw[idx] = true; }
    localStorage.setItem('octile_months', JSON.stringify(localMonthsRaw));
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

  // Unlocked themes: union
  if (p.unlocked_themes && p.unlocked_themes.length) {
    try {
      var local = JSON.parse(localStorage.getItem('octile_unlocked_themes') || '[]');
      var merged = Array.from(new Set(local.concat(p.unlocked_themes)));
      localStorage.setItem('octile_unlocked_themes', JSON.stringify(merged));
    } catch(e) {}
  }

  // Solved set: union
  if (p.solved_set && p.solved_set.length) {
    try {
      var localSolved = JSON.parse(localStorage.getItem('octile_solved') || '[]');
      var mergedSolved = Array.from(new Set(localSolved.concat(p.solved_set)));
      localStorage.setItem('octile_solved', JSON.stringify(mergedSolved));
    } catch(e) {}
  }

  // Best times: per-puzzle MIN (keep faster)
  if (p.best_times) {
    try {
      for (var pid in p.best_times) {
        var key = 'octile_best_' + pid;
        var serverTime = p.best_times[pid];
        var localTime = parseFloat(localStorage.getItem(key) || '999999');
        if (serverTime < localTime) localStorage.setItem(key, serverTime);
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
        // Server score totals are authoritative — always reconcile
        if (typeof data.score_exp === 'number') localStorage.setItem('octile_exp', Math.max(data.score_exp, getExp()));
        if (typeof data.score_diamonds === 'number') localStorage.setItem('octile_diamonds', Math.max(data.score_diamonds, getDiamonds()));
        updateExpDisplay();
        updateDiamondDisplay();
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
        // Server score totals are authoritative — always reconcile
        if (typeof data.score_exp === 'number') localStorage.setItem('octile_exp', Math.max(data.score_exp, getExp()));
        if (typeof data.score_diamonds === 'number') localStorage.setItem('octile_diamonds', Math.max(data.score_diamonds, getDiamonds()));
        updateExpDisplay();
        updateDiamondDisplay();
      }
    }
    console.log('[Octile] Progress synced');
  } catch (e) {
    console.warn('[Octile] Sync failed:', e.message);
  }
}

