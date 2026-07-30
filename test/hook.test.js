import { describe, test, expect } from "bun:test";
import { registerHook, resolveHook } from "../src/hook.js";
import { createGameState } from "../src/state.js";
import { createGame } from "../src/engine.js";

describe("resolveHook", () => {
  test("function hooks are called with (state, context)", () => {
    const state = createGameState();
    resolveHook(state, (s, ctx) => { s.flags.called = true; }, {});
    expect(state.flags.called).toBe(true);
  });

  test("array hooks are processed in order", () => {
    const state = createGameState();
    resolveHook(state, [
      { type: "setFlag", flag: "first" },
      { type: "setFlag", flag: "second" },
    ], {});
    expect(state.flags.first).toBe(true);
    expect(state.flags.second).toBe(true);
  });

  test("null/undefined hook does nothing", () => {
    expect(() => resolveHook(createGameState(), null)).not.toThrow();
    expect(() => resolveHook(createGameState(), undefined)).not.toThrow();
  });

  test("throws for unknown hook type", () => {
    expect(() => resolveHook(createGameState(), { type: "bogus" }, {})).toThrow();
  });
});

describe("built-in hooks", () => {
  test("setFlag", () => {
    const state = createGameState();
    resolveHook(state, { type: "setFlag", flag: "done" });
    expect(state.flags.done).toBe(true);
  });

  test("clearFlag", () => {
    const state = createGameState();
    state.flags.done = true;
    resolveHook(state, { type: "clearFlag", flag: "done" });
    expect(state.flags.done).toBeUndefined();
  });

  test("log and message add entries", () => {
    const state = createGameState();
    resolveHook(state, { type: "log", text: "logged" });
    resolveHook(state, { type: "message", text: "messaged" });
    expect(state.gameLog).toHaveLength(2);
    expect(state.gameLog[0].type).toBe("log");
    expect(state.gameLog[1].type).toBe("message");
  });

  test("addRep / addCoin / addXp require crew", () => {
    const state = createGameState();
    expect(() => resolveHook(state, { type: "addRep" })).not.toThrow();
    expect(() => resolveHook(state, { type: "addCoin" })).not.toThrow();
    expect(() => resolveHook(state, { type: "addXp" })).not.toThrow();
  });

  test("clearActiveScene", () => {
    const state = createGameState();
    state.activeScene = "s1";
    resolveHook(state, { type: "clearActiveScene" });
    expect(state.activeScene).toBeNull();
  });

  test("completePlotline", () => {
    const state = createGameState();
    state.plotlines.push({ id: "p1", completed: false });
    resolveHook(state, { type: "completePlotline", plotlineId: "p1" });
    expect(state.plotlines[0].completed).toBe(true);
  });

  test("custom hook types via registerHook", () => {
    registerHook("double", (state, params) => {
      state.flags[params.flag] = params.value * 2;
    });
    const state = createGameState();
    resolveHook(state, { type: "double", flag: "test", value: 5 });
    expect(state.flags.test).toBe(10);
  });

  test("adjustStatus", () => {
    const state = createGameState();
    state.factions.push({ id: "f1", heat: 0 });
    resolveHook(state, { type: "adjustStatus", factionId: "f1", delta: 2 });
    expect(state.factions[0].heat).toBe(2);
  });

  test("tickClock", () => {
    const state = createGameState();
    state.factionClocks.push({ id: "fc1", clock: { max: 4, current: 0 }, completed: false });
    resolveHook(state, { type: "tickClock", clockId: "fc1", amount: 2 });
    expect(state.factionClocks[0].clock.current).toBe(2);
  });

  test("encounter activates scene by string ID", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
      encounters: [
        { id: "enc_bandits", type: "dialogue", fiction: "Bandits!", tags: [], options: [{ text: "Fight" }] },
      ],
    });
    const result = resolveHook(state, { type: "encounter", encounter: "enc_bandits" });
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("enc_bandits");
    expect(result.sceneFiction).toBe("Bandits!");
    expect(state.activeScene).toBe("enc_bandits");
  });

  test("encounter returns null for empty string", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
      encounters: [],
    });
    const result = resolveHook(state, { type: "encounter", encounter: "" });
    expect(result).toBeNull();
    expect(state.activeScene).toBeNull();
  });

  test("encounter returns null for missing encounter ID", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
      encounters: [],
    });
    const result = resolveHook(state, { type: "encounter", encounter: "enc_missing" });
    expect(result).toBeNull();
    expect(state.activeScene).toBeNull();
  });

  test("encounter picks from weighted array", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
      encounters: [
        { id: "enc_bandits", type: "dialogue", fiction: "Bandits!", tags: [], options: [{ text: "Fight" }] },
        { id: "enc_patrol", type: "dialogue", fiction: "Patrol!", tags: [], options: [{ text: "Hide" }] },
      ],
    });
    const results = new Set();
    for (let i = 0; i < 50; i++) {
      state.activeScene = null;
      const result = resolveHook(state, {
        type: "encounter",
        encounter: [["enc_bandits", "enc_patrol"], [10, 10]],
      });
      expect(result).not.toBeNull();
      expect(result.type).toBe("scene_start");
      results.add(result.sceneId);
    }
    expect(results.has("enc_bandits")).toBe(true);
    expect(results.has("enc_patrol")).toBe(true);
  });
});

describe("Tier 1 hooks", () => {
  test("giveItem adds item to character inventory", () => {
    const state = createGame({
      characters: [{ name: "Test", items: [] }],
      items: [{ id: "key", name: "Key", description: "A key", load: 1, tags: [] }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    resolveHook(state, { type: "giveItem", itemId: "key", characterIndex: 0 });
    expect(state.characters[0].inventory).toHaveLength(1);
    expect(state.characters[0].inventory[0].id).toBe("key");
  });

  test("giveItem returns null for invalid character", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "giveItem", itemId: "key", characterIndex: 5 })).toBeNull();
  });

  test("giveItem returns null for missing item", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      items: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    expect(resolveHook(state, { type: "giveItem", itemId: "missing" })).toBeNull();
  });

  test("takeItem removes item from character inventory", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      items: [{ id: "key", name: "Key", description: "A key", load: 1, tags: [] }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    state.characters[0].inventory.push({ id: "key", name: "Key", load: 1, tags: [] });
    resolveHook(state, { type: "takeItem", itemId: "key", characterIndex: 0 });
    expect(state.characters[0].inventory).toHaveLength(0);
  });

  test("takeItem returns null for missing item", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      items: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    expect(resolveHook(state, { type: "takeItem", itemId: "missing" })).toBeNull();
  });

  test("addCondition adds condition to character", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    resolveHook(state, { type: "addCondition", condition: "poisoned", characterIndex: 0 });
    expect(state.characters[0].conditions).toContain("poisoned");
  });

  test("addCondition returns null for invalid character", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "addCondition", condition: "poisoned", characterIndex: 5 })).toBeNull();
  });

  test("addCondition returns null without condition param", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    expect(resolveHook(state, { type: "addCondition", characterIndex: 0 })).toBeNull();
  });

  test("dealHarm reduces guard first then body", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const char = state.characters[0];
    expect(char.guard).toBe(3);
    expect(char.body).toBe(6);

    resolveHook(state, { type: "dealHarm", amount: 2, characterIndex: 0 });
    expect(char.guard).toBe(1);
    expect(char.body).toBe(6);

    resolveHook(state, { type: "dealHarm", amount: 5, characterIndex: 0 });
    expect(char.guard).toBe(0);
    expect(char.body).toBe(2);
  });

  test("dealHarm respects armor reduction", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      items: [{ id: "vest", name: "Vest", description: "Armor", load: 1, tags: ["combat"], armor: 2 }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const char = state.characters[0];
    char.inventory.push({ id: "vest", name: "Vest", load: 1, tags: ["combat"], armor: 2 });

    resolveHook(state, { type: "dealHarm", amount: 4, characterIndex: 0, tags: ["combat"] });
    expect(char.guard).toBe(1);
    expect(char.body).toBe(6);
  });

  test("dealHarm returns null for invalid character", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "dealHarm", amount: 2, characterIndex: 5 })).toBeNull();
  });

  test("addCharacterXp adds XP to character", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    resolveHook(state, { type: "addCharacterXp", amount: 3, characterIndex: 0 });
    expect(state.characters[0].xp).toBe(3);
  });

  test("addCharacterXp defaults to 1", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    resolveHook(state, { type: "addCharacterXp", characterIndex: 0 });
    expect(state.characters[0].xp).toBe(1);
  });

  test("addCharacterXp returns null for invalid character", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "addCharacterXp", amount: 2, characterIndex: 5 })).toBeNull();
  });
});

describe("Tier 2 hooks", () => {
  test("removeCondition removes specific condition", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    state.characters[0].conditions = ["poisoned", "doomed"];
    resolveHook(state, { type: "removeCondition", condition: "poisoned", characterIndex: 0 });
    expect(state.characters[0].conditions).toEqual(["doomed"]);
  });

  test("removeCondition returns null if condition not present", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    state.characters[0].conditions = ["poisoned"];
    expect(resolveHook(state, { type: "removeCondition", condition: "missing" })).toBeNull();
    expect(state.characters[0].conditions).toEqual(["poisoned"]);
  });

  test("clearConditions removes all conditions", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    state.characters[0].conditions = ["poisoned", "doomed", "shaken"];
    resolveHook(state, { type: "clearConditions", characterIndex: 0 });
    expect(state.characters[0].conditions).toHaveLength(0);
  });

  test("resetGuard restores guard to maxGuard", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    state.characters[0].guard = 0;
    state.characters[0].maxGuard = 3;
    resolveHook(state, { type: "resetGuard", characterIndex: 0 });
    expect(state.characters[0].guard).toBe(3);
  });

  test("resetGuard respects custom maxGuard", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    state.characters[0].guard = 0;
    state.characters[0].maxGuard = 5;
    resolveHook(state, { type: "resetGuard", characterIndex: 0 });
    expect(state.characters[0].guard).toBe(5);
  });

  test("moveNPC changes NPC location", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "room1", name: "Room", description: "desc", links: [], actions: [] },
        { id: "room2", name: "Room2", description: "desc", links: [], actions: [] },
      ],
      npcs: [{ id: "valeria", name: "Valeria", location: "room1", description: "desc" }],
      startLocation: "room1",
    });
    expect(state.npcsByLocation["room1"]).toHaveLength(1);
    expect(state.npcsByLocation["room2"]).toBeUndefined();

    resolveHook(state, { type: "moveNPC", npcId: "valeria", locationId: "room2" });
    expect(state.npcs[0].location).toBe("room2");
    expect(state.npcsByLocation["room1"]).toBeUndefined();
    expect(state.npcsByLocation["room2"]).toHaveLength(1);
  });

  test("moveNPC returns null for missing NPC", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      npcs: [{ id: "valeria", name: "Valeria", location: "room1", description: "desc" }],
      startLocation: "room1",
    });
    expect(resolveHook(state, { type: "moveNPC", npcId: "missing", locationId: "room1" })).toBeNull();
  });

  test("removeNPC removes NPC from state", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      npcs: [{ id: "valeria", name: "Valeria", location: "room1", description: "desc" }],
      startLocation: "room1",
    });
    expect(state.npcs).toHaveLength(1);
    resolveHook(state, { type: "removeNPC", npcId: "valeria" });
    expect(state.npcs).toHaveLength(0);
    expect(state.npcsByLocation["room1"]).toBeUndefined();
  });

  test("removeNPC returns null for missing NPC", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      npcs: [{ id: "valeria", name: "Valeria", location: "room1", description: "desc" }],
      startLocation: "room1",
    });
    expect(resolveHook(state, { type: "removeNPC", npcId: "missing" })).toBeNull();
  });
});

describe("Tier 3 hooks", () => {
  test("addClock creates a new faction clock", () => {
    const state = createGameState();
    resolveHook(state, {
      type: "addClock",
      id: "timer",
      name: "Bomb Timer",
      description: "The bomb is ticking.",
      clockMax: 6,
    });
    expect(state.factionClocks).toHaveLength(1);
    expect(state.factionClocks[0].id).toBe("timer");
    expect(state.factionClocks[0].name).toBe("Bomb Timer");
    expect(state.factionClocks[0].clock.max).toBe(6);
  });

  test("addClock defaults clockMax to 4", () => {
    const state = createGameState();
    resolveHook(state, { type: "addClock", id: "timer", name: "Timer" });
    expect(state.factionClocks[0].clock.max).toBe(4);
  });

  test("removeClock removes a faction clock", () => {
    const state = createGameState();
    state.factionClocks.push({ id: "timer", clock: { max: 4, current: 0 }, completed: false });
    resolveHook(state, { type: "removeClock", clockId: "timer" });
    expect(state.factionClocks).toHaveLength(0);
  });

  test("removeClock returns null for missing clock", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "removeClock", clockId: "missing" })).toBeNull();
  });

  test("modifyAction permanent adjusts action rating", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const char = state.characters[0];
    expect(char.actions["Study"]).toBe(0);

    resolveHook(state, { type: "modifyAction", action: "Study", delta: 2, characterIndex: 0, permanent: true });
    expect(char.actions["Study"]).toBe(2);
    expect(char.actionMods).toBeFalsy();
  });

  test("modifyAction permanent caps at 4", () => {
    const state = createGame({
      characters: [{ name: "Test", actions: { Study: 3 } }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    resolveHook(state, { type: "modifyAction", action: "Study", delta: 5, characterIndex: 0, permanent: true });
    expect(state.characters[0].actions["Study"]).toBe(4);
  });

  test("modifyAction temporary stores in actionMods", () => {
    const state = createGame({
      characters: [{ name: "Test" }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const char = state.characters[0];

    resolveHook(state, { type: "modifyAction", action: "Study", delta: 1, characterIndex: 0 });
    expect(char.actionMods).toHaveLength(1);
    expect(char.actionMods[0]).toEqual({ action: "Study", delta: 1 });
    expect(char.actions["Study"]).toBe(0);
  });

  test("modifyAction returns null for invalid character", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "modifyAction", action: "Study", delta: 1, characterIndex: 5 })).toBeNull();
  });
});

describe("Level-up hooks", () => {
  test("level_up_action deducts XP and increments action rating", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 8, actions: { Muscle: 1 } }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const char = state.characters[0];
    expect(char.actions.Muscle).toBe(1);
    expect(char.xp).toBe(8);

    const result = resolveHook(state, { type: "level_up_action", characterIndex: 0, action: "Muscle" });
    expect(result.type).toBe("levelup");
    expect(result.choice).toBe("action");
    expect(result.action).toBe("Muscle");
    expect(result.from).toBe(1);
    expect(result.to).toBe(2);
    expect(char.actions.Muscle).toBe(2);
    expect(char.xp).toBe(0);
  });

  test("level_up_action errors for insufficient XP", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 5, actions: { Muscle: 1 } }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const result = resolveHook(state, { type: "level_up_action", characterIndex: 0, action: "Muscle" });
    expect(result.type).toBe("error");
    expect(result.message).toContain("needs 8 XP");
    expect(state.characters[0].xp).toBe(5);
  });

  test("level_up_action errors for maxed action", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 8, actions: { Muscle: 4 } }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const result = resolveHook(state, { type: "level_up_action", characterIndex: 0, action: "Muscle" });
    expect(result.type).toBe("error");
    expect(result.message).toContain("already at max");
    expect(state.characters[0].actions.Muscle).toBe(4);
  });

  test("level_up_action errors for unknown action", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 8 }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const result = resolveHook(state, { type: "level_up_action", characterIndex: 0, action: "Bogus" });
    expect(result.type).toBe("error");
    expect(result.message).toContain("Unknown action");
  });

  test("level_up_action returns null for invalid character", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "level_up_action", characterIndex: 5, action: "Muscle" })).toBeNull();
  });

  test("level_up_stunt deducts XP and adds stunt from gameStunts", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 8 }],
      stunts: [{ id: "quick_reflexes", name: "Quick Reflexes", description: "React faster.", tags: ["combat"] }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const char = state.characters[0];
    expect(char.stunts).toHaveLength(0);
    expect(char.xp).toBe(8);

    const result = resolveHook(state, { type: "level_up_stunt", characterIndex: 0, stuntId: "quick_reflexes" });
    expect(result.type).toBe("levelup");
    expect(result.choice).toBe("stunt");
    expect(result.stuntName).toBe("Quick Reflexes");
    expect(char.stunts).toHaveLength(1);
    expect(char.stunts[0].id).toBe("quick_reflexes");
    expect(char.xp).toBe(0);
  });

  test("level_up_stunt errors for insufficient XP", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 5 }],
      stunts: [{ id: "quick_reflexes", name: "Quick Reflexes", description: "React faster.", tags: ["combat"] }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const result = resolveHook(state, { type: "level_up_stunt", characterIndex: 0, stuntId: "quick_reflexes" });
    expect(result.type).toBe("error");
    expect(result.message).toContain("needs 8 XP");
    expect(state.characters[0].xp).toBe(5);
  });

  test("level_up_stunt errors for missing stunt", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 8 }],
      stunts: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const result = resolveHook(state, { type: "level_up_stunt", characterIndex: 0, stuntId: "missing" });
    expect(result.type).toBe("error");
    expect(result.message).toContain("not found");
  });

  test("level_up_stunt errors if character already has the stunt", () => {
    const state = createGame({
      characters: [{ name: "Test", xp: 8, stunts: [{ id: "quick_reflexes", name: "Quick Reflexes", tags: [], action: null, bonusDice: 0, bonusTicks: 0, bonusEffect: 0, substituteAction: null }] }],
      stunts: [{ id: "quick_reflexes", name: "Quick Reflexes", description: "React faster.", tags: ["combat"] }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      startLocation: "room1",
    });
    const result = resolveHook(state, { type: "level_up_stunt", characterIndex: 0, stuntId: "quick_reflexes" });
    expect(result.type).toBe("error");
    expect(result.message).toContain("already has");
  });

  test("level_up_stunt returns null for invalid character", () => {
    const state = createGameState();
    expect(resolveHook(state, { type: "level_up_stunt", characterIndex: 5, stuntId: "x" })).toBeNull();
  });
});
