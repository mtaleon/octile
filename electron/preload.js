const { contextBridge } = require('electron');

// Expose Steam API to the web app via window.steam
// The web app checks `if (window.steam)` before calling these
contextBridge.exposeInMainWorld('steam', {
  platform: 'steam',

  unlockAchievement: (id) => {
    try {
      const steamworks = require('steamworks.js');
      steamworks.achievement.activate(id);
      return true;
    } catch (_) {
      return false;
    }
  },

  isAchievementUnlocked: (id) => {
    try {
      const steamworks = require('steamworks.js');
      return steamworks.achievement.isActivated(id);
    } catch (_) {
      return false;
    }
  },
});
