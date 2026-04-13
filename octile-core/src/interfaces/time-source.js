/**
 * TimeSource interface for Timer
 * Platform implementations: web (Date.now + visibilitychange), WeChat (Date.now + onHide/onShow)
 */
export class TimeSource {
  /**
   * Whether this time source compensates for pause/resume lifecycle.
   * Useful for debugging and logging.
   * - true: WeChat (compensates for onHide/onShow time gaps)
   * - false: Simple Date.now() wrapper (no lifecycle handling)
   */
  isPauseAware = false;

  /**
   * Get current time in milliseconds
   * @returns {number} Millisecond timestamp (monotonic, compensated for pauses if isPauseAware)
   */
  now() {
    throw new Error('TimeSource.now() not implemented');
  }

  /**
   * Register callback for app going to background
   * @param {Function} callback - Callback function () => void
   */
  onPause(callback) {
    // Override in implementation
  }

  /**
   * Register callback for app returning to foreground
   * @param {Function} callback - Callback function () => void
   */
  onResume(callback) {
    // Override in implementation
  }
}
