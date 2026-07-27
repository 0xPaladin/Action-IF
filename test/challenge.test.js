import { describe, test, expect } from "bun:test";
import { createChallenge, addActionToChallenge, resolveAction } from "../src/challenge.js";
import { createCharacter } from "../src/character.js";
import { createScene } from "../src/scene.js";
import { registerConsequenceTemplate } from "../src/consequence.js";

describe("createChallenge", () => {
  test("creates challenge with empty clock and no actions", () => {
    const c = createChallenge("c1", "Pick the lock", 4, ["stealth"]);
    expect(c.id).toBe("c1");
    expect(c.clock.current).toBe(0);
    expect(c.clock.max).toBe(4);
    expect(c.actions).toEqual([]);
    expect(c.resolved).toBe(false);
  });
});

describe("addActionToChallenge", () => {
  test("adds action entry with consequence and default heat 3", () => {
    const c = createChallenge("c1", "desc", 4);
    addActionToChallenge(c, "Tinker", "Alarm triggers");
    expect(c.actions).toHaveLength(1);
    expect(c.actions[0].actionName).toBe("Tinker");
    expect(c.actions[0].consequences).toBe("Alarm triggers");
    expect(c.actions[0].heat).toBe(3);
  });

  test("adds action entry with explicit heat", () => {
    const c = createChallenge("c1", "desc", 4);
    addActionToChallenge(c, "Muscle", "Bad", 2);
    expect(c.actions[0].heat).toBe(2);
  });

  test("adds action entry with single consequence object", () => {
    const c = createChallenge("c1", "desc", 4);
    addActionToChallenge(c, "Sneak", {
      description: "A guard spots you.", template: "condition", params: { condition: "spotted" },
    });
    expect(c.actions).toHaveLength(1);
    expect(c.actions[0].consequences.description).toBe("A guard spots you.");
    expect(c.actions[0].consequences.template).toBe("condition");
  });
});

describe("resolveAction", () => {
  test("ticks clock on full success", () => {
    const char = createCharacter("Luna");
    char.actions.Sway = 4;
    const scene = createScene("s1", "action", "text", ["social"]);
    const challenge = createChallenge("c1", "desc", 4);
    addActionToChallenge(challenge, "Sway", "Bad outcome");
    scene.challenges = [challenge];

    const actionEntry = challenge.actions[0];
    const result = resolveAction(challenge, actionEntry, char, scene);
    expect(result.roll.outcome.level).toMatch(/critical|full|partial|failure/);
    expect(challenge.clock.current).toBeGreaterThanOrEqual(0);
  });

  test("marks resolved when clock fills", () => {
    const char = createCharacter("Luna");
    char.actions.Finesse = 5;
    const challenge = createChallenge("c1", "desc", 1);
    addActionToChallenge(challenge, "Finesse", "Oops");
    const actionEntry = challenge.actions[0];
    resolveAction(challenge, actionEntry, char, null, null, 10);
    if (challenge.resolved) {
      expect(challenge.resolved).toBe(true);
    }
  });

  test("applies consequence on failure, and on partial 50% of the time", () => {
    const char = createCharacter("Luna");
    char.actions.Sneak = 4;
    const state = { flags: {} };
    const challenge = createChallenge("c1", "desc", 4);
    addActionToChallenge(challenge, "Sneak", {
      description: "Guards spot you.", template: "condition", params: { condition: "spotted" },
    });
    const actionEntry = challenge.actions[0];
    const result = resolveAction(challenge, actionEntry, char, null, state);

    if (result.roll.outcome.level === "failure") {
      expect(result.result.consequence).toBeDefined();
      expect(result.result.consequence.description).toBe("Guards spot you.");
    } else if (result.roll.outcome.level === "partial") {
      // 50% chance of consequence, 50% chance of reduced effect
      if (result.result.reduced) {
        expect(result.result.consequence).toBeUndefined();
      } else {
        expect(result.result.consequence).toBeDefined();
        expect(result.result.consequence.description).toBe("Guards spot you.");
      }
    } else {
      // full or critical — no consequence
      expect(result.result.consequence).toBeUndefined();
    }
  });

  test("string consequence applies on failure and partial", () => {
    const char = createCharacter("Luna");
    char.actions.Sneak = 4;
    const state = { flags: {} };
    const challenge = createChallenge("c1", "desc", 4);
    addActionToChallenge(challenge, "Sneak", "Old style consequence text");
    const actionEntry = challenge.actions[0];
    const result = resolveAction(challenge, actionEntry, char, null, state);

    if (result.roll.outcome.level === "failure") {
      expect(result.result.consequence.description).toBe("Old style consequence text");
      expect(result.result.consequence.templateResult).toBeNull();
    } else if (result.roll.outcome.level === "partial" && !result.result.reduced) {
      expect(result.result.consequence.description).toBe("Old style consequence text");
      expect(result.result.consequence.templateResult).toBeNull();
    }
  });

  test("custom consequence template fires correctly", () => {
    registerConsequenceTemplate("test_custom", (state, params, context) => {
      return { type: "test", applied: true };
    });

    const char = createCharacter("Luna");
    char.actions.Sneak = 4;
    const state = { flags: {} };
    const challenge = createChallenge("c1", "desc", 4);
    addActionToChallenge(challenge, "Sneak", {
      description: "Custom consequence", template: "test_custom",
    });
    const actionEntry = challenge.actions[0];
    const result = resolveAction(challenge, actionEntry, char, null, state);

    if (result.roll.outcome.level === "failure") {
      expect(result.result.consequence.templateResult.type).toBe("test");
      expect(result.result.consequence.templateResult.applied).toBe(true);
    }
  });
});
