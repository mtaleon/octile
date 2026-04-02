# Update & OTA System

## Overview

Octile has **two separate update systems** that share a single `version.json` manifest:

1. **Update Banner** — tells native app users "go to Play Store to update" (runs in app.js inside WebView)
2. **OTA Update** — silently downloads new web assets in the background, applies on next launch (runs in MainActivity.java native code)

```
                      version.json
                           │
              ┌────────────┴────────────┐
              │                         │
        versionCode: 11          otaVersionCode: 23
        (Play Store version)     (web assets version)
              │                         │
              ▼                         ▼
       ┌──────────────┐        ┌──────────────────┐
       │ Update Banner │        │ OTA System       │
       │ (app.js)      │        │ (MainActivity)   │
       │               │        │                  │
       │ "Go to Play   │        │ Silent download  │
       │  Store"       │        │ → apply on       │
       │               │        │   next launch    │
       └──────────────┘        └──────────────────┘
              │                         │
       Requires: new APK         Requires: v1.10+ APK
       on Play Store             (has OTA code)
```

---

## version.json

Hosted at `https://mtaleon.github.io/octile/version.json`:

```json
{
  "versionCode": 11,
  "versionName": "1.8.1",
  "otaVersionCode": 23,
  "minApiVersion": 1,
  "playStoreUrl": "https://play.google.com/store/apps/details?id=com.octile.app",
  "releaseNotes": { "en": "...", "zh": "..." },
  "bundleUrl": "https://mtaleon.github.io/octile/ota/bundle-v23.zip",
  "bundleHash": "sha256:..."
}
```

| Field | Purpose | Read by |
|-------|---------|---------|
| `versionCode` | Play Store release version (integer) | Update banner (all clients) |
| `versionName` | Human-readable Play Store version | Display only |
| `otaVersionCode` | Latest web assets version (integer) | OTA system (v1.10+ only) |
| `minApiVersion` | Minimum backend `apiVersion` required for this OTA | OTA system |
| `playStoreUrl` | Play Store listing URL | Update banner button |
| `releaseNotes` | Shown in update banner (en/zh) | Update banner |
| `bundleUrl` | HTTPS URL to the OTA zip | OTA system |
| `bundleHash` | `sha256:<hex>` hash of the zip file | OTA system |

**Key rule:** `versionCode` must always match what's actually published on the Play Store. `otaVersionCode` can be ahead — it tracks the latest web assets pushed via OTA.

---

## System 1: Update Banner

**File:** `app.js:1206` `checkForUpdate()`

**Purpose:** Prompt native app users to update via Play Store when a newer APK is available.

**Only runs in native apps** — skips on web (`https://` protocol).

### Flow

```
App launches (3s delay)
    │
    ├── protocol === "https://" ?  → STOP (web user, always latest)
    │
    ▼ (file:// = native app)
    │
    fetch(SITE_URL + "version.json")
    │
    ▼
    storeVersion = data.playStoreVersionCode || data.versionCode
    │
    storeVersion <= APP_VERSION_CODE? → STOP (up to date)
    │
    ▼
    Already dismissed this version? → STOP
    │
    ▼
    Show banner: "Update available — {releaseNotes}"
    ├── [Update] → opens playStoreUrl
    └── [Later]  → dismiss, save to localStorage
```

### Backward compatibility

| Client | What it reads | value.json value | Result |
|--------|--------------|------------------|--------|
| v1.8.1 (versionCode 11) | `data.versionCode` | 11 | 11 ≤ 11 → no banner |
| v1.15+ (versionCode 23) | `data.playStoreVersionCode \|\| data.versionCode` | 11 | 11 ≤ 23 → no banner |

v1.8.1 doesn't know about `playStoreVersionCode` — it falls through to `versionCode`, which is set to the Play Store version (11). So no false banner.

### When you publish to Play Store

Bump `versionCode` to match the new Play Store release. Example: publish v1.15.0 → set `versionCode: 23`. Then v1.8.1 users see `23 > 11` → banner appears, pointing to the real Play Store update.

---

## System 2: OTA Update

**File:** `MainActivity.java:352` `checkForOtaUpdate()`

**Purpose:** Silently download new web assets (HTML/JS/CSS) without a Play Store release. The WebView loads from local files — either bundled APK assets or an OTA-downloaded set.

**Only exists in v1.10+ APKs.** v1.8.1 does NOT have this code.

### Architecture

```
GitHub Pages (mtaleon.github.io/octile/)
  ├── version.json          ← version info + bundle URL + hash
  └── ota/bundle-vN.zip     ← zip of web assets + ota_manifest.json

Android App (MainActivity.java)
  ├── assets/               ← bundled web assets (ships with APK)
  ├── files/ota/            ← OTA-downloaded assets (if newer)
  └── files/ota_tmp/        ← temp extraction dir (atomic swap)

Backend (octile_api.py)
  └── GET /version          ← returns { apiVersion, data_version, ... }
```

### Startup: which web root to load

```
getWebLoadUrl()
  1. ota_version > bundledVersionCode AND ota/index.html exists?
     → load file://{filesDir}/ota/index.html  (OTA version)
  2. ota_version <= bundledVersionCode?
     → delete stale ota/ dir (APK caught up), load bundled
  3. No OTA?
     → load file:///android_asset/index.html  (bundled)
```

### Background download flow

```
onPageFinished → checkForOtaUpdate() [background thread]
    │
    ▼
    fetch(SITE_URL + "version.json")
    │
    remoteVersion = json.optInt("otaVersionCode", json.optInt("versionCode", 0))
    localMax = max(bundledVersionCode, ota_version from SharedPrefs)
    │
    remoteVersion <= localMax? → STOP (up to date)
    │
    remoteVersion == lastFailed? → STOP (avoid retry loop)
    │
    ▼
    minApiVersion check:
    │  fetch WORKER_URL/version → get backend apiVersion
    │  backend apiVersion < minApiVersion? → STOP (backend not ready)
    │
    ▼
    Download bundleUrl (zip)
    │
    ▼
    Verify zip SHA-256 hash
    │  mismatch? → mark failed, STOP
    │
    ▼
    Extract to ota_tmp/
    │
    ▼
    Verify required files:
    │  index.html, app.min.js, style.css, themes.css,
    │  translations.json, sw.js, favicon.svg
    │
    ▼
    Verify ota_manifest.json (per-file SHA-256) if present
    │  any mismatch? → mark failed, cleanup, STOP
    │
    ▼
    Atomic swap: delete ota/, rename ota_tmp/ → ota/
    │  rename fails? → mark failed, cleanup, STOP
    │
    ▼
    Save ota_version to SharedPrefs, clear lastFailed
    │
    ▼
    Notify WebView: window.onOtaUpdateReady(version)
    │
    ▼ (app.js handler)
    Show banner: "Update ready, restart to apply"
    ├── [Restart] → location.reload() (reloads from ota/ dir)
    └── [Later]   → dismiss
```

---

## Safety Measures

| Measure | How |
|---------|-----|
| **Zip hash verification** | SHA-256 of entire zip must match `bundleHash` |
| **Per-file manifest verify** | Each file in `ota_manifest.json` checked individually |
| **Required files check** | 7 core files must exist after extraction |
| **Atomic swap** | Extract to `ota_tmp/`, rename to `ota/` — no half-state |
| **Failed version skip** | `ota_last_failed` in SharedPrefs prevents retrying a broken bundle |
| **Backend compat check** | `minApiVersion` vs backend's `apiVersion` — skip if backend not ready |
| **Bundled fallback** | If OTA dir missing/corrupt, falls back to APK bundled assets |
| **User consent** | Banner with [Restart] / [Later] — no forced update |

---

## ota_manifest.json (inside zip)

```json
{
  "files": {
    "index.html": "sha256:abc123...",
    "app.min.js": "sha256:def456...",
    "style.css": "sha256:..."
  }
}
```

Generated by `scripts/make-ota-bundle.sh`. Each file's SHA-256 is verified after extraction.

---

## Building an OTA Bundle

```bash
bash scripts/make-ota-bundle.sh
```

This:
1. Builds `app.min.js` via terser
2. Generates `ota_manifest.json` with per-file SHA-256 hashes
3. Creates `ota/bundle-vN.zip` with all web assets + manifest
4. Computes zip SHA-256
5. Updates `version.json` with new `otaVersionCode`, `bundleUrl`, and `bundleHash`

### Files in Bundle

| File | Required | Purpose |
|------|----------|---------|
| `index.html` | Yes | Main page |
| `app.min.js` | Yes | Game logic (minified) |
| `style.css` | Yes | Styles |
| `themes.css` | Yes | Theme styles |
| `translations.json` | Yes | i18n strings |
| `sw.js` | Yes | Service worker |
| `favicon.svg` | Yes | App icon |
| `config.json` | No | Worker URL config |
| `privacy.html` | No | Privacy policy |
| `terms.html` | No | Terms of use |
| `help.html` | No | Full guide |
| `feedback.html` | No | Feedback form |
| `ota_manifest.json` | No | Per-file hashes (generated) |

---

## Data Version (Score Compatibility)

The backend has `OCTILE_DATA_VERSION` (e.g., `"2026-04-02"`) that tracks puzzle data encoding changes. The frontend:

1. Fetches `data_version` from `GET /version` on startup
2. Includes it in `POST /score` submissions
3. If backend returns 409 (version mismatch), refreshes the cached version

This prevents submitting scores with incompatible puzzle encoding after a data change.

---

## When to Bump

| Change | What to bump |
|--------|-------------|
| Web asset changes only | `otaVersionCode` in version.json, rebuild bundle |
| New backend endpoints needed | `minApiVersion` in version.json + `OCTILE_API_VERSION` in backend |
| Puzzle data/encoding change | `OCTILE_DATA_VERSION` in backend |
| Play Store release | `versionCode` in version.json (match Play Store), `versionCode` in build.gradle |

---

## Version matrix example

| Client | APK versionCode | Has OTA? | Sees banner? | Gets OTA? |
|--------|----------------|----------|-------------|-----------|
| v1.8.1 | 11 | No | Only if `versionCode` > 11 (= new Play Store release) | Never |
| v1.15.0 (dev) | 23 | Yes | Only if `versionCode` > 23 (= newer Play Store release) | If `otaVersionCode` > 23 |
| v1.15.0 (after OTA v24) | 23 (APK) + 24 (OTA) | Yes | Same | If `otaVersionCode` > 24 |
