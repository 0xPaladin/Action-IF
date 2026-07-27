import { describe, test, expect } from "bun:test";
import { createCharacter } from "../src/character.js";
import { createCrew } from "../src/crew.js";
import { applyConsequence, registerConsequenceTemplate, knownConsequenceTemplates, getConsequenceTemplate } from "../src/consequence.js";

describe("applyConsequence", () => {
  test("null consequence returns null", () => {
    const result = applyConsequence(null, null);
    expect(result).toBeNull();
  });

  test("string consequence returns description only", () => {
    const result = applyConsequence(null, "Bad outcome");
    expect(result.description).toBe("Bad outcome");
    expect(result.templateResult).toBeNull();
  });

  test("consequence without template returns description only", () => {
    const result = applyConsequence(null, { description: "Something bad" });
    expect(result.description).toBe("Something bad");
    expect(result.templateResult).toBeNull();
  });

  test("array of consequences applies each", () => {
    const results = applyConsequence(null, [
      { description: "First" },
      { description: "Second" },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].description).toBe("First");
    expect(results[1].description).toBe("Second");
  });

  test("unknown template throws", () => {
    expect(() => {
      applyConsequence(null, { description: "Bad", template: "nonexistent" });
    }).toThrow("Unknown consequence template");
  });
});

describe("harm template", () => {
  test("reduces guard by default amount (1)", () => {
    const char = createCharacter("Test");
    applyConsequence(null, {
      description: "Minor injury",
      template: "harm",
    }, { character: char });
    expect(char.guard).toBe(2);
    expect(char.body).toBe(6);
  });

  test("reduces guard by specified amount", () => {
    const char = createCharacter("Test");
    applyConsequence(null, {
      description: "Strong hit",
      template: "harm",
      params: { amount: 2 },
    }, { character: char });
    expect(char.guard).toBe(1);
    expect(char.body).toBe(6);
  });

  test("excess harm overflows guard to body", () => {
    const char = createCharacter("Test");
    char.guard = 1;
    applyConsequence(null, {
      description: "Massive blow",
      template: "harm",
      params: { amount: 3 },
    }, { character: char });
    expect(char.guard).toBe(0);
    expect(char.body).toBe(4);
  });

  test("no character returns zero damage", () => {
    const result = applyConsequence(null, {
      description: "Injury",
      template: "harm",
    }, {});
    expect(result.templateResult.guardDamage).toBe(0);
    expect(result.templateResult.bodyDamage).toBe(0);
  });

  test("armor from matching items reduces incoming harm", () => {
    const char = createCharacter("Test");
    char.inventory.push({
      id: "shield",
      name: "Shield",
      load: 1,
      tags: ["protective"],
      armor: 1,
    });
    applyConsequence(null, {
      description: "Strong hit",
      template: "harm",
      params: { amount: 2 },
    }, {
      character: char,
      scene: { tags: ["protective"] },
      challenge: { tags: [] },
    });
    expect(char.guard).toBe(2);  // 2 harm - 1 reduction = 1 → guard 3→2
    expect(char.body).toBe(6);
  });
});

describe("condition template", () => {
  test("adds condition tag to character and recalculates load", () => {
    const char = createCharacter("Test");
    char.inventory.push({ id: "sword", name: "Sword", load: 1 });
    applyConsequence(null, {
      description: "You're exposed",
      template: "condition",
      params: { condition: "exposed" },
    }, { character: char });
    expect(char.conditions).toContain("exposed");
    expect(char.load).toBe(2);
  });

  test("no character does nothing", () => {
    applyConsequence(null, {
      description: "Condition",
      template: "condition",
      params: { condition: "exposed" },
    }, {});
  });
});

describe("tickClock template", () => {
  test("ticks mission danger clock", () => {
    const state = {
      flags: {},
      plotlines: [{
        id: "p1",
        mission: { dangerClock: { current: 0, max: 4 }, heatGenerated: 0 },
      }],
      activeMissionId: "p1",
      characters: [],
    };
    applyConsequence(state, {
      description: "Time passes",
      template: "tickClock",
      params: { amount: 2 },
    }, {});
    expect(state.plotlines[0].mission.dangerClock.current).toBe(2);
  });
});

describe("loseItem template", () => {
  test("removes item from character inventory by id", () => {
    const char = createCharacter("Test");
    char.inventory.push({ id: "sword", name: "Sword", load: 1 });
    char.inventory.push({ id: "shield", name: "Shield", load: 2 });
    applyConsequence(null, {
      description: "Drop your weapon",
      template: "loseItem",
      params: { itemId: "sword" },
    }, { character: char });
    expect(char.inventory.find((i) => i.id === "sword")).toBeUndefined();
    expect(char.inventory).toHaveLength(1);
  });

  test("falls back to last item when no id matches", () => {
    const char = createCharacter("Test");
    char.inventory.push({ id: "knife", name: "Knife", load: 1 });
    applyConsequence(null, {
      description: "Drop something",
      template: "loseItem",
    }, { character: char });
    expect(char.inventory).toHaveLength(0);
  });
});

describe("registerConsequenceTemplate", () => {
  test("registers and applies custom template", () => {
    registerConsequenceTemplate("custom_test", (state, params, context) => {
      return { type: "custom", value: params.value };
    });

    expect(knownConsequenceTemplates()).toContain("custom_test");

    const result = applyConsequence(null, {
      description: "Custom effect",
      template: "custom_test",
      params: { value: 5 },
    }, {});
    expect(result.templateResult.value).toBe(5);
    expect(getConsequenceTemplate("custom_test")).toBeDefined();
  });
});
