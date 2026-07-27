import { addCoin, addRep, addUpgrade, addCrewStunt, hasUpgrade, hasCrewStunt } from "./crew.js";
import { addHeat as addFactionHeat } from "./faction.js";

const BUILTIN_TEMPLATES = {};

export function registerClaimTemplate(id, name, description, apply, remove) {
  BUILTIN_TEMPLATES[id] = { id, name, description, apply, remove };
}

export function getClaimTemplate(id) {
  return BUILTIN_TEMPLATES[id] || null;
}

export function knownClaimTemplates() {
  return Object.keys(BUILTIN_TEMPLATES);
}

registerClaimTemplate("income", "Income", "Generates passive coin each downtime.",
  (s, crew, claim) => { if (crew) addCoin(crew, claim.params.amount || 1); },
  (s, crew, claim) => { if (crew) addCoin(crew, -(claim.params.amount || 1)); },
);

registerClaimTemplate("rep_boost", "Reputation", "Increases crew reputation.",
  (s, crew, claim) => { if (crew) addRep(crew, claim.params.amount || 1); },
  (s, crew, claim) => { if (crew) addRep(crew, -(claim.params.amount || 1)); },
);

registerClaimTemplate("heat_sink", "Safe Haven", "Reduces heat generation on missions. Stacks with other heat sinks.",
  (s, crew, claim) => { if (crew) crew.heatSinks = (crew.heatSinks || 0) + (claim.params.amount || 1); },
  (s, crew, claim) => { if (crew) crew.heatSinks = Math.max(0, (crew.heatSinks || 0) - (claim.params.amount || 1)); },
);

registerClaimTemplate("upgrade_slot", "Upgrade", "Grants a crew upgrade.",
  (s, crew, claim) => { if (crew && claim.params.upgradeId) addUpgrade(crew, claim.params.upgradeId); },
  (s, crew, claim) => { /* upgrades are not removed */ },
);

registerClaimTemplate("faction_contact", "Contact", "Improves relations with a faction.",
  (s, crew, claim) => {
    if (claim.params.factionId) {
      const faction = (s.factions || []).find((f) => f.id === claim.params.factionId);
      if (faction) addFactionHeat(faction, -(claim.params.amount || 1));
    }
  },
  (s, crew, claim) => {
    if (claim.params.factionId) {
      const faction = (s.factions || []).find((f) => f.id === claim.params.factionId);
      if (faction) addFactionHeat(faction, claim.params.amount || 1);
    }
  },
);

registerClaimTemplate("territory_control", "Territory", "Brings a location under the crew's control.",
  (s, crew, claim) => {
    if (crew && claim.params.locationId && !crew.territory.includes(claim.params.locationId)) {
      crew.territory.push(claim.params.locationId);
    }
  },
  (s, crew, claim) => {
    if (crew && claim.params.locationId) {
      crew.territory = crew.territory.filter((id) => id !== claim.params.locationId);
    }
  },
);

registerClaimTemplate("crew_stunt", "Crew Ability", "Grants a crew-wide stunt.",
  (s, crew, claim) => {
    if (crew && claim.params.stuntId) {
      try { addCrewStunt(crew, claim.params.stuntId); } catch (_) {}
    }
  },
  (s, crew, claim) => { /* stunts are not removed */ },
);

registerClaimTemplate("lair_room", "Lair Room", "Adds a room or feature to the lair.",
  (s, crew, claim) => {
    if (crew) {
      if (!crew.lairRooms) crew.lairRooms = [];
      if (!crew.lairRooms.includes(claim.params.roomId || claim.id)) {
        crew.lairRooms.push(claim.params.roomId || claim.id);
      }
    }
  },
  (s, crew, claim) => {
    if (crew && crew.lairRooms) {
      crew.lairRooms = crew.lairRooms.filter((r) => r !== (claim.params.roomId || claim.id));
    }
  },
);

registerClaimTemplate("bonus_payout", "Bonus Payout", "Extra coin and rep from missions with matching tags.",
  (s, crew, claim) => {
    if (crew) {
      if (!crew.bonusPayouts) crew.bonusPayouts = [];
      crew.bonusPayouts.push({
        tags: claim.params.tags || [],
        bonusCoin: claim.params.bonusCoin || 2,
        bonusRep: claim.params.bonusRep || 0,
      });
    }
  },
  (s, crew, claim) => {
    if (crew && crew.bonusPayouts) {
      crew.bonusPayouts = crew.bonusPayouts.filter((bp) => {
        return JSON.stringify(bp.tags) !== JSON.stringify(claim.params.tags || []);
      });
    }
  },
);

export function createClaim(id, name, description, location, templateId, params = {}, options = {}) {
  const template = getClaimTemplate(templateId);
  if (!template) throw new Error(`Unknown claim template "${templateId}". Known: ${knownClaimTemplates().join(", ")}`);

  return {
    id,
    name,
    description,
    location,
    templateId,
    params,
    prerequisites: options.prerequisites || [],
    connections: options.connections || [],
    taken: false,
  };
}

export function findClaim(state, claimId) {
  return (state.claims || []).find((c) => c.id === claimId) || null;
}

export function getAvailableClaims(state) {
  return (state.claims || []).filter((c) => {
    if (c.taken) return false;
    return (c.prerequisites || []).every((prereqId) => {
      const prereq = findClaim(state, prereqId);
      return prereq && prereq.taken;
    });
  });
}

export function getClaimConnections(state, claimId) {
  const claim = findClaim(state, claimId);
  if (!claim) return [];
  return (claim.connections || []).map((id) => findClaim(state, id)).filter(Boolean);
}

export function takeClaim(state, claimId) {
  const claim = findClaim(state, claimId);
  if (!claim) throw new Error(`Claim "${claimId}" not found`);
  if (claim.taken) throw new Error(`Claim "${claimId}" is already taken`);

  for (const prereqId of (claim.prerequisites || [])) {
    const prereq = findClaim(state, prereqId);
    if (!prereq || !prereq.taken) {
      throw new Error(`Prerequisite "${prereqId}" not taken for claim "${claimId}"`);
    }
  }

  const template = getClaimTemplate(claim.templateId);
  if (!template) throw new Error(`Template "${claim.templateId}" not found for claim "${claimId}"`);

  claim.taken = true;

  if (state.crew) {
    if (!state.crew.claims.includes(claimId)) {
      state.crew.claims.push(claimId);
    }
  }

  if (typeof template.apply === "function") {
    template.apply(state, state.crew, claim);
  }

  return claim;
}

export function relinquishClaim(state, claimId) {
  const claim = findClaim(state, claimId);
  if (!claim) throw new Error(`Claim "${claimId}" not found`);
  if (!claim.taken) throw new Error(`Claim "${claimId}" is not taken`);

  const template = getClaimTemplate(claim.templateId);
  if (template && typeof template.remove === "function") {
    template.remove(state, state.crew, claim);
  }

  claim.taken = false;

  if (state.crew) {
    state.crew.claims = state.crew.claims.filter((id) => id !== claimId);
  }

  return claim;
}
