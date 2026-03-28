# Authentication System for Octile

Balance "frictionless entry" with "data security" for 90,000+ puzzles and a global leaderboard across Android/PWA.

---

## Existing Infrastructure (xsw backend)

Most auth building blocks already exist in the xsw codebase:

| Component | File | Status |
|-----------|------|--------|
| `EmailSender` (SMTP, attachments, TLS/SSL) | `email_sender.py` | Ready — just add Octile sender config |
| `User` model (id, display_name, email, avatar, is_active) | `db_models.py` | Ready |
| `UserOAuth` model (multi-provider linking) | `db_models.py` | Ready |
| JWT create/decode/verify (30-day expiry) | `user_auth.py` | Ready |
| `require_user_auth` / `optional_user_auth` FastAPI deps | `user_auth.py` | Ready |
| `find_or_create_user` (account merging across providers) | `user_auth.py` | Ready |
| `verify_google_user` (Google ID token verification) | `user_auth.py` | Ready |
| Facebook, Apple, WeChat verification | `user_auth.py` | Ready |
| `GOOGLE_CLIENT_ID` env var config | `user_auth.py` | Ready — needs Octile-specific client ID |

**What's new for Octile**: email OTP flow, Octile-specific auth endpoints, progress sync table, Android deep links, client auth UI.

---

## Current State: Guest Mode

- On first launch, generate UUID → `octile_browser_uuid` in localStorage
- All progress (EXP, diamonds, levels, achievements) saved locally
- Scores submitted to backend with anonymous UUID
- Android: `NativeStorage` bridge backs up localStorage to SharedPreferences

### Limitations

- Device loss = data loss (no cloud backup)
- No cross-device sync
- Scoreboard identity is device-bound

---

## Phase 1: Email OTP Authentication (~4-5 hours)

### Database: Octile User Table

New table in `octile_api.py` (separate from xsw `User` model — Octile has its own DB):

```python
class OctileUser(OctileBase):
    __tablename__ = "octile_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    browser_uuid = Column(String, nullable=True, index=True)  # link to guest data
    is_verified = Column(Boolean, default=False)
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, nullable=True)
```

### Backend Endpoints

```
POST /octile/auth/register
  Body: { email, password, display_name, browser_uuid }
  → Create pending user, send 6-digit OTP via email
  → Response: { status: "pending", message: "Check your email" }

POST /octile/auth/verify
  Body: { email, otp_code }
  → Activate account, return JWT
  → Response: { access_token, user: { id, display_name, email } }

POST /octile/auth/login
  Body: { email, password }
  → Verify credentials, return JWT
  → Response: { access_token, user: { id, display_name, email } }

POST /octile/auth/forgot-password
  Body: { email }
  → Send OTP, allow password reset
  → Response: { status: "sent" }

POST /octile/auth/reset-password
  Body: { email, otp_code, new_password }
  → Verify OTP, update password
  → Response: { status: "ok" }
```

### Email OTP Implementation

Reuse existing `EmailSender` with Octile-specific SMTP config:

```python
from email_sender import EmailSender

octile_email = EmailSender(
    smtp_host=os.getenv("OCTILE_SMTP_HOST", os.getenv("SMTP_HOST", "")),
    smtp_port=int(os.getenv("OCTILE_SMTP_PORT", "587")),
    smtp_user=os.getenv("OCTILE_SMTP_USER", ""),
    smtp_password=os.getenv("OCTILE_SMTP_PASSWORD", ""),
    from_email=os.getenv("OCTILE_FROM_EMAIL", "noreply@octile.app"),
    from_name="Octile",
)
```

OTP generation:

```python
import secrets
otp = f"{secrets.randbelow(1000000):06d}"  # 6-digit zero-padded
expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
```

### Security

- Password hashing: `bcrypt` (via `passlib`)
- OTP: 6-digit, expires in 10 minutes
- Rate limit: max 5 OTP requests per email per 15 minutes
- JWT: 30-day expiry (reuse `user_auth.py` constants)
- HTTPS only (already enforced)

### Worker Proxy

Add `/auth/*` routes to `workers/octile-proxy/index.js`:

```javascript
if (url.pathname.startsWith("/auth/")) {
    // Pass through to backend
}
```

### Implementation Checklist

- [ ] `OctileUser` model + migration in `octile_api.py`
- [ ] `POST /octile/auth/register` endpoint
- [ ] `POST /octile/auth/verify` endpoint
- [ ] `POST /octile/auth/login` endpoint
- [ ] `POST /octile/auth/forgot-password` endpoint
- [ ] `POST /octile/auth/reset-password` endpoint
- [ ] Email OTP sender (reuse `EmailSender`, add Octile SMTP env vars)
- [ ] Worker: proxy `/auth/*` routes
- [ ] Tests for all auth endpoints

---

## Phase 2: Google OAuth (~3-4 hours)

### Why Separate from Email

Low friction — one tap to sign in. Most Octile users are on Android with Google accounts.

### Server-Side Flow

`verify_google_user()` already exists in `user_auth.py`. Need two new endpoints:

```
GET /octile/auth/google
  → Generate state token, redirect to Google OAuth consent screen
  → Google redirects back to callback URL

GET /octile/auth/google/callback?code=XXX&state=YYY
  → Exchange code for id_token via Google API
  → Call verify_google_user(id_token) → get email, name, avatar
  → Find or create OctileUser (match by email, or create new)
  → Generate JWT
  → Redirect to:
    - Android: octile://auth?token=JWT&name=NAME
    - PWA: /auth/success?token=JWT (web page stores token)
```

### Android: Custom Tabs + Deep Link

Google blocks OAuth in WebViews. Use Custom Tabs (opens Chrome) with deep link redirect back.

#### `MainActivity.java` additions:

```java
// JS bridge for Google login
public class OctileBridge {
    @JavascriptInterface
    public void startGoogleLogin() {
        String authUrl = "https://octile.owen-ouyang.workers.dev/auth/google";
        CustomTabsIntent intent = new CustomTabsIntent.Builder().build();
        intent.launchUrl(mContext, Uri.parse(authUrl));
    }
}

// Handle deep link redirect
@Override
protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    Uri uri = intent.getData();
    if (uri != null && "octile".equals(uri.getScheme()) && "auth".equals(uri.getHost())) {
        String token = uri.getQueryParameter("token");
        String name = uri.getQueryParameter("name");
        webView.post(() -> webView.evaluateJavascript(
            "if(window.onAuthSuccess)window.onAuthSuccess('" + token + "','" + name + "')", null
        ));
    }
}
```

#### `AndroidManifest.xml`:

```xml
<activity android:name=".MainActivity" android:launchMode="singleTask">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="octile" android:host="auth" />
    </intent-filter>
</activity>
```

### PWA: Google Identity Services

Standard web flow — no WebView workaround needed:

```javascript
function loginWithGoogle() {
    if (window.OctileBridge) {
        // Android WebView — use Custom Tabs
        OctileBridge.startGoogleLogin();
    } else {
        // Browser/PWA — redirect
        window.location.href = WORKER_URL + '/auth/google';
    }
}
```

### Implementation Checklist

- [ ] `GET /octile/auth/google` — redirect to Google consent
- [ ] `GET /octile/auth/google/callback` — exchange code, create user, redirect
- [ ] Google Cloud Console: create OAuth client ID for Octile
- [ ] Android: `OctileBridge` class with `startGoogleLogin()`
- [ ] Android: `onNewIntent` deep link handler
- [ ] Android: `AndroidManifest.xml` intent filter
- [ ] Android: add `androidx.browser:browser` dependency for Custom Tabs
- [ ] Worker: proxy `/auth/google` and `/auth/google/callback`

---

## Phase 3: Client Auth UI (~2-3 hours)

### Auth Modal

New modal accessible from Profile card ("Sign In" button when not authenticated):

```
+------------------------------------------+
|  Sign In to Save Progress                |
|                                          |
|  [G] Sign in with Google                 |
|                                          |
|  ─────── or ───────                      |
|                                          |
|  Email: [________________]               |
|  Password: [________________]            |
|                                          |
|  [Sign In]  [Create Account]             |
|                                          |
|  Forgot password?                        |
+------------------------------------------+
```

### Auth State Management (client)

```javascript
// localStorage keys
octile_auth_token    // JWT token
octile_auth_user     // { id, display_name, email } JSON

function isAuthenticated() {
    return !!localStorage.getItem('octile_auth_token');
}

function getAuthHeaders() {
    var token = localStorage.getItem('octile_auth_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Called after successful login (email or Google)
window.onAuthSuccess = function(token, name) {
    localStorage.setItem('octile_auth_token', token);
    localStorage.setItem('octile_auth_user', JSON.stringify({ display_name: name }));
    syncProgressToServer();
    // Refresh profile card to show authenticated state
};
```

### Profile Card Integration

When authenticated:
- Show real display name instead of generated cute name
- Show "Signed in as email@example.com"
- Show "Sign Out" button
- Show "Sync" button for manual progress sync

When not authenticated:
- Show "Sign In" button in profile header
- Show subtle prompt: "Sign in to save your progress across devices"

### Implementation Checklist

- [ ] Auth modal HTML/CSS (reuse modal pattern)
- [ ] Email login/register form with OTP verification step
- [ ] Google sign-in button (routes to appropriate flow per platform)
- [ ] Token storage and `isAuthenticated()` / `getAuthHeaders()` helpers
- [ ] `window.onAuthSuccess` callback
- [ ] Profile card: authenticated vs guest state
- [ ] Sign out function (clear token, revert to guest display)
- [ ] Translation keys (EN + ZH) for all auth UI

---

## Phase 4: Progress Sync (~3-4 hours)

### Endpoints

```
POST /octile/sync/push  (authenticated)
  Body: {
    browser_uuid: "...",
    level_easy: 2400,
    level_medium: 800,
    level_hard: 120,
    level_hell: 0,
    exp: 12500,
    diamonds: 1250,
    chapters_completed: 18,
    achievements: ["speed_30", "streak_7", ...],
    streak: { count: 7, lastDate: "2026-03-29" },
    months: [1, 2, 3, 11, 12],
    total_solved: 3320,
    total_time: 98400,
    grades: { S: 142, A: 380, B: 95 }
  }
  → Server stores all fields, keeps MAX for numeric values
  → Also links browser_uuid scores to this authenticated user

GET /octile/sync/pull  (authenticated)
  → Returns server-side progress
  → Client merges: MAX for each numeric field, union for sets
```

### Sync Table

```python
class OctileProgress(OctileBase):
    __tablename__ = "octile_progress"

    user_id = Column(Integer, primary_key=True)
    browser_uuid = Column(String, nullable=True, index=True)
    level_easy = Column(Integer, default=0)
    level_medium = Column(Integer, default=0)
    level_hard = Column(Integer, default=0)
    level_hell = Column(Integer, default=0)
    exp = Column(Integer, default=0)
    diamonds = Column(Integer, default=0)
    chapters_completed = Column(Integer, default=0)
    achievements = Column(Text, default="[]")  # JSON array
    streak_count = Column(Integer, default=0)
    streak_last_date = Column(String, nullable=True)
    months = Column(Text, default="[]")  # JSON array
    total_solved = Column(Integer, default=0)
    total_time = Column(Float, default=0)
    grades_s = Column(Integer, default=0)
    grades_a = Column(Integer, default=0)
    grades_b = Column(Integer, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

### Merge Strategy

- **Numeric fields** (exp, diamonds, levels, totals): `MAX(server, client)` — never lose progress
- **Sets** (achievements, months): union
- **Streak**: keep the one with higher count (if same date) or most recent date
- **Grades**: `MAX` per grade tier
- **browser_uuid**: link old guest scores to authenticated user on first sync

### When to Sync

- On login (push local → pull server → merge)
- On app resume (if authenticated, background pull)
- On puzzle completion (push updated progress)
- Manual "Sync" button in profile card

### Implementation Checklist

- [ ] `OctileProgress` model + migration
- [ ] `POST /octile/sync/push` endpoint with merge logic
- [ ] `GET /octile/sync/pull` endpoint
- [ ] `POST /octile/sync/link-uuid` — link guest UUID scores to authenticated user
- [ ] Client: `syncProgressToServer()` function
- [ ] Client: merge pulled data with localStorage (MAX strategy)
- [ ] Client: auto-sync on login and app resume
- [ ] Worker: proxy `/sync/*` routes
- [ ] Tests for push/pull/merge

---

## Summary

| Phase | What | Effort | Dependencies |
|-------|------|--------|-------------|
| **1. Email OTP** | Register, verify, login, forgot-password | 4-5 hr | Add SMTP env vars |
| **2. Google OAuth** | Server redirect flow + Android deep link | 3-4 hr | Google Cloud Console client ID |
| **3. Client UI** | Auth modal, token management, profile integration | 2-3 hr | Phase 1 or 2 |
| **4. Progress Sync** | Push/pull/merge endpoints, auto-sync | 3-4 hr | Phase 1 or 2 |
| **Total** | | **~2 days** | |

### Deploy Order

1. Backend: auth endpoints + sync endpoints + email config
2. Worker: proxy new routes
3. Client: auth UI + sync logic
4. Android: Custom Tabs + deep link (for Google OAuth)

### Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Separate OctileUser table | Yes | Octile has its own SQLite DB, not shared with xsw User table |
| Reuse EmailSender | Yes | Same SMTP infra, just different sender address |
| Reuse JWT logic | Yes | Same `user_auth.py` helpers, same 30-day expiry |
| No soft wall | Skip | Don't gate content behind login — offer it as a benefit ("save progress") |
| Merge strategy | MAX wins | Never lose progress, even if client/server diverge |
| Google OAuth via Custom Tabs | Yes | Only way that works in Android WebView |
