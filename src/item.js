/**
 * ### Items
 *
 * `item.js` models items that characters can carry. They have load cost and effects
 * that work identically to stunts.
 *
 * Item {
 *   id: string
 *   name: string
 *   description: string
 *   load: number                       // load cost while carried
 *   tags: string[]                     // matched against scene + challenge tags
 *   action: string | null              // if set, bonusDice/bonusTicks/bonusEffect only apply when this action is rolled
 *   bonusDice: number                  // +1d per point (requires action + tags match)
 *   bonusTicks: number                 // +1 extra tick per point on challenge clock
 *   bonusEffect: number                // +1 effect level per point
 *   armor: number                      // reduces incoming harm by N when tags match
 *   substituteAction: { from, to } | null
 *   specialized: boolean               // if true, only available to characters with this item ID
 *   individual: boolean                // if true, never available in loadout
 * }
 *
 * Item Classifications:
 * - General: Available to all characters during loadout
 * - Specialized: Only available to characters whose `items` array includes this item's ID
 * - Individual: Never available in loadout; granted at runtime via hooks, projects, or NPC actions
 */
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
