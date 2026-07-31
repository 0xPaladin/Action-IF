import { describe, test, expect } from "bun:test";
import { createNPC, createNPCDialogueScene } from "../src/npc.js";
import { createScene, createOption } from "../src/scene.js";

describe("createNPC", () => {
  test("creates NPC with normalized fields", () => {
    const npc = createNPC({
      id: "valeria",
      name: "Commander Valeria",
      faction: "guardians",
      location: "ops_center",
      description: "A stern warden.",
    });

    expect(npc.id).toBe("valeria");
    expect(npc.name).toBe("Commander Valeria");
    expect(npc.faction).toBe("guardians");
    expect(npc.location).toBe("ops_center");
    expect(npc.description).toBe("A stern warden.");
    expect(npc.actions).toEqual([]);
    expect(npc.dialogue).toEqual([]);
    expect(npc.onEnter).toBeNull();
    expect(npc.onExit).toBeNull();
  });

  test("normalizes NPC actions with triggerScene (not triggerDialogue)", () => {
    const npc = createNPC({
      id: "valeria",
      name: "Valeria",
      location: "ops_center",
      description: "desc",
      actions: [
        {
          id: "offer_mission",
          label: "Request Briefing",
          description: "Ask for details.",
          once: true,
          triggerScene: "npc:valeria:introduction",
          setFlag: "briefing_received",
          provideKeys: ["gate_key"],
          condition: { flag: "ready" },
          hooks: { type: "log", text: "Briefing given." },
        },
      ],
    });

    const a = npc.actions[0];
    expect(a.id).toBe("offer_mission");
    expect(a.label).toBe("Request Briefing");
    expect(a.description).toBe("Ask for details.");
    expect(a.once).toBe(true);
    expect(a.used).toBe(false);
    expect(a.triggerScene).toBe("npc:valeria:introduction");
    expect(a.setFlag).toBe("briefing_received");
    expect(a.provideKeys).toEqual(["gate_key"]);
    expect(a.condition).toEqual({ flag: "ready" });
    expect(a.hooks).toEqual({ type: "log", text: "Briefing given." });
    expect(a.triggerDialogue).toBeUndefined();
  });

  test("defaults optional action fields", () => {
    const npc = createNPC({
      id: "bob",
      name: "Bob",
      location: "room",
      description: "desc",
      actions: [{ id: "a1", label: "Do thing" }],
    });

    const a = npc.actions[0];
    expect(a.description).toBe("");
    expect(a.once).toBe(false);
    expect(a.used).toBe(false);
    expect(a.triggerScene).toBeNull();
    expect(a.setFlag).toBeNull();
    expect(a.provideKeys).toEqual([]);
    expect(a.condition).toBeNull();
    expect(a.hooks).toBeNull();
  });
});

describe("createNPCDialogueScene", () => {
  const allDialogues = [
    { id: "introduction" },
    { id: "detail_a" },
    { id: "detail_b" },
  ];

  test("creates a dialogue scene with npc: prefix id", () => {
    const scene = createNPCDialogueScene("valeria", {
      id: "introduction",
      fiction: "Hello there.",
      tags: ["social"],
      options: [{ text: "Hi" }],
    }, allDialogues);

    expect(scene.id).toBe("npc:valeria:introduction");
    expect(scene.type).toBe("dialogue");
    expect(scene.fiction).toBe("Hello there.");
    expect(scene.tags).toEqual(["social"]);
    expect(scene.resolved).toBe(false);
    expect(scene.options).toHaveLength(1);
  });

  test("passes through heat, onEnter, onExit", () => {
    const onEnter = { type: "log", text: "entered" };
    const onExit = { type: "setFlag", flag: "done" };
    const scene = createNPCDialogueScene("valeria", {
      id: "intro",
      fiction: "Hi",
      tags: [],
      heat: true,
      onEnter,
      onExit,
      options: [],
    }, allDialogues);

    expect(scene.heat).toBe(true);
    expect(scene.onEnter).toEqual(onEnter);
    expect(scene.onExit).toEqual(onExit);
  });

  test("passes through tickFactionClockOnResolve", () => {
    const scene = createNPCDialogueScene("valeria", {
      id: "intro",
      fiction: "Hi",
      tags: [],
      tickFactionClockOnResolve: { id: "clock1", amount: 2 },
      options: [],
    }, allDialogues);

    expect(scene.tickFactionClockOnResolve).toEqual({ id: "clock1", amount: 2 });
  });

  test("passes through scene-level triggerScene", () => {
    const scene = createNPCDialogueScene("valeria", {
      id: "intro",
      fiction: "Hi",
      tags: [],
      triggerScene: "npc:valeria:detail_a",
      options: [],
    }, allDialogues);

    expect(scene.triggerScene).toBe("npc:valeria:detail_a");
  });

  test("option triggerScene is prefixed when it matches a sibling dialogue id", () => {
    const scene = createNPCDialogueScene("valeria", {
      id: "introduction",
      fiction: "Hi",
      tags: [],
      options: [
        { text: "More detail", triggerScene: "detail_a" },
        { text: "Other detail", triggerScene: "detail_b" },
      ],
    }, allDialogues);

    expect(scene.options[0].triggerScene).toBe("npc:valeria:detail_a");
    expect(scene.options[1].triggerScene).toBe("npc:valeria:detail_b");
  });

  test("option triggerScene is left as-is when it does not match a sibling dialogue id", () => {
    const scene = createNPCDialogueScene("valeria", {
      id: "introduction",
      fiction: "Hi",
      tags: [],
      options: [
        { text: "Go elsewhere", triggerScene: "some_other_scene" },
      ],
    }, allDialogues);

    expect(scene.options[0].triggerScene).toBe("some_other_scene");
  });

  test("option passes through setFlag, condition, hooks, tickFactionClock", () => {
    const scene = createNPCDialogueScene("valeria", {
      id: "intro",
      fiction: "Hi",
      tags: [],
      options: [
        {
          text: "Bribe",
          setFlag: "bribe_offered",
          triggerScene: "some_other_scene",
          condition: { notFlag: "bribe_attempted" },
          hooks: [{ type: "spendResource", id: "coin", amount: 2 }],
          tickFactionClock: { id: "bluecoat_investigation", amount: 2 },
        },
      ],
    }, allDialogues);

    const opt = scene.options[0];
    expect(opt.text).toBe("Bribe");
    expect(opt.setFlag).toBe("bribe_offered");
    expect(opt.triggerScene).toBe("some_other_scene");
    expect(opt.condition).toEqual({ notFlag: "bribe_attempted" });
    expect(opt.hooks).toEqual([{ type: "spendResource", id: "coin", amount: 2 }]);
    expect(opt.tickFactionClock).toEqual({ id: "bluecoat_investigation", amount: 2 });
  });

  test("null triggerScene stays null", () => {
    const scene = createNPCDialogueScene("valeria", {
      id: "intro",
      fiction: "Hi",
      tags: [],
      options: [{ text: "No transition" }],
    }, allDialogues);

    expect(scene.options[0].triggerScene).toBeNull();
  });
});
