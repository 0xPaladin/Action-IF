export function getTotalArmor(character) {
  return (character.inventory || []).reduce((sum, item) => sum + (item.armor || 0), 0);
}
