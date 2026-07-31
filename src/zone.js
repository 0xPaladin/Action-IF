/**
 * ### Zones
 *
 * `zone.js` models the zone hierarchy, graph generation.
 *
 * Zone Types (largest → smallest):
 * galaxy > expanse > sector > reach > subsector > cluster > system > world > realm > region > area > site
 *
 * Zone {
 *   id: string
 *   type: string                     // one of the hierarchy levels above
 *   name: string
 *   description: string
 *   parent: string | null
 *   children: string[]               // child zone IDs (populated by generateZoneNodeGraph)
 *   links: Link[]                     // structural navigation links
 * }
 *
 * API:
 * - `createZone(id, type, name, description, parent)` — create a zone
 * - `addZone(state, zone)` — add zone to state
 * - `generateZoneNodeGraph(state)` — builds parent/child links from zone hierarchy
 *
 * Zone Node Graph Logic (4 passes):
 * 1. Build a `zoneIndex` map of all zones
 * 2. For each zone with a `parent`, push its id into the parent's `children[]`
 * 3. For each zone, create parent→child links from `children[]`
 * 4. For each non-root zone, create a child→parent return link
 */
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
