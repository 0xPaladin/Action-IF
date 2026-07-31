/**
 * ### Momentum
 *
 * `momentum.js` provides a shared crew-level resource for boosting action rolls.
 *
 * - **Starting value**: 2 per session
 * - **Gain**: Action roll outcomes generate momentum when momentum was NOT spent:
 *   - 4–5 (partial): +1 momentum
 *   - 6 (full): +2 momentum
 *   - 66 (critical): +3 momentum
 * - **Spend**: Spend 2 momentum for +1 bonus die on an action roll ("push yourself")
 *
 * API:
 * - `addMomentum(state, amount)` — increments `state.momentum`
 * - `spendMomentum(state, amount)` — decrements if sufficient, returns boolean
 * - `canSpendMomentum(state, amount)` — checks if enough momentum
 * - `resetMomentum(state)` — resets to 2
 * - `momentumFromOutcome(level)` — returns gain: critical=3, full=2, partial=1, failure=0
 */
import { addLogEntry } from "./state.js";

export function addMomentum(state, amount) {
  state.momentum = (state.momentum || 0) + amount;
  addLogEntry(state, {
    type: "momentum",
    text: `Momentum +${amount} (now ${state.momentum})`,
  });
}

export function spendMomentum(state, amount) {
  if ((state.momentum || 0) < amount) return false;
  state.momentum -= amount;
  addLogEntry(state, {
    type: "momentum",
    text: `Momentum −${amount} (now ${state.momentum})`,
  });
  return true;
}

export function canSpendMomentum(state, amount) {
  return (state.momentum || 0) >= amount;
}

export function resetMomentum(state) {
  state.momentum = 2;
}

const GAIN_MAP = {
  critical: 3,
  full: 2,
  partial: 1,
  failure: 0,
};

export function momentumFromOutcome(outcomeLevel) {
  return GAIN_MAP[outcomeLevel] ?? 0;
}
