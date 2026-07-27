const CONDITIONS = {};

const DEFAULT_CONDITIONS = {
  exposed: {
    id: "exposed",
    name: "Exposed",
    description: "You are visible and without cover.",
    tags: ["surveillance", "perception", "outdoor", "urban"],
  },
  cornered: {
    id: "cornered",
    name: "Cornered",
    description: "You are trapped with no escape route.",
    tags: ["chase", "evasion", "mobility", "trapped"],
  },
  shaken: {
    id: "shaken",
    name: "Shaken",
    description: "You are mentally rattled and unsure.",
    tags: ["social", "concentration", "mental", "analytical"],
  },
  poisoned: {
    id: "poisoned",
    name: "Poisoned",
    description: "Toxins course through your system.",
    tags: ["survival", "natural", "alchemical", "magical"],
  },
  doomed: {
    id: "doomed",
    name: "Doomed",
    description: "Fate itself works against you.",
    tags: ["combat", "chase", "intimidating", "ritual"],
  },
  injured: {
    id: "injured",
    name: "Injured",
    description: "A wound slows and pains you.",
    tags: ["combat", "brute", "mobility", "evasion"],
  },
  fatigued: {
    id: "fatigued",
    name: "Fatigued",
    description: "You are worn down and struggling to keep going.",
    tags: ["mobility", "concentration", "brute", "survival"],
  },
  compromised: {
    id: "compromised",
    name: "Compromised",
    description: "Your position or intentions are known.",
    tags: ["stealth", "surveillance", "tracking", "deceptive"],
  },
  pinned: {
    id: "pinned",
    name: "Pinned",
    description: "You are under covering fire and cannot move.",
    tags: ["combat", "evasion", "mobility", "ranged"],
  },
};

for (const def of Object.values(DEFAULT_CONDITIONS)) {
  CONDITIONS[def.id] = def;
}

export function registerCondition(id, def) {
  CONDITIONS[id] = def;
}

export function getCondition(id) {
  return CONDITIONS[id] || null;
}

export function knownConditions() {
  return Object.keys(CONDITIONS);
}

export function getConditionTags(id) {
  const cond = CONDITIONS[id];
  return cond ? cond.tags : [];
}

export function checkCondition(condition, state, character = null) {
  if (!condition) return true;
  if (typeof condition === "function") return condition(state);

  if (condition.flag && !state.flags[condition.flag]) return false;
  if (condition.notFlag && state.flags[condition.notFlag]) return false;
  if (condition.hasItem && (!character || !character.inventory.some((i) => i.id === condition.hasItem))) return false;
  if (condition.notItem && character && character.inventory.some((i) => i.id === condition.notItem)) return false;
  if (condition.flagValue !== undefined && state.flags[condition.flag] !== condition.flagValue) return false;

  return true;
}

export function filterConditional(items, state, character = null) {
  return items.filter((item) => checkCondition(item.condition, state, character));
}
