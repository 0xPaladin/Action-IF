/**
 * ### Armor
 *
 * `armor.js` provides armor calculation for harm reduction.
 * Armor is checked by the harm consequence template — when harm is applied,
 * items with matching tags reduce the harm amount before Guard/Body absorb.
 *
 * API:
 * - `getTotalArmor(character)` — sums armor values from all carried items
 */
export function getTotalArmor(character) {
  return (character.inventory || []).reduce((sum, item) => sum + (item.armor || 0), 0);
}
