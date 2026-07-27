import { describe, test, expect } from "bun:test";
import { actionRoll, resistanceRoll } from "../src/action.js";
import { createCharacter } from "../src/character.js";

describe("actionRoll", () => {
  test("returns roll result with all fields", () => {
    const c = createCharacter("Luna");
    c.actions.Sway = 2;
    const r = actionRoll(c, "Sway");
    expect(r.action).toBe("Sway");
    expect(r.pool).toBe(2);
    expect(r.results).toHaveLength(2);
    expect(r.outcome).toHaveProperty("level");
  });

  test("throws for unknown action", () => {
    expect(() => actionRoll(createCharacter("Luna"), "Bogus")).toThrow();
  });

  test("applies bonus dice and body penalty", () => {
    const c = createCharacter("Luna");
    c.actions.Notice = 1;
    c.body = 3;
    const r = actionRoll(c, "Notice", 3);
    expect(r.pool).toBe(3);
  });

  test("penalty dice reduce pool", () => {
    const c = createCharacter("Luna");
    c.actions.Notice = 3;
    const r = actionRoll(c, "Notice", 0, 5);
    expect(r.pool).toBe(0);
  });
});

describe("resistanceRoll", () => {
  test("returns pool, results, reduction", () => {
    const c = createCharacter("Luna");
    c.actions.Muscle = 3;
    const r = resistanceRoll(c);
    expect(r.pool).toBe(3);
    expect(r.results).toHaveLength(3);
    expect(r.reduction).toBeGreaterThanOrEqual(0);
    expect(r.stressCost).toBeUndefined();
  });
});
