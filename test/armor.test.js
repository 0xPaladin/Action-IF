import { describe, test, expect } from "bun:test";
import { getTotalArmor } from "../src/armor.js";
import { createCharacter } from "../src/character.js";

describe("getTotalArmor", () => {
  test("returns 0 for empty inventory", () => {
    const c = createCharacter("Test");
    expect(getTotalArmor(c)).toBe(0);
  });

  test("sums armor values from inventory items", () => {
    const c = createCharacter("Test");
    c.inventory.push({ id: "vest", name: "Vest", armor: 1 });
    c.inventory.push({ id: "shield", name: "Shield", armor: 2 });
    expect(getTotalArmor(c)).toBe(3);
  });

  test("ignores items without armor field", () => {
    const c = createCharacter("Test");
    c.inventory.push({ id: "sword", name: "Sword" });
    c.inventory.push({ id: "vest", name: "Vest", armor: 1 });
    expect(getTotalArmor(c)).toBe(1);
  });
});
