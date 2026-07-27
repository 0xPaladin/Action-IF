import { resolveHook } from "./hook.js";

export function createFactionClock(id, name, description, clockMax, onComplete = null) {
  return {
    id,
    name,
    description,
    clock: { max: clockMax, current: 0 },
    completed: false,
    onComplete,
  };
}

export function tickFactionClock(state, clockId, amount = 1) {
  const clock = state.factionClocks.find((c) => c.id === clockId);
  if (!clock) throw new Error(`Faction clock "${clockId}" not found`);
  if (clock.completed) return { clock, ticked: false, alreadyCompleted: true };

  clock.clock.current = Math.min(clock.clock.max, clock.clock.current + amount);

  if (clock.clock.current >= clock.clock.max && !clock.completed) {
    clock.completed = true;
    resolveHook(state, clock.onComplete, { clock });
  }

  return { clock, ticked: true };
}
