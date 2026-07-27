import { describe, test, expect } from "bun:test";
import { createCharacter, assignActionDots, addItem, removeItem, hasItem, findItem, addStunt, harmPenalty, conditionPenalty, setLoadLevel, healHarm, tickHealing, restCharacter, addXp, spendXp, getXp, getAvailableItems, ACTION_ACTIONS } from "../src/character.js";
import { createItem } from "../src/item.js";

describe("createCharacter", () => {
  test("returns character with default fields", () => {
    const c = createCharacter("Luna");
    expect(c.name).toBe("Luna");
    for (const a of ACTION_ACTIONS) {
      expect(c.actions[a]).toBe(0);
    }
    expect(c.guard).toBe(3);
    expect(c.body).toBe(6);
    expect(c.conditions).toEqual([]);
    expect(c.aspects).toEqual([]);
    expect(c.items).toEqual([]);
  });
});

describe("assignActionDots", () => {
  test("sets 12 action values summing to 7, max 2 per action", () => {
    const c = createCharacter("Luna");
    assignActionDots(c, [2, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0]);
    expect(c.actions.Muscle).toBe(2);
    expect(c.actions.Sway).toBe(0);
  });

  test("throws if not 12 values", () => {
    const c = createCharacter("Luna");
    expect(() => assignActionDots(c, [1, 2, 3])).toThrow();
  });

  test("throws if total not 7", () => {
    const c = createCharacter("Luna");
    expect(() => assignActionDots(c, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toThrow();
  });

  test("throws if any value > 2", () => {
    const c = createCharacter("Luna");
    expect(() => assignActionDots(c, [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0])).toThrow();
  });
});

describe("inventory", () => {
  test("addItem and removeItem", () => {
    const c = createCharacter("Luna");
    const item = createItem("sword", "Sword", "", 2);
    addItem(c, item);
    expect(c.inventory).toHaveLength(1);
    expect(c.load).toBe(2);
    removeItem(c, "sword");
    expect(c.inventory).toHaveLength(0);
    expect(c.load).toBe(0);
  });

  test("hasItem and findItem", () => {
    const c = createCharacter("Luna");
    addItem(c, createItem("key", "Key", ""));
    expect(hasItem(c, "key")).toBe(true);
    expect(hasItem(c, "nope")).toBe(false);
    expect(findItem(c, "key")).not.toBeNull();
    expect(findItem(c, "nope")).toBeNull();
  });
});

describe("harmPenalty", () => {
  test("body >= 5 = 0, body 3-4 = 1, body 1-2 = 2, body <= 0 = -1", () => {
    const c = createCharacter("Luna");
    expect(harmPenalty(c)).toBe(0);
    c.body = 4;
    expect(harmPenalty(c)).toBe(1);
    c.body = 2;
    expect(harmPenalty(c)).toBe(2);
    c.body = 0;
    expect(harmPenalty(c)).toBe(-1);
  });
});

describe("conditionPenalty", () => {
  test("registered condition triggers -1d when its tags match scene tags", () => {
    const c = createCharacter("Luna");
    c.conditions = ["exposed", "cornered"];
    expect(conditionPenalty(c, ["combat"])).toBe(0);
    expect(conditionPenalty(c, ["surveillance"])).toBe(1);
    expect(conditionPenalty(c, ["surveillance", "chase"])).toBe(2);
  });

  test("returns 0 with no conditions or no tags", () => {
    expect(conditionPenalty(createCharacter("Luna"), ["combat"])).toBe(0);
    expect(conditionPenalty(createCharacter("Luna"), [])).toBe(0);
  });
});

describe("setLoadLevel", () => {
  test("sets maxLoad and drops excess", () => {
    const c = createCharacter("Luna");
    addItem(c, createItem("a", "A", "", 3));
    addItem(c, createItem("b", "B", "", 2));
    const r = setLoadLevel(c, "light");
    expect(c.maxLoad).toBe(3);
    expect(r.dropped).toHaveLength(1);
  });
});

describe("healHarm", () => {
  test("restores body first, then guard", () => {
    const c = createCharacter("Luna");
    c.body = 4;
    c.guard = 0;
    healHarm(c);
    expect(c.body).toBe(5);
    expect(c.guard).toBe(0);

    c.body = 6;
    healHarm(c);
    expect(c.body).toBe(6);
    expect(c.guard).toBe(1);
  });

  test("caps at max values", () => {
    const c = createCharacter("Luna");
    healHarm(c);
    expect(c.body).toBe(6);
    expect(c.guard).toBe(3);
  });
});

describe("tickHealing", () => {
  test("after 4 ticks heals one and resets clock", () => {
    const c = createCharacter("Luna");
    c.body = 5;
    for (let i = 0; i < 4; i++) tickHealing(c);
    expect(c.body).toBe(6);
    expect(c.guard).toBe(3);
  });

  test("healing clears when body and guard are full", () => {
    const c = createCharacter("Luna");
    c.body = 5;
    for (let i = 0; i < 8; i++) tickHealing(c);
    expect(c.body).toBe(6);
    expect(c.guard).toBe(3);
    expect(c.healing).toBeNull();
  });
});

describe("restCharacter", () => {
  test("clears all conditions and recalculates load", () => {
    const c = createCharacter("Luna");
    c.conditions = ["exposed", "cornered"];
    c.inventory.push({ id: "sword", name: "Sword", load: 1 });
    c.load = 3;
    restCharacter(c);
    expect(c.conditions).toEqual([]);
    expect(c.load).toBe(1);
  });
});

describe("xp", () => {
  test("addXp and spendXp", () => {
    const c = createCharacter("Luna");
    addXp(c, 10);
    expect(getXp(c)).toBe(10);
    spendXp(c, 6);
    expect(getXp(c)).toBe(4);
    expect(() => spendXp(c, 10)).toThrow();
  });
});

describe("addStunt", () => {
  test("adds stunt to character", () => {
    const c = createCharacter("Luna");
    addStunt(c, { id: "s1", bonusDice: 1 });
    expect(c.stunts).toHaveLength(1);
    expect(c.stunts[0].id).toBe("s1");
  });
});

describe("getAvailableItems", () => {
  const general = { id: "sword", name: "Sword", individual: false, specialized: false };
  const specialized = { id: "plasma_sword", name: "Plasma Sword", individual: false, specialized: true };
  const individual = { id: "relic", name: "Relic", individual: true, specialized: false };

  test("general items are available to all characters", () => {
    const char = createCharacter("Luna");
    const result = getAvailableItems(char, [general]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sword");
  });

  test("specialized items require char.items to include the id", () => {
    const char = createCharacter("Luna");
    expect(getAvailableItems(char, [specialized])).toHaveLength(0);
    char.items = ["plasma_sword"];
    const result = getAvailableItems(char, [specialized]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("plasma_sword");
  });

  test("individual items are never available", () => {
    const char = createCharacter("Luna");
    expect(getAvailableItems(char, [individual])).toHaveLength(0);
    char.items = ["relic"];
    expect(getAvailableItems(char, [individual])).toHaveLength(0);
  });

  test("mixed pool filtered correctly", () => {
    const char = createCharacter("Luna");
    char.items = ["plasma_sword"];
    const result = getAvailableItems(char, [general, specialized, individual]);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["sword", "plasma_sword"]);
  });
});
