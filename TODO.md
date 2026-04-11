# Octile TODO - Future Releases

## Bugs to Fix

### Normal Puzzle Keyboard Hint Invisible
**Issue:** Normal (non-DC) puzzles have `<kbd>N</kbd>` hint invisible after recent changes
**Context:** 
- DC correctly hides Next button + kbd hint ✅
- But normal puzzles should show kbd hint ❌ currently invisible
**Root Cause:** Likely CSS or display style regression from today's fix
**Priority:** Medium (functional but UX degraded)
**Files to check:**
- `src/js/07-game.js:977-981` - Show logic
- `src/web/style.css` - kbd hint styles
**Created:** 2026-04-11

---

## Verified Fixes (2026-04-11)

1. ✅ DC "N" key blocked, kbd hint hidden in DC
2. ✅ 23008 bug fixed (shows 2876 for puzzleSet 11378)
3. ✅ Score submission enabled in pure mode
4. ✅ DC puzzle number mismatch fixed (backend API authoritative)
5. ✅ Multiplier events no longer trigger in pure mode
6. ✅ All notifications disabled in D1/pure/demo mode (no meta-game interruptions)
