import { createStunt } from "./stunt.js";

export function createCrew(id, name, definition = {}) {
  const stuntDefs = definition.stunts || [];
  const stunts = stuntDefs.map((s) =>
    createStunt(s.id, s.name, s.description, s.tags || [], s.effects || s)
  );

  return {
    id,
    name,
    description: definition.description || "",
    lair: definition.lair || null,
    reputation: definition.reputation || 0,
    coin: definition.coin || 0,
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

export function addRep(crew, amount) {
  crew.reputation = Math.max(0, crew.reputation + amount);
  return crew;
}

export function addCoin(crew, amount) {
  crew.coin = Math.max(0, crew.coin + amount);
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
