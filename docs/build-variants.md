# Steam Build Variants

The Octile project supports 3 distinct macOS builds for different distribution channels.

## Variants

### 1. Octile Demo (`Octile-Demo-*.dmg`)
**Purpose**: Steam demo build with limited content
**Bundle ID**: `cc.eu.octile.game.demo`

**Features**:
- ✗ No auth
- ✗ No economy (diamonds, energy)
- ✗ No daily tasks
- ✗ No daily challenge
- ✓ Puzzle caps: Easy 50, Medium 20, Hard 10, Hell 5
- ✓ CTA modal after 10 solves
- ✓ Puzzle set 11378 (v0)

### 2. Octile D1 (`Octile-D1-*.dmg`)
**Purpose**: D1 release (Desktop Essentials)
**Bundle ID**: `cc.eu.octile.game.d1`

**Features**:
- ✗ No auth
- ✗ No economy (diamonds, energy)
- ✗ No daily tasks
- ✓ Daily challenge enabled
- ✓ Full puzzle access (no caps)
- ✓ Puzzle set 11378 (v0)

### 3. Octile Pure (`Octile-Pure-*.dmg`)
**Purpose**: Production release test (cleanest experience)
**Bundle ID**: `cc.eu.octile.game.pure`

**Features**:
- ✗ No auth
- ✗ No economy (diamonds, energy)
- ✗ No daily tasks
- ✗ No daily challenge
- ✓ Full puzzle access (no caps)
- ✓ Puzzle set 11378 (v0)

## Building Locally

### Build All Variants
```bash
./scripts/build-electron.sh all
```

Output:
- `electron/dist/Octile-Demo-2.0.0.dmg`
- `electron/dist/Octile-D1-2.0.0.dmg`
- `electron/dist/Octile-Pure-2.0.0.dmg`

### Build Single Variant
```bash
./scripts/build-electron.sh demo   # Demo only
./scripts/build-electron.sh d1     # D1 only
./scripts/build-electron.sh pure   # Pure only
```

Or via npm:
```bash
cd electron
npm run build:demo
npm run build:d1
npm run build:pure
```

## CI/CD

GitHub Actions automatically builds all 3 variants on push to `main`.

**Artifacts** (90-day retention):
- `octile-demo-mac` → `Octile-Demo-*.dmg`
- `octile-d1-mac` → `Octile-D1-*.dmg`
- `octile-pure-mac` → `Octile-Pure-*.dmg`

## Configuration Details

### Config Files
- `electron/configs/config.demo.json` - Demo mode with level caps
- `electron/configs/config.d1.json` - D1 mode with daily challenge
- `electron/configs/config.pure.json` - Pure mode (cleanest)

### Key Config Differences

| Setting | Demo | D1 | Pure |
|---------|------|----|----- |
| `demo` flag | `true` | - | - |
| `pure` flag | - | - | `true` |
| `demoCaps` | 50/20/10/5 | - | - |
| `features.daily_challenge` | `false` | `true` | `false` |

### Mode Flags Contract

- **`demo: true`** and **`pure: true`** are **mutually exclusive**
- A build MUST NOT enable both flags at the same time
- `demo: true` → level caps + CTA modal (Steam demo distribution)
- `pure: true` → cleanest experience (production testing)

### Implicit Behavior (Future Config Candidates)

These values are currently hardcoded in the application code:

1. **Demo CTA threshold**: CTA modal appears after **10 solves** (hardcoded in `src/js/07-game.js`)
   - Future config candidate: `"demoCtaAfterSolves": 10`

2. **Block Unsolved**: All 3 variants use `features.blockUnsolved: false`
   - This is correct for Steam builds (full access model)
   - If future variants need "visible but locked" puzzles, adjust this flag

### Code Changes Required

**`src/js/01-data.js`**: Update `getEffectiveLevelTotal()` to read `config.demoCaps` for configurability.

## Verification Checklist

### Demo Build
- [ ] Puzzle caps enforced (Easy=50, Medium=20, Hard=10, Hell=5)
- [ ] CTA modal appears after 10 solves
- [ ] NO Daily Challenge card on welcome panel
- [ ] NO auth (no sign-in button)

### D1 Build
- [ ] NO puzzle caps (full access)
- [ ] Daily Challenge card visible on welcome panel
- [ ] NO CTA modal
- [ ] NO auth

### Pure Build
- [ ] NO puzzle caps
- [ ] NO Daily Challenge card
- [ ] NO CTA modal
- [ ] NO auth
- [ ] Cleanest puzzle-only experience
