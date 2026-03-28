# Player Profile Card

A skill-focused profile that prioritizes quality over quantity. A player who solved 500 puzzles brilliantly should look better than one who solved 5,000 poorly.

---

## Design Principles

- **Data-grounded**: Phase 1 uses only data we already collect — no new tracking needed
- **Skill over grind**: Radar chart uses percentages and averages, not raw counts
- **Motivation**: Encourages improving grades and tackling harder worlds, not just solving more
- **Client-first**: Profile computed locally from localStorage + one backend call, no new backend endpoints for Phase 1

---

## Data Inventory

### Already Available (no changes needed)

| Source | Data | How |
|--------|------|-----|
| Backend (per solve) | `puzzle_number`, `resolve_time`, `exp`, `diamonds`, `grade` (implicit from exp calc), `flagged` | `octile_scores` table |
| Backend (aggregated) | `total_exp`, `total_diamonds`, `puzzles_solved`, `avg_time` | Leaderboard query |
| Client localStorage | Level progress per world (`octile_level_{easy,medium,hard,hell}`) | Direct read |
| Client localStorage | `octile_exp`, `octile_diamonds` | Direct read |
| Client localStorage | `octile_streak` (count + lastDate) | Direct read |
| Client localStorage | `octile_chapters_completed` | Direct read |
| Client localStorage | `octile_months` (array of played months) | Direct read |
| Client localStorage | `octile_night_solves`, `octile_morning_solves` | Direct read |
| Client localStorage | `octile_achievements` (unlocked set) | Direct read |

### Not Available (would need new tracking)

| Data | Status | Phase |
|------|--------|-------|
| Grade distribution (% S/A/B per player) | Need new backend endpoint or client tracking | Phase 2 |
| Moves per solve | Not tracked anywhere | Phase 3 |
| Mistakes per solve | Not tracked anywhere | Phase 3 |
| Hints per solve | Only daily total, not per-solve | Phase 2 |
| Per-difficulty avg time | Need backend query or client tracking | Phase 2 |

---

## Phase 1: Client-Only Profile Card

Uses **only existing localStorage data**. No backend changes, no new endpoints.

### Card Layout

```
+------------------------------------------+
|  [Avatar]  CuteName-1234                 |
|            Rank Title  ⭐ 12,500 EXP      |
+------------------------------------------+
|                                          |
|          [Skill Radar Chart]             |
|       Speed · Mastery · Breadth          |
|      Dedication · Progress               |
|                                          |
+------------------------------------------+
|  🌿 Easy    2,400/23,008  ████░░  10%   |
|  🌊 Medium    800/22,520  ██░░░░   4%   |
|  🔥 Hard      120/31,848  █░░░░░  <1%   |
|  🟣 Nightmare   0/13,648  ░░░░░░   0%   |
+------------------------------------------+
|  🔥 7-day streak  💎 1,250  🏆 18/51    |
+------------------------------------------+
```

### Skill Radar Chart (5 axes, 0–100 scale)

All computed from existing client data:

| Axis | Definition | Calculation |
|------|-----------|-------------|
| **Speed** | How fast relative to par times | `avg_par / avg_solve_time × 100` (capped at 100). Uses weighted average across difficulties played. |
| **Mastery** | Proportion of harder worlds attempted | `(easy×1 + medium×2 + hard×3 + hell×4) / (total×4) × 100`. Weighted by solve count per difficulty. |
| **Breadth** | How many worlds actively played | `worlds_with_progress / 4 × 100`. Bonus points for deeper progress in each. |
| **Dedication** | Streak and consistency | `min(100, streak × 3 + months.length × 5)`. Rewards daily play and long-term engagement. |
| **Progress** | Total completion percentage | `total_solved / 91024 × 100`. Logarithmic scale so early progress feels meaningful: `min(100, log10(solved+1) / log10(91025) × 100)`. |

**Speed estimation** (client-side, no per-solve data): Track cumulative solve time and count in localStorage. Two new keys:
- `octile_total_time` — sum of all solve times (seconds)
- `octile_total_solves` — count of solves

Added to `checkWin()` — one line each: `+= elapsed` and `+= 1`. From these, `avg_time = total_time / total_solves`.

**Weighted par for Speed axis**: `weighted_par = sum(solves_per_level × par_per_level) / total_solves`. If no per-level solve count is available, approximate from progress ratios.

### Rank Titles (based on total EXP)

| EXP Range | Title EN | Title ZH |
|-----------|----------|----------|
| 0 – 999 | Novice | 初學者 |
| 1,000 – 4,999 | Apprentice | 見習生 |
| 5,000 – 14,999 | Puzzler | 解謎者 |
| 10,000 – 49,999 | Strategist | 策略家 |
| 50,000 – 149,999 | Expert | 專家 |
| 150,000 – 499,999 | Master | 大師 |
| 500,000+ | Grandmaster | 宗師 |

### Where It Lives

- **Settings menu**: New "Profile" button (alongside Achievements, Scoreboard)
- **Modal**: Same full-screen modal pattern as Achievements
- **Radar chart**: SVG pentagon, drawn inline (no library)

### New localStorage Keys

| Key | Type | Added in |
|-----|------|----------|
| `octile_total_time` | number (seconds) | `checkWin()` |
| `octile_total_solves` | number | `checkWin()` |

Only 2 new keys. Everything else already exists.

---

## Phase 2: Grade Tracking + Backend Stats

### Client-side grade tracking

Track per-solve grades in localStorage:

```
octile_grades = { S: 142, A: 380, B: 95 }
```

Added to `checkWin()`: increment grade counter. Enables:
- **Grade distribution** pie/bar on profile card
- **S-rate** metric: `S_count / total × 100` — replaces "Mastery" or becomes a 6th radar axis
- **Hint-free tracking**: separate counter for solves without hints

### Backend: Player stats endpoint

```
GET /octile/player/{uuid}/stats
```

Returns aggregated stats from `octile_scores`:

```json
{
  "total_exp": 12500,
  "total_diamonds": 1250,
  "puzzles_solved": 617,
  "avg_time": 45.2,
  "by_difficulty": {
    "easy": { "count": 400, "avg_time": 32.1, "total_exp": 5000 },
    "medium": { "count": 150, "avg_time": 55.3, "total_exp": 4500 },
    "hard": { "count": 60, "avg_time": 78.2, "total_exp": 2700 },
    "hell": { "count": 7, "avg_time": 120.5, "total_exp": 300 }
  },
  "grade_distribution": { "S": 142, "A": 380, "B": 95 }
}
```

This replaces client-estimated Speed with server-authoritative per-difficulty stats.

### Effort: ~1 day
- Backend endpoint: 1-2 hours
- Client grade tracking: 30 min
- Profile card update to use server data: 1-2 hours

---

## Phase 3: ELO Rating + Shareable Card (Future)

### ELO Rating System

ELO measures **relative skill**, not grind. Designed by Arpad Elo for chess, now used in LoL, Arena of Valor, FIFA, etc. Perfect for Octile's 90,000+ puzzles where we want the leaderboard to reflect pure skill.

**Why ELO over cumulative EXP**:
- EXP rewards volume: play 10,000 puzzles poorly → high EXP, high rank
- ELO rewards skill: solve 100 puzzles perfectly → ELO can surpass the 10,000-puzzle grinder
- No grinding exploit: repeating Easy puzzles gives near-zero ELO gain

**How it works for Octile**:

Each puzzle has a hidden **difficulty rating** (derived from solver backtrack count):

| Difficulty | Puzzle ELO Range |
|-----------|-----------------|
| Easy | 600 - 1000 |
| Medium | 1000 - 1500 |
| Hard | 1500 - 2200 |
| Nightmare | 2200 - 3000 |

Player starts at **ELO 1200**. After each solve:

```
New_ELO = Old_ELO + K × (Actual - Expected)

K = adjustment factor (larger for new players, smaller for stable players)
  - First 30 solves: K = 40
  - 30-100 solves: K = 20
  - 100+ solves: K = 10

Actual = performance score (0.0 to 1.0):
  - S grade: 1.0
  - A grade: 0.7
  - B grade: 0.4
  - Failed/gave up: 0.0

Expected = predicted performance based on ELO gap:
  E = 1 / (1 + 10^((Puzzle_ELO - Player_ELO) / 400))
```

**Examples**:
- High-ELO player (2000) solves Easy puzzle (800): Expected ≈ 0.99, S-grade Actual = 1.0 → gains ~0.1 ELO (almost nothing)
- Low-ELO player (1200) solves Nightmare puzzle (2500): Expected ≈ 0.05, S-grade Actual = 1.0 → gains ~38 ELO (huge jump)
- High-ELO player (2000) gets B-grade on Hard (1800): Expected ≈ 0.76, Actual = 0.4 → loses ~3.6 ELO

**Rank titles** (replace current EXP-based tiers):

| ELO Range | Title EN | Title ZH |
|-----------|----------|----------|
| < 800 | Novice | 初學者 |
| 800 - 1199 | Apprentice | 見習生 |
| 1200 - 1599 | Puzzler | 解謎者 |
| 1600 - 1999 | Strategist | 策略家 |
| 2000 - 2399 | Expert | 專家 |
| 2400 - 2799 | Master | 大師 |
| 2800+ | Grandmaster | 宗師 |

**Implementation requirements**:
- Backend: `octile_scores` already has `puzzle_number` + `resolve_time` + difficulty → can compute ELO server-side
- New DB column: `player_elo` on a player stats table (or in `OctileProgress` from auth Phase 4)
- Recalculate on each score submission: `POST /octile/score` response includes updated ELO
- Backfill: replay all historical scores in chronological order to bootstrap existing players' ELO
- Leaderboard: option to rank by ELO instead of total EXP

### Other Phase 3 Features

- **Canvas export**: Render profile card to PNG for sharing
- **Deep link**: `octile://profile/{uuid}` to view other players' cards
- **Leaderboard integration**: Tap player on leaderboard to see their card
- **Accuracy tracking**: Track moves and mistakes per solve (requires client changes)

---

## Implementation Checklist

### Phase 1 (~3-4 hours, client-only)

- [ ] Add `octile_total_time`, `octile_total_solves` tracking to `checkWin()`
- [ ] SVG radar chart renderer (5-axis pentagon, ~60 lines)
- [ ] Rank title calculation from EXP
- [ ] Profile modal HTML/CSS (match existing modal pattern)
- [ ] Profile button in settings menu
- [ ] World progress bars (reuse data from welcome panel)
- [ ] Footer stats row (streak, diamonds, achievements)
- [ ] Translation keys (EN + ZH) for rank titles and labels

### Phase 2 (~1 day, client + backend)

- [ ] Client: grade counter in localStorage, increment on win
- [ ] Backend: `GET /octile/player/{uuid}/stats` endpoint
- [ ] Worker: proxy new endpoint
- [ ] Profile card: grade distribution display
- [ ] Profile card: use server stats for Speed axis (authoritative)

### Phase 3 (future)

- [ ] Canvas-to-PNG export
- [ ] Share button integration
- [ ] ELO system design and implementation
- [ ] Per-solve move/mistake tracking
