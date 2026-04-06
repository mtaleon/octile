# In-App Update System for Octile (WebView Hybrid)

Two update layers: **Binary Updates** (native APK via Play Store) and **OTA Content Updates** (web assets via GitHub Pages).

---

## Current State

| Platform | Loads from | Update path | Latency |
|----------|-----------|-------------|---------|
| **PWA/Web** | GitHub Pages (https) | Auto — service worker cache-busts on `CACHE_NAME` change | Instant |
| **Android** | `file:///android_asset/` | Manual — rebuild APK, publish to Play Store | Days |
| **iOS** | Local bundle | Manual — rebuild, submit to App Store | Days |

**Bottleneck**: 90% of Octile changes are web assets (`app.js`, `style.css`, `index.html`), but Android requires a full Play Store update cycle for every change.

---

## 1. OTA Content Updates (Phase 1 — Priority)

Lightweight over-the-air updates for Android. Download web assets from GitHub Pages and load from internal storage instead of bundled `assets/`.

### Architecture

```
App Launch (Android, file:// protocol)
  │
  v
Read "ota_version" from SharedPreferences
  │
  v
OTA dir exists AND ota_version >= bundled version?
  ├─ YES → load file:///data/.../ota/index.html
  └─ NO  → load file:///android_asset/index.html (current behavior)
  │
  v
Background: fetch SITE_URL/version.json
  │
  v
Remote versionCode > max(bundled, ota_version)?
  ├─ YES → download bundle zip → verify hash → extract to ota/
  │         save ota_version → notify JS: "Update ready"
  └─ NO  → do nothing
```

**Key**: OTA applies on **next launch**, never mid-session (don't interrupt gameplay).

### Manifest: `version.json` (already exists)

Add `bundleUrl` and `bundleHash` fields:

```json
{
  "versionCode": 13,
  "versionName": "2.0.0",
  "bundleUrl": "https://mtaleon.github.io/octile/ota/bundle-v13.zip",
  "bundleHash": "sha256:a1b2c3d4...",
  "playStoreUrl": "https://play.google.com/store/apps/details?id=com.octile.app",
  "releaseNotes": {
    "en": "...",
    "zh": "..."
  }
}
```

No new backend endpoint needed — GitHub Pages hosts everything.

### Bundle Contents (~254KB zipped)

Per the mobile asset sync checklist:
- `index.html`, `app.min.js`, `style.css`, `themes.css`, `translations.json`
- `privacy.html`, `terms.html`
- `sw.js`, `favicon.svg`
- **Exclude**: `app.js` (source), `workers/`, `docs/`, build files, `scripts/verify_puzzles.py`

### Bundle Build Script: `scripts/make-ota-bundle.sh`

```bash
#!/bin/bash
set -e
VERSION=$(jq -r .versionCode version.json)
OUT="ota/bundle-v${VERSION}.zip"
mkdir -p ota
zip -j "$OUT" index.html app.min.js style.css themes.css translations.json \
    privacy.html terms.html sw.js favicon.svg
HASH=$(shasum -a 256 "$OUT" | cut -d' ' -f1)
echo "Bundle: $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
echo "SHA-256: $HASH"
# Update version.json with bundleUrl and bundleHash
jq --arg url "https://mtaleon.github.io/octile/$OUT" \
   --arg hash "sha256:$HASH" \
   '.bundleUrl = $url | .bundleHash = $hash' version.json > version.json.tmp
mv version.json.tmp version.json
```

### Android: `MainActivity.java` Changes

#### Load priority (in `onCreate`):

```java
// Determine which web root to load
String otaDir = getFilesDir() + "/ota";
int otaVersion = prefs.getInt("ota_version", 0);
int bundledVersion = 12; // APP_VERSION_CODE, update on each APK release

if (otaVersion >= bundledVersion && new File(otaDir, "index.html").exists()) {
    webView.loadUrl("file://" + otaDir + "/index.html");
} else {
    webView.loadUrl("file:///android_asset/index.html");
}
```

#### Background OTA check (in `onPageFinished`):

```java
new Thread(() -> {
    try {
        // Fetch version.json
        URL url = new URL("https://mtaleon.github.io/octile/version.json?t=" + System.currentTimeMillis());
        JSONObject json = new JSONObject(readStream(url.openStream()));
        int remoteVersion = json.getInt("versionCode");
        int localMax = Math.max(bundledVersion, otaVersion);

        if (remoteVersion > localMax && json.has("bundleUrl")) {
            String bundleUrl = json.getString("bundleUrl");
            String expectedHash = json.optString("bundleHash", "");

            // Download zip
            File zipFile = new File(getCacheDir(), "ota-bundle.zip");
            downloadFile(bundleUrl, zipFile);

            // Verify hash
            if (!expectedHash.isEmpty() && !verifyHash(zipFile, expectedHash)) {
                zipFile.delete();
                return;
            }

            // Extract to ota/ dir
            File otaDir = new File(getFilesDir(), "ota");
            deleteDir(otaDir);
            unzip(zipFile, otaDir);
            zipFile.delete();

            // Verify extraction (at minimum index.html must exist)
            if (!new File(otaDir, "index.html").exists()) {
                deleteDir(otaDir);
                return;
            }

            // Save version
            prefs.edit().putInt("ota_version", remoteVersion).apply();

            // Notify WebView
            webView.post(() -> webView.evaluateJavascript(
                "if(window.onOtaUpdateReady)window.onOtaUpdateReady(" + remoteVersion + ")", null
            ));
        }
    } catch (Exception e) {
        // Silent fail — bundled assets still work
    }
}).start();
```

### Client: `app.js` Changes

Reuse the existing update banner for OTA-ready notification:

```javascript
// Native calls this after OTA download completes
window.onOtaUpdateReady = function(version) {
  // Don't interrupt mid-puzzle — show subtle banner
  var banner = document.getElementById('update-banner');
  document.getElementById('update-text').textContent = t('ota_ready');
  document.getElementById('update-btn').textContent = t('ota_restart');
  document.getElementById('update-btn').onclick = function() {
    // Reload WebView to pick up new OTA files on next load
    location.reload();
  };
  document.getElementById('update-dismiss').textContent = t('update_later');
  document.getElementById('update-dismiss').onclick = function() {
    banner.classList.remove('show');
  };
  banner.classList.add('show');
};
```

Translation keys:
- `ota_ready`: "New version downloaded" / "新版本已下載"
- `ota_restart`: "Restart" / "重新啟動"

### Rollback Safety

1. `bundleHash` (SHA-256) in `version.json` — verify zip integrity after download
2. Post-extraction check: `index.html` and `app.min.js` must exist in ota/ dir
3. If verification fails → delete ota/ dir → falls back to bundled assets on next launch
4. OTA version can only go **higher** than bundled — never downgrade
5. New APK release resets floor: if `bundledVersion > otaVersion`, load from assets/

### What about `file:///android_asset/` URL references?

OTA files load from `file:///data/data/com.octile.app/files/ota/` instead of `file:///android_asset/`. Relative URLs (stylesheets, scripts) work fine since they resolve relative to `index.html`. No absolute paths in the web code reference `android_asset` directly.

---

## 2. Native Binary Updates (Play Store) — Phase 2

For changes involving native code (new permissions, WebView config, Java changes).

Uses the [Google Play In-App Updates API](https://developer.android.com/guide/playcore/in-app-updates).

### Update Types

| Type | UX | Use Case |
|---|---|---|
| **Immediate** | Full-screen blocking | Critical security patches, breaking API changes |
| **Flexible** | Background download | Non-critical native improvements |

### Implementation

- [ ] Add `com.google.android.play:app-update` dependency to `build.gradle`
- [ ] Create `AppUpdateManager` in `MainActivity`
- [ ] Check for updates in `onResume()` (catches stalled updates)
- [ ] Flexible flow by default; immediate only for critical versions

---

## 3. iOS Considerations

- Apple **prohibits** OTA code updates that change app behavior (App Store Review Guidelines 3.3.2)
- All iOS web asset updates must go through App Store submission
- In-app update prompts: use `SKStoreProductViewController` or link to App Store
- No OTA system for iOS — only binary updates

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| When OTA applies | Next launch | Don't interrupt gameplay mid-puzzle |
| Download source | GitHub Pages | Already hosted, free CDN, no backend change |
| Manifest | Existing `version.json` | No new endpoint needed |
| Fallback | Bundled `assets/` | If OTA corrupt, delete dir and fall back |
| Integrity | SHA-256 hash in `version.json` | Verify zip before extracting |
| iOS | Skip OTA | Apple prohibits it |
| Bundle size | ~254KB zipped | Small enough for any connection |
| Delta updates | Not needed | Full bundle is tiny at 254KB |
| Background polling | Not needed | Check once on launch is sufficient |
| A/B testing | Not needed | One version, ship it |

---

## Implementation Checklist

### Phase 1: OTA Content Updates (~3-4 hours)

| File | Change | Effort |
|------|--------|--------|
| `version.json` | Add `bundleUrl`, `bundleHash` fields | 5 min |
| `scripts/make-ota-bundle.sh` | Zip web assets, compute hash, update version.json | 15 min |
| `MainActivity.java` | OTA load priority + background download/extract (~80 lines) | 1-2 hr |
| `app.js` | `window.onOtaUpdateReady` handler, reuse update banner | 30 min |
| `translations.json` | Add `ota_ready`, `ota_restart` keys | 5 min |
| `.github/workflows/` | Optional: auto-generate bundle on version bump | 30 min |

### Phase 2: Play Store In-App Updates (~1 day)

- [ ] `build.gradle` — add Play Core dependency
- [ ] `MainActivity.java` — AppUpdateManager flexible flow
- [ ] Handle stalled updates in `onResume()`

### Not Building (Keep It Simple)

- No delta/diff updates — 254KB full zip is fine
- No background polling — once on launch is enough
- No server-side hosting — GitHub Pages is the CDN
- No A/B testing — one version, ship it
- No iOS OTA — Apple forbids it
