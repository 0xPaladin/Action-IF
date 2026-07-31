/**
 * ### Clock
 *
 * `clock.js` implements generic progress clocks:
 * - `createClock(max, label, current)` → creates a clock object
 * - `tickClock(clock, segments)` → advances the clock
 * - `isClockFull(clock)` → checks if clock is complete
 * - `clockRemaining(clock)` → returns remaining segments
 * - `clockProgress(clock)` → returns progress ratio (0-1)
 */
export function createClock(max, label = "", current = 0) {
  return { max, current, label };
}

export function tickClock(clock, segments = 1) {
  clock.current = Math.min(clock.max, clock.current + segments);
  return clock;
}

export function isClockFull(clock) {
  return clock.current >= clock.max;
}

export function clockRemaining(clock) {
  return Math.max(0, clock.max - clock.current);
}

export function clockProgress(clock) {
  return clock.current / clock.max;
}
