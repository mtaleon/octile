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
| 4 | Menu | `menu.png` | Click settings gear, hide debug section (`document.getElementById('debug-section').style.display='none'`) |
| 5 | How to Play | `howtoplay.png` | From menu, click How to Play |
| 6 | About | `about.png` | Close help, open story modal |
| 7 | Scoreboard | `scoreboard.png` | Call `showScoreboardModal()`, wait 3s for data |
| 8 | Achievements | `achievements.png` | Set `_achieveTab='main'`, call `renderAchieveModal()`, show modal |
| 9 | Progress | `progress.png` | Set `_achieveTab='progress'`, call `renderAchieveModal()` |
| 10 | Calendar | `calendar.png` | Set `_achieveTab='calendar'`, call `renderAchieveModal()` |
| 11 | Energy | `energy.png` | Call `showEnergyModal(false)` |
| 12 | Paused | `paused.png` | Force start timer, then call `pauseGame()` |
| 13 | LEGO theme | `theme-lego.png` | Call `setTheme('lego')`, close modals |
| 14 | Wood theme | `theme-wood.png` | Call `setTheme('wood')` |

## Language switching
- English: `currentLang='en'; applyLanguage();`
- Chinese: `currentLang='zh'; applyLanguage();`
- After switching, re-render any open modal before capturing

## Process for each language
1. Set language via evaluate_script
2. Reload page to get fresh state
3. Set mobile viewport via CDP
4. Capture all 14 screenshots in order
5. Reset to classic theme before switching language

## After capturing
- Reset theme to classic: `setTheme('classic')`
- Reset language to English: `currentLang='en'; applyLanguage();`
- Clear CDP device metrics override
- List all captured files with sizes

## Output
Total: 28 screenshots (14 × 2 languages) in `docs/png/app/en/` and `docs/png/app/zh/`
