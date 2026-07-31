/**
 * ### Scene Types
 *
 * Scenes are triggered by location or NPC actions. They have a `type` — either `"action"` or `"dialogue"`.
 *
 * Action Scene:
 * - Has **challenges** — obstacles resolved via action rolls
 * - Scene { id, type: "action", fiction, tags, challenges, resolved, onEnter, onExit, heat }
 *
 * Dialogue Scene:
 * - Has **options** — choices that set flags, trigger other scenes, or both
 * - Scene { id, type: "dialogue", fiction, tags, options, resolved, onEnter, onExit }
 *
 * Option {
 *   text: string
 *   setFlag: string | null
 *   triggerScene: string | null
 *   condition: object | null
 *   hooks: object | null
 *   tickFactionClock: { id, amount } | null
 * }
 *
 * Challenge {
 *   id: string
 *   description: string
 *   clock: { max: number, current: number }
 *   tags: string[]
 *   actions: ActionEntry[]
 *   resolved: boolean
 *   onAct: Hook | null
 *   onComplete: Hook | null
 *   tickFactionClock: { id, amount } | null
 * }
 *
 * ActionEntry {
 *   actionName: string
 *   heat: number
 *   consequences: Consequence
 * }
 *
 * Consequence {
 *   description: string
 *   template: string
 *   params?: object
 * }
 */
import { updatePlotlines } from "./plotline.js";
import { setActiveScene, addLogEntry } from "./state.js";
import { filterConditional } from "./condition.js";
import { tickFactionClock } from "./factionClock.js";
import { resolveHook } from "./hook.js";

export function createScene(id, type, fiction, tags = [], triggerScene = null, onEnter = null, onExit = null, heat = false) {
  const scene = {
    id,
    type,
    fiction,
    tags: [...tags],
    triggerScene,
    resolved: false,
    onEnter,
    onExit,
    heat,
  };

  if (type === "action") {
    scene.challenges = [];
  } else if (type === "dialogue") {
    scene.options = [];
  }

  return scene;
}

export function createOption(text, setFlag = null, triggerScene = null, condition = null, hooks = null, tickFactionClock = null) {
  return { text, setFlag, triggerScene, condition, hooks, tickFactionClock };
}

export function addChallengeToScene(scene, challenge) {
  if (scene.type !== "action") {
    throw new Error(`Cannot add challenge to "${scene.type}" scene "${scene.id}"`);
  }
  scene.challenges.push(challenge);
  return scene;
}

export function addOptionToScene(scene, option) {
  if (scene.type !== "dialogue") {
    throw new Error(`Cannot add option to "${scene.type}" scene "${scene.id}"`);
  }
  scene.options.push(option);
  return scene;
}

export function getVisibleOptions(scene, state, character = null) {
  return filterConditional(scene.options || [], state, character);
}

export function getVisibleChallenges(scene, state, character = null) {
  return filterConditional(scene.challenges || [], state, character);
}

export function getChallenge(scene, challengeId) {
  return scene.challenges?.find((c) => c.id === challengeId) || null;
}

export function selectOption(scene, optionIndex, state) {
  if (scene.type !== "dialogue") {
    throw new Error(`Cannot select option on "${scene.type}" scene`);
  }

  const option = scene.options[optionIndex];
  if (!option) {
    throw new Error(`Option index ${optionIndex} not found in scene "${scene.id}"`);
  }

  if (option.condition && !checkCondition(option.condition, state)) {
    throw new Error(`Option "${option.text}" is not available`);
  }

  if (option.setFlag) {
    state.flags[option.setFlag] = true;
  }

  if (option.hooks) {
    resolveHook(state, option.hooks, { scene, option });
  }

  if (option.tickFactionClock && state) {
    tickFactionClock(state, option.tickFactionClock.id, option.tickFactionClock.amount || 1);
  }

  scene.resolved = true;
  let missionSummary = null;
  const hookResult = resolveHook(state, scene.onExit, scene);
  if (hookResult && hookResult.type === "mission_complete") {
    missionSummary = hookResult.text;
  }

  const nextSceneId = option.triggerScene || scene.triggerScene || null;
  finaliseScene(scene, state, nextSceneId);

  return { option, triggerScene: nextSceneId, missionSummary };
}

export function isSceneResolved(scene) {
  if (scene.type === "action") {
    return scene.challenges.every((c) => c.resolved);
  }
  if (scene.type === "dialogue") {
    return scene.resolved;
  }
  return false;
}

export function updateSceneResolution(scene, state = null) {
  if (isSceneResolved(scene)) {
    scene.resolved = true;
    let summary = null;
    if (state) {
      const hookResult = resolveHook(state, scene.onExit, scene);
      if (hookResult && hookResult.type === "mission_complete") {
        summary = hookResult.text;
      }
    }
    if (state) {
      const nextSceneId = scene.triggerScene || null;
      summary = finaliseScene(scene, state, nextSceneId) || summary;
    }
    return summary;
  }
  return null;
}

function finaliseScene(scene, state, nextSceneId) {
  if (scene.tickFactionClockOnResolve) {
    tickFactionClock(state, scene.tickFactionClockOnResolve.id, scene.tickFactionClockOnResolve.amount || 1);
  }

  if (nextSceneId) {
    setActiveScene(state, nextSceneId);
  } else {
    state.activeScene = null;
  }

  const summary = updatePlotlines(state);
  addLogEntry(state, {
    type: "scene_resolved",
    sceneId: scene.id,
    timestamp: Date.now(),
  });
  return summary;
}

function checkCondition(condition, state) {
  if (!condition) return true;
  if (typeof condition === "function") return condition(state);
  if (condition.flag && !state.flags[condition.flag]) return false;
  if (condition.notFlag && state.flags[condition.notFlag]) return false;
  return true;
}
