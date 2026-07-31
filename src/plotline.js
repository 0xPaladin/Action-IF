/**
 * ### Plotlines
 *
 * A **Plotline** is a connected set of scenes that form a story arc. Players may jump between
 * scenes on different plotlines based on choices — plotlines do not need to run start-to-finish.
 *
 * A plotline can optionally carry a **mission config** — when present, the plotline is treated
 * as a mission (score) with an engagement roll, heat tracking, and payoff upon completion.
 *
 * Plotline {
 *   id: string
 *   name: string
 *   description: string
 *   scenes: Scene[]
 *   completed: boolean
 *   mission: MissionConfig | null
 * }
 *
 * MissionConfig {
 *   locationId: string
 *   startingSceneId: string
 *   patron: string | null
 *   patronFaction: string | null
 *   targetFaction: string | null
 *   payoff: { rep: number, coin: number }
 *   baseHeat: number
 *   heatGenerated: number
 *   dangerClock: { current: number, max: number }
 *   tags: string[]
 *   engagementAction: string
 *   onComplete: Hook | null
 * }
 *
 * API:
 * - `createPlotline(id, name, description, scenes, mission)` — create a new plotline
 * - `addSceneToPlotline(plotline, scene)` — associate a scene
 * - `plotlineStatus(plotline)` — returns { total, resolved, remaining, completed }
 * - `isPlotlineComplete(plotline)` — checks all scenes resolved
 * - `isMissionComplete(plotline)` — checks all plotline scenes resolved
 * - `startPlotlineMission(state, plotline)` — activates a plotline as the current mission
 * - `getActiveMission(state)` — returns the active plotline/mission or null
 * - `addMissionHeat(state, amount)` — updates heatGenerated
 * - `finishMission(state, plotline)` — applies payoff, faction heat, enters downtime
 * - `updateMission(state)` — checks if active mission is complete
 * - `updatePlotlines(state)` — scans all plotlines, marks completed, finishes missions
 */
import { setCurrentLocation, setActiveScene, addLogEntry } from "./state.js";
import { addCoin, addRep } from "./crew.js";
import { addHeat as addFactionHeat } from "./faction.js";
import { resolveHook } from "./hook.js";
import { buildMissionSummary } from "./mission.js";
import { startDowntime } from "./downtime.js";

export function createPlotline(id, name, description = "", scenes = [], mission = null) {
  const defaultMission = {
    patron: null,
    patronFaction: null,
    targetFaction: null,
    payoff: { rep: 0, coin: 0 },
    baseHeat: 0,
    heatGenerated: 0,
    dangerClock: { current: 0, max: 4 },
    tags: [],
    onComplete: null,
  };

  return {
    id,
    name,
    description,
    scenes: [...scenes],
    completed: false,
    mission: mission ? { ...defaultMission, ...mission } : null,
  };
}

export function addSceneToPlotline(plotline, scene) {
  if (!plotline.scenes.some((s) => s.id === scene.id)) {
    plotline.scenes.push(scene);
  }
  return plotline;
}

export function plotlineStatus(plotline) {
  const total = plotline.scenes.length;
  const resolved = plotline.scenes.filter((s) => s.resolved).length;

  return {
    total,
    resolved,
    remaining: total - resolved,
    completed: resolved === total && total > 0,
  };
}

export function isPlotlineComplete(plotline) {
  return plotlineStatus(plotline).completed;
}

export function startPlotlineMission(state, plotline) {
  if (!plotline.mission) return plotline;

  state.activeMissionId = plotline.id;
  state.currentLocation = plotline.mission.locationId;
  setActiveScene(state, plotline.mission.startingSceneId);
  return plotline;
}

export function getActiveMission(state) {
  if (!state.activeMissionId) return null;
  return state.plotlines.find((p) => p.id === state.activeMissionId) || null;
}

export function isMissionComplete(plotline) {
  if (!plotline.mission) return false;
  return plotline.scenes.every((s) => s.resolved);
}

export function addMissionHeat(state, amount) {
  const plotline = getActiveMission(state);
  if (plotline && plotline.mission) {
    plotline.mission.heatGenerated = Math.max(plotline.mission.heatGenerated, amount);
  }
}

export function finishMission(state, plotline) {
  if (!plotline.mission || !state.crew) return null;

  const mission = plotline.mission;
  addCoin(state.crew, mission.payoff.coin || 0);
  addRep(state.crew, mission.payoff.rep || 0);

  for (const bp of state.crew.bonusPayouts || []) {
    if (bp.tags.length === 0 || bp.tags.some((t) => (mission.tags || []).includes(t))) {
      if (bp.bonusCoin) addCoin(state.crew, bp.bonusCoin);
      if (bp.bonusRep) addRep(state.crew, bp.bonusRep);
    }
  }

  const heatFromMission = mission.heatGenerated + (mission.baseHeat || 0);

  if (mission.targetFaction) {
    const target = state.factions.find((f) => f.id === mission.targetFaction);
    if (target) addFactionHeat(target, heatFromMission);
  }
  if (mission.patronFaction) {
    const patron = state.factions.find((f) => f.id === mission.patronFaction);
    if (patron) addFactionHeat(patron, -(mission.payoff.rep || 0));
  }

  resolveHook(state, mission.onComplete, { plotline, mission });

  plotline.mission.completed = true;
  state.activeMissionId = null;

  startDowntime(state);
  const downtimeMsg = "You have entered Downtime. Every character may perform 2 actions.";
  addLogEntry(state, { type: "system", text: downtimeMsg });

  const summary = buildMissionSummary(plotline);
  if (summary) {
    addLogEntry(state, { type: "mission_complete", text: summary });
  }

  return `${downtimeMsg}\n\n${summary}`;
}

export function updateMission(state) {
  const plotline = getActiveMission(state);
  if (!plotline || !plotline.mission || plotline.mission.completed) return null;
  if (isMissionComplete(plotline)) {
    return finishMission(state, plotline);
  }
  return null;
}

export function updatePlotlines(state) {
  let summary = null;
  for (const plotline of state.plotlines) {
    if (!plotline.completed && isPlotlineComplete(plotline)) {
      plotline.completed = true;
    }
    if (plotline.mission && !plotline.mission.completed && isMissionComplete(plotline)) {
      summary = finishMission(state, plotline) || summary;
    }
  }
  return summary;
}
