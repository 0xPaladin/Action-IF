import { tickClock, isClockFull } from "./clock.js";
import { actionRoll } from "./action.js";
import {
  findApplicableEffects,
  getEffectiveActionFromEffects,
  applyBonusDice,
  getBonusTicks,
  getBonusEffect,
} from "./stunt.js";
import { tickFactionClock } from "./factionClock.js";
import { resolveHook } from "./hook.js";
import { applyConsequence } from "./consequence.js";
import { addMomentum, momentumFromOutcome } from "./momentum.js";

// Effect level constants and helpers
export const EFFECT_LEVELS = ["none", "limited", "standard", "great"];
export const EFFECT_TICKS = { none: 0, limited: 1, standard: 2, great: 3 };
const EFFECT_ORDER = { none: 0, limited: 1, standard: 2, great: 3 };

export function getEffectTicks(effectLevel) {
  return EFFECT_TICKS[effectLevel] ?? 0;
}

export function clampEffect(level) {
  if (level < 0) return "none";
  if (level > 3) return "great";
  return EFFECT_LEVELS[level];
}

export function reduceEffect(level) {
  const idx = EFFECT_ORDER[level] ?? 1;
  return EFFECT_LEVELS[Math.max(0, idx - 1)];
}

export function increaseEffect(level) {
  const idx = EFFECT_ORDER[level] ?? 1;
  return EFFECT_LEVELS[Math.min(3, idx + 1)];
}

export function createChallenge(
  id,
  description,
  clockMax,
  tags = [],
  onAct = null,
  onComplete = null,
  condition = null,
  defaultEffect = "standard",
) {
  return {
    id,
    description,
    clock: { max: clockMax, current: 0 },
    tags: [...tags],
    actions: [],
    resolved: false,
    onAct,
    onComplete,
    condition,
    defaultEffect,
  };
}

export function addActionToChallenge(
  challenge,
  actionName,
  consequence,
  heat = 3,
) {
  challenge.actions.push({ actionName, consequences: consequence, heat });
  return challenge;
}

export function resolveAction(
  challenge,
  actionEntry,
  character,
  scene = null,
  state = null,
  extraBonusDice = 0,
  crewStunts = [],
  momentumSpent = false,
  effect = null,
) {
  const { actionName } = actionEntry;

  const allTags = [...(scene?.tags || []), ...(challenge.tags || [])];
  const charEffects = [
    ...(character.stunts || []),
    ...(character.inventory || []),
    ...crewStunts,
  ];
  const applicable = findApplicableEffects(charEffects, allTags, character);

  const effective = getEffectiveActionFromEffects(
    character,
    actionName,
    applicable,
  );

  const modified = applyBonusDice(applicable, effective.pool, effective.actionName);

  const bonusDice = modified.pool - effective.pool + extraBonusDice;

  const roll = actionRoll(
    character,
    effective.actionName,
    bonusDice,
    0,
    allTags,
  );

  const outcomeLevel = roll.outcome.level;

  // --- Effect system ---
  // Determine base effect level: explicit param > challenge default > "standard"
  let baseEffect = effect || challenge.defaultEffect || "standard";
  if (!EFFECT_LEVELS.includes(baseEffect)) baseEffect = "standard";

  // Apply bonusEffect from stunts/items
  const bonusEffect = getBonusEffect(applicable, effective.actionName);
  let effectiveEffect = clampEffect(EFFECT_ORDER[baseEffect] + bonusEffect);

  // Apply push-for-effect (caller passes pushForEffect via extraBonusDice trick —
  // but we handle it via the effect param being pre-incremented by engine)
  // Note: engine handles pushForEffect by passing an already-boosted effect level

  // Apply nextActionBonusDice from Set Up (consumed by engine before calling)
  // Apply reduced effect from challenge state (if previously reduced)
  if (challenge.reducedEffect > 0) {
    effectiveEffect = reduceEffect(effectiveEffect);
    challenge.reducedEffect -= 1;
  }

  const bonusTicks = getBonusTicks(applicable, effective.actionName);

  // --- Tick calculation ---
  let ticks = 0;
  let reduced = false;
  let consequenceApplied = false;
  let consequenceResult = null;

  if (outcomeLevel === "critical") {
    ticks = getEffectTicks(effectiveEffect) * 2 + bonusTicks;
  } else if (outcomeLevel === "full") {
    ticks = getEffectTicks(effectiveEffect) + bonusTicks;
  } else if (outcomeLevel === "partial") {
    // 50/50: reduced effect (no consequence) OR full effect + designer consequence
    if (Math.random() < 0.5) {
      // Reduced effect — drop one level, no designer consequence
      effectiveEffect = reduceEffect(effectiveEffect);
      reduced = true;
      ticks = getEffectTicks(effectiveEffect) + bonusTicks;
    } else {
      // Full effect + designer consequence
      ticks = getEffectTicks(effectiveEffect) + bonusTicks;
      const consequence = actionEntry.consequence || actionEntry.consequences;
      if (consequence) {
        // Protect: redirect consequence to protecting character
        let consequenceCharacter = character;
        if (state && state.protectTargetIndex !== undefined && state.protectTargetIndex !== null) {
          const protectChar = state.characters[state.protectTargetIndex];
          if (protectChar) {
            consequenceCharacter = protectChar;
          }
        }
        const context = { challenge, scene, roll, character: consequenceCharacter, actionEntry, effect: effectiveEffect };
        consequenceResult = state
          ? applyConsequence(state, consequence, context)
          : applyConsequence(null, consequence, context);
        consequenceApplied = true;
      }
    }
  } else {
    // failure — always designer consequence
    ticks = 0;
    const consequence = actionEntry.consequence || actionEntry.consequences;
    if (consequence) {
      // Protect: redirect consequence to protecting character
      let consequenceCharacter = character;
      if (state && state.protectTargetIndex !== undefined && state.protectTargetIndex !== null) {
        const protectChar = state.characters[state.protectTargetIndex];
        if (protectChar) {
          consequenceCharacter = protectChar;
        }
      }
      const context = { challenge, scene, roll, character: consequenceCharacter, actionEntry, effect: effectiveEffect };
      consequenceResult = state
        ? applyConsequence(state, consequence, context)
        : applyConsequence(null, consequence, context);
      consequenceApplied = true;
    }
  }

  tickClock(challenge.clock, ticks);

  if (!momentumSpent && state) {
    const gain = momentumFromOutcome(outcomeLevel);
    if (gain > 0) addMomentum(state, gain);
  }

  let result = {
    clock: challenge.clock,
    effect: effectiveEffect,
    reduced,
    consequenceApplied,
  };

  if (consequenceResult) {
    result.consequence = consequenceResult;
  }

  const wasResolved = challenge.resolved;
  if (isClockFull(challenge.clock)) {
    challenge.resolved = true;
  }

  if (state) resolveHook(state, challenge.onAct, { challenge, roll, result });
  else if (typeof challenge.onAct === "function")
    challenge.onAct(challenge, { roll, result });

  if (!wasResolved && challenge.resolved) {
    if (challenge.tickFactionClock && state) {
      tickFactionClock(
        state,
        challenge.tickFactionClock.id,
        challenge.tickFactionClock.amount || 1,
      );
    }
    if (state) resolveHook(state, challenge.onComplete, { challenge });
    else if (typeof challenge.onComplete === "function")
      challenge.onComplete(challenge);
  }

  return { roll, result };
}
