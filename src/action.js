import { rollDice, interpretResults } from "./dice.js";
import { harmPenalty, conditionPenalty } from "./character.js";

export function actionRoll(
  character,
  actionName,
  bonusDice = 0,
  penaltyDice = 0,
  penaltyTags = [],
) {
  const dots = character.actions[actionName];
  if (dots === undefined) {
    throw new Error(`Unknown action "${actionName}"`);
  }

  const mods = (character.actionMods || []).filter((m) => m.action === actionName);
  const modDelta = mods.reduce((sum, m) => sum + m.delta, 0);
  const effectiveDots = Math.max(0, dots + modDelta);

  const hp = Math.max(0, harmPenalty(character));
  const cp = conditionPenalty(character, penaltyTags);
  const pool = Math.max(
    0,
    effectiveDots + bonusDice - penaltyDice - hp - cp,
  );
  const results = rollDice(pool);
  const outcome = interpretResults(results);

  return {
    action: actionName,
    pool,
    results,
    outcome,
  };
}

export function resistanceRoll(character) {
  const best = Object.values(character.actions).reduce(
    (max, v) => Math.max(max, v),
    0,
  );
  const pool = Math.max(0, best);
  const results = rollDice(pool);
  const sixes = results.filter((d) => d === 6).length;

  const reduction = sixes >= 2 ? 2 : 1;

  return { pool, results, reduction };
}
