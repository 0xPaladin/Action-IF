export function createItem(id, name, description, load = 0, tags = [], opts = {}) {
  return {
    id,
    name,
    description,
    load,
    tags: [...tags],
    action: opts.action || null,
    bonusDice: opts.bonusDice || 0,
    bonusTicks: opts.bonusTicks || 0,
    bonusEffect: opts.bonusEffect || 0,
    armor: opts.armor || 0,
    substituteAction: opts.substituteAction || null,
    specialized: opts.specialized || false,
    individual: opts.individual || false,
  };
}
