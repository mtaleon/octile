/**
 * WeChat Mini Game TimeSource implementation
 * Compensates for time gaps during onHide/onShow lifecycle
 */
export class WeChatTimeSource {
  isPauseAware = true; // WeChat compensates for onHide/onShow

  constructor() {
    this.baseTime = Date.now(); // For debugging/logging
    this.totalPausedDuration = 0;
    this.lastPauseTime = 0;
    this.pauseCallbacks = [];
    this.resumeCallbacks = [];
  }

  /**
   * Get current time with pause compensation
   * @returns {number} Millisecond timestamp (monotonic, excludes paused time)
   */
  now() {
    const raw = Date.now();
    const compensated = raw - this.totalPausedDuration;
    return compensated;
  }

  /**
   * Handle app going to background (called from game.js onHide)
   * Records pause timestamp and triggers callbacks
   */
  handlePause() {
    this.lastPauseTime = Date.now();
    this.pauseCallbacks.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('[WeChatTimeSource] pause callback error:', e);
      }
    });
  }

  /**
   * Handle app returning to foreground (called from game.js onShow)
   * Adds pause duration to compensation and triggers callbacks
   */
  handleResume() {
    if (this.lastPauseTime > 0) {
      const pauseDuration = Date.now() - this.lastPauseTime;
      this.totalPausedDuration += pauseDuration;
      this.lastPauseTime = 0;
      console.log('[WeChatTimeSource] Resumed after', (pauseDuration / 1000).toFixed(1), 'seconds pause');
    }
    this.resumeCallbacks.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('[WeChatTimeSource] resume callback error:', e);
      }
    });
  }

  /**
   * Register callback for pause event
   * @param {Function} callback - Callback function
   */
  onPause(callback) {
    this.pauseCallbacks.push(callback);
  }

  /**
   * Register callback for resume event
   * @param {Function} callback - Callback function
   */
  onResume(callback) {
    this.resumeCallbacks.push(callback);
  }
}
