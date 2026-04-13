/**
 * Timer class for tracking game elapsed time
 * Uses TimeSource interface for platform-agnostic time tracking
 */
export class Timer {
  /**
   * Create a new Timer
   * @param {import('../interfaces/time-source.js').TimeSource} timeSource - Time source implementation
   */
  constructor(timeSource) {
    this.timeSource = timeSource;
    this.startTime = 0;
    this.elapsedBeforePause = 0;
    this.paused = false;
    this.started = false;

    // Register lifecycle callbacks
    timeSource.onPause(() => this.pause());
    timeSource.onResume(() => this.resume());
  }

  /**
   * Start the timer
   */
  start() {
    if (this.started) return;
    this.started = true;
    this.startTime = this.timeSource.now();
    this.elapsedBeforePause = 0;
    this.paused = false;
  }

  /**
   * Pause the timer
   */
  pause() {
    if (!this.started || this.paused) return;
    this.elapsedBeforePause = Math.floor((this.timeSource.now() - this.startTime) / 1000);
    this.paused = true;
  }

  /**
   * Resume the timer
   */
  resume() {
    if (!this.paused) return;
    this.startTime = this.timeSource.now();
    this.paused = false;
  }

  /**
   * Get elapsed time in seconds
   * @returns {number} Elapsed seconds
   */
  getElapsedSeconds() {
    if (!this.started) return 0;
    if (this.paused) return this.elapsedBeforePause;
    const ms = this.timeSource.now() - this.startTime;
    return this.elapsedBeforePause + Math.floor(ms / 1000);
  }

  /**
   * Get elapsed time in milliseconds
   * @returns {number} Elapsed milliseconds
   */
  getElapsedMs() {
    if (!this.started) return 0;
    if (this.paused) return this.elapsedBeforePause * 1000;
    return this.elapsedBeforePause * 1000 + (this.timeSource.now() - this.startTime);
  }

  /**
   * Reset the timer to initial state
   */
  reset() {
    this.started = false;
    this.paused = false;
    this.startTime = 0;
    this.elapsedBeforePause = 0;
  }
}
