# E2E Tests

End-to-end tests for Octile using [Playwright](https://playwright.dev/).

## Prerequisites

- **Node.js** 18+
- **Google Chrome** installed (tests use system Chrome, not bundled Chromium)
- **npm dependencies**: `npm install`

## Run Tests

```bash
# Run all tests (~11 min)
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

## Test Files (215 tests across 19 files)

### Identity & Data (48 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `account.spec.js` | 28 | Account & Data section, logout confirm, delete flow (2-step + 5 outcomes), energy preservation, energy gate, win flow z-index, offline checks |
| `account-advanced.spec.js` | 20 | Delete irreversibility, logout vs delete data retention, 401 session expiry, multi-click protection, reward idempotency, grade regression pinning, diamond balance consistency |

### Migration & Sync (32 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `migration.spec.js` | 18 | Corrupt/legacy JSON resilience (energy, grades, streak, achievements, tasks, messages, auth, checkin, translations), key preservation across logout |
| `identity.spec.js` | 14 | MAX merge (levels, EXP, diamonds, grades), union merge (achievements, solved set, themes, months), UUID priority, best time MIN merge |

### Economy & Rewards (35 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `economy.spec.js` | 14 | Grades (S/A/B with hint dependency), EXP base/multiplier, diamonds, streaks, daily check-in |
| `achievements.spec.js` | 13 | Achievement unlock/claim idempotency, daily tasks (deterministic seed, counters, claim), goals modal, reward modal (backdrop click) |
| `energy.spec.js` | 8 | Energy max/recovery/deduction, first-free-daily, display, modal + restore button |

### Time-Dependent (19 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `time.spec.js` | 19 | Daily resets (energy, tasks, hints, checkin, counters), energy recovery curves (2h/4h/10h/24h/cap), streak edge cases (yesterday/2-days-ago/today/empty/corrupt), multiplier expiry |

### Board & Gameplay (17 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `board.spec.js` | 8 | 11 pieces, 8x8 board, rotation, solved set, timer format |
| `board-advanced.spec.js` | 9 | Placement constraints (out-of-bounds, overlap, valid), win detection, piece reset on new game, timer state, solved set integrity |

### Profile & Stats (19 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `profile.spec.js` | 8 | Tiers, ranks, rank colors, radar chart, profile modal open/close |
| `profile-advanced.spec.js` | 11 | New player empty state, tier transitions (new→active→expert), stats source consistency, extreme values (high EXP/streak, energy bounds) |

### Navigation & Modals (22 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `navigation.spec.js` | 11 | Welcome panel, game mode enter/exit, modals (scoreboard, messages, settings), puzzle data |
| `navigation-advanced.spec.js` | 11 | Modal close (no ghost overlays), modal stacking, rapid navigation race conditions, offline score queue (FIFO, persist), tutorial state |

### i18n & Formatting (21 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `i18n.spec.js` | 10 | EN/ZH translation, localStorage fallback cache, key completeness for account/delete keys |
| `i18n-advanced.spec.js` | 11 | Dynamic language switch (no reload), html lang attribute, fallback rules (missing zh→en, missing both→key), number/time format consistency, ZH text length safety |

### Accessibility (14 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `a11y.spec.js` | 14 | Modal roles (dialog/aria-modal), close button aria-labels, keyboard focusability, semantic HTML (single h1, html lang, img alt, button labels) |

### Levels & Infrastructure (19 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `levels.spec.js` | 11 | 4 difficulty levels, unlock gates, level progress read/write, chapter sizes, PAR times, hints (count, max, rollover) |
| `infra.spec.js` | 8 | UUID/avatar (deterministic), move log anti-cheat (record, encode), offline score queue |

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
- Tests use `page.evaluate()` to call app functions directly (e.g., `showProfileModal()`, `hasEnoughEnergy()`), testing real app logic.
- **Flaky tests**: ~8 tests depend on network route interception timing and may fail on first attempt but pass on retry. The `retries: 1` config handles this automatically.
- **Corporate VPN (Zscaler)**: If loopback (`127.0.0.1`) is broken, run `sudo route delete 127.0.0.1 100.64.0.1` to restore it. Temporary — Zscaler re-adds the route on reconnect.
- **Port 9222 conflict**: Microsoft Teams may occupy port 9222. Kill it with `kill $(lsof -ti :9222)` if Chrome debug tools are needed.
- **Test isolation**: Each test resets relevant localStorage keys in its setup. No cross-test state sharing.
- **Adding tests**: Place new `.spec.js` files in `tests/`. Use `page.evaluate()` to call app functions. Follow existing patterns for `beforeEach` (goto + wait).
