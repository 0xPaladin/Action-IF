import { describe, test, expect } from "bun:test";
import {
  createFaction, addHeat, setTier, setHold,
  addTerritory, removeTerritory, hasTerritory,
  addMember, removeMember, hasMember,
  addGoal, removeGoal, setNotes,
} from "../src/faction.js";

describe("createFaction", () => {
  test("creates faction with defaults", () => {
    const f = createFaction("billhooks", "Billhooks", "A vicious gang");
    expect(f.tier).toBe(1);
    expect(f.hold).toBe("weak");
    expect(f.heat).toBe(0);
    expect(f.territory).toEqual([]);
  });

  test("accepts options", () => {
    const f = createFaction("lampblacks", "Lampblacks", "Rival gang", { tier: 2, hold: "strong", heat: 5, territory: ["docks"], members: ["clem"] });
    expect(f.tier).toBe(2);
    expect(f.heat).toBe(5);
  });
});

describe("addHeat", () => {
  test("adds positive and negative heat", () => {
    const f = createFaction("f", "F", "");
    addHeat(f, 3);
    expect(f.heat).toBe(3);
    addHeat(f, -5);
    expect(f.heat).toBe(-2);
  });

  test("handles undefined heat field", () => {
    const f = { id: "f", name: "F", description: "" };
    addHeat(f, 2);
    expect(f.heat).toBe(2);
  });
});

describe("setTier", () => {
  test("clamps 1-6", () => {
    const f = createFaction("f", "F", "");
    setTier(f, 8);
    expect(f.tier).toBe(6);
    setTier(f, 0);
    expect(f.tier).toBe(1);
  });
});

describe("setHold", () => {
  test("validates hold value", () => {
    const f = createFaction("f", "F", "");
    setHold(f, "strong");
    expect(f.hold).toBe("strong");
    expect(() => setHold(f, "medium")).toThrow();
  });
});

describe("territory management", () => {
  test("addTerritory / removeTerritory / hasTerritory", () => {
    const f = createFaction("f", "F", "");
    addTerritory(f, "docks");
    expect(hasTerritory(f, "docks")).toBe(true);
    addTerritory(f, "docks");
    expect(f.territory).toHaveLength(1);
    removeTerritory(f, "docks");
    expect(hasTerritory(f, "docks")).toBe(false);
  });
});

describe("member management", () => {
  test("addMember / removeMember / hasMember", () => {
    const f = createFaction("f", "F", "");
    addMember(f, "clem");
    expect(hasMember(f, "clem")).toBe(true);
    addMember(f, "clem");
    expect(f.members).toHaveLength(1);
    removeMember(f, "clem");
    expect(hasMember(f, "clem")).toBe(false);
  });
});

describe("goals / notes", () => {
  test("addGoal / removeGoal", () => {
    const f = createFaction("f", "F", "");
    addGoal(f, "Expand");
    expect(f.goals).toEqual(["Expand"]);
    removeGoal(f, "Expand");
    expect(f.goals).toEqual([]);
  });

  test("setNotes", () => {
    const f = createFaction("f", "F", "");
    setNotes(f, "Important faction");
    expect(f.notes).toBe("Important faction");
  });
});
