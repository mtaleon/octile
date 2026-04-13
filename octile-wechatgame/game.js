/**
 * Octile WeChat Mini Game (小游戏)
 * Main game lifecycle entry point
 */

import { WeChatTimeSource } from './platform/index.js';
import { MINIPACK_DATA } from './utils/minipack.js';

// Global instances (shared across scenes)
let timeSource = null;

/**
 * Game launch - called when mini game starts
 */
GameGlobal.onLaunch = function(options) {
  console.log('[Game] onLaunch', options);

  // Initialize time source for pause/resume handling
  timeSource = new WeChatTimeSource();
  GameGlobal.timeSource = timeSource;

  // Load embedded MiniPack (99 base puzzles, 792 extended)
  loadMiniPack();

  console.log('[Game] Initialization complete');
};

/**
 * Game shown - called when app returns to foreground
 */
GameGlobal.onShow = function(options) {
  console.log('[Game] onShow (返回前台)');
  if (timeSource) {
    timeSource.handleResume(); // Compensate for paused time
  }
};

/**
 * Game hidden - called when app goes to background
 */
GameGlobal.onHide = function() {
  console.log('[Game] onHide (进入后台)');
  if (timeSource) {
    timeSource.handlePause(); // Freeze time
  }
};

/**
 * Game error handler
 */
GameGlobal.onError = function(error) {
  console.error('[Game] Error:', error);
};

/**
 * Load embedded MiniPack into global buffer
 */
function loadMiniPack() {
  try {
    const arrayBuffer = wx.base64ToArrayBuffer(MINIPACK_DATA);
    GameGlobal.miniPackBuffer = arrayBuffer;
    console.log('[Game] MiniPack loaded:', arrayBuffer.byteLength, 'bytes');
  } catch (e) {
    console.error('[Game] MiniPack load failed:', e);
  }
}
