/**
 * ### Crew System
 *
 * `crew.js` models the player crew (defined by the game creator). Crews have a description,
 * a `resources` map (keyed by resource id, e.g. `coin`, `reputation`), hold, upgrades, XP, and stunts.
 * A crew stunt applies to **all characters**.
 *
 * Resource amounts are stored in `crew.resources` (a plain object mapping resource id → number).
 * The set of known resource ids and their display names/descriptions is declared by the game
 * definition's `gameResources` object (loaded into `state.gameResources` by the engine). The
 * `resources` map is lenient: any id may be used and auto-initializes to 0.
 *
 * API:
 * - `createCrew(id, name, definition)` — creates a crew
 * - `addResource(crew, id, amount)` — add to a resource (clamped at 0)
 * - `spendResource(crew, id, amount)` — spend from a resource (returns false if insufficient)
 * - `migrateLegacyCrew(crew)` — migrate old `crew.coin`/`crew.reputation` into `crew.resources`
 * - `addUpgrade(crew, upgradeId)` — add an upgrade
 * - `hasUpgrade(crew, upgradeId)` — check if crew has an upgrade
 * - `addCrewXp(crew, amount)` — add crew XP
 * - `addCrewStunt(crew, stuntId)` — activate a stunt on the crew
 * - `hasCrewStunt(crew, stuntId)` — check if stunt is active
 * - `getCrewStunts(crew)` — get array of active stunt objects
 */
import { createStunt } from "./stunt.js";

export function createCrew(id, name, definition = {}) {
  const stuntDefs = definition.stunts || [];
  const stunts = stuntDefs.map((s) =>
    createStunt(s.id, s.name, s.description, s.tags || [], s.effects || s)
  );

  // Build the resources map from the definition. Support both the new
  // `resources` object and the legacy `coin`/`reputation` fields so that
  // older game definitions keep working.
  const resources = { ...(definition.resources || {}) };
  if (definition.coin !== undefined) resources.coin = definition.coin;
  if (definition.reputation !== undefined) resources.reputation = definition.reputation;

  return {
    id,
    name,
    description: definition.description || "",
    lair: definition.lair || null,
    resources,
    hold: definition.hold || "weak",
    upgrades: definition.upgrades || [],
    stunts,
    stuntDefs,
    claims: [],
    territory: [],
    heatSinks: 0,
    lairRooms: [],
    bonusPayouts: [],
    xp: definition.xp || 0,
  };
}

export function addResource(crew, id, amount) {
  if (!crew.resources) crew.resources = {};
  crew.resources[id] = Math.max(0, (crew.resources[id] || 0) + amount);
  return crew;
}

export function spendResource(crew, id, amount) {
  if (!crew.resources) crew.resources = {};
  const current = crew.resources[id] || 0;
  if (current < amount) return false;
  crew.resources[id] = current - amount;
  return true;
}

export function migrateLegacyCrew(crew) {
  if (!crew) return crew;
  if (!crew.resources) crew.resources = {};
  if (crew.coin !== undefined) {
    crew.resources.coin = (crew.resources.coin || 0) + crew.coin;
    delete crew.coin;
  }
  if (crew.reputation !== undefined) {
    crew.resources.reputation = (crew.resources.reputation || 0) + crew.reputation;
    delete crew.reputation;
  }
  return crew;
}

export function addUpgrade(crew, upgradeId) {
  if (!crew.upgrades.includes(upgradeId)) {
    crew.upgrades.push(upgradeId);
  }
  return crew;
}

export function hasUpgrade(crew, upgradeId) {
  return crew.upgrades.includes(upgradeId);
}

export function addCrewXp(crew, amount) {
  crew.xp += amount;
  return crew;
}

export function addCrewStunt(crew, stuntId) {
  const stuntDef = (crew.stuntDefs || []).find((s) => s.id === stuntId);
  if (!stuntDef) throw new Error(`Stunt "${stuntId}" not found in crew`);
  if (!crew.stunts.find((s) => s.id === stuntId)) {
    crew.stunts.push(createStunt(stuntDef.id, stuntDef.name, stuntDef.description, stuntDef.tags || [], stuntDef.effects || stuntDef));
  }
  return crew;
}

export function hasCrewStunt(crew, stuntId) {
  return crew.stunts.some((s) => s.id === stuntId);
}

export function getCrewStunts(crew) {
  return crew.stunts || [];
}
