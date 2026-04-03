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
