import { describe, test, expect } from "bun:test";
import { createGame, getContext, processInput, resolveEncounter } from "../src/engine.js";
import { findSceneById } from "../src/state.js";
import { createCharacter } from "../src/character.js";
import { createLocation, createLink, createAction, addLink, addAction } from "../src/location.js";
import { createScene, createOption, addOptionToScene } from "../src/scene.js";
import { createPlotline } from "../src/plotline.js";
import { parseInput } from "../src/parser.js";

describe("createGame", () => {
  test("initialises state from definition", () => {
    const def = {
      characters: [
        { name: "Luna", actionDots: [2, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0] },
      ],
      locations: [
        { id: "room1", name: "Room", description: "A room", links: [], actions: [] },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    };

    const state = createGame(def);
    expect(state.characters).toHaveLength(1);
    expect(state.characters[0].name).toBe("Luna");
    expect(state.characters[0].actions.Muscle).toBe(2);
    expect(state.locations).toHaveLength(1);
    expect(state.currentLocation).toBe("room1");
  });

  test("initialises with direct actions characters", () => {
    const def = {
      characters: [
        { name: "Luna", actions: { Muscle: 2, Command: 1 } },
      ],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    };
    const state = createGame(def);
    expect(state.characters[0].actions.Muscle).toBe(2);
    expect(state.characters[0].actions.Command).toBe(1);
  });

  test("initialises with character aspects", () => {
    const def = {
      characters: [
        { name: "Luna", aspects: ["The Unbroken Shield", "Oath of the Celestial"] },
      ],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    };
    const state = createGame(def);
    expect(state.characters[0].aspects).toEqual(["The Unbroken Shield", "Oath of the Celestial"]);
  });

  test("initialises crew", () => {
    const def = {
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: { id: "c1", name: "Crew", description: "A crew of shadows", resources: { coin: 3 } },
      startLocation: "room1",
    };
    const state = createGame(def);
    expect(state.crew.name).toBe("Crew");
    expect(state.crew.resources.coin).toBe(3);
  });
});

describe("getContext", () => {
  test("returns location context when no scene active", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    const ctx = getContext(state);
    expect(ctx.type).toBe("location");
    expect(ctx.name).toBe("Room");
  });

  test("returns scene context when scene active", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [{
        id: "p1",
        name: "Test",
        description: "d",
        scenes: [{ id: "s1", type: "dialogue", fiction: "Hello!", tags: [], options: [{ text: "Hi" }] }],
      }],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    state.activeScene = "s1";
    const ctx = getContext(state);
    expect(ctx.type).toBe("scene");
    expect(ctx.fiction).toBe("Hello!");
  });

  test("returns mission context fields when mission active", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [{
        id: "m1",
        name: "Mission",
        description: "d",
        scenes: [{ id: "s1", type: "dialogue", fiction: "Go!", tags: [], options: [] }],
        mission: {
          locationId: "room1",
          startingSceneId: "s1",
        },
      }],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    state.activeMissionId = "m1";
    const ctx = getContext(state);
    expect(ctx.missionId).toBe("m1");
  });
});

describe("processInput", () => {
  test("processes go command at location", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "room1", name: "Room 1", description: "First", links: [{ targetId: "room2", label: "East" }], actions: [] },
        { id: "room2", name: "Room 2", description: "Second", links: [], actions: [] },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });

    const cmd = { type: "go_num", index: 0 };
    const result = processInput(state, cmd);
    expect(result.type).toBe("transition");
    expect(state.currentLocation).toBe("room2");
  });

  test("processes location action", () => {
    const state = createGame({
      characters: [],
      locations: [
        {
          id: "room1", name: "Room", description: "desc",
          links: [],
          actions: [{ id: "search", label: "Search", description: "Look around", once: false, used: false, triggerScene: null, setFlag: "searched", provideKeys: [], condition: null, hooks: null }],
        },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });

    const cmd = parseInput("search");
    const result = processInput(state, cmd);
    expect(result.type).toBe("action_done");
    expect(state.flags.searched).toBe(true);
  });

  test("processes NPC action via text command", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "room1", name: "Room", description: "desc", links: [], actions: [] },
      ],
      npcs: [
        {
          id: "valeria",
          name: "Valeria",
          location: "room1",
          description: "A contact.",
          actions: [
            { id: "briefing", label: "Request Briefing", description: "Ask for details.", once: false, triggerScene: null, setFlag: "briefing_received", provideKeys: ["gate_key"], condition: null, hooks: null },
          ],
          dialogue: [],
        },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });

    const result = processInput(state, parseInput("briefing"));
    expect(result.type).toBe("action_done");
    expect(state.flags.briefing_received).toBe(true);
    expect(state.flags.gate_key).toBe(true);
  });

  test("processes NPC action via act number", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "room1", name: "Room", description: "desc", links: [], actions: [] },
      ],
      npcs: [
        {
          id: "valeria",
          name: "Valeria",
          location: "room1",
          description: "A contact.",
          actions: [
            { id: "briefing", label: "Request Briefing", description: "Ask for details.", once: false, triggerScene: null, setFlag: "briefing_received", provideKeys: [], condition: null, hooks: null },
          ],
          dialogue: [],
        },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });

    const result = processInput(state, parseInput("act 1"));
    expect(result.type).toBe("action_done");
    expect(state.flags.briefing_received).toBe(true);
  });

  test("NPC action with triggerScene starts scene", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "room1", name: "Room", description: "desc", links: [], actions: [] },
      ],
      npcs: [
        {
          id: "valeria",
          name: "Valeria",
          location: "room1",
          description: "A contact.",
          actions: [
            { id: "start", label: "Start Mission", description: "Begin.", once: true, triggerScene: "mission_start", setFlag: "mission_started", provideKeys: [], condition: null, hooks: null },
          ],
          dialogue: [],
        },
      ],
      plotlines: [{
        id: "p1",
        name: "Mission",
        description: "d",
        scenes: [{ id: "mission_start", type: "dialogue", fiction: "Go!", tags: [], options: [{ text: "OK" }] }],
      }],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });

    const result = processInput(state, parseInput("start"));
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("mission_start");
    expect(state.flags.mission_started).toBe(true);
  });

  test("NPC action appears in location context under its NPC", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "room1", name: "Room", description: "desc", links: [], actions: [] },
      ],
      npcs: [
        {
          id: "valeria",
          name: "Valeria",
          location: "room1",
          description: "A contact.",
          actions: [
            { id: "briefing", label: "Request Briefing", description: "Ask for details.", once: false, triggerScene: null, setFlag: null, provideKeys: [], condition: null, hooks: null },
          ],
          dialogue: [],
        },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });

    const ctx = getContext(state);
    expect(ctx.npcs).toHaveLength(1);
    expect(ctx.npcs[0].name).toBe("Valeria");
    expect(ctx.npcs[0].actions).toHaveLength(1);
    expect(ctx.npcs[0].actions[0].label).toBe("Request Briefing");
  });

  test("NPC action once-flag prevents reuse", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "room1", name: "Room", description: "desc", links: [], actions: [] },
      ],
      npcs: [
        {
          id: "valeria",
          name: "Valeria",
          location: "room1",
          description: "A contact.",
          actions: [
            { id: "once_action", label: "Once", description: "Do once.", once: true, triggerScene: null, setFlag: "once_done", provideKeys: [], condition: null, hooks: null },
          ],
          dialogue: [],
        },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });

    const result1 = processInput(state, parseInput("once"));
    expect(result1.type).toBe("action_done");
    expect(state.flags.once_done).toBe(true);

    const result2 = processInput(state, parseInput("once"));
    expect(result2.type).toBe("error");
  });

  test("processes dialogue option selection", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [{
        id: "p1",
        name: "Test",
        description: "d",
        scenes: [{ id: "s1", type: "dialogue", fiction: "Talk", tags: [], options: [{ text: "Say yes", setFlag: "said_yes" }] }],
      }],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    state.activeScene = "s1";

    const cmd = parseInput("1");
    const result = processInput(state, cmd);
    expect(result.type).toBe("scene_end");
    expect(state.flags.said_yes).toBe(true);
  });

  test("processes fortune roll", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    const cmd = parseInput("fortune 3");
    const result = processInput(state, cmd);
    expect(result.type).toBe("fortune_result");
    expect(result.pool).toBe(3);
    expect(result.results).toHaveLength(3);
  });

  test("returns error for unknown command", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    const result = processInput(state, { type: "bogus" });
    expect(result.type).toBe("error");
  });
});

describe("resolveEncounter", () => {
  test("returns encounter ID for string input", () => {
    expect(resolveEncounter({}, "enc_bandits")).toBe("enc_bandits");
    expect(resolveEncounter({}, "")).toBe("");
  });

  test("returns encounter ID from weighted random array", () => {
    const ids = ["enc_bandits", "enc_patrol", ""];
    const weights = [10, 10, 1];
    const state = {};
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(resolveEncounter(state, [ids, weights]));
    }
    expect(results.has("enc_bandits")).toBe(true);
    expect(results.has("enc_patrol")).toBe(true);
    expect(results.has("")).toBe(true);
  });

  test("returns null for missing encounter def", () => {
    expect(resolveEncounter({}, null)).toBe(null);
    expect(resolveEncounter({}, undefined)).toBe(null);
  });

  test("returns null for empty weighted array", () => {
    expect(resolveEncounter({}, [[], []])).toBe(null);
  });

  test("returns null for zero-weight array", () => {
    expect(resolveEncounter({}, [["enc_test"], [0]])).toBe(null);
  });
});

describe("Encounters", () => {
  test("creates encounters from definition", () => {
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
        { id: "enc_bandits", type: "dialogue", fiction: "Bandits block the road!", tags: [], options: [{ text: "Fight" }] },
        { id: "enc_patrol", type: "action", fiction: "A patrol approaches.", tags: [], challenges: [] },
      ],
    });
    expect(state.encounters).toHaveLength(2);
    expect(state.encounters[0].id).toBe("enc_bandits");
    expect(state.encounters[0]._encounter).toBe(true);
    expect(state.encounters[1].id).toBe("enc_patrol");
    expect(findSceneById(state, "enc_bandits")).toBeDefined();
  });

  test("journey activates encounter scene when first scene has encounter string", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "town", name: "Town", description: "desc", links: [{ targetId: "cave", label: "Cave" }], actions: [] },
        { id: "cave", name: "Cave", description: "desc", links: [], actions: [] },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "town",
      encounters: [
        { id: "enc_bandits", type: "dialogue", fiction: "Bandits!", tags: [], options: [{ text: "Run" }] },
      ],
    });
    state.locations[0].links[0].journey = [
      { type: "dialogue", fiction: "Traveling...", tags: [], options: [{ text: "Continue" }], encounter: "enc_bandits" },
    ];
    const cmd = parseInput("1");
    const result = processInput(state, cmd);
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("enc_bandits");
    expect(state.activeScene).toBe("enc_bandits");
  });

  test("journey skips encounter when encounter ID is empty string", () => {
    const state = createGame({
      characters: [],
      locations: [
        { id: "town", name: "Town", description: "desc", links: [{ targetId: "cave", label: "Cave" }], actions: [] },
        { id: "cave", name: "Cave", description: "desc", links: [], actions: [] },
      ],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "town",
      encounters: [],
    });
    state.locations[0].links[0].journey = [
      { type: "dialogue", fiction: "Traveling...", tags: [], options: [{ text: "Continue" }], encounter: [[""], [1]] },
    ];
    const cmd = parseInput("1");
    const result = processInput(state, cmd);
    expect(result.type).toBe("transition");
    expect(state.currentLocation).toBe("cave");
  });
});

describe("createGame — items", () => {
  test("stores def.items as char.items IDs, not auto-added to inventory", () => {
    const state = createGame({
      items: [
        { id: "sword", name: "Sword", description: "A blade", load: 1, tags: ["combat"] },
        { id: "shield", name: "Shield", description: "A shield", load: 2, tags: ["protective"] },
      ],
      characters: [
        { name: "Luna", items: ["sword"] },
      ],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    const char = state.characters[0];
    expect(char.items).toEqual(["sword"]);
    expect(char.inventory).toEqual([]);
  });
});

describe("getContext — mayChangeInventory", () => {
  test("returns mayChangeInventory from location", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "armory", name: "Armory", description: "desc", mayChangeInventory: true, links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "armory",
    });
    const ctx = getContext(state);
    expect(ctx.mayChangeInventory).toBe(true);
    expect(ctx.onMission).toBe(false);
  });

  test("defaults mayChangeInventory to false", () => {
    const state = createGame({
      characters: [],
      locations: [{ id: "cave", name: "Cave", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "cave",
    });
    const ctx = getContext(state);
    expect(ctx.mayChangeInventory).toBe(false);
  });
});

describe("toggleitem command", () => {
  function makeState() {
    const definition = {
      items: [
        { id: "sword", name: "Sword", description: "A blade", load: 1, tags: ["combat"] },
        { id: "shield", name: "Shield", description: "A shield", load: 3, tags: ["protective"] },
        { id: "spec_item", name: "Specialized", description: "Special", load: 1, tags: ["tech"], effects: { specialized: true } },
      ],
      characters: [
        { name: "Luna", items: ["spec_item"] },
      ],
      locations: [{ id: "armory", name: "Armory", description: "desc", mayChangeInventory: true, links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "armory",
    };
    return createGame(definition);
  }

  test("equips general item within load limit", () => {
    const state = makeState();
    const cmd = { type: "toggleitem", itemId: "sword" };
    const result = processInput(state, cmd, 0);
    expect(result.type).toBe("item_toggled");
    expect(result.equipped).toBe(true);
    expect(state.characters[0].inventory.some((i) => i.id === "sword")).toBe(true);
  });

  test("errors when equipping unavailable specialized item", () => {
    const state = makeState();
    const cmd = { type: "toggleitem", itemId: "spec_item" };
    const char = state.characters[0];
    char.items = [];
    const result = processInput(state, cmd, 0);
    expect(result.type).toBe("error");
  });

  test("errors when exceeding max load off-mission (10)", () => {
    const state = makeState();
    const char = state.characters[0];
    char.load = 10;
    const cmd = { type: "toggleitem", itemId: "sword" };
    const result = processInput(state, cmd, 0);
    expect(result.type).toBe("error");
    expect(result.message).toContain("exceeds max load");
  });

  test("drops item off-mission", () => {
    const state = makeState();
    const char = state.characters[0];
    const item = state.items.find((i) => i.id === "sword");
    char.inventory.push(item);
    char.load = 1;
    const cmd = { type: "toggleitem", itemId: "sword" };
    const result = processInput(state, cmd, 0);
    expect(result.type).toBe("item_toggled");
    expect(result.equipped).toBe(false);
    expect(char.inventory.some((i) => i.id === "sword")).toBe(false);
  });

  test("errors dropping item on-mission", () => {
    const state = createGame({
      items: [
        { id: "sword", name: "Sword", description: "A blade", load: 1, tags: ["combat"] },
      ],
      characters: [
        { name: "Luna" },
      ],
      locations: [{ id: "armory", name: "Armory", description: "desc", mayChangeInventory: true, links: [], actions: [] }],
      plotlines: [{
        id: "test_mission",
        name: "Test",
        description: "Test",
        scenes: [],
        mission: {
          engagementAction: "Command",
          payoff: { rep: 1, coin: 1 },
          baseHeat: 0,
          tags: [],
          locationId: "armory",
          startingSceneId: null,
          dangerClock: { current: 0, max: 4 },
        },
      }],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "armory",
    });
    state.activeMissionId = "test_mission";
    const char = state.characters[0];
    const item = state.items.find((i) => i.id === "sword");
    char.inventory.push(item);
    char.load = 1;
    const cmd = { type: "toggleitem", itemId: "sword" };
    const result = processInput(state, cmd, 0);
    expect(result.type).toBe("error");
    expect(result.message).toContain("Cannot drop items during a mission");
  });

  test("errors equipping at location without mayChangeInventory", () => {
    const state = createGame({
      items: [{ id: "sword", name: "Sword", description: "A blade", load: 1, tags: ["combat"] }],
      characters: [{ name: "Luna" }],
      locations: [{ id: "cave", name: "Cave", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "cave",
    });
    const cmd = { type: "toggleitem", itemId: "sword" };
    const result = processInput(state, cmd, 0);
    expect(result.type).toBe("error");
    expect(result.message).toContain("only change gear");
  });
});

describe("Level Up", () => {
  function makeLevelUpState() {
    return createGame({
      characters: [
        { name: "Luna", xp: 8, actions: { Muscle: 2, Sway: 1 } },
      ],
      stunts: [
        { id: "quick_reflexes", name: "Quick Reflexes", description: "React faster.", tags: ["combat"] },
        { id: "shadow_step", name: "Shadow Step", description: "Move unseen.", tags: ["stealth"] },
      ],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
  }

  test("handleLevelUp returns error when XP < 8", () => {
    const state = createGame({
      characters: [{ name: "Luna", xp: 5 }],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    const result = processInput(state, { type: "levelup" }, 0);
    expect(result.type).toBe("error");
    expect(result.message).toContain("needs 8 XP");
  });

  test("handleLevelUp creates choice scene with 2 options", () => {
    const state = makeLevelUpState();
    const result = processInput(state, { type: "levelup" }, 0);
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("_levelup_choice:0");
    expect(result.context.type).toBe("scene");
    expect(result.context.options).toHaveLength(2);
    expect(result.context.options[0].text).toBe("Improve an Action");
    expect(result.context.options[1].text).toBe("Add a Stunt");
  });

  test("handleLevelUp creates action list scene with upgradeable actions", () => {
    const state = makeLevelUpState();
    processInput(state, { type: "levelup" }, 0);
    // Select "Improve an Action" (option 0)
    const result = processInput(state, { type: "select", index: 0 }, 0);
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("_levelup_actions:0");
    expect(result.context.options.length).toBeGreaterThan(0);
    // Should include actions with rating < 4 (Muscle=2, Sway=1, and all others at 0)
    const optionTexts = result.context.options.map((o) => o.text);
    expect(optionTexts.some((t) => t.includes("Muscle"))).toBe(true);
    expect(optionTexts.some((t) => t.includes("Sway"))).toBe(true);
  });

  test("handleLevelUp creates stunt list scene with available stunts", () => {
    const state = makeLevelUpState();
    processInput(state, { type: "levelup" }, 0);
    // Select "Add a Stunt" (option 1)
    const result = processInput(state, { type: "select", index: 1 }, 0);
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("_levelup_stunts:0");
    expect(result.context.options).toHaveLength(2);
    const optionTexts = result.context.options.map((o) => o.text);
    expect(optionTexts.some((t) => t.includes("Quick Reflexes"))).toBe(true);
    expect(optionTexts.some((t) => t.includes("Shadow Step"))).toBe(true);
  });

  test("selecting an action option upgrades the action and deducts XP", () => {
    const state = makeLevelUpState();
    processInput(state, { type: "levelup" }, 0);
    processInput(state, { type: "select", index: 0 }, 0);
    // Now in the actions scene. Find the Muscle option (rating 2 → 3)
    const actionsScene = state.scenes.find((s) => s.id === "_levelup_actions:0");
    const muscleIdx = actionsScene.options.findIndex((o) => o.text.includes("Muscle"));
    const result = processInput(state, { type: "select", index: muscleIdx }, 0);
    expect(result.type).toBe("scene_end");
    expect(state.characters[0].actions.Muscle).toBe(3);
    expect(state.characters[0].xp).toBe(0);
    expect(state.activeScene).toBeNull();
  });

  test("selecting a stunt option adds the stunt and deducts XP", () => {
    const state = makeLevelUpState();
    processInput(state, { type: "levelup" }, 0);
    processInput(state, { type: "select", index: 1 }, 0);
    // Now in the stunts scene. Select "Quick Reflexes" (option 0)
    const result = processInput(state, { type: "select", index: 0 }, 0);
    expect(result.type).toBe("scene_end");
    expect(state.characters[0].stunts).toHaveLength(1);
    expect(state.characters[0].stunts[0].id).toBe("quick_reflexes");
    expect(state.characters[0].xp).toBe(0);
    expect(state.activeScene).toBeNull();
  });

  test("levelup command works via parser", () => {
    const state = makeLevelUpState();
    const cmd = parseInput("levelup");
    expect(cmd.type).toBe("levelup");
    const result = processInput(state, cmd, 0);
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("_levelup_choice:0");
  });

  test("levelup command still works via downtime for backward compat", () => {
    const state = makeLevelUpState();
    const cmd = parseInput("levelup Muscle");
    expect(cmd.type).toBe("downtime");
    expect(cmd.action).toBe("levelup");
    expect(cmd.param).toBe("Muscle");
  });

  test("gameStunts is populated from definition", () => {
    const state = makeLevelUpState();
    expect(state.gameStunts).toHaveLength(2);
    expect(state.gameStunts[0].id).toBe("quick_reflexes");
    expect(state.gameStunts[1].id).toBe("shadow_step");
  });

  test("stunt list excludes stunts character already has", () => {
    const state = createGame({
      characters: [
        {
          name: "Luna",
          xp: 8,
          actions: { Muscle: 2 },
          stunts: [{ id: "quick_reflexes", name: "Quick Reflexes", tags: [], action: null, bonusDice: 0, bonusTicks: 0, bonusEffect: 0, substituteAction: null }],
        },
      ],
      stunts: [
        { id: "quick_reflexes", name: "Quick Reflexes", description: "React faster.", tags: ["combat"] },
        { id: "shadow_step", name: "Shadow Step", description: "Move unseen.", tags: ["stealth"] },
      ],
      locations: [{ id: "room1", name: "Room", description: "desc", links: [], actions: [] }],
      plotlines: [],
      factions: [],
      factionClocks: [],
      claims: [],
      crew: null,
      startLocation: "room1",
    });
    processInput(state, { type: "levelup" }, 0);
    processInput(state, { type: "select", index: 1 }, 0);
    // Should only show shadow_step, not quick_reflexes
    expect(state.scenes.find((s) => s.id === "_levelup_stunts:0").options).toHaveLength(1);
    expect(state.scenes.find((s) => s.id === "_levelup_stunts:0").options[0].hooks.stuntId).toBe("shadow_step");
  });
});
