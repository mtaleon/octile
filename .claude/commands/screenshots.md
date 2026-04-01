Take mobile screenshots of all Octile app screens in both English and Chinese.

## Prerequisites
- Chrome must be running with `--remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile`
- If DevToolsActivePort file missing, create it: read port from `curl -s http://localhost:9222/json/version` and write to `~/Library/Application Support/Google/Chrome/DevToolsActivePort`
- Local dev server running at http://localhost:8080

## Setup
1. Navigate to http://localhost:8080
2. Set mobile viewport via CDP WebSocket: width=393, height=852, deviceScaleFactor=3, mobile=true
3. Reload page and wait for load

## Screenshots to capture (for EACH language: en, zh)

For each language, save to `docs/png/app/{lang}/`:

| # | Screen | Filename | How to get there |
|---|--------|----------|-----------------|
| 1 | Splash | `splash.png` | Fresh page load (before dismissing) |
| 2 | Welcome | `welcome.png` | Dismiss splash, wait for level data to load |
| 3 | Gameplay | `gameplay.png` | Click Easy level card, wait for board |
| 4 | Menu | `menu.png` | Click settings gear, hide debug section |
| 5 | How to Play | `howtoplay.png` | From menu, click How to Play |
| 6 | About | `about.png` | Close help, open story modal |
| 7 | Scoreboard | `scoreboard.png` | Call `showScoreboardModal()`, wait 3s for data |
| 8 | Achievements | `achievements.png` | Set `_achieveTab='main'`, call `renderAchieveModal()`, show modal |
| 9 | Calendar | `calendar.png` | Set `_achieveTab='calendar'`, call `renderAchieveModal()` |
| 10 | Energy | `energy.png` | Call `showEnergyModal(false)` |
| 11 | Paused | `paused.png` | Force start timer, then call `pauseGame()` |
| 12 | LEGO theme | `theme-lego.png` | Call `setTheme('lego')`, start easy level |
| 13 | Wood theme | `theme-wood.png` | Call `setTheme('wood')`, start easy level |
| 14 | Chapter Grid | `chaptergrid.png` | Call `openChapterGrid('easy')` |
| 15 | Puzzle Path | `puzzlepath.png` | Call `openPuzzlePath('easy', 0)` |
| 16 | Profile | `profile.png` | Call `showProfileModal()` |
| 17 | Daily Tasks | `dailytasks.png` | Call `showDailyTasksModal()` |
| 18 | Messages | `messages.png` | Inject sample messages, call `showMessagesModal()` |
| 19 | Multiplier Confirm | `multiplier-confirm.png` | Call `showMultiplierConfirm(2)` |
| 20 | Multiplier Active | `multiplier-active.png` | Start easy level, call `activateMultiplier(2)` |
| 21 | Team League | `league.png` | Open scoreboard, call `switchSbTab('league')` |

## Language switching
- English: `currentLang='en'; applyLanguage();`
- Chinese: `currentLang='zh'; applyLanguage();`
- After switching, re-render any open modal before capturing

## Process for each language
1. Set language via evaluate_script
2. Reload page to get fresh state
3. Set mobile viewport via CDP
4. Capture all 21 screenshots in order
5. Reset to classic theme before switching language

## After capturing
- Reset theme to classic: `setTheme('classic')`
- Reset language to English: `currentLang='en'; applyLanguage();`
- Clear CDP device metrics override
- List all captured files with sizes

## Output
Total: 42 screenshots (21 × 2 languages) in `docs/png/app/en/` and `docs/png/app/zh/`

## Automated script
Run `SCREENSHOT_URL=http://localhost:5500 node scripts/take-screenshots.js` to capture all screenshots automatically via Puppeteer at 1280×800 @2x.
