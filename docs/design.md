# Octile — Design Document

**Version:** 1.7.0 | **Last updated:** 2026-03-24

---

## 1. Overview

Octile is a tile-placement puzzle game inspired by Archimedes' *Stomachion* (250 BC). Players fill an 8×8 board with 11 tiles — 3 pre-placed grey tiles define each puzzle, and 8 colored tiles must be arranged to fill the remaining cells.

**91,024 puzzles** (11,378 base × 8 D4 symmetry transforms), each proven solvable and unique via exhaustive search.

### Platforms

| Platform | Technology | Distribution |
|----------|-----------|-------------|
| Web | Static HTML/CSS/JS (PWA) | GitHub Pages |
| Android | WebView wrapper | Google Play |
| iOS | WKWebView wrapper | App Store |

### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Client      │────▶│ Cloudflare Worker │────▶│  Backend    │
│  (app.js)    │     │  (edge proxy)     │     │  (FastAPI)  │
└─────────────┘     └──────────────────┘     └─────────────┘
   Static site          octile.owen-          Docker + SQLite
   gh-pages             ouyang.workers.dev    m.taleon.work.gd
```

---

## 2. Game Flow

### 2.1 Welcome Panel

The entry screen shows:
- Energy status badge
- Rotating tagline from brand copy
- 4 level cards (Easy / Medium / Hard / Nightmare) with progress bars
- "Random Puzzle" button

### 2.2 Level-Based Play

Each level contains puzzles ordered by solver complexity (backtrack count):

| Level  | Base Puzzles | Total (×8) | Backtrack Threshold |
|--------|-------------|------------|---------------------|
| Easy   | 2,876       | 23,008     | ≤ 36                |
| Medium | 2,815       | 22,520     | ≤ 114               |
| Hard   | 3,981       | 31,848     | ≤ 559               |
| Nightmare | 1,706    | 13,648     | > 559               |

**Slot ordering:** Interleaved — consecutive slots use different base puzzles. Slot 1 = base1_transform0, slot 2 = base2_transform0, ..., slot N = baseN_transform0, slot N+1 = base1_transform1, etc.

**Navigation:**
- Tap level card → loads next unplayed slot (or level-complete screen if finished)
- In-game ◀ / ▶ arrows navigate freely within the level (disabled at boundaries)
- Progress stored per level: `octile_level_{easy,medium,hard,hell}`
- Solving any slot higher than current progress advances progress to that slot (skipping allowed)

### 2.3 Random Play

- Picks a random puzzle from the full 91,024 range (or 88 offline)
- No level context — `currentLevel = null`
- Accessible from welcome panel, control bar, and win dialog

### 2.4 Game Mechanics

- **Board:** 8×8 grid (64 cells)
- **Grey tiles:** 1×1, 1×2, 1×3 — pre-placed, defining the puzzle (6 cells)
- **Player tiles:** 3×4, 2×5, 3×3, 2×4, 2×3, 1×5, 1×4, 2×2 (58 cells)
- **Controls:** Drag & drop or tap-to-select/tap-to-place; tap selected piece to rotate 90°
- **Win condition:** All 64 cells filled with no overlaps

### 2.5 Win Dialog

Displays:
- Solve time + personal best comparison
- Unique progress (N / 91,024)
- Energy cost
- Newly earned achievements
- Level-complete banner (when applicable)
- "Did You Know?" rotating fact

Actions: Share Result, View Board, ← Previous (level only), Next →, Random, Menu

---

## 3. Systems

### 3.1 Energy System

| Parameter | Value |
|-----------|-------|
| Max points | 25 |
| Recovery | Linear over 4 hours (≈0.00174/sec) |
| Deducted | After solve, not at start |
| Minimum to play | 1 point |

**Energy cost by solve time:**

| Time | Cost |
|------|------|
| ≤ 60s | 1 |
| ≤ 2min | 2 |
| ≤ 3min | 3 |
| ≤ 5min | 4 |
| > 5min | 5 |

### 3.2 Hint System

- 3 hints per day (resets when starting a new puzzle after midnight)
- Each hint reveals one unplaced tile's correct position (flash animation)
- Lazy solver: solution computed on first hint request per puzzle
- Stored in `octile_daily_hints` (date + used count)

### 3.3 Timer

- Lazy start — begins on first tile placement
- Pauses when pause overlay is shown
- Best time per puzzle stored in `octile_best_{puzzleNumber}`

### 3.4 Streak System

- Consecutive days with at least one solve
- Stored in `octile_streak` (lastDate, count)
- Resets to 1 if a day is skipped

---

## 4. Achievements (57 total)

### Main Tab (31)

**Milestones (8):** 1, 10, 50, 100, 500, 1000, 5000, 91024 unique solves

**Speed (4):** Under 60s, 45s, 30s, 15s

**Dedication (4):** 20, 100, 500, 1000 total solves

**Streak (7):** 3, 7, 30, 100, 200, 300, 365 consecutive days

**Special (8):** No-hint solve, 5-in-a-day, 10-in-a-day, night owl (22:00–04:59), night 100, morning 100 (04:30–08:59), weekend solve, leaderboard rank 1

### Level Tab (8)

100 and 1000 completions per level (easy/medium/hard/hell)

### Calendar Tab (18)

12 monthly badges + 4 seasonal (spring/summer/autumn/winter) + half-year (6 months) + all-months (12)

---

## 5. Data & Encoding

### 5.1 Puzzle Encoding

**Base-92 alphabet:** Printable ASCII 33–126, excluding `'` (39) and `\` (92).

**Puzzle data:** 3 chars per puzzle (base-92, little-endian).
```
combined = g1_pos × 10752 + g2_placement × 96 + g3_placement
```

**Solution encoding:** 8-char base-92 compact format (mixed-radix placement per piece).

### 5.2 Offline Data

| Data | Count | Storage |
|------|-------|---------|
| Random puzzles | 88 | `OFFLINE_PUZZLE_NUMS` + `OFFLINE_CELLS` |
| Level puzzles | 22 per level (88 total) | `OFFLINE_LEVEL_PUZZLES` |
| Level totals | 4 levels | `OFFLINE_LEVEL_TOTALS` |

All encoded as base-92 packed strings (6 chars per puzzle = cell indices + 33).

### 5.3 localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `octile_lang` | string | `en` or `zh` |
| `octile_level_{name}` | int | Completed slots per level |
| `octile_solved` | JSON array | Set of solved puzzle numbers |
| `octile_total_solved` | int | Total solves (incl. re-solves) |
| `octile_best_{n}` | int | Best time (seconds) for puzzle N |
| `octile_energy` | JSON | `{points, ts}` |
| `octile_energy_day` | JSON | Daily energy stats `{date, puzzles, spent}` |
| `octile_daily_hints` | JSON | `{date, used}` |
| `octile_streak` | JSON | `{lastDate, count}` |
| `octile_achievements` | JSON | Unlocked achievement IDs |
| `octile_months` | JSON array | 12-element boolean array |
| `octile_night_solves` | int | Night solve count (22:00–04:29) |
| `octile_morning_solves` | int | Morning solve count (04:30–08:59) |
| `octile_score_queue` | JSON array | Offline score queue |
| `octile_browser_uuid` | string | Anonymous player UUID |
| `octile-theme` | string | `default`, `lego`, or `wood` |
| `octile_debug` | JSON | Debug flags (localhost only) |

---

## 6. Networking

### 6.1 API Endpoints (via Cloudflare Worker proxy)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Backend health check (3s timeout) |
| GET | `/levels` | Level totals `{easy, medium, hard, hell}` |
| GET | `/level/{name}/puzzle/{slot}` | Puzzle by level + slot |
| GET | `/puzzle/{n}` | Puzzle by number (1–91,024) |
| POST | `/score` | Submit solve score |
| GET | `/scoreboard` | Leaderboard data |
| GET | `/puzzles` | Puzzle stats |

### 6.2 Offline Strategy

- **Health check:** 3s timeout, re-checked every 5 minutes
- **Puzzle fetch:** 3s timeout → fallback to nearest offline puzzle
- **Level fetch:** 3s timeout → fallback to `_OFFLINE_LEVEL_MAP`
- **Level totals:** 3s timeout → fallback to `OFFLINE_LEVEL_TOTALS`
- **Score submission:** Queued in localStorage, flushed on reconnect (35s delay between sends)
- **State detection:** `_backendOnline` — `null` (unknown), `true`, `false`

### 6.3 Anti-Cheat

- Cloudflare Turnstile (invisible challenge) on score submission
- Server-side solution verification (compact 8-char solution decoded and checked)
- HMAC signing (currently disabled)
- Turnstile blocked on `file://` (WebView) and `localhost`

---

## 7. UI Layout

### 7.1 Mobile (< 769px)

```
┌─ Header ─────────────────────────┐
│ ← Octile        ⚡25  0:00  ⚙️   │
├──────────────────────────────────┤
│ ◀ 🟢 Easy #5 ▶                  │  ← Level nav (during level play)
├──────────────────────────────────┤
│  Hint(3)   ↻   Random           │  ← Controls
├──────────────────────────────────┤
│                                  │
│         8×8 Board                │
│                                  │
├──────────────────────────────────┤
│ ▓▓ [3×4] [2×5] [3×3] ... ▶ ▓▓  │  ← Horizontal scrollable dock
│ Swipe for more tiles. Tap to ... │  ← Hint (auto-dismiss)
└──────────────────────────────────┘
```

- Pool: horizontal flex, `overflow-x: auto`, edge fade gradients
- Placed pieces hidden from dock
- Scroll/rotate hint shown once per session (yellow, 8s auto-dismiss)

### 7.2 Desktop (≥ 769px)

```
┌─ Header ──────────────────────────────────┐
│ ← Octile                  ⚡25  0:00  ⚙️   │
├───────────────────────┬───────────────────┤
│                       │  [3×4]  [2×5]    │
│    8×8 Board          │  [3×3]  [2×4]    │
│                       │  [2×3]  [1×5]    │
│                       │  [1×4]  [2×2]    │
│                       │                   │
│                       │ Tap to rotate     │
└───────────────────────┴───────────────────┘
```

- Pool: wrapped flex grid, 28px cells, all pieces visible
- Board and pool side-by-side (`flex-direction: row`)

### 7.3 Drag & Drop

- **Pool → Board:** Ghost rendered at board cell size (`getCellSize()`)
- **Board → Pool:** Tap placed tile to return, or drag off board
- Preview overlay shows valid/invalid placement during drag

---

## 8. Internationalization

- 2 languages: English (`en`) and Traditional Chinese (`zh`)
- Auto-detect from `navigator.language` on first visit
- Translations loaded synchronously from `translations.json` at init
- `t(key)` function with English fallback
- All UI text set in `applyLanguage()` — called at init and on toggle

---

## 9. Themes

| Theme | Key | Description |
|-------|-----|-------------|
| Classic | `default` | Dark navy background, flat colored tiles |
| LEGO | `lego` | LEGO brick textures |
| Wood | `wood` | Wood grain textures |

Stored in `octile-theme` localStorage. Applied via body class.

---

## 10. Service Worker & PWA

- `sw.js` with cache-first strategy for static assets
- Cache versioned: `octile-v{N}` — bump on releases
- Installable via manifest (home screen / dock)
- Offline: serves cached assets, game works with bundled puzzles

---

## 11. Mobile Apps

### Android
- `MainActivity.java` — WebView loading `file:///android_asset/index.html`
- `allowFileAccessFromFileURLs` + `allowUniversalAccessFromFileURLs` enabled
- JS bridge for native SharedPreferences

### iOS
- `WebViewScreen.swift` — WKWebView loading local `index.html`
- `loadFileURL` with read access to parent directory

### Sync
- `app.js`, `style.css`, `index.html`, `translations.json`, `sw.js` must be manually copied to:
  - `android/app/src/main/assets/`
  - `ios/Octile/Octile/Web/`

---

## 12. Debug Panel (localhost only)

Visible in settings when `location.hostname` is `localhost` or `127.0.0.1`.

| Toggle | Effect |
|--------|--------|
| Force Offline | Blocks all API fetches, uses offline puzzle data, sets `_backendOnline = false` |
| Unlimited Hints | `getHintsUsedToday()` always returns 0, `useHint()` skips incrementing |

Config persisted in `octile_debug` localStorage (loaded only on localhost).

---

## 13. Build & Deploy

| Component | Build | Deploy |
|-----------|-------|--------|
| Web client | Static files (no build step) | `git push` to gh-pages → GitHub Pages |
| Worker proxy | `wrangler deploy` | Cloudflare Workers |
| Backend | `docker build` (runs `ruff check` + `pytest`) | Docker on server |
| Android | Gradle (`versionCode`/`versionName` must match `version.json`) | Google Play Console |
| iOS | Xcode | App Store Connect |

### Cache Busting
- GitHub Pages: 10-minute cache (`max-age=600`)
- Service worker: bump `CACHE_NAME` version in `sw.js`
- Worker proxy: must add routes when backend adds endpoints

---

## 14. Known Constraints

- SQLite `create_all()` won't modify existing tables — new columns need `ALTER TABLE`
- Old DB has `timestamp_utc NOT NULL` — always provide a value
- Turnstile doesn't work on `file://` — gate on `https:` protocol
- Turnstile container must not be `display:none` — use off-screen positioning
- Score queue flush respects 30s rate limit — one at a time with 35s delay
- Pre-existing ruff warning: `grey_cell_set` unused in `verify_solution` (F841)
