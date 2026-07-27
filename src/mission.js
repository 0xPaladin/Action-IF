export function heatForAction(outcomeLevel, actionHeat = 3) {
  if (outcomeLevel === "critical") return Math.max(0, actionHeat - 2);
  if (outcomeLevel === "partial" || outcomeLevel === "full")
    return Math.max(0, actionHeat - 1);
  return actionHeat;
}

export function buildMissionSummary(plotline) {
  if (!plotline || !plotline.mission) return null;

  const mission = plotline.mission;
  const totalHeat = (mission.heatGenerated || 0) + (mission.baseHeat || 0);

  const lines = [
    `Mission Complete: ${plotline.name}`,
    `Payoff: +${mission.payoff.coin || 0} coin, +${mission.payoff.rep || 0} rep`,
    `Heat: ${totalHeat} (max action heat ${mission.heatGenerated || 0} + base ${mission.baseHeat || 0})`,
  ];
  if (mission.patronFaction) lines.push(`Patron (${mission.patronFaction}): +1 status`);
  if (mission.targetFaction) lines.push(`Target (${mission.targetFaction}): -1 status`);

  return lines.join("\n");
}

export function createMissionConfig(def) {
  return {
    patron: def.patron || null,
    patronFaction: def.patronFaction || null,
    targetFaction: def.targetFaction || null,
    payoff: def.payoff || { rep: 0, coin: 0 },
    baseHeat: def.baseHeat || 0,
    tags: def.tags || [],
    locationId: def.locationId || null,
    startingSceneId: def.startingSceneId || null,
    engagementAction: def.engagementAction || null,
    onComplete: def.onComplete || null,
  };
}