# Octile TODO

## Open

### In-App Coupon System

**Goal:** Let admins distribute promo codes that grant diamonds, energy, themes, or multipliers. Auth required.

**Backend** (`xsw/octile_api.py`):
- `OctileCoupon` model: code, reward_type (diamonds/energy/theme/multiplier), reward_amount, reward_detail, max_uses, expires_at, is_active
- `OctileCouponRedemption` model: coupon_id, user_id (unique constraint)
- `POST /coupon/redeem` (auth required) — validate code, check expiry/max uses/already redeemed, apply reward
- `POST /coupon/create` (admin key header) — create coupon, auto-generate code if empty

**Worker** (`workers/octile-proxy/index.js`):
- Add `/coupon/` route to `proxyAuthToBackend`

**Client** (`src/08-ui.js`, `index.html`, `translations.json`):
- Nav button in settings modal (after Messages, before Profile)
- `#coupon-modal` with text input + redeem button + status
- `showCouponModal()`, `redeemCoupon(code)` — POST to API, apply reward locally (addDiamonds/unlockTheme/addClaimableMultiplier), show toast
- ~10 translation keys (en + zh)

**Priority:** Low — nice-to-have for growth, no users asking yet
**Effort:** High (4-6h) — backend model + migration + API + worker + client UI

### Magic Link Email — Respect User Language

~~Backend sends magic link emails in English only.~~ Email already sends `lang: currentLang`. Verify page localized in `xsw/octile_api.py` (lang stored on OctileMagicLink, used in verify endpoint). Mobile redirect shows "return to app" instead of opening web session. **Needs backend deploy.**

### Steam D1 — Subtraction-First Release

**Goal:** Ship only the essence — puzzle + daily ritual. Strip all economy/meta systems on Electron.

**What stays:** Core puzzle (4 difficulties, level/chapter/puzzle), Daily Challenge (1 attempt, no hints, speed leaderboard), 3 free themes (Classic/LEGO/Wood), keyboard/mouse/gamepad, zen mode, minimal profile, feedback form.

**What goes (Electron only):** Diamonds, EXP display, energy, streak stats, achievements, daily tasks, check-in, multiplier, league, inbox, ELO/radar, global scoreboard, auth/sign-in, hints, paid themes. All invisible — no trace in UI.

**Key design decisions:**
- `_steamFeature()` returns `false` on non-Electron (not `true`) — web/mobile use own code paths, no accidental coupling
- `auth` hidden on Electron via `_isElectron` guard (not config.json) — cookie UUID/SteamID for leaderboard identity
- Hints = 0 on Electron — no hint button, no hint key, no hint text. Thinking game.
- Puzzle set: v0 (11378) on Electron, v1 (91024) on web/mobile. Set at runtime via `_appConfig.puzzleSet = 11378`.
- Scores submitted silently (backend collects), but no global scoreboard UI on D1
- Win flow: grade + time + personal best only. No economy rewards.

**Implementation:** Done. 11 files modified, 25 new tests passing.

### Steam Demo (before D1)

**Goal:** Pre-release demo for Steam Next Fest / store page. Subtraction-first — identical to D1 UX.

**Content:**
- Offline 88 puzzles (existing `OFFLINE_PUZZLE_NUMS`)
- All 4 difficulties (Easy / Medium / Hard / Nightmare)
- Flow identical to D1: difficulty → chapter → puzzle → win → next

**Behavior (must match D1):**
- Hints = 0 (no hint button, no hint text anywhere)
- Zero economy UI (no diamonds/EXP/energy/tasks/achievements/check-in)
- Gamepad fully playable (Steam Deck ready)
- Win flow: Grade / Time / Personal Best / Next only

**Demo limits (natural buy motivation):**
- Limit chapter depth per difficulty (e.g. first N chapters only)
- "Full game includes the complete puzzle library + Daily Challenge (global)" in menu or after milestone
- No roadmap, no "coming soon", no D30/D60 mentions

**Demo CTA (after ~10 solves or first Hard completion):**
> Thanks for playing the demo.
> The full game adds the complete puzzle library + the Daily Challenge ritual on Steam.
> [Get the full game]
- Tone: calm, not salesy.

**Pitfalls to avoid:**
- A: Demo too generous — 88 puzzles is plenty. Limit progression depth so demo doesn't feel "enough"
- B: Any "mobile smell" (diamond, EXP bar, check-in, achievement toast) → player classifies as "system game" not "thinking game"

**Implementation:** Build on D1 codebase. Add `_isDemoMode` flag (Electron + env var or config). Limit `getEffectiveLevelTotal()` per difficulty. Add CTA modal triggered by solve count milestone.

**Priority:** Medium — needed before D1 store launch
**Effort:** Low (2-3h) — D1 subtraction already does 90% of the work

### Google OAuth — Blocked by Appeal

Google Cloud Console account under appeal. Once resolved:
- Add `https://app.octile.eu.cc` to authorized JS origins
- Add `https://api.octile.eu.cc/auth/google/callback` to redirect URIs
- Set `OCTILE_GOOGLE_REDIRECT_URI` in backend env + redeploy
- Re-enable Google auth in UI

---

## Done

### ✅ Onboarding Tutorial — Day 1 Script (2026-04-04)

9-step tutorial: fill board → rotation → rating unlock → goal-setting → hint system → daily progress → locked feature teaser → sign-in prompt → closing. Step-based tracking via `octile_tut_step`. Each hint shown once, non-intrusive tooltips/toasts. 17 new translation keys (en+zh).

### ✅ EXP Sync Mismatch (2026-04-04)

Changed sync reconciliation from `>` to `Math.max(server, local)` with proper type check. Server `score_exp`/`score_diamonds` from OctileScore table are authoritative after push+pull.

### ✅ Feedback Mail — Add Origin Field (2026-04-04)

Added `origin` (window.location.origin) to feedback payload. Backend model + email body updated.

### ✅ Safari / iOS ITP Fix (2026-04-03)

Migrated to same-site domains: `app.octile.eu.cc` (GitLab Pages) + `api.octile.eu.cc` (Worker).
GitHub Actions auto-deploys to GitLab on push to gh-pages.

### ✅ Unclaimed Reward Notifications (2026-04-03)

`checkUnclaimedRewards()` detects missed check-in, claimable tasks, unclaimed achievements.
Red pulsing `.settings-dot` on gear icon. Reminder toast once per type per session.

### ✅ Enriched Web App Graphics (2026-04-03)

Canvas particle FX engine, CSS grade reveal/shimmer/snap animations, WAAPI counter animations.

### ✅ Security Hardening (2026-04-03)

Frontend: picture URL XSS, onclick injection, prototype pollution, CORS whitelist, JSON.parse safety.
Backend: JWT 30-day expiry, OTP brute-force rate limit, score dedup, error leak fix, postMessage origin.
See `docs/security-practices.md`.

### ✅ Split app.js into src/ Modules (2026-04-03)

12 source files in `src/`, `scripts/build.sh` concatenates + minifies. `app.js` gitignored as build artifact.
