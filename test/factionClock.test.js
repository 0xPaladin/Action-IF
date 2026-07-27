import { describe, test, expect } from "bun:test";
import { createFactionClock, tickFactionClock } from "../src/factionClock.js";

describe("createFactionClock", () => {
  test("creates faction clock with defaults", () => {
    const fc = createFactionClock("fc1", "Investigation", "The Bluecoats close in", 6);
    expect(fc.id).toBe("fc1");
    expect(fc.clock.current).toBe(0);
    expect(fc.clock.max).toBe(6);
    expect(fc.completed).toBe(false);
  });
});

describe("tickFactionClock", () => {
  test("advances clock and fires onComplete when full", () => {
    let fired = false;
    const fc = createFactionClock("fc1", "Test", "desc", 4,
      (state, clock) => { fired = true; },
    );
    const state = { factionClocks: [fc] };

    tickFactionClock(state, "fc1", 4);
    expect(fc.completed).toBe(true);
    expect(fired).toBe(true);
  });

  test("returns alreadyCompleted when ticking completed clock", () => {
    const fc = createFactionClock("fc1", "Test", "desc", 2);
    fc.completed = true;
    const state = { factionClocks: [fc] };
    const r = tickFactionClock(state, "fc1", 1);
    expect(r.alreadyCompleted).toBe(true);
    expect(r.ticked).toBe(false);
  });

  test("throws for unknown clock", () => {
    expect(() => tickFactionClock({ factionClocks: [] }, "nope")).toThrow();
  });
});
