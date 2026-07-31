/**
 * ### Actions
 *
 * Actions are physical things characters can do at a location (search, activate a lever, etc)
 * or interact with an NPC. They may trigger a scene, provide keys, set flags, or resolve hooks.
 * The same `Action` object is used for both location actions and NPC actions — NPC actions appear
 * grouped under their NPC in the location context.
 *
 * Action {
 *   id: string
 *   label: string                  // display text
 *   description: string
 *   once: boolean                  // true = can only be performed once
 *   used: boolean                  // tracks if a once-action has been used
 *   triggerScene: string | null    // scene to enter when used
 *   setFlag: string | null         // flag to set when used
 *   provideKeys: string[]          // keys (flags) granted when used
 *   condition: object | null       // prerequisite to be available
 *   hooks: object | null           // declarative hook(s) to resolve when used
 * }
 */
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
