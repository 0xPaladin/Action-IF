import { describe, test, expect } from "bun:test";
import { engagementRoll, APPROACHES } from "../src/engagement.js";

describe("engagementRoll", () => {
  test("returns roll result with outcome", () => {
    const r = engagementRoll(3);
    expect(r.pool).toBe(3);
    expect(r.results).toHaveLength(3);
    expect(r.outcome).toHaveProperty("level");
  });

  test("zero pool gives failure", () => {
    const r = engagementRoll(0);
    expect(r.pool).toBe(0);
    expect(r.outcome.level).toBe("failure");
  });
});

describe("APPROACHES", () => {
  test("has 5 approaches with descriptions", () => {
    expect(Object.keys(APPROACHES)).toEqual(["assault", "stealth", "social", "occult", "transport"]);
  });
});
