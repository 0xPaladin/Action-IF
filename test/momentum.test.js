import { describe, test, expect } from "bun:test";
import {
  addMomentum,
  spendMomentum,
  canSpendMomentum,
  resetMomentum,
  momentumFromOutcome,
} from "../src/momentum.js";

function makeState(initial = 0) {
  return { momentum: initial, gameLog: [] };
}

describe("addMomentum", () => {
  test("increments state.momentum by given amount", () => {
    const state = makeState(2);
    addMomentum(state, 3);
    expect(state.momentum).toBe(5);
  });

  test("works when momentum is 0", () => {
    const state = makeState(0);
    addMomentum(state, 1);
    expect(state.momentum).toBe(1);
  });

  test("creates gameLog if missing", () => {
    const state = { momentum: 0 };
    addMomentum(state, 1);
    expect(state.momentum).toBe(1);
    expect(state.gameLog).toBeDefined();
    expect(state.gameLog).toHaveLength(1);
  });
});

describe("spendMomentum", () => {
  test("decrements state.momentum when sufficient", () => {
    const state = makeState(5);
    const result = spendMomentum(state, 2);
    expect(result).toBe(true);
    expect(state.momentum).toBe(3);
  });

  test("returns false when insufficient", () => {
    const state = makeState(1);
    const result = spendMomentum(state, 2);
    expect(result).toBe(false);
    expect(state.momentum).toBe(1);
  });

  test("spending exactly the amount works", () => {
    const state = makeState(2);
    const result = spendMomentum(state, 2);
    expect(result).toBe(true);
    expect(state.momentum).toBe(0);
  });

  test("spending 0 does nothing and returns true", () => {
    const state = makeState(2);
    const result = spendMomentum(state, 0);
    expect(result).toBe(true);
    expect(state.momentum).toBe(2);
  });
});

describe("canSpendMomentum", () => {
  test("returns true when sufficient", () => {
    expect(canSpendMomentum(makeState(5), 3)).toBe(true);
  });

  test("returns true when exactly enough", () => {
    expect(canSpendMomentum(makeState(2), 2)).toBe(true);
  });

  test("returns false when insufficient", () => {
    expect(canSpendMomentum(makeState(1), 2)).toBe(false);
  });

  test("handles undefined momentum", () => {
    expect(canSpendMomentum({}, 1)).toBe(false);
  });
});

describe("resetMomentum", () => {
  test("sets momentum to 2", () => {
    const state = makeState(99);
    resetMomentum(state);
    expect(state.momentum).toBe(2);
  });

  test("overwrites whatever value was there", () => {
    const state = makeState(0);
    resetMomentum(state);
    expect(state.momentum).toBe(2);
  });
});

describe("momentumFromOutcome", () => {
  test("critical returns 3", () => {
    expect(momentumFromOutcome("critical")).toBe(3);
  });

  test("full returns 2", () => {
    expect(momentumFromOutcome("full")).toBe(2);
  });

  test("partial returns 1", () => {
    expect(momentumFromOutcome("partial")).toBe(1);
  });

  test("failure returns 0", () => {
    expect(momentumFromOutcome("failure")).toBe(0);
  });

  test("unknown outcome returns 0", () => {
    expect(momentumFromOutcome("unknown")).toBe(0);
  });
});
