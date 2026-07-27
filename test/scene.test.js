import { describe, test, expect } from "bun:test";
import { createScene, createOption, addChallengeToScene, addOptionToScene, getVisibleOptions, getVisibleChallenges, getChallenge } from "../src/scene.js";
import { createChallenge } from "../src/challenge.js";

describe("createScene", () => {
  test("creates action scene with challenges array", () => {
    const s = createScene("s1", "action", "Fight!", ["combat"]);
    expect(s.type).toBe("action");
    expect(s.challenges).toEqual([]);
  });

  test("creates dialogue scene with options array", () => {
    const s = createScene("s2", "dialogue", "What do?", ["social"]);
    expect(s.type).toBe("dialogue");
    expect(s.options).toEqual([]);
  });
});

describe("addChallengeToScene / addOptionToScene", () => {
  test("adds challenge to action scene", () => {
    const s = createScene("s1", "action", "desc");
    const c = createChallenge("c1", "desc", 4);
    addChallengeToScene(s, c);
    expect(s.challenges).toHaveLength(1);
  });

  test("throws adding challenge to non-action scene", () => {
    const s = createScene("s1", "dialogue", "desc");
    expect(() => addChallengeToScene(s, createChallenge("c1", "desc", 4))).toThrow();
  });

  test("throws adding option to non-dialogue scene", () => {
    const s = createScene("s1", "action", "desc");
    expect(() => addOptionToScene(s, createOption("text"))).toThrow();
  });
});

describe("createOption", () => {
  test("creates option with flags and triggerScene", () => {
    const opt = createOption("Go left", "went_left", "scene2");
    expect(opt.text).toBe("Go left");
    expect(opt.setFlag).toBe("went_left");
    expect(opt.triggerScene).toBe("scene2");
  });
});

describe("getVisibleOptions", () => {
  test("filters by condition", () => {
    const s = createScene("s1", "dialogue", "desc");
    addOptionToScene(s, createOption("A", null, null, null));
    addOptionToScene(s, createOption("B", null, null, { flag: "ok" }));
    const visible = getVisibleOptions(s, { flags: { ok: true } });
    expect(visible).toHaveLength(2);
    const hidden = getVisibleOptions(s, { flags: {} });
    expect(hidden).toHaveLength(1);
  });
});

describe("getVisibleChallenges", () => {
  test("filters challenges by condition", () => {
    const s = createScene("s1", "action", "desc");
    const a = createChallenge("a", "desc", 4);
    const b = createChallenge("b", "desc", 4, [], null, null, { flag: "ok" });
    addChallengeToScene(s, a);
    addChallengeToScene(s, b);
    expect(getVisibleChallenges(s, { flags: {} })).toHaveLength(1);
    expect(getVisibleChallenges(s, { flags: { ok: true } })).toHaveLength(2);
  });
});

describe("getChallenge", () => {
  test("finds challenge by id", () => {
    const s = createScene("s1", "action", "desc");
    addChallengeToScene(s, createChallenge("c1", "desc", 4));
    expect(getChallenge(s, "c1")).not.toBeNull();
    expect(getChallenge(s, "nope")).toBeNull();
  });
});
