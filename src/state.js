import { migrateLegacyCrew } from "./crew.js";

/**
 * ### Game State
 *
 * `state.js` manages the central serialisable game state. No global mutation outside the state module.
 *
 * The state tracks:
 * - `gameName` (string, set from definition's `name` field)
 * - `zones[]` (the world hierarchy)
 * - `currentLocation` (the active location node)
 * - `activeScene` (when a location action triggers a scene)
 * - `momentum` (number, default 2, shared crew resource)
 * - `gameStunts` (array of all stunt objects from game definition)
 * - `gameResources` (object mapping resource id → { name, description } from game definition)
 * - `flags` (flat object tracking player choices)
 * - `factions[]`, `claims[]`, `factionClocks[]`
 * - `characters[]`, `crew`, `npcs[]`
 *
 * API:
 * - `createGameState()` — creates fresh state object
 * - `serialize(state)` / `deserialize(data)` — for save/load
 * - `setFlag`, `hasFlag`, `clearFlag` — flag management
 * - `addLogEntry` — add to game log
 * - `addCharacter`, `addLocation`, `addScene`, `addPlotline`, `addNPC`
 * - `setCurrentLocation`, `setActiveScene`, `clearActiveScene`
 * - `moveNPC`, `removeNPC`
 */
export function createGameState() {
  return {
    gameName: null,
    characters: [],
    crew: null,
    zones: [],
    locations: [],
    currentLocation: null,
    plotlines: [],
    scenes: [],
    activeScene: null,
    stunts: [],
    flags: {},
    momentum: 2,
    gameLog: [],
    factionClocks: [],
    factions: [],
    claims: [],
    activePlotlineId: null,
    activeMissionId: null,
    journeyScenes: null,
    journeyTarget: null,
    journeyIndex: 0,
    encounters: [],
    npcs: [],
    npcsByLocation: {},
    items: [],
    gameStunts: [],
    gameResources: {},
    nextActionBonusDice: 0,
    assistBonusDice: 0,
    protectTargetIndex: null,
    nextActionChoice: null,
  };
}

export function addCharacter(state, character) {
  state.characters.push(character);
  return state;
}

export function addLocation(state, location) {
  state.locations.push(location);
  return state;
}

export function setCurrentLocation(state, locationId) {
  const next = state.locations.find((l) => l.id === locationId);
  if (!next) return state;

  state.currentLocation = locationId;
  return state;
}

export function getCurrentLocation(state) {
  return state.locations.find((l) => l.id === state.currentLocation) || null;
}

export function addScene(state, scene) {
  state.scenes.push(scene);
  return state;
}

export function getActivePlotline(state) {
  if (!state.activeMissionId) return null;
  return state.plotlines.find((p) => p.id === state.activeMissionId) || null;
}

export function findSceneById(state, sceneId) {
  if (!sceneId) return null;
  for (const plotline of state.plotlines || []) {
    const scene = (plotline.scenes || []).find((s) => s.id === sceneId);
    if (scene) return scene;
  }
  return state.scenes.find((s) => s.id === sceneId) || null;
}

export function setActiveScene(state, sceneId) {
  const prev = getActiveScene(state);
  const next = findSceneById(state, sceneId);
  if (!next) return state;

  if (prev && prev.onExit && prev.id !== sceneId) {
    callHook(state, prev.onExit, prev);
  }

  state.activeScene = sceneId;

  if (next.onEnter) {
    callHook(state, next.onEnter, next);
  }

  return state;
}

function callHook(state, hook, context) {
  if (typeof hook === "function") return hook(state, context);
  if (Array.isArray(hook)) {
    for (const h of hook) callHook(state, h, context);
    return;
  }
  if (hook && typeof hook === "object" && hook.type) {
    import("./hook.js").then((mod) => { try { mod.resolveHook(state, hook, context); } catch (e) { } });
  }
}

export function clearActiveScene(state) {
  state.activeScene = null;
  return state;
}

export function getActiveScene(state) {
  return findSceneById(state, state.activeScene);
}

export function addPlotline(state, plotline) {
  state.plotlines.push(plotline);
  return state;
}

export function setFlag(state, key) {
  state.flags[key] = true;
  return state;
}

export function hasFlag(state, key) {
  return !!state.flags[key];
}

export function clearFlag(state, key) {
  delete state.flags[key];
  return state;
}

export function addStunt(state, stunt) {
  state.stunts.push(stunt);
  return state;
}

export function addLogEntry(state, entry) {
  if (!state.gameLog) state.gameLog = [];
  state.gameLog.push(entry);
  return state;
}

export function addNPC(state, npc) {
  state.npcs.push(npc);
  if (!state.npcsByLocation) state.npcsByLocation = {};
  if (!state.npcsByLocation[npc.location]) {
    state.npcsByLocation[npc.location] = [];
  }
  state.npcsByLocation[npc.location].push(npc);
  return state;
}

export function getNPCsAtLocation(state, locationId) {
  return (state.npcsByLocation || {})[locationId] || [];
}

export function getNPC(state, npcId) {
  return state.npcs.find((npc) => npc.id === npcId) || null;
}

export function moveNPC(state, npcId, newLocationId) {
  const npc = getNPC(state, npcId);
  if (!npc) return false;

  const oldLocation = npc.location;
  if (state.npcsByLocation && state.npcsByLocation[oldLocation]) {
    state.npcsByLocation[oldLocation] = state.npcsByLocation[oldLocation].filter(
      (n) => n.id !== npcId,
    );
    if (state.npcsByLocation[oldLocation].length === 0) {
      delete state.npcsByLocation[oldLocation];
    }
  }

  npc.location = newLocationId;

  if (!state.npcsByLocation) state.npcsByLocation = {};
  if (!state.npcsByLocation[newLocationId]) {
    state.npcsByLocation[newLocationId] = [];
  }
  state.npcsByLocation[newLocationId].push(npc);

  return true;
}

export function removeNPC(state, npcId) {
  const npc = getNPC(state, npcId);
  if (!npc) return false;

  state.npcs = state.npcs.filter((n) => n.id !== npcId);

  if (state.npcsByLocation && state.npcsByLocation[npc.location]) {
    state.npcsByLocation[npc.location] = state.npcsByLocation[npc.location].filter(
      (n) => n.id !== npcId,
    );
    if (state.npcsByLocation[npc.location].length === 0) {
      delete state.npcsByLocation[npc.location];
    }
  }

  return true;
}

export function serialize(state) {
  return JSON.parse(JSON.stringify(state));
}

export function deserialize(data) {
  const state = JSON.parse(JSON.stringify(data));
  // Migrate legacy crew saves that stored coin/reputation as top-level fields.
  if (state.crew) {
    migrateLegacyCrew(state.crew);
  }
  return state;
}
