import { describe, test, expect } from "bun:test";
import {
  createPlotline, getActiveMission, isMissionComplete,
  addMissionHeat, finishMission, startPlotlineMission, updateMission,
} from "../src/plotline.js";
import { createGameState } from "../src/state.js";
import { createScene } from "../src/scene.js";
import { createCrew } from "../src/crew.js";
import { createFaction } from "../src/faction.js";
import { heatForAction } from "../src/mission.js";

function makeScene(id) {
  return createScene(id, "action", id);
}

function makePlotline(id, sceneDefs, missionOpts = {}) {
  const scenes = sceneDefs.map((d) => (typeof d === "string" ? makeScene(d) : d));
  return createPlotline(id, "M", "d", scenes, missionOpts);
}

describe("createPlotline with mission config", () => {
  test("creates plotline with mission defaults", () => {
    const p = makePlotline("p1", ["s1", "s2"], { locationId: "loc1", startingSceneId: "s1" });
    expect(p.id).toBe("p1");
    expect(p.completed).toBe(false);
    expect(p.mission).not.toBeNull();
    expect(p.mission.heatGenerated).toBe(0);
    expect(p.mission.payoff).toEqual({ rep: 0, coin: 0 });
    expect(p.mission.locationId).toBe("loc1");
    expect(p.mission.startingSceneId).toBe("s1");
  });

  test("accepts mission options", () => {
    const p = makePlotline("p1", ["s1"], {
      patron: "clem",
      payoff: { rep: 2, coin: 4 },
      baseHeat: 2,
      locationId: "loc1",
      startingSceneId: "s1",
    });
    expect(p.mission.patron).toBe("clem");
    expect(p.mission.payoff.coin).toBe(4);
    expect(p.mission.baseHeat).toBe(2);
  });

  test("plotline without mission has null mission", () => {
    const p = createPlotline("p1", "Plain", "no mission", []);
    expect(p.mission).toBeNull();
  });
});

describe("startPlotlineMission / getActiveMission", () => {
  test("sets state for active plotline mission", () => {
    const state = createGameState();
    const s1 = makeScene("s1");
    state.scenes.push(s1);
    state.locations.push({ id: "loc1" });
    const p = makePlotline("p1", [s1], { locationId: "loc1", startingSceneId: "s1" });
    state.plotlines.push(p);
    startPlotlineMission(state, p);
    expect(state.activeMissionId).toBe("p1");
    expect(getActiveMission(state).id).toBe("p1");
  });
});

describe("isMissionComplete", () => {
  test("true when all scenes resolved", () => {
    const s1 = makeScene("s1"); s1.resolved = true;
    const s2 = makeScene("s2"); s2.resolved = true;
    const p = makePlotline("p1", [s1, s2], { locationId: "loc1", startingSceneId: "s1" });
    expect(isMissionComplete(p)).toBe(true);
  });

  test("false when some scenes unresolved", () => {
    const s1 = makeScene("s1"); s1.resolved = true;
    const s2 = makeScene("s2"); s2.resolved = false;
    const p = makePlotline("p1", [s1, s2], { locationId: "loc1", startingSceneId: "s1" });
    expect(isMissionComplete(p)).toBe(false);
  });

  test("false for plotline without mission", () => {
    const s1 = makeScene("s1");
    const p = createPlotline("p1", "Plain", "no mission", [s1]);
    expect(isMissionComplete(p)).toBe(false);
  });
});

describe("addMissionHeat", () => {
  test("tracks max heat per action", () => {
    const state = createGameState();
    const p = makePlotline("p1", ["s1"], { locationId: "loc1", startingSceneId: "s1" });
    state.plotlines.push(p);
    state.activeMissionId = "p1";
    addMissionHeat(state, 2);
    addMissionHeat(state, 1);
    expect(getActiveMission(state).mission.heatGenerated).toBe(2);
  });
});

describe("finishMission", () => {
  test("applies payoff, heat to factions, clears mission", () => {
    const state = createGameState();
    state.crew = createCrew("crew1", "The Crew", { description: "A crew of shadows", coin: 5 });
    state.factions.push(createFaction("lampblacks", "Lampblacks", "", { heat: 0 }));
    state.factions.push(createFaction("billhooks", "Billhooks", "", { heat: 0 }));
    const p = makePlotline("p1", ["s1"], {
      patronFaction: "lampblacks",
      targetFaction: "billhooks",
      payoff: { rep: 2, coin: 3 },
      baseHeat: 2,
      locationId: "loc1",
      startingSceneId: "s1",
    });
    state.plotlines.push(p);
    state.activeMissionId = "p1";
    p.mission.heatGenerated = 3;
    finishMission(state, p);
    expect(state.crew.coin).toBe(8);
    expect(state.crew.reputation).toBe(2);
    const patron = state.factions.find((f) => f.id === "lampblacks");
    expect(patron.heat).toBe(-2);
    const target = state.factions.find((f) => f.id === "billhooks");
    expect(target.heat).toBe(5);
    expect(state.activeMissionId).toBeNull();
    expect(p.mission.completed).toBe(true);
  });
});

describe("heatForAction", () => {
  test("computes heat from outcome and action heat", () => {
    expect(heatForAction("full", 3)).toBe(2);
    expect(heatForAction("critical", 3)).toBe(1);
    expect(heatForAction("partial", 3)).toBe(2);
    expect(heatForAction("failure", 3)).toBe(3);
    expect(heatForAction("failure", 5)).toBe(5);
    expect(heatForAction("critical", 5)).toBe(3);
  });
});
