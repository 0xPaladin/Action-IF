import { filterConditional } from "./condition.js";
import { resolveHook } from "./hook.js";
import { getNPCsAtLocation } from "./state.js";

export function createLocation(id, name, description, parent = null, mayChangeInventory = false) {
  return {
    id,
    name,
    description,
    parent,
    mayChangeInventory,
    links: [],
    actions: [],
    onEnter: null,
    onExit: null,
  };
}

export function createLink(targetId, label, condition = null, locked = false, key = null, journey = null) {
  return { targetId, label, condition, locked, key, journey };
}

export function createAction(id, label, description, once = false, triggerScene = null, setFlag = null, provideKeys = [], condition = null, hooks = null) {
  return {
    id,
    label,
    description,
    once,
    used: false,
    triggerScene,
    setFlag,
    provideKeys,
    condition,
    hooks,
  };
}

export function addLink(location, link) {
  location.links.push(link);
  return location;
}

export function addAction(location, action) {
  location.actions.push(action);
  return location;
}

export function getVisibleLinks(location, state) {
  return filterConditional(location.links, state);
}

export function getAvailableActions(location, state, character = null) {
  const filtered = filterConditional(location.actions, state, character);
  return filtered.filter((a) => !a.once || !a.used);
}

export function useLink(location, linkIndex, state) {
  const allLinks = location.links;
  const link = allLinks[linkIndex];
  if (!link) {
    throw new Error(`Link index ${linkIndex} not found in location "${location.id}"`);
  }

  if (!checkCondition(link.condition, state)) {
    throw new Error(`Link "${link.label}" is not available`);
  }

  if (link.locked && link.key && !hasFlag(state, link.key)) {
    throw new Error(`Link "${link.label}" is locked (requires key: ${link.key})`);
  }

  return { targetId: link.targetId, journey: link.journey || null };
}

export function useAction(location, actionIndex, state) {
  const action = location.actions[actionIndex];
  if (!action) {
    throw new Error(`Action index ${actionIndex} not found in location "${location.id}"`);
  }

  if (!checkCondition(action.condition, state)) {
    throw new Error(`Action "${action.label}" is not available`);
  }

  if (action.once && action.used) {
    throw new Error(`Action "${action.label}" has already been used`);
  }

  if (action.setFlag) {
    setFlag(state, action.setFlag);
  }

  for (const key of action.provideKeys) {
    setFlag(state, key);
  }

  if (action.hooks) {
    resolveHook(state, action.hooks, action);
  }

  if (action.once) {
    action.used = true;
  }

  return {
    triggerScene: action.triggerScene || null,
    action,
  };
}

export function setLocation(state, locationId) {
  const next = state.locations.find((l) => l.id === locationId);
  if (!next) throw new Error(`Location "${locationId}" not found`);
  const current = state.locations.find((l) => l.id === state.currentLocation);
  if (current) exitLocation(current, state);
  state.currentLocation = locationId;
  enterLocation(next, state);
  return next;
}

export function enterLocation(location, state) {
  if (typeof location.onEnter === "function") {
    location.onEnter(location, state);
  }
  
  const npcs = getNPCsAtLocation(state, location.id);
  for (const npc of npcs) {
    if (typeof npc.onEnter === "function") {
      npc.onEnter(npc, state);
    }
  }
  
  return location;
}

export function exitLocation(location, state) {
  if (typeof location.onExit === "function") {
    location.onExit(location, state);
  }
  return location;
}

function hasFlag(state, key) {
  return !!state.flags[key];
}

function setFlag(state, key) {
  state.flags[key] = true;
}

function checkCondition(condition, state) {
  if (!condition) return true;
  if (typeof condition === "function") return condition(state);
  if (condition.flag && !state.flags[condition.flag]) return false;
  if (condition.notFlag && state.flags[condition.notFlag]) return false;
  return true;
}
