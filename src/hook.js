import { tickFactionClock } from "./factionClock.js";
import { addCoin, addRep, addCrewXp } from "./crew.js";
import {
  setActiveScene,
  setFlag,
  clearFlag,
  addLogEntry,
  getActivePlotline,
  findSceneById,
  moveNPC as stateMoveNPC,
  removeNPC as stateRemoveNPC,
} from "./state.js";
import { addHeat as addFactionHeat } from "./faction.js";
import {
  healHarm as healCharacterHarm,
  restCharacter,
  recalcLoad,
  addItem,
  removeItem,
  addXp,
} from "./character.js";
import { startDowntime } from "./downtime.js";
import { engagementRoll } from "./engagement.js";
import { buildMissionSummary } from "./mission.js";
import { resolveEncounter, getContext } from "./engine.js";
import { findApplicableEffects } from "./stunt.js";
import { createFactionClock } from "./factionClock.js";

const HOOK_TYPES = {};

export function registerHook(type, handler) {
  HOOK_TYPES[type] = handler;
}

export function resolveHook(state, hook, context = {}) {
  if (typeof hook === "function") {
    return hook(state, context);
  }
  if (Array.isArray(hook)) {
    let lastResult;
    for (const h of hook) {
      const r = resolveHook(state, h, context);
      if (r !== undefined) lastResult = r;
    }
    return lastResult;
  }
  if (hook && typeof hook === "object" && hook.type) {
    const handler = HOOK_TYPES[hook.type];
    if (!handler) throw new Error(`Unknown hook type "${hook.type}"`);
    return handler(state, { ...hook }, context);
  }
}

registerHook("setFlag", (state, params) => {
  state.flags[params.flag] = true;
});
registerHook("clearFlag", (state, params) => {
  delete state.flags[params.flag];
});

registerHook("tickClock", (state, params) => {
  tickFactionClock(state, params.clockId, params.amount || 1);
});

registerHook("addRep", (state, params) => {
  if (state.crew) addRep(state.crew, params.amount || 1);
});

registerHook("addCoin", (state, params) => {
  if (state.crew) addCoin(state.crew, params.amount || 2);
});

registerHook("addXp", (state, params) => {
  if (state.crew) addCrewXp(state.crew, params.amount || 2);
});

registerHook("setScene", (state, params) => {
  setActiveScene(state, params.sceneId);
});

registerHook("encounter", (state, params) => {
  const encounterId = resolveEncounter(state, params.encounter);
  if (!encounterId) return null;

  const encScene = findSceneById(state, encounterId);
  if (!encScene) return null;

  setActiveScene(state, encounterId);
  return {
    type: "scene_start",
    sceneId: encounterId,
    sceneFiction: encScene.fiction,
    context: getContext(state),
  };
});

registerHook("log", (state, params) => {
  addLogEntry(state, { type: "hook", text: params.text || "", ...params });
});

registerHook("adjustStatus", (state, params) => {
  const faction = (state.factions || []).find((f) => f.id === params.factionId);
  if (faction) addFactionHeat(faction, params.delta || 1);
});

registerHook("clearActiveScene", (state) => {
  state.activeScene = null;
});

registerHook("message", (state, params) => {
  addLogEntry(state, { type: "message", text: params.text || "" });
});

registerHook("completePlotline", (state, params) => {
  const plotline = (state.plotlines || []).find(
    (p) => p.id === params.plotlineId,
  );
  if (plotline) plotline.completed = true;
});

registerHook("setLocation", (state, params) => {
  state.currentLocation = params.locationId;
});

registerHook("spendCoin", (state, params) => {
  if (state.crew) addCoin(state.crew, -(params.amount || 2));
});

registerHook("rest", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (char) restCharacter(char);
});

registerHook("healHarm", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (char) healCharacterHarm(char);
});

registerHook("engagement", (state, params, context) => {
  let plotline = null;
  if (params.plotlineId) {
    plotline = state.plotlines.find((p) => p.id === params.plotlineId) || null;
  }
  if (!plotline) {
    const plotlineId = context?.scene?._plotlineId || context?._plotlineId;
    if (plotlineId) {
      plotline = state.plotlines.find((p) => p.id === plotlineId) || null;
    }
  }
  if (!plotline) {
    plotline =
      state.plotlines.find(
        (p) => p.mission && !p.mission.completed && !state.activeMissionId,
      ) || null;
  }
  if (!plotline || !plotline.mission) return;

  let rating = params.rating;
  if (!rating && plotline.mission.engagementAction) {
    const actionName = plotline.mission.engagementAction;
    rating = Math.max(
      0,
      ...state.characters.map((c) => c.actions?.[actionName] || 0),
    );
  }
  rating = rating || 0;

  const result = engagementRoll(rating);

  state.activeMissionId = plotline.id;

  for (const char of state.characters || []) {
    char.inventory = [];
    char.load = 0;
    recalcLoad(char);
  }

  addLogEntry(state, {
    type: "engagement",
    text: `Engagement roll: ${result.pool}d → ${result.outcome.level}`,
  });
});

registerHook("completeMission", (state, params, context) => {
  const plotline = getActivePlotline(state);
  if (!plotline || !plotline.mission || plotline.mission.completed) return;

  const mission = plotline.mission;

  if (state.crew) {
    addCoin(state.crew, mission.payoff.coin || 0);
    addRep(state.crew, mission.payoff.rep || 0);

    for (const bp of state.crew.bonusPayouts || []) {
      if (
        bp.tags.length === 0 ||
        bp.tags.some((t) => (mission.tags || []).includes(t))
      ) {
        if (bp.bonusCoin) addCoin(state.crew, bp.bonusCoin);
        if (bp.bonusRep) addRep(state.crew, bp.bonusRep);
      }
    }
  }

  const heatFromMission = (mission.heatGenerated || 0) + (mission.baseHeat || 0);

  if (mission.targetFaction) {
    const target = (state.factions || []).find(
      (f) => f.id === mission.targetFaction,
    );
    if (target) addFactionHeat(target, heatFromMission);
  }
  if (mission.patronFaction) {
    const patron = (state.factions || []).find(
      (f) => f.id === mission.patronFaction,
    );
    if (patron) addFactionHeat(patron, -(mission.payoff.rep || 0));
  }

  resolveHook(state, mission.onComplete, { plotline, mission });

  mission.completed = true;
  state.activeMissionId = null;

  startDowntime(state);

  const summary = buildMissionSummary(plotline);
  addLogEntry(state, { type: "mission_complete", text: summary });

  const downtimeMsg =
    "You have entered Downtime. Every character may perform 2 actions.";
  addLogEntry(state, { type: "system", text: downtimeMsg });

  return { type: "mission_complete", text: `${summary}\n\n${downtimeMsg}` };
});

registerHook("giveItem", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char) return null;
  const item = (state.items || []).find((i) => i.id === params.itemId);
  if (!item) return null;
  addItem(char, item);
  addLogEntry(state, {
    type: "item",
    text: `${char.name} received ${item.name}.`,
  });
  return { type: "item_given", characterIndex: charIndex, itemId: params.itemId };
});

registerHook("takeItem", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char) return null;
  const item = char.inventory.find((i) => i.id === params.itemId);
  if (!item) return null;
  removeItem(char, params.itemId);
  addLogEntry(state, {
    type: "item",
    text: `${char.name} lost ${item.name}.`,
  });
  return { type: "item_taken", characterIndex: charIndex, itemId: params.itemId };
});

registerHook("addCondition", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char || !params.condition) return null;
  char.conditions.push(params.condition);
  recalcLoad(char);
  addLogEntry(state, {
    type: "condition",
    text: `${char.name} gained condition: ${params.condition}.`,
  });
  return { type: "condition_added", characterIndex: charIndex, condition: params.condition };
});

registerHook("removeCondition", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char || !params.condition) return null;
  const before = char.conditions.length;
  char.conditions = char.conditions.filter((c) => c !== params.condition);
  if (char.conditions.length < before) {
    recalcLoad(char);
    addLogEntry(state, {
      type: "condition",
      text: `${char.name} recovered from: ${params.condition}.`,
    });
    return { type: "condition_removed", characterIndex: charIndex, condition: params.condition };
  }
  return null;
});

registerHook("clearConditions", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char) return null;
  const removed = [...char.conditions];
  char.conditions = [];
  recalcLoad(char);
  addLogEntry(state, {
    type: "condition",
    text: `${char.name} recovered from all conditions.`,
  });
  return { type: "conditions_cleared", characterIndex: charIndex, removed };
});

registerHook("dealHarm", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char) return null;

  const amount = params.amount || 1;
  const allTags = params.tags || [];
  const applicable = findApplicableEffects(char.inventory || [], allTags, char);
  let reduction = 0;
  for (const e of applicable) reduction += e.armor || 0;

  let remaining = Math.max(0, amount - reduction);
  const guardBefore = char.guard;
  if (char.guard > 0) {
    const absorbed = Math.min(char.guard, remaining);
    char.guard -= absorbed;
    remaining -= absorbed;
  }
  const bodyBefore = char.body;
  char.body = Math.max(0, char.body - remaining);

  const guardDamage = guardBefore - char.guard;
  const bodyDamage = bodyBefore - char.body;

  addLogEntry(state, {
    type: "harm",
    text: `${char.name} takes ${amount} harm (${guardDamage} guard, ${bodyDamage} body).`,
  });

  return {
    type: "harm_dealt",
    characterIndex: charIndex,
    amount,
    reduction,
    guardDamage,
    bodyDamage,
    guard: char.guard,
    body: char.body,
  };
});

registerHook("resetGuard", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char) return null;
  const before = char.guard;
  char.guard = char.maxGuard ?? 3;
  addLogEntry(state, {
    type: "guard",
    text: `${char.name}'s guard restored to ${char.guard}.`,
  });
  return { type: "guard_reset", characterIndex: charIndex, before, after: char.guard };
});

registerHook("addCharacterXp", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char) return null;
  addXp(char, params.amount || 1);
  addLogEntry(state, {
    type: "xp",
    text: `${char.name} gained ${params.amount || 1} XP.`,
  });
  return { type: "xp_added", characterIndex: charIndex, amount: params.amount || 1, total: char.xp };
});

registerHook("moveNPC", (state, params) => {
  const success = stateMoveNPC(state, params.npcId, params.locationId);
  if (success) {
    addLogEntry(state, {
      type: "npc",
      text: `NPC "${params.npcId}" moved to "${params.locationId}".`,
    });
    return { type: "npc_moved", npcId: params.npcId, locationId: params.locationId };
  }
  return null;
});

registerHook("removeNPC", (state, params) => {
  const success = stateRemoveNPC(state, params.npcId);
  if (success) {
    addLogEntry(state, {
      type: "npc",
      text: `NPC "${params.npcId}" removed.`,
    });
    return { type: "npc_removed", npcId: params.npcId };
  }
  return null;
});

registerHook("addClock", (state, params) => {
  const clock = createFactionClock(
    params.id,
    params.name || params.id,
    params.description || "",
    params.clockMax || 4,
    params.onComplete || null,
  );
  state.factionClocks.push(clock);
  addLogEntry(state, {
    type: "clock",
    text: `Clock "${params.name || params.id}" created (${clock.clock.max} ticks).`,
  });
  return { type: "clock_added", clockId: params.id };
});

registerHook("removeClock", (state, params) => {
  const before = state.factionClocks.length;
  state.factionClocks = state.factionClocks.filter((c) => c.id !== params.clockId);
  if (state.factionClocks.length < before) {
    addLogEntry(state, {
      type: "clock",
      text: `Clock "${params.clockId}" removed.`,
    });
    return { type: "clock_removed", clockId: params.clockId };
  }
  return null;
});

registerHook("modifyAction", (state, params) => {
  const charIndex = params.characterIndex ?? 0;
  const char = (state.characters || [])[charIndex];
  if (!char || !params.action) return null;

  const delta = params.delta || 1;
  const current = char.actions[params.action] || 0;

  if (params.permanent) {
    char.actions[params.action] = Math.max(0, Math.min(4, current + delta));
    addLogEntry(state, {
      type: "action",
      text: `${char.name}'s ${params.action} changed: ${current}→${char.actions[params.action]}.`,
    });
    return {
      type: "action_modified",
      characterIndex: charIndex,
      action: params.action,
      before: current,
      after: char.actions[params.action],
      permanent: true,
    };
  }

  if (!char.actionMods) char.actionMods = [];
  char.actionMods.push({ action: params.action, delta });
  addLogEntry(state, {
    type: "action",
    text: `${char.name}'s ${params.action} temporarily modified by ${delta}.`,
  });
  return {
    type: "action_modified",
    characterIndex: charIndex,
    action: params.action,
    delta,
    permanent: false,
  };
});

import { addMomentum, spendMomentum, canSpendMomentum } from "./momentum.js";

registerHook("addMomentum", (state, params) => {
  const amount = params.amount || 1;
  addMomentum(state, amount);
  return { type: "momentum_added", amount, total: state.momentum };
});

registerHook("spendMomentum", (state, params) => {
  const amount = params.amount || 2;
  if (!canSpendMomentum(state, amount)) {
    return { type: "error", message: `Not enough momentum. Need ${amount}.` };
  }
  spendMomentum(state, amount);
  return { type: "momentum_spent", amount, total: state.momentum };
});
