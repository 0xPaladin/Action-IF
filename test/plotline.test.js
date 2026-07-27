import { describe, test, expect } from "bun:test";
import { createPlotline, addSceneToPlotline, plotlineStatus, isPlotlineComplete, updatePlotlines } from "../src/plotline.js";
import { createScene } from "../src/scene.js";

describe("createPlotline", () => {
  test("creates plotline with scene objects", () => {
    const s1 = createScene("s1", "action", "a");
    const s2 = createScene("s2", "dialogue", "b");
    const p = createPlotline("p1", "The Heist", "desc", [s1, s2]);
    expect(p.scenes).toHaveLength(2);
    expect(p.scenes[0].id).toBe("s1");
    expect(p.scenes[1].id).toBe("s2");
    expect(p.completed).toBe(false);
  });
});

describe("addSceneToPlotline", () => {
  test("adds scene object skipping duplicates", () => {
    const s1 = createScene("s1", "action", "a");
    const s2 = createScene("s2", "dialogue", "b");
    const p = createPlotline("p1", "p", "", [s1]);
    addSceneToPlotline(p, s2);
    expect(p.scenes).toHaveLength(2);
    addSceneToPlotline(p, s1);
    expect(p.scenes).toHaveLength(2);
  });
});

describe("plotlineStatus / isPlotlineComplete", () => {
  test("reports completion when all scenes resolved", () => {
    const s1 = createScene("s1", "dialogue", "text");
    s1.resolved = true;
    const p = createPlotline("p1", "p", "", [s1]);
    const status = plotlineStatus(p);
    expect(status.completed).toBe(true);
    expect(isPlotlineComplete(p)).toBe(true);
  });
});

describe("updatePlotlines", () => {
  test("marks plotlines complete when all scenes done", () => {
    const s1 = createScene("s1", "dialogue", "text");
    s1.resolved = true;
    const state = { plotlines: [createPlotline("p1", "p", "", [s1])] };
    updatePlotlines(state);
    expect(state.plotlines[0].completed).toBe(true);
  });
});
