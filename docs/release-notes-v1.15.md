# Release Notes — v1.15.0 (Build 23)

**Previous Android release: v1.8.1**

---

## What's New (Google Play — max 500 chars)

### English

```
What's New in v1.15:

🎯 Daily Tasks — 3 random challenges each day with diamond rewards
💎 Diamond Multiplier — 2x/3x timed buffs during happy hours or A+ streaks
🔔 Message Center — achievement history, claimable rewards, share milestones
🏆 Team League — compete in gemstone tiers (Bronze → Obsidian) with daily EXP
✉️ Magic Link Login — sign in with email, no password needed
📋 Redesigned help guide with visuals
🐛 Error reporting — tap to send feedback when something goes wrong
```

### 中文

```
v1.15 更新內容：

🎯 每日任務 — 每天 3 個隨機挑戰，完成獲得鑽石獎勵
💎 鑽石加成 — 歡樂時段或 A+ 連勝觸發 2x/3x 限時加成
🔔 訊息中心 — 成就記錄、可領取獎勵、分享里程碑
🏆 團隊聯賽 — 寶石階級競技（青銅 → 黑曜石），每日經驗值排名
✉️ 魔術連結登入 — 用電子郵件登入，無需密碼
📋 重新設計的遊戲說明頁面
🐛 錯誤回報 — 遇到問題時可一鍵回報
```

---

## Full Changelog (v1.8.1 → v1.15.0)

### New Features

**Daily Tasks**
- 3 random tasks per day from a pool of 10 (solve puzzles, earn grades, play time, try difficulties)
- Diamond rewards per task + 50💎 bonus for completing all 3
- Resets at midnight, progress bars, claim buttons
- Syncs across devices via existing push/pull

**Diamond Multiplier (2x / 3x)**
- 2x during happy hours (12:00–13:00, 20:00–21:00)
- 3x after 3 consecutive A+ grades (once per day)
- 10-minute timed buff with header countdown
- Confirmation dialog — "Maybe Later" saves to Message Center (3-day expiry)
- Exclusive: highest wins, no stacking

**Message Center**
- 14-day notification history (achievements, multipliers, streaks, level completions)
- Stores translation keys — renders in current language regardless of when saved
- Claim uncollected achievement diamonds directly from messages
- Claim saved multiplier buffs before expiry
- Share button on all messages

**Team League**
- 8 gemstone tiers: Bronze → Silver → Gold → Sapphire → Ruby → Emerald → Amethyst → Obsidian
- Dynamic team size by tier (10 → 8 → 7 → 5)
- Authenticated players only, monthly team reassignment
- Atomic `today_exp` update on score submit
- Safety zone: top 2 → promo streak, last place → demote streak, middle → neutral
- Cold-start protection: min 3 active members + min 500 EXP for promotion
- Inactive handling: 2+ days 0 EXP excluded from evaluation
- Anti-cheat: daily EXP cap (20,000)
- Settlement countdown timer, offline-aware message
- Demotion consolation: auto-send 2x multiplier

**Magic Link Login (Passwordless)**
- Email magic link replaces email/password + Google login
- 15-minute link expiry, SHA-256 hashed tokens, one-time use
- Rate limit: 5 requests / 15 min per email, 60s resend cooldown
- JWT 365-day expiry with auto-refresh at halfway (182 days)
- Platform-aware verify page: mobile deep link, desktop web redirect
- 2-minute countdown on sent screen, spam folder hint

**Feedback Form**
- Screenshot attachment (PNG/JPEG, max 5MB) with preview
- Device/OS auto-detect, version from version.json, user info pre-fill
- Sends to octileapp@googlegroups.com via backend

**Error Reporting**
- Global error handler catches unhandled JS errors + promise rejections
- User-initiated report dialog (policy-safe: never auto-sends)
- Opens feedback form with error details pre-filled
- localStorage quota safety: auto-cleans expendable data on full

### Improvements

**Auth & Security**
- Terms/privacy agreement checkbox in sign-in dialog
- Subtle sign-in hint at chapter complete, scoreboard open, profile open (once per session)
- iOS deep link support (`octile://` URL scheme in Info.plist)
- Android App Links: HTTPS intent-filter with autoVerify (pending assetlinks.json at domain root)
- Android: `getDeviceInfo` JS bridge — tap version in About for SHA-1/package info

**UI & UX**
- Splash screen: labels hidden 300ms, fade in after translations load (no English flash in zh mode)
- Redesigned help guide: emoji headers, mini board visual, tier chips, tip boxes
- Improved in-app help modal: compact controls table, grade/EXP merged table
- Close button style fixed on new modals (Daily Tasks, Messages)
- Safe-area padding on standalone HTML pages (terms, privacy, help, feedback)
- Floating point display fix in daily task progress

**Scoreboard & Leaderboard**
- Fixed duplicate leaderboard entries for multi-device users
- Single-pass leaderboard: merge all browser_uuids per user
- Display names via user_id lookup, fallback to browser_uuid

**Android Specific**
- File upload support (`onShowFileChooser`) for feedback form screenshots
- Google Sign-In debug prompt removed, normal error callback restored
- Support email updated to octileapp@googlegroups.com

**Documentation**
- Terms, privacy, help, feedback pages: bilingual en/zh toggle
- Favicon added to all standalone HTML pages
- All docs updated for magic link auth (removed Google/password references)
- how-to-play.md updated with new feature sections (en + zh)
- auth-system.md rewritten for magic link flow

### Backend

- 4 new league tables + tier constants + 3 endpoints + daily scheduler
- Magic link endpoints: `POST /auth/magic-link`, `GET /auth/magic-link/verify`
- `POST /feedback` with screenshot attachment + device field
- Atomic `today_exp` with `BEGIN IMMEDIATE` transaction
- Composite indexes for league performance
- JWT 365-day expiry, auto-refresh at halfway via `/auth/me`
- Styled error pages for expired/invalid magic links
- Email template: spam-safe wording, plain-text URL fallback

### Worker Proxy

- Added `/league/*` route
- Added `/feedback` route

---

## Version Info

- **Version**: 1.15.0
- **Build code**: 23
- **Cache**: octile-v36
- **OTA Bundle**: v23
- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 35
