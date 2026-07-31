/**
 * ### Engagement
 *
 * `engagement.js` handles the engagement roll that starts a mission (score).
 *
 * API:
 * - `engagementRoll(rating)` — roll a dice pool of `rating` (typically the crew's best action).
 *   Returns `{ pool, results, outcome, complication }` — no position or engagement shift.
 */
import { rollDice, interpretResults } from "./dice.js";

export const APPROACHES = {
  assault:   { description: "Direct, violent action." },
  stealth:   { description: "Quiet, unnoticed, or disguised." },
  social:    { description: "Manipulation, negotiation, or deception." },
  occult:    { description: "Rituals, arcane power, or supernatural means." },
  transport: { description: "Movement of goods or people through dangerous routes." },
};

export function engagementRoll(rating) {
  const pool = Math.max(0, rating);
  const results = rollDice(pool);
  const outcome = interpretResults(results);

  return {
    pool,
    results,
    outcome,
    complication: outcome.level === "partial",
  };
}
