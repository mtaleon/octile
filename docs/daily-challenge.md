# Daily Challenge -- Steam-Exclusive Feature

## Overview

Every day, 4 puzzles (one per difficulty: easy/medium/hard/nightmare) are deterministically selected for all players worldwide. Players get one attempt per difficulty per day, free (no energy), with bonus rewards and a dedicated daily leaderboard.

Available only when `window.steam` is present (Electron/Steam builds).

## Trust Model

**Daily Challenge leaderboard is fully backend-authoritative.**
Steamworks APIs are used only for achievements, stats, and optional summary displays, and are never treated as a source of truth.

- Client `getDailyChallengeSlot()` is for UI preview only
- Backend computes puzzle from date (never trusts client puzzle_number)
- Backend skips offline puzzle numbers when computing daily slot
- Score dedup: `POST /score` with `daily_challenge: true` rejects 409 if same UUID+date+level exists

## Core Rules

### Attempt = Start, Not Completion

- Pressing "Play" immediately locks that difficulty for the day
- If the player exits/crashes mid-game, the attempt is consumed (row shows "Locked", not "Play")
- Completing the puzzle: row shows "Done" with time + grade

### Cross-Midnight: Start Date Wins

- The daily date is captured at start time and stored in the try key
- If a player starts at 23:59 UTC and finishes at 00:01 UTC, it counts as yesterday's daily
- Score submission uses `_dailyDate` (from try), not current UTC date

### Online-Only

- Daily Challenge requires network (leaderboard + backend puzzle source)
- If offline: card shows "Daily Challenge requires internet" (grayed out)
- Backend response is the source of truth for puzzle number

### Streak

- Updated on first completion of any level per day
- Yesterday -> today: count + 1
- Same day completing more levels: no change to streak
- Gap > 1 day: reset count = 1
- Client-authoritative by design

## Puzzle Selection

Deterministic slot per level per day, computed identically on client (preview) and backend (authoritative):

```js
function getDailyChallengeSlot(level, dateStr) {
  var key = dateStr + ':' + level;
  var h = 2166136261;  // FNV-1a offset basis
  for (var i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  var total = _levelTotals[level] || OFFLINE_LEVEL_TOTALS_8[level];
  return ((h >>> 0) % total) + 1;
}
```

Backend skips slots that map to `OFFLINE_PUZZLE_NUMS`.

## State Management (localStorage)

| Key | Example | Purpose |
|-----|---------|---------|
| `octile_daily_try_{date}_{level}` | `{"date":"2026-04-06","slot":1234,"puzzle":56789,"startedAt":"..."}` | Attempt lock (written at start) |
| `octile_daily_done_{date}_{level}` | `{"time":45,"grade":"S","puzzle":56789}` | Completion result |
| `octile_daily_streak` | `{"count":5,"lastDate":"2026-04-06"}` | Consecutive days |

Guard logic: `hasTryOrDone(date, level) = try key exists OR done key exists`

## Welcome Panel Card

4 row states:
1. **Play** -- no try key: show "Play" button
2. **Locked** -- try key exists, no done key: show "Attempted" + lock icon
3. **Done** -- done key exists: show time + grade, tap opens leaderboard
4. **Offline** -- no network: entire card grayed, "Requires internet"

## startDailyChallenge(level) Flow

1. `date = getDailyChallengeDate()` (UTC YYYY-MM-DD)
2. If `hasTryOrDone(date, level)`: toast "Already attempted/completed today" and return
3. If `!isOnline()`: toast "Daily Challenge requires internet" and return
4. Fetch `GET /daily-challenge/puzzle?level=LEVEL&date=DATE` from backend
5. Write try key: `octile_daily_try_{date}_{level}`
6. Set flags: `_isDailyChallenge=true, _dailyChallengeLevel=level, _dailyDate=date`
7. `startGame(puzzle_number)` -- bypasses energy check entirely
8. Hide restart button
9. Re-render daily card (row now shows "Locked")

## Win Flow

When `_isDailyChallenge`:
1. EXP = `calcPuzzleExp(level, elapsed) * 2`
2. Diamonds = base + 5 bonus
3. Write done key: `octile_daily_done_{_dailyDate}_{level}` (uses start date!)
4. Update streak (only if this is first completion today)
5. Submit score with `daily_challenge: true, daily_date: _dailyDate`
6. Show reward modal: "Daily Challenge Complete!", "2x EXP + 5 bonus diamonds"
7. Disable next/restart in post-win UI

## Rewards

| Reward | Normal Puzzle | Daily Challenge |
|--------|--------------|-----------------|
| EXP | `calcPuzzleExp(level, elapsed)` | 2x |
| Diamonds | 1 (+ multiplier) | 1 + 5 bonus |
| Energy cost | 1 (or free first daily) | 0 (always free) |

## Files Modified

- `src/js/01-data.js` -- `getDailyChallengeDate()`, `getDailyChallengeSlot()`, `OFFLINE_PUZZLE_SET`
- `src/js/06-economy.js` -- `renderDailyChallengeCard()`, daily challenge state/streak helpers
- `src/js/07-game.js` -- `startDailyChallenge()`, `showDailyChallengeLeaderboard()`, checkWin mods
- `src/js/08-ui.js` -- Energy bypass, restart hide, flag reset in `returnToWelcome()`
- `src/js/04-infra.js` -- `daily_challenge` + `daily_date` in score payload
- `src/js/11-init.js` -- Leaderboard modal close handler, modal list
- `src/web/index.html` -- `#wp-daily-challenge` card, `#dc-leaderboard-modal`
- `src/web/style.css` -- Card styles, leaderboard modal, mobile fullscreen
- `src/web/translations.json` -- EN + ZH keys
- `workers/octile-proxy/index.js` -- Proxy `/daily-challenge/*` to backend

## Backend Endpoints (separate PR in xsw repo)

- `GET /daily-challenge/puzzle?level=LEVEL&date=YYYY-MM-DD` -- returns `{puzzle_number, cells, slot, level}`
- `GET /daily-challenge/scoreboard?level=LEVEL&date=YYYY-MM-DD&limit=50` -- top scores
- Score dedup: `POST /score` with `daily_challenge: true` rejects 409 if same UUID+date+level exists
