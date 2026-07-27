import { describe, test, expect } from "bun:test";
import { createStunt, findApplicableEffects, getEffectiveActionFromEffects, applyBonusDice, getBonusTicks } from "../src/stunt.js";
import { createItem } from "../src/item.js";

describe("createStunt", () => {
  test("returns stunt with given fields", () => {
    const s = createStunt("s1", "Ability", "Does a thing", ["combat"], {
      bonusDice: 1,
    });
    expect(s.id).toBe("s1");
    expect(s.tags).toEqual(["combat"]);
    expect(s.bonusDice).toBe(1);
  });

  test("defaults to zeros", () => {
    const s = createStunt("s2", "Test", "desc");
    expect(s.bonusDice).toBe(0);
    expect(s.bonusTicks).toBe(0);
    expect(s.substituteAction).toBeNull();
  });

  test("can set bonusTicks", () => {
    const s = createStunt("s3", "Heavy", "", ["combat"], { bonusTicks: 1 });
    expect(s.bonusTicks).toBe(1);
  });

  test("can set action", () => {
    const s = createStunt("s4", "Action", "", ["combat"], { action: "Muscle", bonusDice: 1 });
    expect(s.action).toBe("Muscle");
  });

  test("action defaults to null", () => {
    const s = createStunt("s5", "No Action", "");
    expect(s.action).toBeNull();
  });
});

describe("findApplicableEffects", () => {
  test("returns effectors with overlapping tags", () => {
    const a = createStunt("a", "A", "", ["combat", "night"]);
    const b = createStunt("b", "B", "", ["social"]);
    const result = findApplicableEffects([a, b], ["combat", "outdoor"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  test("returns empty when no tags provided", () => {
    expect(findApplicableEffects([createStunt("a", "A", "", ["x"])], [])).toEqual([]);
  });

  test("filters out specialized items when character lacks the item", () => {
    const item = createItem("plasma_sword", "Plasma Sword", "", 1, ["combat"], { specialized: true, bonusDice: 1 });
    const char = { inventory: [{ id: "other_item" }] };
    const result = findApplicableEffects([item], ["combat"], char);
    expect(result).toHaveLength(0);
  });

  test("includes specialized items when character has the item", () => {
    const item = createItem("plasma_sword", "Plasma Sword", "", 1, ["combat"], { specialized: true, bonusDice: 1 });
    const char = { inventory: [{ id: "plasma_sword" }] };
    const result = findApplicableEffects([item], ["combat"], char);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("plasma_sword");
  });

  test("includes non-specialized items regardless of character", () => {
    const item = createItem("sword", "Sword", "", 1, ["combat"], { bonusDice: 1 });
    const char = { inventory: [] };
    const result = findApplicableEffects([item], ["combat"], char);
    expect(result).toHaveLength(1);
  });

  test("does not filter specialized when character is null", () => {
    const item = createItem("sword", "Sword", "", 1, ["combat"], { specialized: true, bonusDice: 1 });
    const result = findApplicableEffects([item], ["combat"]);
    expect(result).toHaveLength(1);
  });
});

describe("getEffectiveActionFromEffects", () => {
  test("returns original action when no substitute", () => {
    const char = { actions: { Sway: 2 } };
    const result = getEffectiveActionFromEffects(char, "Sway", []);
    expect(result).toEqual({ actionName: "Sway", pool: 2 });
  });

  test("returns substituted action when match found", () => {
    const char = { actions: { Sway: 2, Command: 3 } };
    const sub = createStunt("s", "S", "", [], { substituteAction: { from: "Command", to: "Sway" } });
    const result = getEffectiveActionFromEffects(char, "Command", [sub]);
    expect(result).toEqual({ actionName: "Sway", pool: 2 });
  });
});

describe("applyBonusDice", () => {
  test("sums bonus dice from applicable effects", () => {
    const a = createStunt("a", "A", "", [], { bonusDice: 1 });
    const b = createStunt("b", "B", "", [], { bonusDice: 2 });
    const result = applyBonusDice([a, b], 2);
    expect(result).toEqual({ pool: 5 });
  });

  test("no applicable effects returns base pool", () => {
    const result = applyBonusDice([], 3);
    expect(result).toEqual({ pool: 3 });
  });

  test("counts bonus when action matches", () => {
    const a = createStunt("a", "A", "", ["combat"], { action: "Muscle", bonusDice: 1 });
    const result = applyBonusDice([a], 2, "Muscle");
    expect(result).toEqual({ pool: 3 });
  });

  test("skips bonus when action does not match", () => {
    const a = createStunt("a", "A", "", ["combat"], { action: "Muscle", bonusDice: 1 });
    const result = applyBonusDice([a], 2, "Study");
    expect(result).toEqual({ pool: 2 });
  });

  test("counts bonus when no action specified (backward compat)", () => {
    const a = createStunt("a", "A", "", ["combat"], { bonusDice: 1 });
    const result = applyBonusDice([a], 2, "Study");
    expect(result).toEqual({ pool: 3 });
  });
});

describe("getBonusTicks", () => {
  test("sums bonus ticks from applicable effects", () => {
    const a = createStunt("a", "A", "", [], { bonusTicks: 1 });
    const b = createStunt("b", "B", "", [], { bonusTicks: 2 });
    expect(getBonusTicks([a, b])).toBe(3);
  });

  test("returns 0 with no applicable effects", () => {
    expect(getBonusTicks([])).toBe(0);
  });

  test("counts ticks when action matches", () => {
    const a = createStunt("a", "A", "", ["combat"], { action: "Muscle", bonusTicks: 1 });
    expect(getBonusTicks([a], "Muscle")).toBe(1);
  });

  test("skips ticks when action does not match", () => {
    const a = createStunt("a", "A", "", ["combat"], { action: "Muscle", bonusTicks: 1 });
    expect(getBonusTicks([a], "Study")).toBe(0);
  });
});
