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
