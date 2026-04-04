# Migration: browser_uuid to cookie_uuid

## Overview

Replace client-side `browser_uuid` (localStorage, spoofable) with Worker-issued `cookie_uuid` (HttpOnly cookie, tamper-proof).

## What changed

### Worker (`workers/octile-proxy/index.js`)
- **Cookie generation**: On every request, Worker reads `octile_uid` cookie. If absent, generates a new UUID via `crypto.randomUUID()`.
- **Cookie setting**: Every response gets `Set-Cookie: octile_uid=<uuid>; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=315360000` (~10 years).
- **Backend forwarding**: Worker sends the cookie UUID to backend as `X-Player-UUID` header (trusted, not client-controlled).
- **Client echoing**: Worker adds `X-Cookie-UUID` response header so client JS can read the UUID for display purposes (scoreboard "you" marker).
- **CORS**: Added `Access-Control-Allow-Credentials: true` (when origin matches allowlist) and `Access-Control-Expose-Headers: X-Cookie-UUID`.

### Client (`src/02-config.js`, `src/04-infra.js`, `src/09-auth.js`)
- **`credentials: 'include'`**: All `fetch()` calls to `WORKER_URL` now include cookies (via the fetch wrapper in `02-config.js`).
- **UUID capture**: The fetch wrapper calls `_captureCookieUUID(response)` on every API response, which reads `X-Cookie-UUID` and stores it in `localStorage['octile_cookie_uuid']`.
- **`getBrowserUUID()`**: Now returns `octile_cookie_uuid` (if set) before falling back to legacy `octile_browser_uuid`. No other call sites changed.
- **Logout preservation**: `octile_cookie_uuid` added to `_AUTH_KEEP_KEYS` so it survives logout.

### Backend (`xsw/octile_api.py`)
- **`_get_player_uuid(request, fallback)`**: New helper that reads `X-Player-UUID` header, falls back to the body/param value.
- **Patched endpoints**: `submit_score`, `auth_register`, `auth_login`, `auth_magic_link`, `auth_google_redirect`, `auth_google_verify`, `sync_push`, `submit_feedback` all override `browser_uuid` with the header value when present.
- **No schema change**: `browser_uuid` column unchanged. The Worker-issued UUID flows through the same column.

## Backward compatibility

- **Old clients** (no `credentials: 'include'`): No cookie sent. Worker generates a new UUID per request but body still has `browser_uuid`. Backend uses body value as fallback.
- **New clients** (with cookie): Cookie sent automatically. Worker reads it, forwards as header. Backend prefers header over body.
- **Android WebView** (`file://`): Cookies may not work with `file://` origin. Client still sends `browser_uuid` in body. Worker still generates and sends `X-Player-UUID` header from cookie (if cookie works) or body falls back. Android keeps working either way.

## Migration timeline

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Worker sets cookie | **Done** | Cookie set on every response, forwarded as `X-Player-UUID` |
| 2. Client reads cookie UUID | **Done** | `_captureCookieUUID()` stores in localStorage for display |
| 3. Backend accepts header | **Done** | `_get_player_uuid()` prefers header over body |
| 4. Deprecate body browser_uuid | Future | Stop sending `browser_uuid` in request body |

## UUID lifecycle

```
First visit (no cookie):
  Client -> Worker: no Cookie header
  Worker: generates UUID, sets _requestCookieUUID
  Worker -> Backend: X-Player-UUID: <new-uuid>
  Worker -> Client: Set-Cookie: octile_uid=<new-uuid>, X-Cookie-UUID: <new-uuid>
  Client: stores octile_cookie_uuid in localStorage

Subsequent visits (cookie exists):
  Client -> Worker: Cookie: octile_uid=<uuid>
  Worker: reads cookie, sets _requestCookieUUID
  Worker -> Backend: X-Player-UUID: <uuid>
  Worker -> Client: X-Cookie-UUID: <uuid> (no new Set-Cookie needed, but included for simplicity)
```

## Testing checklist

- [ ] Web (incognito): First API call sets cookie, subsequent calls send it
- [ ] Web: `document.cookie` does NOT show `octile_uid` (HttpOnly)
- [ ] Web: `localStorage.octile_cookie_uuid` matches cookie value
- [ ] Web: Scoreboard "you" marker works with cookie UUID
- [ ] Android WebView: Verify cookie behavior with `file://` origin
- [ ] Auth: Register/login/Google OAuth all receive correct UUID
- [ ] Logout: `octile_cookie_uuid` preserved across logout
- [ ] Old client: Still works (body `browser_uuid` used as fallback)

## SameSite=None note

We use `SameSite=None` (not `Lax`) because the cookie needs to be sent cross-origin:
- Web app at `app.octile.eu.cc` makes fetch requests to `api.octile.eu.cc`
- These are same-site (both `.octile.eu.cc`) but cross-origin
- `credentials: 'include'` with `SameSite=Lax` would work for top-level navigations but not for `fetch()` requests
- `SameSite=None; Secure` allows the cookie on all cross-origin fetch requests

## Android fallback

If Android WebView doesn't send cookies from `file://` origin:
- Worker won't have a cookie to read
- Worker generates a new UUID each request (not ideal)
- But backend still gets `browser_uuid` from the request body
- `_get_player_uuid()` returns body value as fallback
- Net effect: Android works exactly as before, no regression
