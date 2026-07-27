import { describe, test, expect } from "bun:test";
import { rollDice, interpretResults, fortuneRoll } from "../src/dice.js";

describe("rollDice", () => {
  test("returns array of given length", () => {
    const r = rollDice(3);
    expect(r).toHaveLength(3);
  });

  test("each element is 1-6", () => {
    const r = rollDice(50);
    for (const d of r) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });

  test("empty array for count 0", () => {
    expect(rollDice(0)).toEqual([]);
  });
});

describe("interpretResults", () => {
  test("critical: 2+ sixes", () => {
    expect(interpretResults([6, 6])).toMatchObject({ level: "critical" });
    expect(interpretResults([6, 6, 3])).toMatchObject({ level: "critical" });
  });

  test("full: exactly one 6", () => {
    expect(interpretResults([6, 3])).toMatchObject({ level: "full" });
  });

  test("partial: no sixes but at least one 5", () => {
    expect(interpretResults([5, 3])).toMatchObject({ level: "partial" });
    expect(interpretResults([4, 5])).toMatchObject({ level: "partial" });
  });

  test("failure: no 4+", () => {
    expect(interpretResults([3, 3])).toMatchObject({ level: "failure" });
    expect(interpretResults([1, 2])).toMatchObject({ level: "failure" });
  });

  test("empty results returns failure", () => {
    expect(interpretResults([])).toMatchObject({ level: "failure" });
  });
});

describe("fortuneRoll", () => {
  test("returns pool, results, and outcome", () => {
    const r = fortuneRoll(2);
    expect(r.pool).toBe(2);
    expect(r.results).toHaveLength(2);
    expect(r.outcome).toHaveProperty("level");
  });

  test("zero pool returns empty results", () => {
    const r = fortuneRoll(0);
    expect(r.pool).toBe(0);
    expect(r.results).toEqual([]);
  });

  test("negative pool is clamped to 0", () => {
    const r = fortuneRoll(-3);
    expect(r.pool).toBe(0);
  });
});
