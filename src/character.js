import { getCondition } from "./condition.js";

export const ACTION_ACTIONS = [
  "Muscle", "Move", "Finesse", "Sneak", "Shoot", "Tinker",
  "Study", "Notice", "Bond", "Command", "Focus", "Sway",
];

export const ACTION_DESCRIPTIONS = {
  Muscle:  "use your force to move, overcome or wreck the obstacle in front of you.",
  Move:    "quickly shift to a new position or get out of danger.",
  Finesse: "employ dexterous manipulation or subtle misdirection.",
  Sneak:   "traverse skillfully and quietly.",
  Shoot:   "carefully track and shoot at a target.",
  Tinker:  "understand, create, or repair complex mechanisms or organisms.",
  Study:   "gather, scrutinize and analyze information.",
  Notice:  "observe the situation and anticipate outcomes.",
  Bond:    "reassure and socialize with friends and contacts.",
  Command: "compel swift obedience with skills and respect.",
  Focus:   "concentrate to accomplish a task that requires great strength of mind.",
  Sway:    "influence with guile, charm, or argument.",
};

export const LOAD_LEVELS = { light: 3, normal: 5, heavy: 6 };

export function createCharacter(name) {
  const actions = {};
  for (const a of ACTION_ACTIONS) {
    actions[a] = 0;
  }

  return {
    name,
    actions,
    inventory: [],
    items: [],
    stunts: [],
    stuntChoices: [],
    guard: 3,
    maxGuard: 3,
    body: 6,
    conditions: [],
    healing: null,
    load: 0,
    maxLoad: 5,
    xp: 0,
    projects: [],
    downtimeRemaining: 0,
    aspects: [],
  };
}

export function getAvailableItems(character, allItems) {
  return allItems.filter((item) => {
    if (item.individual) return false;
    if (item.specialized) return character.items.includes(item.id);
    return true;
  });
}

export function assignActionDots(character, dots) {
  if (!Array.isArray(dots) || dots.length !== 12) {
    throw new Error("Must provide exactly 12 dot values");
  }

  let total = 0;
  for (const d of dots) {
    if (!Number.isInteger(d) || d < 0 || d > 2) {
      throw new Error("Each dot value must be an integer between 0 and 2");
    }
    total += d;
  }

  if (total !== 7) {
    throw new Error(`Dot total must be 7, got ${total}`);
  }

  for (let i = 0; i < ACTION_ACTIONS.length; i++) {
    character.actions[ACTION_ACTIONS[i]] = dots[i];
  }

  return character;
}

export function addItem(character, item) {
  character.inventory.push(item);
  recalcLoad(character);
  return character;
}

export function removeItem(character, itemId) {
  character.inventory = character.inventory.filter((i) => i.id !== itemId);
  recalcLoad(character);
  return character;
}

export function hasItem(character, itemId) {
  return character.inventory.some((i) => i.id === itemId);
}

export function findItem(character, itemId) {
  return character.inventory.find((i) => i.id === itemId) || null;
}

export function recalcLoad(character) {
  character.load = character.inventory.reduce((sum, i) => sum + i.load, 0) + character.conditions.length;
  return character;
}

export function addStunt(character, stunt) {
  character.stunts.push(stunt);
  return character;
}

export function harmPenalty(character) {
  if (character.body <= 0) return -1;
  if (character.body <= 2) return 2;
  if (character.body <= 4) return 1;
  return 0;
}

export function conditionPenalty(character, tags = []) {
  if (!tags.length || !character.conditions.length) return 0;
  let penalty = 0;
  for (const conditionId of character.conditions) {
    const cond = getCondition(conditionId);
    if (cond) {
      if (cond.tags.some((t) => tags.includes(t))) penalty++;
    } else if (tags.includes(conditionId)) {
      penalty++;
    }
  }
  return penalty;
}

export function setLoadLevel(character, level) {
  if (typeof level === "string") {
    level = LOAD_LEVELS[level];
    if (level === undefined) level = 3;
  }
  character.maxLoad = level;
  if (character.load > character.maxLoad) {
    const excess = character.load - character.maxLoad;
    const sorted = [...character.inventory].sort((a, b) => b.load - a.load);
    let dropped = [];
    let removed = 0;
    for (const item of sorted) {
      if (removed >= excess) break;
      dropped.push(item.id);
      character.inventory = character.inventory.filter((i) => i.id !== item.id);
      removed += item.load;
    }
    recalcLoad(character);
    return { dropped };
  }
  return { dropped: [] };
}

export function healHarm(character) {
  if (character.body < 6) {
    character.body = Math.min(6, character.body + 1);
  } else if (character.guard < 3) {
    character.guard = Math.min(3, character.guard + 1);
  }
  return character;
}

export function tickHealing(character) {
  if (!character.healing) {
    character.healing = { ticks: 0, max: 4 };
  }

  character.healing.ticks++;

  if (character.healing.ticks >= character.healing.max) {
    character.healing.ticks = 0;
    healHarm(character);
    if (character.body >= 6 && character.guard >= 3) {
      character.healing = null;
    }
  }

  return character;
}

export function restCharacter(character) {
  character.conditions = [];
  recalcLoad(character);
  return character;
}

export function addXp(character, amount) {
  character.xp += amount;
  return character;
}

export function spendXp(character, amount) {
  if (character.xp < amount) {
    throw new Error(`Need ${amount} XP, have ${character.xp}`);
  }
  character.xp -= amount;
  return character;
}

export function getXp(character) {
  return character.xp;
}
