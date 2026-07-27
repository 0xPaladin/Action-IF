import { describe, test, expect } from "bun:test";
import { checkCondition, filterConditional, getCondition, knownConditions, registerCondition, getConditionTags } from "../src/condition.js";
import { conditionPenalty } from "../src/character.js";

describe("condition registry", () => {
  test("getCondition returns registered condition", () => {
    const cond = getCondition("exposed");
    expect(cond).not.toBeNull();
    expect(cond.id).toBe("exposed");
    expect(cond.name).toBe("Exposed");
    expect(cond.tags).toContain("surveillance");
  });

  test("getCondition returns null for unknown", () => {
    expect(getCondition("nonexistent")).toBeNull();
  });

  test("knownConditions returns all registered IDs", () => {
    const ids = knownConditions();
    expect(ids).toContain("exposed");
    expect(ids).toContain("cornered");
    expect(ids).toContain("shaken");
    expect(ids).toContain("poisoned");
    expect(ids).toContain("doomed");
    expect(ids).toContain("injured");
    expect(ids).toContain("fatigued");
    expect(ids).toContain("compromised");
    expect(ids).toContain("pinned");
    expect(ids.length).toBe(9);
  });

  test("getConditionTags returns tags for registered condition", () => {
    expect(getConditionTags("exposed")).toEqual(["surveillance", "perception", "outdoor", "urban"]);
  });

  test("getConditionTags returns empty array for unknown", () => {
    expect(getConditionTags("nonexistent")).toEqual([]);
  });

  test("registerCondition adds a custom condition", () => {
    registerCondition("custom_cond", {
      id: "custom_cond",
      name: "Custom",
      description: "A custom condition.",
      tags: ["combat", "social", "stealth", "mental"],
    });
    expect(getCondition("custom_cond")).not.toBeNull();
    expect(knownConditions()).toContain("custom_cond");
    expect(getConditionTags("custom_cond")).toEqual(["combat", "social", "stealth", "mental"]);
  });

  test("each condition has 4 tags", () => {
    for (const id of knownConditions()) {
      const cond = getCondition(id);
      expect(cond.tags.length).toBe(4);
    }
  });
});

describe("conditionPenalty", () => {
  test("registered condition triggers -1d when its tags match scene tags", () => {
    const c = { conditions: ["exposed"], actions: {} };
    expect(conditionPenalty(c, ["surveillance"])).toBe(1);
    expect(conditionPenalty(c, ["perception"])).toBe(1);
    expect(conditionPenalty(c, ["combat"])).toBe(0);
  });

  test("multiple conditions each contribute -1d when their tags match", () => {
    const c = { conditions: ["exposed", "cornered"], actions: {} };
    expect(conditionPenalty(c, ["surveillance"])).toBe(1);
    expect(conditionPenalty(c, ["surveillance", "chase"])).toBe(2);
    expect(conditionPenalty(c, ["combat"])).toBe(0);
  });

  test("unregistered condition falls back to direct string matching", () => {
    const c = { conditions: ["rattled"], actions: {} };
    expect(conditionPenalty(c, ["rattled"])).toBe(1);
    expect(conditionPenalty(c, ["combat"])).toBe(0);
  });

  test("returns 0 with no conditions or no tags", () => {
    expect(conditionPenalty({ conditions: [] }, ["combat"])).toBe(0);
    expect(conditionPenalty({ conditions: ["exposed"] }, [])).toBe(0);
  });

  test("doomed condition triggers on combat/chase/intimidating/ritual tags", () => {
    const c = { conditions: ["doomed"], actions: {} };
    expect(conditionPenalty(c, ["combat"])).toBe(1);
    expect(conditionPenalty(c, ["chase"])).toBe(1);
    expect(conditionPenalty(c, ["intimidating"])).toBe(1);
    expect(conditionPenalty(c, ["ritual"])).toBe(1);
    expect(conditionPenalty(c, ["social"])).toBe(0);
  });
});

describe("checkCondition", () => {
  test("null/undefined condition returns true", () => {
    expect(checkCondition(null, { flags: {} })).toBe(true);
    expect(checkCondition(undefined, { flags: {} })).toBe(true);
  });

  test("function condition is evaluated", () => {
    const cond = (s) => s.flags.done === true;
    expect(checkCondition(cond, { flags: { done: true } })).toBe(true);
    expect(checkCondition(cond, { flags: {} })).toBe(false);
  });

  test("flag condition checks state.flag", () => {
    expect(checkCondition({ flag: "key" }, { flags: { key: true } })).toBe(true);
    expect(checkCondition({ flag: "key" }, { flags: {} })).toBe(false);
  });

  test("notFlag condition", () => {
    expect(checkCondition({ notFlag: "bad" }, { flags: { good: true } })).toBe(true);
    expect(checkCondition({ notFlag: "bad" }, { flags: { bad: true } })).toBe(false);
  });

  test("hasItem checks character inventory", () => {
    const char = { inventory: [{ id: "sword" }] };
    expect(checkCondition({ hasItem: "sword" }, { flags: {} }, char)).toBe(true);
    expect(checkCondition({ hasItem: "key" }, { flags: {} }, char)).toBe(false);
  });

  test("notItem checks character inventory", () => {
    const char = { inventory: [{ id: "sword" }] };
    expect(checkCondition({ notItem: "key" }, { flags: {} }, char)).toBe(true);
    expect(checkCondition({ notItem: "sword" }, { flags: {} }, char)).toBe(false);
  });

  test("flagValue checks exact flag value", () => {
    expect(checkCondition({ flag: "count", flagValue: 3 }, { flags: { count: 3 } })).toBe(true);
    expect(checkCondition({ flag: "count", flagValue: 3 }, { flags: { count: 1 } })).toBe(false);
  });
});

describe("filterConditional", () => {
  test("filters items by condition", () => {
    const items = [
      { id: "a", condition: null },
      { id: "b", condition: { flag: "ok" } },
      { id: "c", condition: { flag: "nope" } },
    ];
    const result = filterConditional(items, { flags: { ok: true } });
    expect(result.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
