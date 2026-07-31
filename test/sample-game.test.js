import { describe, test, expect } from "bun:test";
import { createGame, getContext, processInput } from "../src/engine.js";
import { parseInput } from "../src/parser.js";
import { getActiveMission, startPlotlineMission } from "../src/plotline.js";
import { engagementRoll } from "../src/engagement.js";
import { addResource, addCrewXp } from "../src/crew.js";
import { takeClaim, getAvailableClaims } from "../src/claim.js";
import {
  startDowntime,
  doRecovery,
  doTraining,
  doLevelUp,
  createProject,
  doProject,
} from "../src/downtime.js";
import { createGameState, addLogEntry, serialize, findSceneById } from "../src/state.js";
import { tickFactionClock } from "../src/factionClock.js";
import { resolveHook } from "../src/hook.js";
import def from "../games/sample-game/game.json" with { type: "json" };

describe("Verse Setting: Guardian Command 'Hammerfall'", () => {
  let state;

  test("01 — createGame initializes the full Verse setting", () => {
    state = createGame(def);

    expect(state.characters).toHaveLength(4);
    expect(state.characters[0].name).toBe("Valeria Steelforged");
    expect(state.characters[1].name).toBe("Kael Stormchaser");
    expect(state.characters[2].name).toBe("Nexus-Charged-Zeta-7T3");
    expect(state.characters[3].name).toBe("Mara Deephold");

    expect(state.characters[0].actions.Muscle).toBe(2);
    expect(state.characters[3].actions.Sneak).toBe(2);

    expect(state.characters[0].stunts.length).toBeGreaterThanOrEqual(1);

    expect(state.crew.name).toBe("Guardian Command 'Hammerfall'");
    expect(state.crew.resources.coin).toBe(4);
    expect(state.gameResources.coin).toBeDefined();
    expect(state.gameResources.coin.name).toBe("Coin");
    expect(state.crew.stunts).toHaveLength(1);
    expect(state.crew.stunts[0].id).toBe("guardian_coordination");

    expect(state.factions).toHaveLength(3);
    expect(state.factionClocks).toHaveLength(1);
    expect(state.claims).toHaveLength(2);
    expect(state.plotlines).toHaveLength(1);
    expect(state.locations.length).toBe(5);
    expect(state.zones.length).toBe(3);

    expect(state.currentLocation).toBe("junction_concord");
  });

  test("02 — getContext shows junction at start", () => {
    const ctx = getContext(state);
    expect(ctx.type).toBe("location");
    expect(ctx.name).toContain("Junction");
    expect(ctx.links.length).toBeGreaterThanOrEqual(1);
  });

  test("03 — navigate from Junction Concorde to Guardian HQ Atrium", () => {
    let ctx = getContext(state);
    const linkLabels = ctx.links.map((l) => l.label);
    expect(linkLabels).toContain("Guardian HQ — Nexus Operations");

    const result = processInput(state, parseInput("1"));
    expect(result.type).toBe("transition");
    expect(result.to).toBe("guardian_hq_atrium");

    ctx = getContext(state);
    expect(ctx.type).toBe("location");
    expect(ctx.name).toContain("Guardian Nexus");
  });

  test("04 — navigate to Operations Center", () => {
    const result = processInput(state, parseInput("1"));
    expect(result.type).toBe("transition");
    expect(result.to).toBe("ops_center");

    const ctx = getContext(state);
    expect(ctx.name).toContain("Operations Center");
  });

  test("05 — review intel to set flag", () => {
    const result = processInput(state, parseInput("review"));
    expect(result.type).toBe("action_done");
    expect(state.flags.intel_reviewed).toBe(true);
  });

  test("06 — at Operations Center with Commander Valeria", () => {
    const ctx = getContext(state);
    expect(ctx.name).toContain("Operations Center");
  });

  test("07 — Talk to Commander Valeria triggers NPC introduction dialogue", () => {
    let ctx = getContext(state);
    expect(ctx.npcs).toBeDefined();
    expect(ctx.npcs.length).toBeGreaterThanOrEqual(1);
    expect(ctx.npcs[0].name).toContain("Valeria");

    const result = processInput(state, parseInput("talk 1"));
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("npc:valeria:introduction");

    ctx = getContext(state);
    expect(ctx.type).toBe("scene");
    expect(ctx.sceneType).toBe("dialogue");
    expect(ctx.options.length).toBe(3);
  });

  test("08 — choose stealth approach in Valeria's dialogue", () => {
    const result = processInput(state, parseInput("1"));
    expect(result.type).toBe("scene_end");
    expect(state.flags.stealth_approach).toBe(true);
    expect(state.flags.vorath_mission_ready).toBe(true);

    const ctx = getContext(state);
    expect(ctx.type).toBe("location");
    expect(ctx.name).toContain("Operations Center");
  });

  test("09 — Start Mission action triggers engagement and teleports to Waystation", () => {
    const ctx = getContext(state);
    expect(ctx.type).toBe("location");
    expect(ctx.name).toContain("Operations Center");
    expect(state.flags.vorath_mission_ready).toBe(true);

    const result = processInput(state, parseInput("start"));
    expect(result.type).toBe("scene_start");
    expect(result.sceneId).toBe("engagement_launch");

    let ctx2 = getContext(state);
    expect(ctx2.type).toBe("scene");
    expect(ctx2.sceneType).toBe("dialogue");
    expect(ctx2.options.length).toBe(3);

    const optionResult = processInput(state, parseInput("1"));
    expect(optionResult.type).toBe("scene_end");

    expect(state.currentLocation).toBe("waystation_platform");
  });

  test("10 — engagement roll starts the mission", () => {
    const rating = state.characters[0].actions.Command;
    const rollResult = engagementRoll(rating);
    const plotline = state.plotlines.find((p) => p.id === "echoes_void");
    startPlotlineMission(state, plotline);

    expect(state.activeMissionId).toBe("echoes_void");
    expect(state.currentLocation).toBe("waystation_platform");

    const ctx = getContext(state);
    expect(ctx.type).toBe("scene");
    expect(ctx.missionId).toBe("echoes_void");
  });

  test("11 — scout scene: resolve Survey challenge with actions", () => {
    let ctx = getContext(state);
    expect(ctx.type).toBe("scene");
    expect(ctx.sceneType).toBe("action");
    expect(ctx.challenges).toHaveLength(1);
    expect(ctx.challenges[0].id).toBe("survey");

    const surveyChallenge = findSceneById(state, "scout_scene").challenges[0];
    expect(surveyChallenge.actions).toHaveLength(3);

    const result = processInput(state, {
      type: "resolve",
      challengeIndex: 0,
      actionIndex: 0,
      characterIndex: 1,
    });

    expect(["roll_result", "challenge_done", "scene_end"]).toContain(
      result.type,
    );
    expect(result.roll).toBeDefined();
    expect(result.roll.action).toBe("Sneak");
    expect(result.roll.outcome).toBeDefined();

    if (result.type === "scene_end") {
      expect(state.flags.perimeter_key).toBe(true);

      const plotline = getActiveMission(state);
      expect(plotline.mission.heatGenerated).toBeGreaterThanOrEqual(0);
    }
  });

  test("12 — complete scout scene (finish survey if needed)", () => {
    const scene = findSceneById(state, "scout_scene");
    const surveyChallenge = scene.challenges[0];
    let safety = 0;
    while (!surveyChallenge.resolved && safety < 200) {
      safety++;
      const result = processInput(state, {
        type: "resolve",
        challengeIndex: 0,
        actionIndex: safety % 3,
        characterIndex: safety % 4,
      });
    }
    expect(surveyChallenge.resolved).toBe(true);
    expect(state.flags.perimeter_key).toBe(true);

    let ctx = getContext(state);
    safety = 0;
    while (ctx.type !== "location" && safety < 200) {
      safety++;
      ctx = getContext(state);
    }
    if (ctx.type === "location") {
      expect(ctx.name).toContain("Waystation");
    }
  });

  test("13 — Enter Listening Post now available", () => {
    let ctx = getContext(state);
    let safety = 0;
    while (ctx.type !== "location" && safety < 200) {
      safety++;
      if (ctx.type === "scene") {
        processInput(state, {
          type: "resolve",
          challengeIndex: 0,
          actionIndex: safety % 3,
          characterIndex: safety % 4,
        });
      }
      ctx = getContext(state);
    }
    expect(ctx.type).toBe("location");
    if (ctx.type === "location") {
      expect(ctx.name).toContain("Waystation");
    }
    expect(state.flags.perimeter_key).toBe(true);
  });

  test("14 — Infiltrate scene: resolve both challenges", () => {
    let ctx = getContext(state);
    let safety = 0;
    while (ctx.type !== "location" && safety < 200) {
      safety++;
      if (ctx.type === "scene") {
        processInput(state, {
          type: "resolve",
          challengeIndex: 0,
          actionIndex: 0,
          characterIndex: 2,
        });
      }
      ctx = getContext(state);
    }

    const result = processInput(state, {
      type: "action",
      text: "enter listening post",
    });
    expect(result.type).toBe("scene_start");

    ctx = getContext(state);
    expect(ctx.type).toBe("scene");

    const infiltrateScene = findSceneById(state, "infiltrate_scene");
    const doorChallenge = infiltrateScene.challenges.find(
      (c) => c.id === "security_door",
    );
    const patrolChallenge = infiltrateScene.challenges.find(
      (c) => c.id === "guard_patrol",
    );

    let safety2 = 0;
    while (
      (!doorChallenge.resolved || !patrolChallenge.resolved) &&
      safety2 < 200
    ) {
      safety2++;
      const ci = doorChallenge.resolved ? 1 : 0;
      const ai = safety2 % 3;
      const charIdx = (safety2 + 1) % 4;
      const r = processInput(state, {
        type: "resolve",
        challengeIndex: ci,
        actionIndex: ai,
        characterIndex: charIdx,
      });
      if (r.type === "error") {
        // try next action index
        continue;
      }
    }
    expect(doorChallenge.resolved).toBe(true);
    expect(patrolChallenge.resolved).toBe(true);
    expect(doorChallenge.resolved).toBe(true);
    expect(patrolChallenge.resolved).toBe(true);

    let ctx2 = getContext(state);
    let safety3 = 0;
    while (ctx2.type !== "location" && safety3 < 20) {
      safety3++;
      if (ctx2.type === "scene") {
        processInput(state, {
          type: "resolve",
          challengeIndex: 0,
          actionIndex: 0,
          characterIndex: 0,
        });
      }
      ctx2 = getContext(state);
    }
    expect(state.flags.archive_unlocked).toBe(true);
  });

  test("15 — Descend to Archive triggers dialogue scene", () => {
    let ctx = getContext(state);
    let safety = 0;
    while (ctx.type !== "location" && safety < 200) {
      safety++;
      if (ctx.type === "scene") {
        processInput(state, {
          type: "resolve",
          challengeIndex: 0,
          actionIndex: 0,
          characterIndex: 0,
        });
      }
      ctx = getContext(state);
    }
    expect(ctx.type).toBe("location");

    const result = processInput(state, parseInput("descend"));
    expect(result.type).toBe("scene_start");

    const ctx2 = getContext(state);
    expect(ctx2.sceneType).toBe("dialogue");
    expect(ctx2.options.length).toBeGreaterThanOrEqual(3);
  });

  test("16 — engage K'tharr in combat", () => {
    let ctx = getContext(state);
    expect(ctx.type).toBe("scene");
    expect(ctx.sceneType).toBe("dialogue");

    const result = processInput(state, parseInput("2"));
    expect(result.type).toBe("scene_start");

    ctx = getContext(state);
    if (ctx.type === "scene" && ctx.sceneId === "combat_scene") {
      const combatScene = findSceneById(state, "combat_scene");
      const combatChallenge = combatScene.challenges[0];

      let safety = 0;
      while (!combatChallenge.resolved && safety < 200) {
        safety++;
        processInput(state, {
          type: "resolve",
          challengeIndex: 0,
          actionIndex: safety % 4,
          characterIndex: safety % 4,
        });
      }
      expect(combatChallenge.resolved).toBe(true);
      expect(state.flags.agent_defeated).toBe(true);
    }
  });

  test("17 — mission completes after extract scene", () => {
    let ctx = getContext(state);
    let safety = 0;
    while (ctx.type !== "location" && safety < 200) {
      safety++;
      if (ctx.type === "scene") {
        processInput(state, {
          type: "resolve",
          challengeIndex: 0,
          actionIndex: 0,
          characterIndex: 0,
        });
      }
      ctx = getContext(state);
    }

    if (!state.flags.extraction_called) {
      const result = processInput(state, parseInput("call"));
      expect(result.type).toBe("scene_start");

      const extractScene = findSceneById(state, "extract_scene");
      const extractChallenge = extractScene.challenges[0];
      let safety2 = 0;
      while (!extractChallenge.resolved && safety2 < 200) {
        safety2++;
        processInput(state, {
          type: "resolve",
          challengeIndex: 0,
          actionIndex: safety2 % 4,
          characterIndex: safety2 % 4,
        });
      }
      expect(extractChallenge.resolved).toBe(true);
    }

    let ctx2 = getContext(state);
    let safety3 = 0;
    while (ctx2.type !== "location" && safety3 < 200) {
      safety3++;
      ctx2 = getContext(state);
    }

    expect(state.flags.extraction_called).toBe(true);
    expect(state.activeMissionId).toBeNull();
    expect(state.flags.operation_complete).toBe(true);
  });

  test("18 — mission payoff: coin, rep applied", () => {
    expect(state.crew.resources.coin).toBeGreaterThanOrEqual(4);
    expect(state.crew.resources.reputation).toBeGreaterThanOrEqual(1);
  });

  test("19 — faction heat changed from mission", () => {
    const guardiansFaction = state.factions.find((f) => f.id === "guardians");
    const hegemonyFaction = state.factions.find((f) => f.id === "hegemony");
    expect(guardiansFaction.heat).toBeLessThan(2);
    expect(hegemonyFaction.heat).toBeGreaterThan(-2);
  });

  test("20 — bonus payout claim applies to tagged missions", () => {
    expect(state.crew.bonusPayouts).toBeDefined();

    const guardianClaim = state.claims.find(
      (c) => c.id === "guardian_supply_line",
    );
    takeClaim(state, "guardian_supply_line");

    const bonusPayout = state.crew.bonusPayouts.find((bp) =>
      bp.tags.includes("guardian"),
    );
    expect(bonusPayout).toBeDefined();
    expect(bonusPayout.bonusCoin).toBe(2);

    if (!state.flags.operation_complete) {
      expect(guardianClaim.taken).toBe(true);
    }
  });

  test("21 — income claim adds coin", () => {
    const coinBefore = state.crew.resources.coin;
    takeClaim(state, "junction_safehouse");
    expect(state.crew.resources.coin).toBe(coinBefore + 1);
  });

  test("22 — faction clock: hegemony_response tracks progress", () => {
    const hegClock = state.factionClocks.find(
      (c) => c.id === "hegemony_response",
    );
    expect(hegClock.clock.current).toBeGreaterThanOrEqual(0);
  });

  test("25 — fortune roll via engine", () => {
    const result = processInput(state, { type: "fortune", pool: 3 });
    expect(result.type).toBe("fortune_result");
    expect(result.pool).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.outcome).toHaveProperty("level");
  });

  test("26 — downtime: recovery (merged), training, levelup", () => {
    const char = state.characters[0];
    char.body = 5;
    char.conditions = ["exposed"];
    char.xp = 7;

    startDowntime(state);
    expect(char.downtimeRemaining).toBe(2);

    const recovery = doRecovery(state, 0);
    expect(recovery.type).toBe("recovery");
    expect(char.healing.ticks).toBe(1);
    expect(char.conditions).toEqual([]);
    expect(recovery.conditionsCleared).toBe(1);

    char.downtimeRemaining = 2;

    const training = doTraining(state, 0);
    expect(training.type).toBe("training");
    expect(training.xpGained).toBe(1);
    expect(training.canLevelUp).toBe(true);
    expect(char.xp).toBe(8);

    char.downtimeRemaining = 2;

    const levelup = doLevelUp(state, 0, "Command");
    expect(levelup.type).toBe("levelup");
    expect(levelup.choice).toBe("action");
    expect(levelup.to).toBe(levelup.from + 1);
    expect(char.xp).toBe(0);
  });

  test("27 — downtime: project clock", () => {
    const char = state.characters[1];
    const proj = createProject("p1", "Build a custom scanner", 4);
    char.projects.push(proj);
    char.downtimeRemaining = 4;

    doProject(state, 1, "p1");
    expect(proj.clock.current).toBe(1);

    for (let i = 0; i < 3; i++) doProject(state, 1, "p1");
    expect(proj.completed).toBe(true);
  });

  test("28 — crew resource operations", () => {
    const crew = state.crew;

    const coinBefore = crew.resources.coin;
    addResource(crew, "coin", 5);
    expect(crew.resources.coin).toBe(coinBefore + 5);

    const repBefore = crew.resources.reputation;
    addResource(crew, "reputation", 2);
    expect(crew.resources.reputation).toBe(repBefore + 2);
  });

  test("29 — crew XP tracking", () => {
    const crew = state.crew;
    const xpBefore = crew.xp || 0;
    addCrewXp(crew, 4);
    expect(crew.xp).toBe(xpBefore + 4);
  });

  test("30 — getContext with no current location returns empty", () => {
    const oldLocation = state.currentLocation;
    state.currentLocation = null;
    const ctx = getContext(state);
    expect(ctx.type).toBe("empty");
    state.currentLocation = oldLocation;
  });

  test("31 — plotline completes when all scenes resolved", () => {
    const plotline = state.plotlines.find((p) => p.id === "echoes_void");
    const scenes = plotline.scenes;
    const allResolved = scenes.every((s) => s.resolved);
    expect(plotline.completed || allResolved).toBe(true);
  });

  test("32 — faction clocks: onComplete fires correctly", () => {
    const hegClock = state.factionClocks.find(
      (c) => c.id === "hegemony_response",
    );
    if (hegClock && !hegClock.completed) {
      tickFactionClock(
        state,
        "hegemony_response",
        hegClock.clock.max - hegClock.clock.current,
      );
    }
    if (hegClock && hegClock.completed) {
      expect(state.flags.hegemony_alert).toBe(true);
    }
  });

  test("33 — crew stunts apply to challenge resolution via tag matching", () => {
    const crewStunt = state.crew.stunts.find(
      (s) => s.id === "guardian_coordination",
    );
    expect(crewStunt).toBeDefined();
    expect(crewStunt.tags).toContain("team");
    expect(crewStunt.bonusDice).toBe(1);
  });

  test("34 — character signature items from character definitions", () => {
    const freshState = createGame(def);
    const valeria = freshState.characters[0];
    expect(valeria.items).toContain("plasma_sword");
    expect(valeria.items).toContain("aurumite_plate");
    expect(valeria.inventory).toEqual([]);

    const mara = freshState.characters[3];
    expect(mara.items).toContain("relic_scanner");
    expect(mara.inventory).toEqual([]);
  });

  test("34b — characters start missions with 0 gear equipped", () => {
    const freshState = createGame(def);
    const plotline = freshState.plotlines.find((p) => p.id === "echoes_void");
    startPlotlineMission(freshState, plotline);
    resolveHook(
      freshState,
      { type: "engagement" },
      { _plotlineId: "echoes_void" },
    );
    for (const char of freshState.characters) {
      expect(char.inventory).toHaveLength(0);
      expect(char.load).toBe(0);
    }
  });

  test("35 — state serialization round-trips", () => {
    const copy = serialize(state);
    expect(copy.crew.name).toBe(state.crew.name);
    expect(copy.characters.length).toBe(4);
  });
});
