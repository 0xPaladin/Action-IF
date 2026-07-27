import { describe, test, expect } from "bun:test";
import { createItem } from "../src/item.js";

describe("createItem", () => {
  test("returns item with all fields", () => {
    const item = createItem("lockpicks", "Lockpicks", "Quality tools", 1, ["stealth", "tinker"], {
      bonusDice: 1,
    });
    expect(item.id).toBe("lockpicks");
    expect(item.load).toBe(1);
    expect(item.tags).toEqual(["stealth", "tinker"]);
    expect(item.bonusDice).toBe(1);
  });

  test("defaults load to 0", () => {
    expect(createItem("i", "n", "d").load).toBe(0);
  });

  test("can set bonusTicks", () => {
    const item = createItem("w", "Weapon", "", 1, ["combat"], { bonusTicks: 1 });
    expect(item.bonusTicks).toBe(1);
  });

  test("can set action", () => {
    const item = createItem("w", "Weapon", "", 1, ["combat"], { action: "Muscle", bonusDice: 1 });
    expect(item.action).toBe("Muscle");
  });

  test("action defaults to null", () => {
    expect(createItem("i", "n", "d").action).toBeNull();
  });

  test("specialized defaults to false", () => {
    expect(createItem("i", "n", "d").specialized).toBe(false);
  });

  test("can set specialized to true", () => {
    const item = createItem("sword", "Sword", "", 1, ["combat"], { specialized: true, bonusDice: 1 });
    expect(item.specialized).toBe(true);
  });

  test("individual defaults to false", () => {
    expect(createItem("i", "n", "d").individual).toBe(false);
  });

  test("can set individual to true", () => {
    const item = createItem("relic", "Relic", "", 0, ["ancient"], { individual: true });
    expect(item.individual).toBe(true);
  });
});
