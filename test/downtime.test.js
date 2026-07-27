import { describe, test, expect } from "bun:test";
import {
  startDowntime, canDoActivity, activitiesRemaining,
  doRecovery, doTraining, doLevelUp, createProject, doProject,
  fortifyDefensesProject, trainActionProject, cultivateContactProject, craftItemProject,
} from "../src/downtime.js";
import { createCharacter, addXp } from "../src/character.js";
import { createGameState, addLogEntry } from "../src/state.js";
import { createFaction } from "../src/faction.js";
import { createItem } from "../src/item.js";

describe("startDowntime", () => {
  test("sets downtimeRemaining to 2 for each character", () => {
    const state = createGameState();
    state.characters.push(createCharacter("Luna"), createCharacter("Rook"));
    startDowntime(state);
    expect(state.characters[0].downtimeRemaining).toBe(2);
    expect(state.characters[1].downtimeRemaining).toBe(2);
  });
});

describe("canDoActivity / activitiesRemaining", () => {
  test("returns remaining count", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.downtimeRemaining = 1;
    state.characters.push(char);
    expect(activitiesRemaining(state, 0)).toBe(1);
    expect(canDoActivity(state, 0)).toBe(true);
  });
});

describe("doRecovery", () => {
  test("ticks healing and clears conditions, uses activity", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.body = 4;
    char.conditions = ["pinned", "rattled"];
    char.downtimeRemaining = 2;
    state.characters.push(char);
    const r = doRecovery(state, 0);
    expect(r.type).toBe("recovery");
    expect(r.conditionsCleared).toBe(2);
    expect(char.conditions).toEqual([]);
    expect(char.healing.ticks).toBe(1);
    expect(r.activitiesLeft).toBe(1);
  });
});

describe("doTraining", () => {
  test("gains 1 XP, uses activity", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.xp = 3;
    char.downtimeRemaining = 2;
    state.characters.push(char);
    const r = doTraining(state, 0);
    expect(r.type).toBe("training");
    expect(r.xpGained).toBe(1);
    expect(r.xpTotal).toBe(4);
    expect(char.xp).toBe(4);
    expect(r.activitiesLeft).toBe(1);
  });

  test("flags canLevelUp when XP reaches 8", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.xp = 7;
    char.downtimeRemaining = 2;
    state.characters.push(char);
    const r = doTraining(state, 0);
    expect(r.canLevelUp).toBe(true);
    expect(char.xp).toBe(8);
  });
});

describe("doLevelUp", () => {
  test("upgrades an action when spending 8 XP", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.actions.Muscle = 1;
    char.xp = 8;
    char.downtimeRemaining = 2;
    state.characters.push(char);
    const r = doLevelUp(state, 0, "Muscle");
    expect(r.type).toBe("levelup");
    expect(r.choice).toBe("action");
    expect(r.from).toBe(1);
    expect(r.to).toBe(2);
    expect(char.xp).toBe(0);
    expect(char.actions.Muscle).toBe(2);
  });

  test("throws for insufficient XP", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.xp = 7;
    state.characters.push(char);
    expect(() => doLevelUp(state, 0, "Muscle")).toThrow(/8 XP/);
  });

  test("throws for maxed action", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.actions.Sway = 4;
    char.xp = 8;
    state.characters.push(char);
    expect(() => doLevelUp(state, 0, "Sway")).toThrow(/max/);
  });

  test("gains a stunt when spending 8 XP on stunt", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.xp = 8;
    char.stuntChoices = [
      { id: "my_stunt", name: "My Stunt", description: "A custom stunt", tags: ["combat"], effects: { bonusDice: 1 } },
    ];
    char.downtimeRemaining = 2;
    state.characters.push(char);
    const r = doLevelUp(state, 0, "stunt");
    expect(r.type).toBe("levelup");
    expect(r.choice).toBe("stunt");
    expect(r.stuntName).toBe("My Stunt");
    expect(char.xp).toBe(0);
    expect(char.stunts.length).toBe(1);
    expect(char.stunts[0].id).toBe("my_stunt");
  });

  test("throws for stunt when no stuntChoices available", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.xp = 8;
    state.characters.push(char);
    expect(() => doLevelUp(state, 0, "stunt")).toThrow(/no stunt choices/);
  });
});

describe("projects", () => {
  test("createProject and doProject", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.downtimeRemaining = 7;
    const proj = createProject("p1", "Build a boat", 6);
    char.projects.push(proj);
    state.characters.push(char);
    const r = doProject(state, 0, "p1");
    expect(r.clock.current).toBe(1);
    expect(r.completed).toBe(false);
    for (let i = 0; i < 5; i++) doProject(state, 0, "p1");
    expect(proj.completed).toBe(true);
  });

  test("throws for unknown project", () => {
    const state = createGameState();
    state.characters.push(createCharacter("Luna"));
    expect(() => doProject(state, 0, "nope")).toThrow();
  });

  test("fortifyDefensesProject increases Guard on completion", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.downtimeRemaining = 5;
    const proj = fortifyDefensesProject();
    char.projects.push(proj);
    state.characters.push(char);
    for (let i = 0; i < 4; i++) doProject(state, 0, "fortify_defenses");
    expect(proj.completed).toBe(true);
    expect(char.maxGuard).toBe(4);
    expect(char.guard).toBe(4);
  });

  test("trainActionProject gives XP on completion", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.xp = 0;
    char.downtimeRemaining = 7;
    const proj = trainActionProject();
    char.projects.push(proj);
    state.characters.push(char);
    for (let i = 0; i < 6; i++) doProject(state, 0, "train_action");
    expect(proj.completed).toBe(true);
    expect(char.xp).toBe(1);
  });

  test("cultivateContactProject reduces faction heat on completion", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.downtimeRemaining = 5;
    const faction = createFaction("test_faction", "Test Faction", "A test", { heat: 3 });
    state.factions.push(faction);
    const proj = cultivateContactProject("test_faction");
    char.projects.push(proj);
    state.characters.push(char);
    for (let i = 0; i < 4; i++) doProject(state, 0, "cultivate_contact");
    expect(proj.completed).toBe(true);
    expect(faction.heat).toBe(2);
  });

  test("craftItemProject adds item to inventory on completion", () => {
    const state = createGameState();
    const char = createCharacter("Luna");
    char.downtimeRemaining = 7;
    const item = createItem("test_blade", "Test Blade", "A sharp thing", 1, ["combat"], {});
    state.items.push(item);
    const proj = craftItemProject("test_blade");
    char.projects.push(proj);
    state.characters.push(char);
    for (let i = 0; i < 6; i++) doProject(state, 0, "craft_item");
    expect(proj.completed).toBe(true);
    expect(char.inventory.some((i) => i.id === "test_blade")).toBe(true);
  });
});