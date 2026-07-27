import { createLink } from "./location.js";

export function createZone(id, type, name, description, parent = null) {
  return {
    id,
    type,
    name,
    description,
    parent,
    children: [],
    links: [],
  };
}

export function addZone(state, zone) {
  state.zones.push(zone);
  return state;
}

export function generateZoneNodeGraph(state) {
  const zoneIndex = {};
  for (const zone of state.zones) {
    zoneIndex[zone.id] = zone;
  }

  for (const zone of state.zones) {
    if (zone.parent && zoneIndex[zone.parent]) {
      const parent = zoneIndex[zone.parent];
      if (!parent.children.includes(zone.id)) {
        parent.children.push(zone.id);
      }
    }
  }

  for (const zone of state.zones) {
    const existingTargetIds = new Set(zone.links.map((l) => l.targetId));
    for (const childId of zone.children) {
      if (existingTargetIds.has(childId)) continue;
      const child = zoneIndex[childId];
      if (child) {
        zone.links.push(createLink(childId, child.name));
      }
    }
  }

  for (const zone of state.zones) {
    if (!zone.parent) continue;
    const existingTargetIds = new Set(zone.links.map((l) => l.targetId));
    if (existingTargetIds.has(zone.parent)) continue;
    const parent = zoneIndex[zone.parent];
    if (parent) {
      zone.links.push(createLink(zone.parent, `Return to ${parent.name}`));
    }
  }
}
