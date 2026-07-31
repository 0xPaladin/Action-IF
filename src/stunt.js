/**
 * ### Stunts
 *
 * `stunt.js` models character abilities that trigger when a tag matches the active scene or challenge.
 *
 * Stunt {
 *   id: string
 *   name: string
 *   description: string
 *   tags: string[]                    // matched against scene + challenge tags
 *   action: string | null             // if set, bonusDice/bonusTicks only apply when this action is rolled
 *   bonusDice: number                 // +1d per point
 *   bonusTicks: number                // +1 extra tick per point
 *   substituteAction: { from, to } | null  // use action `to` for rolls of action `from`
 * }
 *
 * Stunt Types:
 * - **+1d**: `bonusDice: 1` — add a bonus die to the pool
 * - **+ticks**: `bonusTicks: 1` — +1 tick on the challenge clock
 * - **+effect**: `bonusEffect: 1` — increase effect level by one
 * - **Substitute action**: `substituteAction: { from: "Command", to: "Sway" }`
 *
 * API:
 * - `createStunt(id, name, description, tags, opts)` — create a stunt
 * - `findApplicableEffects(effectors, tags, character)` — find stunts/items with matching tags
 * - `getEffectiveActionFromEffects(character, actionName, applicable)` — check for action substitution
 * - `applyBonusDice(applicable, pool, actionName)` — sum bonus dice
 * - `getBonusTicks(applicable, actionName)` — sum bonus ticks
 * - `getBonusEffect(applicable, actionName)` — sum bonus effect
 */
export function createStunt(id, name, description, tags = [], opts = {}) {
  return {
    id,
    name,
    description,
    tags: [...tags],
    action: opts.action || null,
    bonusDice: opts.bonusDice || 0,
    bonusTicks: opts.bonusTicks || 0,
    bonusEffect: opts.bonusEffect || 0,
    substituteAction: opts.substituteAction || null,
  };
}

export function findApplicableEffects(effectors, tags, character = null) {
  if (!tags.length) return [];
  return effectors.filter((e) => {
    if (!e.tags || !e.tags.some((t) => tags.includes(t))) return false;
    if (e.specialized && character && !character.inventory.some((i) => i.id === e.id)) return false;
    return true;
  });
}

export function getEffectiveActionFromEffects(character, actionName, applicable) {
  const sub = applicable.find(
    (e) => e.substituteAction && e.substituteAction.from === actionName
  );
  if (sub) {
    return {
      actionName: sub.substituteAction.to,
      pool: character.actions[sub.substituteAction.to] || 0,
    };
  }
  return { actionName, pool: character.actions[actionName] || 0 };
}

export function applyBonusDice(applicable, pool, actionName = null) {
  let bonus = 0;
  for (const e of applicable) {
    if (e.action && actionName && e.action !== actionName) continue;
    bonus += e.bonusDice || 0;
  }
  return { pool: pool + bonus };
}

export function getBonusTicks(applicable, actionName = null) {
  let ticks = 0;
  for (const e of applicable) {
    if (e.action && actionName && e.action !== actionName) continue;
    ticks += e.bonusTicks || 0;
  }
  return ticks;
}

export function getBonusEffect(applicable, actionName = null) {
  let effect = 0;
  for (const e of applicable) {
    if (e.action && actionName && e.action !== actionName) continue;
    effect += e.bonusEffect || 0;
  }
  return effect;
}
