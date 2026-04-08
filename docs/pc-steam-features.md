# Octile PC/Steam Feature Spec

## Overview

Octile has been upgraded from a mobile-first PWA to a desktop-ready art puzzle experience. This document covers all PC/Steam enhancements implemented across Phases 1-3.

---

## Phase 1: PC Visual Upgrade (4K-Ready)

### Adaptive Board Sizing

The board dynamically scales across 4 tiers using CSS custom properties:

| Breakpoint | Board Size | Cell Size | Target |
|------------|-----------|-----------|--------|
| < 769px | `min(95vw, 400px)` | ~28px | Mobile |
| 769px+ (`pointer: fine`) | `min(80vh, 80vw, 600px)` | ~41px | Laptop |
| 1200px+ (`pointer: fine`) | `min(80vh, 80vw, 720px)` | ~50px | 1440p |
| 2400px+ (`pointer: fine`) | `min(80vh, 80vw, 900px)` | ~62px | 4K |

- `pointer: fine` guard ensures tablets in landscape don't trigger desktop layout
- Board uses `min(vh, vw, cap)` to fit any aspect ratio
- Pool piece cells scale at 55% of board cell size, constrained by pool section width

### CSS Custom Properties

```
--board-size    Board width/height
--cell-size     Board cell size (set by JS from actual render)
--pool-cell     Pool piece cell size (set by JS via getPoolCellSize())
--gap           Layout gap between board and pool
```

### Desktop Layout

- Board + pool side-by-side (`#main-area` flex row)
- Pool section: glass background, scrollable, max-height `calc(100vh - 80px)`
- Unplaced pieces dim to 70% opacity, brighten on hover
- Modals: backdrop blur, max-width 640px, rounded corners
- Timer: monospace font, larger on desktop
- Action bar buttons: bordered, less "mobile pill" feel

### Files Modified
- `style.css` — Custom properties, breakpoints, desktop polish
- `src/05-board.js` — `getPoolCellSize()`, dynamic `--pool-cell` setter
- `src/01-data.js` — `PIECE_CELL_PX = 28` documented as mobile default

---

## Phase 2: Keyboard & Mouse Controls

### Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `1`-`8` | Select piece by index | In-game |
| `R` | Rotate selected piece | In-game, piece selected |
| Arrow keys | Move cursor on board | In-game |
| `Enter` / `Space` | Place piece at cursor | In-game, cursor active |
| `Backspace` | Undo last placement | In-game |
| `Ctrl+Z` / `Cmd+Z` | Undo last placement | In-game |
| `H` | Show hint | In-game |
| `P` | Pause / resume | In-game |
| `Z` | Toggle Zen Mode | In-game |
| `N` | Next puzzle | Win screen |
| `Esc` | Close dialog | Any modal open |
| `?` | Open help / keyboard list | Global |

### Mouse Enhancements

- **Scroll wheel** on pool: cycles through unplaced pieces
- **Right-click** on placed board piece: removes it
- **Crosshair cursor** on empty board cells when piece is selected
- **Hover preview**: unplaced pieces brighten on hover

### Input Mode Tracking

`_inputMode` tracks `'mouse'` vs `'keyboard'` to prevent conflicts:
- Mouse movement hides keyboard cursor
- Key press enables keyboard cursor
- Ghost cursor (kb-cursor class) only renders in keyboard mode

### Keyboard Cursor

- Yellow highlight cell on board (`kb-cursor` class)
- Initializes at center (3,3) on first arrow press
- Cleared on mouse movement or game reset

### Focus Visible

- `:focus-visible` outline on interactive elements (2px solid #f1c40f)
- Tab order: pieces -> board -> controls -> modals

### Files Modified
- `src/11-init.js` — All keyboard/mouse handlers, input mode tracking
- `src/05-board.js` — `piece-selected` class toggle, `data-index` attribute
- `src/07-game.js` — Cursor reset in `resetGame()`
- `style.css` — `kb-cursor`, `focus-visible`, crosshair styles

---

## Phase 3: Zen Mode

### Design Philosophy

"Hide the interface so the puzzle can breathe."

Zen Mode removes UI chrome — header, action bar, hint text — leaving only the board and pieces. It's a visual layer, not a gameplay mode. All game mechanics continue unchanged.

### Behavior

| Element | Normal | Zen Mode |
|---------|--------|----------|
| Header (stats, timer) | Visible | Fades out, reveals on hover |
| Action bar (buttons) | Visible | Fades out, reveals on hover |
| Pool hint text | Visible | Hidden |
| Pool section border/bg | Glass background | Transparent |
| Board + pieces | Normal | Unchanged |

- Toggle: `Z` key (in-game only)
- Toast notification: brief "Zen Mode" / "Zen Mode Off" with icon
- Persists until toggled off or player returns to welcome screen
- Hover header/action bar to temporarily reveal (0.25s ease-in, 0.6s ease-out)
- Invisible `::after` hit area on header for easier mouse targeting

### Files Modified
- `src/11-init.js` — `Z` key handler, toast
- `src/08-ui.js` — `zen-mode` class cleared on `returnToWelcome()`
- `style.css` — Zen Mode CSS (per-element hover, transitions, `::after` hit area)

---

## Phase 4: Steam Integration

### Electron Build (`electron/`)

Octile desktop wraps the web app in Electron, loading `dist/web/` locally — same pattern as the Android WebView.

#### Project Structure

```
electron/
  main.js           — Electron main process + Steamworks init
  preload.js         — Exposes window.steam API to web app
  package.json       — Dependencies, electron-builder config
  steam_appid.txt    — Steam App ID (480 = Spacewar for dev)
  build/             — Icons for electron-builder (icon.png, icon.ico)
  dist/              — Build output (gitignored)
```

#### Development

```bash
# 1. Build web assets (if not already built)
./scripts/build.sh

# 2. Install Electron deps (first time or after package.json changes)
cd electron && npm install

# 3. Run in dev mode (opens with DevTools)
npm run dev
```

#### Building

| Command | Platform | Output |
|---------|----------|--------|
| `npm run build:win` | Windows | `.exe` (NSIS installer) |
| `npm run build:mac` | macOS | `.dmg` |
| `npm run build:linux` | Linux | `.AppImage`, `.deb` |
| `npm run build:all` | Current OS only | All formats for that OS |

Each command runs `build.sh` first, then `electron-builder`. Cross-compilation is not supported — use CI for multi-platform builds.

#### CI: `.github/workflows/build-steam.yml`

Builds on all three platforms in parallel using native runners (`ubuntu-latest`, `windows-latest`, `macos-latest`). Triggers on pushes to `electron/**`, `src/**`, `scripts/**`, or manual dispatch. Uploads artifacts with 90-day retention.

#### Steamworks Integration

- `main.js` initializes Steamworks via `steamworks.js` (fails gracefully if Steam isn't running)
- `preload.js` exposes `window.steam` to the web app via `contextBridge`:
  - `window.steam.platform` — `'steam'`
  - `window.steam.unlockAchievement(id)` — activates a Steam achievement
  - `window.steam.isAchievementUnlocked(id)` — checks if already activated
- Web app integration: check `if (window.steam)` before calling Steam APIs
- `STEAM_APP_ID` in `main.js` — set to `0` (disabled); replace with real ID from Steamworks

#### TODO

- [ ] Get Steam App ID from Steamworks → update `main.js` and `steam_appid.txt`
- [ ] Map in-app achievements to Steam achievement IDs
- [ ] Add `if (window.steam)` calls in `06-economy.js` achievement unlock code
- [ ] Generate `.icns` icon for macOS builds
- [ ] Decide on energy system for Steam (keep, remove, or modify for paid version)
- [ ] Steam auto-update replaces OTA — no SW needed in Electron

### Achievement Mapping
65 in-app achievements ready to map to Steam Achievements:
- First Solve, Streak milestones (3/7/30), Grade milestones (10S/50S)
- Level completions (Easy/Medium/Hard/Nightmare)
- Speed achievements (under 15s, under 30s)
- Collection (solve 100/500/1000 unique puzzles)

### Trading Cards (Concept)
6 cards based on world themes:
- The Grasslands (Easy), The Sky Ocean (Medium), The Magma Peaks (Hard), The Void (Nightmare)
- 2 rare: Stained Glass, Marble & Gold

---

## 15 Visual Themes

| Theme | Cost | Style |
|-------|------|-------|
| Classic | Free | Dark blue, bright primaries |
| LEGO | Free | Green base, bold toy colors |
| Wood | Free | Brown tones, natural grain |
| Stained Glass | 500 | Dark cathedral, jewel tones |
| Marble & Gold | 800 | Warm ivory, gold accents |
| Quilt | 500 | Patchwork, warm earth tones |
| Deep Sea | 1000 | Oceanic blues, bioluminescent teals |
| Space Galaxy | 1500 | Dark cosmos, purple nebula |
| Botanical | 500 | Forest greens, natural growth |
| Cyberpunk | 1000 | Neon pink/cyan on black |
| Ancient Ink | 800 | Parchment, calligraphic brush |
| Ukiyo-e | 1000 | Japanese woodblock, warm darks |
| Steampunk | 1500 | Brass, copper, aged metal |
| Frozen | 800 | Ice blues, pale frost |
| Halloween | 800 | Dark purple, orange glow |

---

## Phase 5: Gamepad Controller Support

Steam-only feature (`_steamFeature('gamepad')`) — standard gamepad/controller (Xbox, PlayStation, etc.) maps onto the existing keyboard cursor infrastructure.

### Module

New file: `src/js/05a-gamepad.js` (~170 lines). Initialized via `_gpInit()` called from `11-init.js` after `_steamConfigReady` resolves.

### Guards

- Hard `_isElectron` gate ensures web/mobile never activates gamepad polling
- `_steamFeature('gamepad')` allows feature flag control via Steam config
- `navigator.getGamepads` API check for browser compatibility

### Button Mapping (Standard Gamepad)

| Button | Index | In-Game | Modal | Win Overlay | Paused | Welcome |
|--------|-------|---------|-------|-------------|--------|---------|
| A (South) | 0 | Place at cursor | Click primary btn | Advance step | Resume | Click resume btn |
| B (East) | 1 | Undo last placement | Close modal | -- | Return to welcome | -- |
| X (West) | 2 | Rotate piece | -- | -- | -- | -- |
| Y (North) | 3 | Show hint | -- | -- | -- | -- |
| LB | 4 | Previous piece | -- | -- | -- | -- |
| RB | 5 | Next piece | -- | -- | -- | -- |
| Start | 9 | Pause | -- | -- | Resume | -- |
| D-pad | 12-15 | Move cursor | -- | -- | -- | -- |
| Left stick | axes 0,1 | Move cursor | -- | -- | -- | -- |

### Input Behavior

- **Input mode activation**: any gamepad input sets `_inputMode = 'keyboard'`, showing the cursor; mouse movement hides it (existing behavior)
- **D-pad + left stick OR'd together**: both control cursor movement simultaneously
- **Key repeat**: fires immediately on press, then 300ms delay before 100ms repeat rate
- **Deadzone**: 0.3 on stick axes to prevent drift
- **Context dispatch**: `_isModalOpen()` > `_winStep > 0` > `paused` > `_isInGame()` > welcome panel

### Polling

- Uses `requestAnimationFrame` loop (started on `gamepadconnected`, stopped on `gamepaddisconnected`)
- Edge detection via `_gpPrevButtons[]` — actions fire on rising edge only (button down, not held)
- No polling overhead when no gamepad is connected

### Files Modified

| File | Change |
|------|--------|
| `src/js/05a-gamepad.js` | New module (~170 lines) |
| `src/js/11-init.js` | +1 line: `_gpInit()` call after `_steamConfigReady` |

---

## Technical Notes

- No framework dependencies — vanilla JS, CSS, HTML
- Build: `src/js/*.js` concatenated → `app.js` → `app.min.js`, `src/web/*` → `dist/web/`
- Electron loads from `dist/web/` (dev) or `resources/app/` (packaged)
- Service worker for offline play (web/PWA); not needed in Electron (Steam handles updates)
- All scaling uses CSS custom properties + JS `getCellSize()` / `getPoolCellSize()`
- Keyboard controls gated by `_isInGame()` and `_isModalOpen()` checks; N key checked before modal guard
- Mobile experience unchanged — all desktop enhancements gated by `pointer: fine` or viewport width

---

## D1 Release Candidate — Manual Test Gate

**Time: 10–15 minutes. Required before every RC build.**

Automated tests cover UI purity, forbidden text, persistence, and core flows. These manual tests cover what CI can't: real hardware input and Steam Deck ergonomics.

### Steam Deck (full flow)
1. Welcome → tap Easy card → board loads
2. Play with touchscreen + physical controls
3. Win → Grade/Time/PB shown, no EXP/diamonds → Next Puzzle
4. Menu → only Profile + Help visible, 3 themes, no economy
5. Help & About → no forbidden words (hint, energy, diamond, task...)
6. Daily Challenge → start → locked on return → complete → leaderboard
7. Zen mode (Z or key binding)

### Xbox / PlayStation gamepad
1. D-pad / left stick navigates cursor
2. A = place, B = undo, X = rotate, LB/RB = cycle tiles
3. Start = pause → resume
4. Full puzzle solve with gamepad only (no keyboard/mouse)
5. Win flow navigable with gamepad (A to advance)
6. Menu/modal navigation with gamepad

### Mixed input (mid-session switching)
1. Start with gamepad → place 2 pieces
2. Switch to mouse → place 2 more → no stuck state, cursor switches
3. Switch to keyboard → arrows work, cursor visible
4. Switch back to gamepad → D-pad works, no ghost cursors
5. Do the above during: a modal, the win overlay, and pause screen

### Edge cases
- Force-quit during Daily Challenge → reopen → that difficulty shows locked
- Offline → Daily card shows offline message, level play still works
- Rapid theme switching during gameplay → no visual glitch
- Window resize during gameplay → board rescales, no overflow
