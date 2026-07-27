import { describe, test, expect } from "bun:test";
import {
  createGameState, addCharacter, addLocation, setCurrentLocation, getCurrentLocation,
  addScene, setActiveScene, clearActiveScene, getActiveScene,
  addPlotline, setFlag, hasFlag, clearFlag, addStunt, addLogEntry, serialize, deserialize,
} from "../src/state.js";
import { createCharacter } from "../src/character.js";
import { createLocation } from "../src/location.js";
import { createScene } from "../src/scene.js";
import { createPlotline } from "../src/plotline.js";

describe("createGameState", () => {
  test("initialises all fields", () => {
    const s = createGameState();
    expect(s.characters).toEqual([]);
    expect(s.locations).toEqual([]);
    expect(s.flags).toEqual({});
    expect(s.currentLocation).toBeNull();
    expect(s.activeScene).toBeNull();
  });
});

describe("addCharacter / addLocation / addScene / addPlotline", () => {
  test("appends to respective arrays", () => {
    const s = createGameState();
    addCharacter(s, createCharacter("Luna"));
    expect(s.characters).toHaveLength(1);
    addLocation(s, createLocation("l1", "Loc", "desc", "zone"));
    expect(s.locations).toHaveLength(1);
    addScene(s, createScene("s1", "action", "desc"));
    expect(s.scenes).toHaveLength(1);
    addPlotline(s, createPlotline("p1", "Plot", "desc"));
    expect(s.plotlines).toHaveLength(1);
  });
});

describe("setCurrentLocation / getCurrentLocation", () => {
  test("finds and sets current location", () => {
    const s = createGameState();
    addLocation(s, createLocation("l1", "Loc", "desc", "zone"));
    setCurrentLocation(s, "l1");
    expect(getCurrentLocation(s).id).toBe("l1");
  });

  test("returns null for unknown location", () => {
    expect(getCurrentLocation(createGameState())).toBeNull();
  });
});

describe("setActiveScene / getActiveScene / clearActiveScene", () => {
  test("sets active scene and calls onEnter", () => {
    const s = createGameState();
    const scene = createScene("s1", "dialogue", "desc");
    const log = [];
    scene.onEnter = (state, sc) => log.push("enter");
    addScene(s, scene);
    setActiveScene(s, "s1");
    expect(getActiveScene(s).id).toBe("s1");
    expect(log).toEqual(["enter"]);
  });

  test("clearActiveScene", () => {
    const s = createGameState();
    const scene = createScene("s1", "dialogue", "desc");
    addScene(s, scene);
    setActiveScene(s, "s1");
    clearActiveScene(s);
    expect(s.activeScene).toBeNull();
  });

  test("switching scenes calls onExit on previous", () => {
    const s = createGameState();
    const s1 = createScene("s1", "dialogue", "desc");
    const s2 = createScene("s2", "dialogue", "desc");
    const log = [];
    s1.onExit = (state, sc) => log.push("exit s1");
    addScene(s, s1);
    addScene(s, s2);
    setActiveScene(s, "s1");
    setActiveScene(s, "s2");
    expect(log).toEqual(["exit s1"]);
  });
});

describe("flags", () => {
  test("setFlag / hasFlag / clearFlag", () => {
    const s = createGameState();
    setFlag(s, "done");
    expect(hasFlag(s, "done")).toBe(true);
    clearFlag(s, "done");
    expect(hasFlag(s, "done")).toBe(false);
  });
});

describe("addStunt / addLogEntry", () => {
  test("adds to respective arrays", () => {
    const s = createGameState();
    addStunt(s, { id: "s1" });
    expect(s.stunts).toHaveLength(1);
    addLogEntry(s, { type: "test" });
    expect(s.gameLog).toHaveLength(1);
  });
});

describe("serialize / deserialize", () => {
  test("produces deep copy", () => {
    const s = createGameState();
    s.flags.active = true;
    const copy = serialize(s);
    expect(copy.flags.active).toBe(true);
    copy.flags.active = false;
    expect(s.flags.active).toBe(true);
  });
});
