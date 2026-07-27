import { describe, test, expect } from "bun:test";
import { createClock, tickClock, isClockFull, clockRemaining, clockProgress } from "../src/clock.js";

describe("createClock", () => {
  test("returns clock with given max and starting current", () => {
    const c = createClock(6, "test", 0);
    expect(c.max).toBe(6);
    expect(c.current).toBe(0);
    expect(c.label).toBe("test");
  });

  test("defaults to 0 current", () => {
    const c = createClock(4);
    expect(c.current).toBe(0);
  });
});

describe("tickClock", () => {
  test("advances current by given segments", () => {
    const c = createClock(6);
    tickClock(c, 3);
    expect(c.current).toBe(3);
  });

  test("caps at max", () => {
    const c = createClock(4);
    tickClock(c, 10);
    expect(c.current).toBe(4);
  });

  test("defaults to 1 segment", () => {
    const c = createClock(6);
    tickClock(c);
    expect(c.current).toBe(1);
  });
});

describe("isClockFull", () => {
  test("true when current >= max", () => {
    const c = createClock(4);
    tickClock(c, 4);
    expect(isClockFull(c)).toBe(true);
  });

  test("false when not full", () => {
    expect(isClockFull(createClock(4, "", 2))).toBe(false);
  });
});

describe("clockRemaining", () => {
  test("returns ticks left", () => {
    expect(clockRemaining(createClock(6, "", 2))).toBe(4);
  });

  test("returns 0 when full", () => {
    expect(clockRemaining(createClock(4, "", 4))).toBe(0);
  });
});

describe("clockProgress", () => {
  test("returns ratio", () => {
    expect(clockProgress(createClock(4, "", 2))).toBe(0.5);
  });

  test("0 for empty clock", () => {
    expect(clockProgress(createClock(4))).toBe(0);
  });
});
