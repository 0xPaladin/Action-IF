import { describe, test, expect } from "bun:test";
import {
  registerClaimTemplate, getClaimTemplate, knownClaimTemplates,
  createClaim, findClaim, getAvailableClaims, getClaimConnections, takeClaim, relinquishClaim,
} from "../src/claim.js";
import { createCrew } from "../src/crew.js";
import { createGameState } from "../src/state.js";

describe("claim templates", () => {
  test("built-in templates are registered", () => {
    expect(knownClaimTemplates()).toContain("income");
    expect(knownClaimTemplates()).toContain("rep_boost");
    expect(knownClaimTemplates()).toContain("heat_sink");
    expect(knownClaimTemplates()).toContain("bonus_payout");
  });

  test("registerClaimTemplate adds custom template", () => {
    registerClaimTemplate("custom_test", "Custom", "test",
      (s, crew, claim) => { s.flags.custom_applied = true; },
      (s, crew, claim) => { delete s.flags.custom_applied; },
    );
    expect(getClaimTemplate("custom_test")).not.toBeNull();
  });
});

describe("createClaim", () => {
  test("creates claim with template", () => {
    const c = createClaim("safehouse", "Safehouse", "A hideout", "docks", "income", { amount: 1 });
    expect(c.id).toBe("safehouse");
    expect(c.templateId).toBe("income");
    expect(c.taken).toBe(false);
  });

  test("throws for unknown template", () => {
    expect(() => createClaim("x", "X", "d", "loc", "bogus")).toThrow();
  });
});

describe("takeClaim / relinquishClaim", () => {
  test("takeClaim applies template and marks taken", () => {
    const state = createGameState();
    state.crew = createCrew("c1", "Crew", { description: "A crew" });
    state.claims.push(createClaim("safehouse", "Safehouse", "A hideout", "docks", "income", { amount: 2 }));
    takeClaim(state, "safehouse");
    expect(state.crew.coin).toBe(2);
    expect(state.claims[0].taken).toBe(true);
  });

  test("relinquishClaim reverses effect", () => {
    const state = createGameState();
    state.crew = createCrew("c1", "Crew", { description: "A crew", coin: 10 });
    state.claims.push(createClaim("safehouse", "Safehouse", "A hideout", "docks", "income", { amount: 3 }));
    takeClaim(state, "safehouse");
    expect(state.crew.coin).toBe(13);
    relinquishClaim(state, "safehouse");
    expect(state.crew.coin).toBe(10);
    expect(state.claims[0].taken).toBe(false);
  });

  test("takeClaim enforces prerequisites", () => {
    const state = createGameState();
    state.crew = createCrew("c1", "Crew", { description: "A crew" });
    state.claims.push(createClaim("outer", "Outer", "d", "loc", "income", {}, { prerequisites: ["inner"] }));
    state.claims.push(createClaim("inner", "Inner", "d", "loc", "income", {}));
    expect(() => takeClaim(state, "outer")).toThrow(/prerequisite/i);
    takeClaim(state, "inner");
    takeClaim(state, "outer");
    expect(state.claims[0].taken).toBe(true);
  });

  test("getAvailableClaims respects prerequisites", () => {
    const state = createGameState();
    state.crew = createCrew("c1", "Crew", { description: "A crew" });
    state.claims.push(createClaim("a", "A", "d", "loc", "income", {}, { prerequisites: ["b"] }));
    state.claims.push(createClaim("b", "B", "d", "loc", "income", {}));
    expect(getAvailableClaims(state)).toHaveLength(1);
    expect(getAvailableClaims(state)[0].id).toBe("b");
    takeClaim(state, "b");
    expect(getAvailableClaims(state)).toHaveLength(1);
    expect(getAvailableClaims(state)[0].id).toBe("a");
  });
});

describe("findClaim / getClaimConnections", () => {
  test("finds claim by ID", () => {
    const state = createGameState();
    state.claims.push(createClaim("a", "A", "d", "loc", "income"));
    expect(findClaim(state, "a")).not.toBeNull();
    expect(findClaim(state, "none")).toBeNull();
  });
});
