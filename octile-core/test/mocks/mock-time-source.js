import { TimeSource } from '../../src/interfaces/time-source.js';

/**
 * Mock TimeSource for testing
 * Allows manual time advancement and lifecycle simulation
 */
export class MockTimeSource extends TimeSource {
  isPauseAware = true; // Mock supports lifecycle callbacks

  constructor() {
    super();
    this.time = 0;
    this.pauseCallbacks = [];
    this.resumeCallbacks = [];
  }

  now() {
    return this.time;
  }

  /**
   * Advance mock time by milliseconds
   * @param {number} ms - Milliseconds to advance
   */
  advanceTime(ms) {
    this.time += ms;
  }

  onPause(callback) {
    this.pauseCallbacks.push(callback);
  }

  onResume(callback) {
    this.resumeCallbacks.push(callback);
  }

  /**
   * Trigger pause callbacks (simulate app going to background)
   */
  triggerPause() {
    this.pauseCallbacks.forEach(cb => cb());
  }

  /**
   * Trigger resume callbacks (simulate app returning to foreground)
   */
  triggerResume() {
    this.resumeCallbacks.forEach(cb => cb());
  }
}
