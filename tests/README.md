# E2E Tests

End-to-end tests for Octile using [Playwright](https://playwright.dev/).

## Prerequisites

- **Node.js** 18+
- **Google Chrome** installed (tests use system Chrome, not bundled Chromium)
- **npm dependencies**: `npm install`

## Run Tests

```bash
# Run all tests
npx playwright test

# Run a specific test file
npx playwright test tests/account.spec.js

# Run tests matching a name pattern
npx playwright test -g "energy"

# Run with headed browser (visible)
npx playwright test --headed

# Run a single test file with verbose output
npx playwright test tests/account.spec.js --reporter=list
```

## Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `account.spec.js` | 28 | Account & Data section, logout confirmation, delete account flow (2-step + 5 outcomes), energy preservation across logout, energy gate, win flow z-index, offline checks |
| `energy.spec.js` | 8 | Energy max/recovery/deduction, first-free-daily, display, modal + restore |
| `economy.spec.js` | 14 | Grades (S/A/B), EXP calculation, diamonds, streaks, daily check-in |
| `achievements.spec.js` | 11 | Achievement unlock/claim, daily tasks, goals modal, reward modal |
| `profile.spec.js` | 7 | Player tiers, ranks, stats, radar chart, profile modal |
| `board.spec.js` | 8 | 11 pieces, 8x8 board, rotation, solved set, timer format |
| `levels.spec.js` | 9 | 4 difficulty levels, unlock gates, hints, PAR times |
| `navigation.spec.js` | 8 | Welcome panel, game mode enter/exit, modals, puzzle data |
| `infra.spec.js` | 6 | UUID/avatar generation, move log (anti-cheat), offline score queue |
| `i18n.spec.js` | 8 | EN/ZH translations, localStorage fallback cache, key completeness |

## Configuration

`playwright.config.js`:
- **Base URL**: `https://app.octile.eu.cc` (tests run against production)
- **Viewport**: 540×720 (mobile-first)
- **Browser**: System Chrome (`channel: 'chrome'`)
- **Timeout**: 15s per test
- **Retries**: 1 (handles flaky network-dependent tests)

## Notes

- Tests run against the **deployed production site**, not a local server. Deploy changes before running tests.
- Some tests mock network responses via `page.route()` to simulate offline, 401, 404, 500 scenarios.
- **Flaky tests**: A few tests depend on network route interception timing and may fail on first attempt but pass on retry. The `retries: 1` config handles this automatically.
- **Corporate VPN (Zscaler)**: If loopback (`127.0.0.1`) is broken, run `sudo route delete 127.0.0.1 100.64.0.1` to restore it. This is temporary — Zscaler re-adds the route on reconnect.
- **Port 9222 conflict**: Microsoft Teams may occupy port 9222. Kill it with `kill $(lsof -ti :9222)` if Chrome debug tools are needed.
- Tests use `page.evaluate()` to call app functions directly (e.g., `showProfileModal()`, `hasEnoughEnergy()`). This tests real app logic, not just DOM state.
