/**
 * ### Factions
 *
 * `faction.js` models the factions in the game world. Each faction has a name, description,
 * tier (1–6), hold, heat (positive = anger, negative = favor), territory, members, goals, notes,
 * and an optional faction clock reference.
 *
 * Faction {
 *   id: string
 *   name: string
 *   description: string
 *   tier: number           // 1–6 power level
 *   hold: "strong" | "weak" | "none"
 *   heat: number           // positive = anger (Heat), negative = favor (Favor)
 *   territory: string[]    // location IDs
 *   members: string[]      // NPC identifiers
 *   notes: string
 *   goals: string[]
 *   clockId: string | null // optional faction clock ID
 * }
 *
 * API:
 * - `createFaction(id, name, description, options)` — create a faction
 * - `addHeat(faction, amount)` — add positive (heat) or negative (favor) heat
 * - `setTier(faction, tier)` — set tier (1–6)
 * - `setHold(faction, hold)` — set hold ("strong", "weak", "none")
 * - `addTerritory/removeTerritory/hasTerritory(locationId)` — manage controlled locations
 * - `addMember/removeMember/hasMember(memberId)` — manage NPC members
 * - `addGoal/removeGoal(goal)` — manage goals
 * - `setNotes(notes)` — set notes
 */
export function createFaction(id, name, description, options = {}) {
  return {
    id,
    name,
    description,
    tier: options.tier || 1,
    hold: options.hold || "weak",
    heat: options.heat ?? 0,
    territory: options.territory || [],
    members: options.members || [],
    notes: options.notes || "",
    goals: options.goals || [],
    clockId: options.clockId || null,
  };
}

export function addHeat(faction, amount) {
  faction.heat = (faction.heat || 0) + amount;
  return faction;
}

export function setTier(faction, tier) {
  faction.tier = Math.max(1, Math.min(6, tier));
  return faction;
}

export function setHold(faction, hold) {
  const valid = ["strong", "weak", "none"];
  if (!valid.includes(hold)) throw new Error(`Hold must be one of: ${valid.join(", ")}`);
  faction.hold = hold;
  return faction;
}

export function addTerritory(faction, locationId) {
  if (!faction.territory.includes(locationId)) {
    faction.territory.push(locationId);
  }
  return faction;
}

export function removeTerritory(faction, locationId) {
  faction.territory = faction.territory.filter((id) => id !== locationId);
  return faction;
}

export function hasTerritory(faction, locationId) {
  return faction.territory.includes(locationId);
}

export function addMember(faction, memberId) {
  if (!faction.members.includes(memberId)) {
    faction.members.push(memberId);
  }
  return faction;
}

export function removeMember(faction, memberId) {
  faction.members = faction.members.filter((id) => id !== memberId);
  return faction;
}

export function hasMember(faction, memberId) {
  return faction.members.includes(memberId);
}

export function addGoal(faction, goal) {
  faction.goals.push(goal);
  return faction;
}

export function removeGoal(faction, goal) {
  faction.goals = faction.goals.filter((g) => g !== goal);
  return faction;
}

export function setNotes(faction, notes) {
  faction.notes = notes;
  return faction;
}
