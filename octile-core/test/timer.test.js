import { Timer } from '../src/game/timer.js';
import { MockTimeSource } from './mocks/mock-time-source.js';

describe('Timer', () => {
  test('starts and tracks elapsed time', () => {
    const timeSource = new MockTimeSource();
    const timer = new Timer(timeSource);

    timer.start();
    timeSource.advanceTime(5000); // 5 seconds

    expect(timer.getElapsedSeconds()).toBe(5);
    expect(timer.getElapsedMs()).toBe(5000);
  });

  test('pause and resume preserves elapsed time', () => {
    const timeSource = new MockTimeSource();
    const timer = new Timer(timeSource);

    timer.start();
    timeSource.advanceTime(3000); // 3 seconds
    timer.pause();

    timeSource.advanceTime(10000); // 10 seconds (should not count)
    expect(timer.getElapsedSeconds()).toBe(3);

    timer.resume();
    timeSource.advanceTime(2000); // 2 more seconds
    expect(timer.getElapsedSeconds()).toBe(5);
  });

  test('auto-pause on platform lifecycle', () => {
    const timeSource = new MockTimeSource();
    const timer = new Timer(timeSource);

    timer.start();
    timeSource.advanceTime(3000);

    timeSource.triggerPause(); // Simulate app going to background
    timeSource.advanceTime(10000);

    expect(timer.getElapsedSeconds()).toBe(3); // Time frozen during pause
  });

  test('reset clears all timer state', () => {
    const timeSource = new MockTimeSource();
    const timer = new Timer(timeSource);

    timer.start();
    timeSource.advanceTime(5000);
    timer.reset();

    expect(timer.getElapsedSeconds()).toBe(0);
    expect(timer.started).toBe(false);
  });

  test('getElapsedMs provides millisecond precision', () => {
    const timeSource = new MockTimeSource();
    const timer = new Timer(timeSource);

    timer.start();
    timeSource.advanceTime(1234); // 1.234 seconds

    expect(timer.getElapsedSeconds()).toBe(1); // Floored to 1 second
    expect(timer.getElapsedMs()).toBe(1234); // Full precision
  });
});
