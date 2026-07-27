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
