import { describe, test, expect } from "bun:test";
import {
  createCrew,
  addResource, spendResource, migrateLegacyCrew, addUpgrade, hasUpgrade, addCrewXp, addCrewStunt, hasCrewStunt, getCrewStunts,
} from "../src/crew.js";
import { createStunt } from "../src/stunt.js";

describe("createCrew", () => {
  test("creates crew with description and resources", () => {
    const crew = createCrew("c1", "The Shadows", {
      description: "Undermine authority through theft, infiltration, and sabotage.",
      resources: { coin: 2 },
    });
    expect(crew.name).toBe("The Shadows");
    expect(crew.resources.coin).toBe(2);
    expect(crew.hold).toBe("weak");
    expect(crew.description).toContain("theft");
  });

  test("accepts inline definition with stunts", () => {
    const crew = createCrew("c1", "Crew", {
      description: "Custom",
      stunts: [createStunt("s1", "S1", "d", [], { bonusDice: 1 })],
      upgrades: [],
    });
    expect(crew.stunts).toHaveLength(1);
    expect(crew.stunts[0].id).toBe("s1");
  });

  test("accepts stunt definition objects", () => {
    const crew = createCrew("c1", "Crew", {
      description: "Custom",
      stunts: [{ id: "s1", name: "S1", description: "d", tags: [], effects: { bonusDice: 1 } }],
      upgrades: [],
    });
    expect(crew.stunts).toHaveLength(1);
    expect(crew.stunts[0].id).toBe("s1");
    expect(crew.stunts[0].bonusDice).toBe(1);
  });
});

describe("addResource / spendResource", () => {
  test("adds and clamps positive", () => {
    const crew = createCrew("c1", "Crew", { description: "d" });
    addResource(crew, "reputation", 5);
    expect(crew.resources.reputation).toBe(5);
    addResource(crew, "coin", -3);
    expect(crew.resources.coin).toBe(0);
  });

  test("spendResource deducts when sufficient", () => {
    const crew = createCrew("c1", "Crew", { description: "d", resources: { coin: 5 } });
    expect(spendResource(crew, "coin", 2)).toBe(true);
    expect(crew.resources.coin).toBe(3);
  });

  test("spendResource returns false and does not change when insufficient", () => {
    const crew = createCrew("c1", "Crew", { description: "d", resources: { coin: 1 } });
    expect(spendResource(crew, "coin", 5)).toBe(false);
    expect(crew.resources.coin).toBe(1);
  });

  test("auto-initializes unknown resource ids", () => {
    const crew = createCrew("c1", "Crew", { description: "d" });
    addResource(crew, "favor", 3);
    expect(crew.resources.favor).toBe(3);
  });
});

describe("migrateLegacyCrew", () => {
  test("migrates legacy coin/reputation fields into resources", () => {
    const crew = { coin: 4, reputation: 2 };
    migrateLegacyCrew(crew);
    expect(crew.resources).toEqual({ coin: 4, reputation: 2 });
    expect(crew.coin).toBeUndefined();
    expect(crew.reputation).toBeUndefined();
  });

  test("preserves existing resources when migrating", () => {
    const crew = { resources: { coin: 1 }, coin: 4, reputation: 2 };
    migrateLegacyCrew(crew);
    expect(crew.resources).toEqual({ coin: 5, reputation: 2 });
    expect(crew.coin).toBeUndefined();
    expect(crew.reputation).toBeUndefined();
  });

  test("handles null crew", () => {
    expect(migrateLegacyCrew(null)).toBeNull();
  });
});

describe("upgrades", () => {
  test("addUpgrade and hasUpgrade dedup", () => {
    const crew = createCrew("c1", "Crew", { description: "d" });
    addUpgrade(crew, "quarters");
    expect(hasUpgrade(crew, "quarters")).toBe(true);
    addUpgrade(crew, "quarters");
    expect(crew.upgrades).toHaveLength(1);
  });
});

describe("crew stunts", () => {
  test("addCrewStunt activates from stuntDefs", () => {
    const crew = createCrew("c1", "Crew", {
      description: "test",
      stunts: [createStunt("t1", "T1", "d", [], { bonusDice: 1 })],
    });
    addCrewStunt(crew, "t1");
    expect(hasCrewStunt(crew, "t1")).toBe(true);
    expect(getCrewStunts(crew)).toHaveLength(1);
  });

  test("addCrewStunt throws for unknown", () => {
    const crew = createCrew("c1", "Crew", { description: "d" });
    expect(() => addCrewStunt(crew, "nope")).toThrow();
  });
});

describe("addCrewXp", () => {
  test("accumulates XP", () => {
    const crew = createCrew("c1", "Crew", { description: "d" });
    addCrewXp(crew, 5);
    expect(crew.xp).toBe(5);
  });
});
