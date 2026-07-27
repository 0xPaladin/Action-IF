import { describe, test, expect } from "bun:test";
import {
  createLocation, createLink, createAction, addLink, addAction,
  getVisibleLinks, getAvailableActions, useLink, useAction, enterLocation, exitLocation,
} from "../src/location.js";
import {
  createZone, addZone, generateZoneNodeGraph,
} from "../src/zone.js";
import { createGameState } from "../src/state.js";

describe("createLocation", () => {
  test("creates location with default fields", () => {
    const l = createLocation("room1", "Dark Room", "A spooky room");
    expect(l.id).toBe("room1");
    expect(l.links).toEqual([]);
    expect(l.actions).toEqual([]);
    expect(l.children).toBeUndefined();
    expect(l.mayChangeInventory).toBe(false);
  });

  test("can set mayChangeInventory", () => {
    const l = createLocation("armory", "Armory", "Gear room", null, true);
    expect(l.mayChangeInventory).toBe(true);
  });
});

describe("links", () => {
  test("addLink and getVisibleLinks", () => {
    const l = createLocation("room1", "Room", "desc");
    addLink(l, createLink("room2", "North", null, false));
    addLink(l, createLink("room3", "Secret", { flag: "key" }, false));
    const visible = getVisibleLinks(l, { flags: {} });
    expect(visible).toHaveLength(1);
    expect(visible[0].label).toBe("North");
  });

  test("useLink returns targetId and journey", () => {
    const l = createLocation("room1", "Room", "desc");
    addLink(l, createLink("room2", "North"));
    const result = useLink(l, 0, { flags: {} });
    expect(result.targetId).toBe("room2");
    expect(result.journey).toBeNull();
  });

  test("useLink returns journey when present", () => {
    const l = createLocation("room1", "Room", "desc");
    addLink(l, createLink("room2", "North", null, false, null, [{ id: "encounter1", type: "dialogue", fiction: "A goblin appears!", tags: [], options: [{ text: "Fight" }] }]));
    const result = useLink(l, 0, { flags: {} });
    expect(result.targetId).toBe("room2");
    expect(result.journey).toHaveLength(1);
  });

  test("useLink throws for locked link", () => {
    const l = createLocation("room1", "Room", "desc");
    addLink(l, createLink("room2", "North", null, true, "key"));
    expect(() => useLink(l, 0, { flags: {} })).toThrow(/locked/);
  });

  test("useLink throws for unavailable link", () => {
    const l = createLocation("room1", "Room", "desc");
    addLink(l, createLink("room2", "North", { flag: "gone" }));
    expect(() => useLink(l, 0, { flags: {} })).toThrow(/not available/);
  });

  test("useLink throws for bad index", () => {
    const l = createLocation("room1", "Room", "desc");
    expect(() => useLink(l, 99, { flags: {} })).toThrow();
  });
});

describe("actions", () => {
  test("getAvailableActions filters used and conditional", () => {
    const l = createLocation("room1", "Room", "desc");
    addAction(l, createAction("search", "Search", "Look around", false));
    addAction(l, createAction("once", "One-time", "Do it", true));
    addAction(l, createAction("secret", "Secret", "Secret", false, null, null, [], { flag: "key" }));
    expect(getAvailableActions(l, { flags: {} })).toHaveLength(2);
    l.actions[1].used = true;
    expect(getAvailableActions(l, { flags: {} })).toHaveLength(1);
  });

  test("useAction sets flags and keys", () => {
    const l = createLocation("room1", "Room", "desc");
    addAction(l, createAction("pull", "Pull lever", "Pull it", false, null, "lever_pulled", ["key1"]));
    const state = createGameState();
    const result = useAction(l, 0, state);
    expect(state.flags.lever_pulled).toBe(true);
    expect(state.flags.key1).toBe(true);
    expect(result.triggerScene).toBeNull();
  });

  test("useAction marks once-actions as used", () => {
    const l = createLocation("room1", "Room", "desc");
    addAction(l, createAction("once", "One-time", "Do it", true));
    useAction(l, 0, { flags: {} });
    expect(l.actions[0].used).toBe(true);
    expect(() => useAction(l, 0, { flags: {} })).toThrow(/already been used/);
  });
});

describe("enterLocation / exitLocation", () => {
  test("calls onEnter and onExit", () => {
    const l = createLocation("room1", "Room", "desc");
    const log = [];
    l.onEnter = (loc, state) => log.push("enter");
    l.onExit = (loc, state) => log.push("exit");
    enterLocation(l, createGameState());
    exitLocation(l, createGameState());
    expect(log).toEqual(["enter", "exit"]);
  });
});

describe("generateZoneNodeGraph", () => {
  function buildState(zones) {
    const state = createGameState();
    for (const z of zones) addZone(state, z);
    return state;
  }

  test("auto-populates children from parent references", () => {
    const parent = createZone("p1", "area", "Parent", "desc");
    const child = createZone("c1", "site", "Child", "desc", "p1");
    const state = buildState([parent, child]);
    generateZoneNodeGraph(state);
    expect(parent.children).toEqual(["c1"]);
  });

  test("generates parent-to-child link", () => {
    const parent = createZone("p1", "area", "Parent", "desc");
    const child = createZone("c1", "site", "Child", "desc", "p1");
    const state = buildState([parent, child]);
    generateZoneNodeGraph(state);
    expect(parent.links).toHaveLength(1);
    expect(parent.links[0].targetId).toBe("c1");
    expect(parent.links[0].label).toBe("Child");
  });

  test("generates child-to-parent return link", () => {
    const parent = createZone("p1", "area", "Parent Room", "desc");
    const child = createZone("c1", "site", "Child", "desc", "p1");
    const state = buildState([parent, child]);
    generateZoneNodeGraph(state);
    expect(child.links).toHaveLength(1);
    expect(child.links[0].targetId).toBe("p1");
    expect(child.links[0].label).toBe("Return to Parent Room");
  });

  test("skips existing links with same targetId", () => {
    const parent = createZone("p1", "area", "Parent", "desc");
    const child = createZone("c1", "site", "Child", "desc", "p1");
    addLink(parent, createLink("c1", "Custom Label"));
    const state = buildState([parent, child]);
    generateZoneNodeGraph(state);
    expect(parent.links).toHaveLength(1);
    expect(parent.links[0].label).toBe("Custom Label");
  });

  test("root zone gets no parent link", () => {
    const zone = createZone("root", "realm", "Root", "desc");
    const state = buildState([zone]);
    generateZoneNodeGraph(state);
    expect(zone.links).toEqual([]);
  });

  test("multiple children get links to each", () => {
    const parent = createZone("p1", "area", "Parent", "desc");
    const c1 = createZone("c1", "site", "Alpha", "desc", "p1");
    const c2 = createZone("c2", "site", "Beta", "desc", "p1");
    const state = buildState([parent, c1, c2]);
    generateZoneNodeGraph(state);
    expect(parent.links).toHaveLength(2);
    expect(parent.links.map((l) => l.targetId)).toEqual(["c1", "c2"]);
  });

  test("nested hierarchy generates links at each level", () => {
    const top = createZone("top", "realm", "Top", "desc");
    const mid = createZone("mid", "area", "Middle", "desc", "top");
    const bot = createZone("bot", "site", "Bottom", "desc", "mid");
    const state = buildState([top, mid, bot]);
    generateZoneNodeGraph(state);
    expect(top.links).toHaveLength(1);
    expect(top.links[0].targetId).toBe("mid");
    expect(mid.links).toHaveLength(2);
    expect(mid.links.map((l) => l.targetId)).toEqual(["bot", "top"]);
    expect(bot.links).toHaveLength(1);
    expect(bot.links[0].targetId).toBe("mid");
  });

  test("deduplicates children when parent already set", () => {
    const parent = createZone("p1", "area", "Parent", "desc");
    const child = createZone("c1", "site", "Child", "desc", "p1");
    parent.children.push("c1");
    const state = buildState([parent, child]);
    generateZoneNodeGraph(state);
    expect(parent.children).toEqual(["c1"]);
  });
});
