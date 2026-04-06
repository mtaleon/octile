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

## Phase 4: Steam Integration (Planned)

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

### Distribution
- Wrap PWA in Electron or Tauri
- Steamworks API for achievements via native plugin
- Offline-first (SW cache already functional)
- Auto-update via Steam instead of OTA

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

## Technical Notes

- No framework dependencies — vanilla JS, CSS, HTML
- Build: `src/*.js` concatenated -> `app.js` -> `app.min.js`
- Service worker for offline play
- All scaling uses CSS custom properties + JS `getCellSize()` / `getPoolCellSize()`
- Keyboard controls gated by `_isInGame()` and `_isModalOpen()` checks
- Mobile experience unchanged — all desktop enhancements gated by `pointer: fine` or viewport width
