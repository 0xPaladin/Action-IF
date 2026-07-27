import { describe, test, expect } from "bun:test";
import { parseInput } from "../src/parser.js";

describe("parseInput", () => {
  test("empty/null input returns null", () => {
    expect(parseInput("")).toBeNull();
    expect(parseInput("   ")).toBeNull();
  });

  test("pure number → select", () => {
    expect(parseInput("3")).toEqual({ type: "select", index: 2 });
    expect(parseInput("0")).toEqual({ type: "select", index: -1 });
  });

  test("'option N' → select", () => {
    expect(parseInput("option 2")).toEqual({ type: "select", index: 1 });
    expect(parseInput("opt 3")).toEqual({ type: "select", index: 2 });
    expect(parseInput("choice 1")).toEqual({ type: "select", index: 0 });
  });

  test("solo direction words fall through to action", () => {
    expect(parseInput("n")).toEqual({ type: "action", text: "n" });
    expect(parseInput("south")).toEqual({ type: "action", text: "south" });
    expect(parseInput("ne")).toEqual({ type: "action", text: "ne" });
    expect(parseInput("u")).toEqual({ type: "action", text: "u" });
    expect(parseInput("in")).toEqual({ type: "action", text: "in" });
  });

  test("'go <dir>' falls through to action", () => {
    expect(parseInput("go north")).toEqual({ type: "action", text: "go north" });
    expect(parseInput("walk east")).toEqual({ type: "action", text: "walk east" });
    expect(parseInput("move west")).toEqual({ type: "action", text: "move west" });
  });

  test("go with named target falls through to action", () => {
    expect(parseInput("go door")).toEqual({ type: "action", text: "go door" });
  });

  test("'fortune N' → fortune", () => {
    expect(parseInput("fortune 3")).toEqual({ type: "fortune", pool: 3 });
    expect(parseInput("fortune")).toEqual({ type: "fortune", pool: 0 });
  });

  test("verb phrases → action", () => {
    expect(parseInput("search")).toEqual({ type: "action", text: "search" });
    expect(parseInput("use key")).toEqual({ type: "action", text: "key" });
    expect(parseInput("pull lever")).toEqual({ type: "action", text: "lever" });
    expect(parseInput("sway")).toEqual({ type: "action", text: "sway" });
    expect(parseInput("muscle the door open")).toEqual({ type: "action", text: "muscle the door open" });
  });
});
