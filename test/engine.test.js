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
      crew: { id: "c1", name: "Crew", description: "A crew of shadows", coin: 3 },
      startLocation: "room1",
    };
    const state = createGame(def);
    expect(state.crew.name).toBe("Crew");
    expect(state.crew.coin).toBe(3);
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
