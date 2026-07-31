/**
 * ### Consequence System
 *
 * Consequences are registered templates that mutate game state. Each action entry provides a single
 * consequence object. Consequences apply on **failure** (always) and **partial success** (50% of the time —
 * the other 50% triggers Reduced Effect instead).
 *
 * Built-in Templates:
 * - `harm` — Reduces Guard then Body (params: `amount`, reduced by matching `armor` items)
 * - `condition` — Adds a condition ID to `character.conditions[]` (params: `condition`)
 * - `tickClock` — Advances the mission's 4-seg danger clock (params: `amount`)
 * - `loseItem` — Removes an item from inventory (params: `itemId`, optional)
 *
 * String-only consequences (narrative text) are also supported.
 *
 * Custom templates can be registered with `registerConsequenceTemplate(id, handler)`.
 *
 * API:
 * - `registerConsequenceTemplate(id, handler)` — register a custom template
 * - `knownConsequenceTemplates()` — return array of registered template IDs
 * - `getConsequenceTemplate(id)` — lookup a template handler
 * - `applyConsequence(state, consequence, context)` — run the template handler
 */
import { removeItem, recalcLoad } from "./character.js";
import { findApplicableEffects } from "./stunt.js";
import { tickClock as tickC } from "./clock.js";

const CONSEQUENCE_TEMPLATES = {};

export function registerConsequenceTemplate(id, handler) {
  CONSEQUENCE_TEMPLATES[id] = handler;
}

export function knownConsequenceTemplates() {
  return Object.keys(CONSEQUENCE_TEMPLATES);
}

export function getConsequenceTemplate(id) {
  return CONSEQUENCE_TEMPLATES[id] || null;
}

export function applyConsequence(state, consequence, context = {}) {
  if (!consequence) return null;

  if (typeof consequence === "string") {
    return { description: consequence, templateResult: null };
  }

  if (Array.isArray(consequence)) {
    return consequence.map((c) => applyConsequence(state, c, context));
  }

  const { description, template, params = {} } = consequence;
  if (!template) {
    return { description: description || "", templateResult: null };
  }

  const handler = CONSEQUENCE_TEMPLATES[template];
  if (!handler) {
    throw new Error(`Unknown consequence template "${template}". Available: ${Object.keys(CONSEQUENCE_TEMPLATES).join(", ")}`);
  }

  const templateResult = handler(state, { ...params }, context);
  return { description: description || "", templateResult };
}

registerConsequenceTemplate("harm", (state, params, context) => {
  const character = context.character;
  if (!character) return { type: "harm", guardDamage: 0, bodyDamage: 0 };

  const allTags = [
    ...(context.scene?.tags || []),
    ...(context.challenge?.tags || []),
  ];
  const applicable = findApplicableEffects(
    character.inventory || [],
    allTags,
    character,
  );
  let reduction = 0;
  for (const e of applicable) reduction += e.armor || 0;

  let remaining = Math.max(0, (params.amount || 1) - reduction);
  const guardBefore = character.guard;
  if (character.guard > 0) {
    const absorbed = Math.min(character.guard, remaining);
    character.guard -= absorbed;
    remaining -= absorbed;
  }
  const bodyBefore = character.body;
  character.body = Math.max(0, character.body - remaining);
  const guardDamage = guardBefore - character.guard;
  const bodyDamage = bodyBefore - character.body;

  return { type: "harm", amount: params.amount || 1, guardDamage, bodyDamage, guard: character.guard, body: character.body, reduction };
});

registerConsequenceTemplate("condition", (state, params, context) => {
  const character = context.character;
  if (!character || !params.condition) return { type: "condition", condition: null };

  character.conditions.push(params.condition);
  recalcLoad(character);
  return { type: "condition", condition: params.condition };
});

registerConsequenceTemplate("tickClock", (state, params, context) => {
  const amount = params.amount || 1;
  if (!state) return { type: "tickClock", amount };

  const mission = (state.plotlines || []).find(
    (p) => p.id === state.activeMissionId,
  )?.mission;
  if (!mission) return { type: "tickClock", amount };

  if (!mission.dangerClock) {
    mission.dangerClock = { current: 0, max: 4 };
  }
  mission.dangerClock.current = Math.min(
    mission.dangerClock.max,
    mission.dangerClock.current + amount,
  );
  const filled = mission.dangerClock.current >= mission.dangerClock.max;
  let trigger = null;

  if (filled) {
    mission.dangerClock.current = 0;
    const roll = Math.floor(Math.random() * 3);
    if (roll === 0) {
      mission.heatGenerated = Math.max(
        mission.heatGenerated || 0,
        (mission.heatGenerated || 0) + 1,
      );
      trigger = { effect: "heat", amount: 1 };
    } else if (roll === 1) {
      const activeScene = context.scene;
      const unresolved = (activeScene?.challenges || []).filter(
        (c) => !c.resolved,
      );
      if (unresolved.length > 0) {
        const target =
          unresolved[Math.floor(Math.random() * unresolved.length)];
        tickC(target.clock, 2);
        target._dangerBoosted = true;
        trigger = { effect: "boostClock", challengeId: target.id, amount: 2 };
      }
    } else {
      const chars = state.characters || [];
      if (chars.length > 0) {
        const target = chars[Math.floor(Math.random() * chars.length)];
        target.conditions = target.conditions || [];
        target.conditions.push("doomed");
        recalcLoad(target);
        trigger = { effect: "condition", condition: "doomed", character: target.name };
      }
    }
  }

  return { type: "tickClock", amount, dangerClock: mission.dangerClock, trigger };
});

registerConsequenceTemplate("loseItem", (state, params, context) => {
  const character = context.character;
  if (!character || !character.inventory.length) {
    return { type: "loseItem", lost: null };
  }

  const itemId = params.itemId;
  if (itemId && character.inventory.some((i) => i.id === itemId)) {
    removeItem(character, itemId);
    return { type: "loseItem", lost: itemId };
  }

  const fallback = character.inventory[character.inventory.length - 1];
  character.inventory = character.inventory.filter((i) => i !== fallback);
  recalcLoad(character);
  return { type: "loseItem", lost: fallback.id, fallback: true };
});
