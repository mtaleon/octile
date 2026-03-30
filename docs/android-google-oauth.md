# Android Google OAuth Flow

## Overview

Octile supports Google Sign-In on Android using the **Credential Manager API** (modern, native bottom-sheet) instead of the legacy browser-based OAuth redirect flow.

---

## New Flow (Credential Manager + ID Token Verify)

```
1. User taps "Sign in with Google" in WebView
2. JS calls OctileBridge.startGoogleLogin()
3. Android shows native bottom-sheet account picker (Credential Manager)
4. User taps their Google account
5. Google returns ID token directly to the app (no browser)
6. Android POSTs ID token to Worker /auth/google/verify
7. Worker proxies to backend, backend verifies ID token, creates/finds user
8. Backend returns { access_token: JWT, display_name, email, picture }
9. Android calls webView.evaluateJavascript("onGoogleAuthSuccess(jwt, name)")
10. JS stores token, syncs progress
```

**Hops**: App → Native picker → Worker → Backend → App

**Benefits**: Never leaves the app, no redirects, no deep links, faster, more reliable

### Key Files

| File | Role |
|------|------|
| `android/.../MainActivity.java` | `OctileBridge.startGoogleLogin()`, `startGoogleSignIn()`, `handleGoogleSignInResult()` |
| `android/app/build.gradle` | Credential Manager + GoogleId dependencies |
| `workers/octile-proxy/index.js` | Proxies `/auth/google/verify` POST to backend |
| `xsw/octile_api.py` | `POST /auth/google/verify` — verifies ID token, returns JWT |
| `app.js` | `window.onGoogleAuthSuccess(token, name)` — stores JWT, syncs |

### Google Cloud Console Setup

1. **Web client ID** — used in `MainActivity.java` (`WEB_CLIENT_ID`) and backend (`OCTILE_GOOGLE_CLIENT_ID`) for ID token verification
2. **Android client ID** — registered with package name (`com.octile.app`) + SHA-1 signing fingerprint. Not referenced in code; Google matches it automatically via the app signature.

---

## Old Flow (External Browser + Redirect) — Deprecated

```
1. User taps "Sign in with Google" in WebView
2. JS calls OctileBridge.startGoogleLogin()
3. Android opens external Chrome browser:
   → https://octile.owen-ouyang.workers.dev/auth/google?source=android
4. Worker proxies to backend /auth/google
5. Backend redirects to Google consent screen
6. User picks Google account in Chrome
7. Google redirects back to Worker /auth/google/callback
8. Backend exchanges auth code for ID token, verifies, creates/finds user
9. Backend redirects to: octile://auth?token=JWT&name=...
10. Android catches deep link in onNewIntent()
11. Android calls webView.evaluateJavascript("onGoogleAuthSuccess(jwt, name)")
12. JS stores token, syncs progress
```

**Hops**: App → Chrome → Worker → Google → Worker → Backend → Deep link → App

**Pain points**: Leaves the app, two redirects, deep link can fail, user sees browser flash

### Deep Link Config (still in AndroidManifest for backward compat)

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="octile" android:host="auth" />
</intent-filter>
```

---

## Web Flow (unchanged)

The web/PWA flow still uses the redirect-based OAuth:

```
1. User clicks "Sign in with Google"
2. JS redirects to Worker /auth/google?source=web&return_url=...
3. Worker proxies to backend, backend redirects to Google consent
4. Google callback → backend verifies, creates JWT
5. Backend redirects to return_url?auth_token=JWT&auth_name=...
6. _checkAuthCallback() picks up token from URL, stores it, cleans URL
```

---

## API Endpoints

| Endpoint | Method | Used By | Description |
|----------|--------|---------|-------------|
| `/auth/google` | GET | Web | Initiates OAuth redirect flow |
| `/auth/google/callback` | GET | Web | Handles Google OAuth callback |
| `/auth/google/verify` | POST | Android | Verifies ID token, returns JWT |
| `/auth/me` | GET | Both | Returns user info (name, email, picture) |
