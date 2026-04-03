# Octile Security Practices

## Frontend (Client-Side)

### XSS Prevention

- **Never** insert API response data into `innerHTML` without sanitization
- Use `escapeHtml()` for all user-visible text from API (names, messages)
- Use `_safePictureUrl()` for all image URLs — validates `https://` protocol via `new URL()`, rejects `data:`, `blob:`, `javascript:`, `file:`
- Use `data-*` attributes + `addEventListener` instead of inline `onclick` handlers
- The `sbError()` retry pattern uses `data-retry` + allowlist regex (`/^[a-zA-Z_]+\(\)$/`) to prevent function injection

### Prototype Pollution

- Config merging uses `_safeMerge()` which filters `__proto__`, `constructor`, `prototype` keys
- Never use `Object.assign()` with untrusted JSON directly

### localStorage Safety

- All `JSON.parse(localStorage.getItem(...))` calls wrapped in `try/catch` with safe defaults
- Corrupted localStorage cannot crash app initialization

### Auth Token Handling

- JWT stored in `localStorage` (same-origin only)
- Token cleaned from URL via `history.replaceState()` after OAuth callback
- `postMessage` targeted to specific origin (`OCTILE_SITE_URL`), not `*`

### Content Security (Future)

Recommended headers for deployment:
```
Content-Security-Policy: default-src 'self'; img-src https:; script-src 'self'; object-src 'none'; base-uri 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
```

---

## Worker (Cloudflare Proxy)

### CORS

- Origin whitelist: `app.octile.eu.cc`, `octileapp.gitlab.io`, `mtaleon.github.io`, `localhost`
- Falls back to `*` for non-browser contexts (Android WebView sends `null` origin)
- Never use `Access-Control-Allow-Credentials: true` with wildcard origin

### Turnstile

- Invisible CAPTCHA on score submission only
- Prevents bot score spam without user friction
- Token verified server-side via Cloudflare siteverify API

### Rate Limiting

- IP-based via Cloudflare KV
- Score submission rate: configurable per-IP window

### HMAC Signing

- Worker signs requests to backend with shared secret
- Backend only accepts Worker-signed requests for score submission

---

## Backend (FastAPI)

### Authentication

- JWT with configurable secret via `OCTILE_JWT_SECRET` env var
- Startup warning if default secret detected
- 30-day token expiry (was 365, reduced for security)
- `pbkdf2_sha256` password hashing via passlib

### Rate Limiting

- **OTP send**: 5 emails per 15 minutes per email address
- **OTP verify**: 5 failed attempts per 15 minutes per email (brute-force protection)
- Returns 429 when exceeded

### Score Integrity

- Duplicate detection: same (user, puzzle, time) within 60 seconds returns 409
- Anomaly detection: flags suspicious patterns (speed, volume)
- Server-authoritative reward calculation (EXP, diamonds computed server-side)
- Resolve time validated: 10-86400 seconds

### OAuth Security

- State parameter for CSRF protection on Google OAuth flow
- Exception details never leaked to client (generic error messages)
- `return_url` should be validated against allowed domains (TODO)

### SQL Injection

- SQLAlchemy ORM with parameterized queries throughout
- No raw SQL strings

### Email Enumeration

- Forgot-password returns generic "sent" response regardless of account existence

---

## Env Vars Checklist

| Variable | Purpose | Required |
|---|---|---|
| `OCTILE_JWT_SECRET` | JWT signing key (min 32 chars) | **Yes** |
| `OCTILE_GOOGLE_CLIENT_ID` | Google OAuth client ID | For OAuth |
| `OCTILE_GOOGLE_CLIENT_SECRET` | Google OAuth secret | For OAuth |
| `OCTILE_GOOGLE_REDIRECT_URI` | OAuth callback URL | For OAuth |
| `OCTILE_SITE_URL` | App URL for redirects | Yes |
| `OCTILE_WORKER_URL` | Worker proxy URL | Yes |
| `WORKER_HMAC_SECRET` | Request signing shared secret | Yes |
| `OCTILE_SMTP_*` | Email delivery config | For auth |

---

## Audit Log (Recommended Future Work)

- Log auth failures (login, OTP, OAuth)
- Log OTP attempts over threshold
- Log score submissions flagged as anomalous
- Log token refresh usage patterns
