import { h, render } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import htm from "htm";
const html = htm.bind(h);

import { getAvailableItems } from "/src/character.js";

// Web UI for Action-IF: Preact + htm terminal-style interface.

// ---- Helpers ----

// Deep merge game definition fragments: arrays concatenate, objects merge.
export function mergeDefinitions(...defs) {
  const result = {};
  for (const def of defs) {
    if (!def) continue;
    for (const [key, value] of Object.entries(def)) {
      if (Array.isArray(value)) {
        result[key] = [...(Array.isArray(result[key]) ? result[key] : []), ...value];
      } else if (value && typeof value === "object") {
        result[key] = { ...(result[key] || {}), ...value };
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// Load a game from a folder: fetch all JSON files, merge, load custom hooks.
export async function loadGameDefinition(gameId) {
  const filesRes = await fetch(`/api/games/${gameId}/files`);
  const { files } = await filesRes.json();
  const defs = await Promise.all(
    files.map((f) => fetch(`/games/${gameId}/${f}`).then((r) => r.json())),
  );
  const def = mergeDefinitions(...defs);

  let customHooks = null;
  try {
    const hookMod = await import(`/games/${gameId}/hooks.js`, {
      with: { type: "javascript" },
    });
    customHooks = hookMod.default || hookMod;
  } catch (e) {
    // No hooks.js file — that's fine
  }

  return { def, customHooks };
}

// Truncate text with ellipsis for log labels.
function abbreviate(text, max = 50) {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max) + "…";
}

// Build a human-friendly one-liner from an engine result.
export function formatTypeLabel(result) {
  switch (result.type) {
    case "transition":
      return `${result.fromName} → ${result.toName}`;
    case "scene_start":
      return `★ ${abbreviate(result.sceneFiction, 60)}`;
    case "scene_end":
      return abbreviate(formatSceneActionLabel(result), 80);
    case "action_done":
      return result.actionLabel || "Done.";
    case "assist_result":
      return result.text || "Assisted!";
    case "protect_result":
      return result.text || "Protected!";
    case "setup_result":
      return result.text || "Set up!";
    case "roll_result": {
      const label = abbreviate(formatSceneActionLabel(result), 80);
      const pool = result.roll.pool;
      const results = (result.roll.results || []).join(", ");
      const level = result.roll.outcome.level;
      const effect = result.result?.effect;
      const reduced = result.result?.reduced;
      const effectLabel = effect ? ` [${effect} effect]` : "";
      const reducedLabel = reduced ? " (reduced effect)" : "";
      if (level === "partial") {
        if (reduced) {
          return `${label} [${pool}d] ${results} → Minor success${effectLabel}${reducedLabel}`;
        }
        const cons = result.result?.consequence;
        if (cons) {
          const risk = getRiskLabelFromResult(cons);
          let line = `${label} [${pool}d] ${results} → Minor success${effectLabel}: ${cons.description} (${risk})`;
          const trigger = cons.templateResult?.trigger;
          if (trigger) {
            const dangerMsg = formatDangerTrigger(trigger);
            if (dangerMsg) line += `\n${dangerMsg}`;
          }
          return line;
        }
        return `${label} [${pool}d] ${results} → Minor success${effectLabel}`;
      }
      if (level === "failure") {
        const cons = result.result?.consequence;
        if (cons) {
          const risk = getRiskLabelFromResult(cons);
          let line = `${label} [${pool}d] ${results} → Failure${effectLabel}: ${cons.description} (${risk})`;
          const trigger = cons.templateResult?.trigger;
          if (trigger) {
            const dangerMsg = formatDangerTrigger(trigger);
            if (dangerMsg) line += `\n${dangerMsg}`;
          }
          return line;
        }
        return `${label} [${pool}d] ${results} → Failure${effectLabel}`;
      }
      return `${label} [${pool}d] ${results} → ${result.roll.outcome.label}${effectLabel}`;
    }
    case "challenge_done":
      return `✓ ${abbreviate(formatSceneActionLabel(result), 80)}`;
    case "fortune_result":
      return `Fortune: ${result.outcome.label} [${(result.results || []).join(", ")}]`;
    case "help":
    case "loadlevel":
      return result.text || "";
    case "item_toggled":
      return result.equipped ? `Equipped item.` : `Dropped item.`;
    case "downtime_result":
    case "gm_result":
      return result.text || "";
    case "levelup":
      return result.text || "";
    case "save":
      return `Saving "${result.name || "autosave"}"...`;
    case "load":
      return `Loading "${result.name || "autosave"}"...`;
    default:
      return "";
  }
}

// Compose a scene/challenge/action label for scene-based results.
function formatSceneActionLabel(result) {
  const scene = abbreviate(
    result.sceneId ? result.sceneId.replace(/_/g, " ") : "",
    30,
  );
  const challenge = result.challengeDesc || "";
  const action = result.actionName || "";
  let label = scene;
  if (challenge) label += ` → ${abbreviate(challenge, 30)}`;
  if (action) label += ` : ${action}`;
  return label;
}

// Find a challenge's full index within its scene by challenge id.
function getChallengeFullIdx(state, challengeId) {
  let scene = state.scenes.find((s) => s.id === state.activeScene);
  if (!scene) {
    for (const plotline of state.plotlines || []) {
      scene = (plotline.scenes || []).find((s) => s.id === state.activeScene);
      if (scene) break;
    }
  }
  if (!scene) return -1;
  return scene.challenges.findIndex((c) => c.id === challengeId);
}

// Render a context object to plain text for non-interactive logs.
export function contextToText(ctx) {
  if (!ctx) return "";
  if (ctx.type === "location") {
    let t = `\n${ctx.name}\n${ctx.description}`;
    if (ctx.links?.length) {
      t += "\n\nYou can go:";
      ctx.links.forEach((l) => {
        t += `\n  ${l.index + 1}. ${l.label}${l.locked ? " [locked]" : ""}`;
      });
    }
    if (ctx.actions?.length) {
      t += "\n\nActions:";
      ctx.actions.forEach((a) => {
        t += `\n  ${ctx.links.length + a.index + 1}. ${a.label}`;
      });
    }
    if (ctx.npcs?.length) {
      t += "\n\nTalk to:";
      ctx.npcs.forEach((npc) => {
        t += `\n  ${ctx.links.length + ctx.actions.length + npc.index + 1}. ${npc.name}`;
      });
    }
    return t;
  }
  if (ctx.type === "scene") {
    let t = `\n${ctx.fiction}`;
    if (ctx.sceneType === "action" && ctx.challenges) {
      ctx.challenges.forEach((c) => {
        t += `\n\n[${c.clock.current}/${c.clock.max}] ${c.description}`;
        c.actions.forEach((a) => {
          t += `\n   ${a.actionName}`;
        });
      });
    }
    if (ctx.sceneType === "dialogue" && ctx.options) {
      ctx.options.forEach((o) => {
        t += `\n\n${o.index + 1}. ${o.text}${o.available ? "" : " [unavailable]"}`;
      });
    }
    return t;
  }
  return "";
}

// Format a timestamp for display in the save list.
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}

// Deep clone game state for persistence.
export function serializeState(state) {
  return JSON.parse(JSON.stringify(state));
}

// Overlay saved mutable data onto a freshly created game state.
export function restoreState(fresh, saved) {
  fresh.currentLocation = saved.currentLocation;
  fresh.activeScene = saved.activeScene;
  fresh.flags = saved.flags || {};
  fresh.momentum = saved.momentum ?? 2;
  fresh.gameLog = saved.gameLog || [];
  fresh.activeMissionId = saved.activeMissionId || null;
  fresh.journeyScenes = saved.journeyScenes || null;
  fresh.journeyTarget = saved.journeyTarget || null;
  fresh.journeyIndex = saved.journeyIndex || 0;
  fresh.encounters = saved.encounters || [];
  fresh.nextActionBonusDice = saved.nextActionBonusDice || 0;
  fresh.assistBonusDice = saved.assistBonusDice || 0;
  fresh.protectTargetIndex = saved.protectTargetIndex ?? null;
  fresh.nextActionChoice = saved.nextActionChoice || null;
  fresh.gameStunts = saved.gameStunts || [];

  if (fresh.crew && saved.crew) {
    Object.assign(fresh.crew, saved.crew);
  }

  (saved.characters || []).forEach((sc, i) => {
    const fc = fresh.characters[i];
    if (!fc) return;
    fc.guard = sc.guard ?? 3;
    fc.maxGuard = sc.maxGuard ?? 3;
    fc.body = sc.body ?? 6;
    fc.conditions = sc.conditions ?? [];
    fc.healing = sc.healing ?? null;
    fc.load = sc.load ?? 0;
    fc.maxLoad = sc.maxLoad ?? 0;
    fc.xp = sc.xp ?? 0;
    fc.downtimeRemaining = sc.downtimeRemaining ?? 0;
    fc.inventory = sc.inventory ?? [];
    fc.items = sc.items ?? [];
    fc.stunts = sc.stunts ?? [];
    fc.stuntChoices = sc.stuntChoices ?? [];
    fc.projects = sc.projects ?? [];
    fc.aspects = sc.aspects ?? fc.aspects ?? [];
    fc.actionMods = sc.actionMods ?? null;
  });

  if (saved.npcs && fresh.npcs) {
    fresh.npcs = saved.npcs;
    fresh.npcsByLocation = saved.npcsByLocation || {};
  }

  if (fresh.crew && saved.crew) {
    fresh.crew.claims = saved.crew.claims || [];
  }

  (saved.claims || []).forEach((sc, i) => {
    const fc = fresh.claims[i];
    if (!fc) return;
    fc.taken = sc.taken ?? false;
  });

  // Restore plotline scene/challenge resolution state
  (saved.plotlines || []).forEach((sp, pi) => {
    const fp = fresh.plotlines[pi];
    if (!fp) return;
    (sp.scenes || []).forEach((ss, si) => {
      const fs = fp.scenes[si];
      if (!fs) return;
      fs.resolved = ss.resolved ?? false;
      (ss.challenges || []).forEach((sc, ci) => {
        const fc = fs.challenges?.[ci];
        if (!fc) return;
        fc.resolved = sc.resolved ?? false;
        fc.clock.current = sc.clock?.current ?? fc.clock.current;
        fc.reducedEffect = sc.reducedEffect ?? 0;
      });
    });
  });

  // Restore NPC dialogue scene resolution state
  (saved.scenes || []).forEach((ss, i) => {
    const fs = fresh.scenes[i];
    if (!fs) return;
    fs.resolved = ss.resolved ?? false;
  });

  (saved.factionClocks || []).forEach((sf, i) => {
    const ff = fresh.factionClocks[i];
    if (!ff) return;
    ff.clock.current = sf.clock?.current ?? ff.clock.current;
    ff.completed = sf.completed ?? false;
  });

  (saved.factions || []).forEach((sf, i) => {
    const ff = fresh.factions[i];
    if (!ff) return;
    ff.status = sf.status ?? 0;
  });

  return fresh;
}

// ---- Components ----

// Try to load a per-game custom GUI module. Returns the module or null.
async function tryLoadGui(gameId) {
  try {
    const mod = await import(`/games/${gameId}/gui.js`);
    return mod;
  } catch (e) {
    return null;
  }
}

// Build the API object passed to a custom gui.js module.
function buildGuiApi({
  gameId,
  gameList,
  def,
  customHooks,
  state,
  engine,
  parser,
  hookMod,
  switchGame,
  root,
}) {
  return {
    gameId,
    gameList,
    definition: def,
    customHooks,
    state,
    engine,
    parser,
    hookMod,
    root,
    helpers: {
      mergeDefinitions,
      serializeState,
      restoreState,
      loadGameDefinition,
    },
    saveLoad: {
      save: async (name, st) => {
        const ser = serializeState(st);
        ser._defSrc = gameId;
        const r = await fetch(`/api/save/${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: ser }),
        });
        return r.json();
      },
      load: async (name) => {
        const r = await fetch(`/api/load/${encodeURIComponent(name)}`);
        return r.json();
      },
      list: async () => {
        const r = await fetch("/api/saves");
        return r.json();
      },
      del: async (name) => {
        const r = await fetch(`/api/save/${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        return r.json();
      },
    },
    switchGame,
  };
}

// Root application component: manages state, messaging, and save/load.
function App() {
  const [gameState, setGameState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [sidebarMode, setSidebarMode] = useState(null); // null | 'crew' | 'character' | 'faction'
  const [factionId, setFactionId] = useState(null);
  const [charDropdown, setCharDropdown] = useState(false);
  const charDropdownRef = useRef(null);
  const [factionOpen, setFactionOpen] = useState(false);
  const factionDropdownRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState("games");
  const [saveName, setSaveName] = useState("");
  const [saves, setSaves] = useState([]);
  const [lastSaveName, setLastSaveName] = useState("");
  const [defSrc, setDefSrc] = useState("sample-game");
  const [activeChar, setActiveChar] = useState(0);
  const [loading, setLoading] = useState(true);
  const [introFaded, setIntroFaded] = useState(false);
  const [topCollapsed, setTopCollapsed] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapZoneId, setMapZoneId] = useState(null);
  const mapDropdownRef = useRef(null);
  const [gameList, setGameList] = useState([]);
  const [useCustomGui, setUseCustomGui] = useState(false);

  const engineRef = useRef(null);
  const parserRef = useRef(null);
  const gameRef = useRef(null);
  const charModuleRef = useRef(null);
  const hookModuleRef = useRef(null);
  const guiCleanupRef = useRef(null);
  const guiModRef = useRef(null);
  const customGuiRootRef = useRef(null);
  const gameListRef = useRef([]);
  const defRef = useRef(null);
  const customHooksRef = useRef(null);

  // Shared game-loading logic: loads definition, registers hooks, creates state,
  // and either delegates to a custom gui.js or renders the default terminal UI.
  const bootGame = useCallback(
    async (gameId, opts = {}) => {
      const { isLoad = false, savedState = null, saveName = null } = opts;

      // Clean up any previous custom GUI
      if (guiCleanupRef.current) {
        guiCleanupRef.current();
        guiCleanupRef.current = null;
      }
      guiModRef.current = null;

      const { def, customHooks } = await loadGameDefinition(gameId);

      // Register custom hooks before createGame
      if (customHooks && hookModuleRef.current) {
        for (const [id, fn] of Object.entries(customHooks)) {
          if (typeof fn === "function") {
            hookModuleRef.current.registerHook(id, fn);
          }
        }
      }

      const state = engineRef.current.createGame(def);

      // If loading a saved game, overlay saved state
      if (isLoad && savedState) {
        restoreState(state, savedState);
      }

      gameRef.current = state;
      defRef.current = def;
      customHooksRef.current = customHooks;
      setGameState(state);
      setDefSrc(gameId);
      setActiveChar(0);

      // Try to load a custom gui.js for this game
      const guiMod = await tryLoadGui(gameId);

      if (guiMod) {
        // Store the module for the useEffect to init after the container div exists
        guiModRef.current = guiMod;
        setUseCustomGui(true);
      } else {
        // Render the default terminal UI
        setUseCustomGui(false);
        if (!isLoad) {
          setMessages([
            {
              type: "system",
              text: "Welcome to Action-IF — Charge SRD Interactive Fiction",
              intro: true,
            },
            {
              type: "system",
              text: 'Type a command or click an option. Try "help" for basics.',
              intro: true,
            },
            { type: "context", context: engineRef.current.getContext(state) },
          ]);
        } else {
          setMessages([
            { type: "system", text: `Loaded: ${opts.saveName || "autosave"}` },
            { type: "divider" },
            { type: "context", context: engineRef.current.getContext(state) },
          ]);
        }
      }
    },
    [],
  );

  // Initialize custom GUI after the container div is in the DOM
  useEffect(() => {
    if (useCustomGui && guiModRef.current && customGuiRootRef.current) {
      const api = buildGuiApi({
        gameId: defSrc,
        gameList: gameListRef.current,
        def: defRef.current,
        customHooks: customHooksRef.current,
        state: gameRef.current,
        engine: engineRef.current,
        parser: parserRef.current,
        hookMod: hookModuleRef.current,
        switchGame: (newGameId) => bootGame(newGameId, { isLoad: false }),
        root: customGuiRootRef.current,
      });
      const cleanup = guiModRef.current.init?.(api) ?? guiModRef.current.default?.(api) ?? (() => {});
      guiCleanupRef.current = cleanup;
    }
    return () => {
      if (guiCleanupRef.current) {
        guiCleanupRef.current();
        guiCleanupRef.current = null;
      }
    };
  }, [useCustomGui, defSrc]);

  useEffect(() => {
    let timer;
    async function init() {
      try {
        const [engine, parser, charMod, hookMod] = await Promise.all([
          import("/src/engine.js"),
          import("/src/parser.js"),
          import("/src/character.js"),
          import("/src/hook.js"),
        ]);
        engineRef.current = engine;
        parserRef.current = parser;
        charModuleRef.current = charMod;
        hookModuleRef.current = hookMod;

        // Fetch available games
        try {
          const gamesRes = await fetch("/api/games");
          const { games } = await gamesRes.json();
          setGameList(games);
          gameListRef.current = games;
        } catch (e) {
          setGameList([]);
          gameListRef.current = [];
        }

        // Load the default game
        await bootGame("sample-game");
        timer = setTimeout(() => setIntroFaded(true), 30000);
      } catch (e) {
        setMessages([
          { type: "system", text: "Failed to load game: " + e.message },
        ]);
      }
      setLoading(false);
    }
    init();
    return () => clearTimeout(timer);
  }, [bootGame]);

  useEffect(() => {
    function handleClick(e) {
      if (
        charDropdownRef.current &&
        !charDropdownRef.current.contains(e.target)
      ) {
        setCharDropdown(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const refreshSaves = useCallback(async () => {
    try {
      const r = await fetch("/api/saves");
      const d = await r.json();
      setSaves(d.saves || []);
    } catch {
      setSaves([]);
    }
  }, []);

  // Reset map zone to current location's parent when location changes
  useEffect(() => {
    if (!gameState) return;
    const location = gameState.locations?.find(
      (l) => l.id === gameState.currentLocation,
    );
    if (location) setMapZoneId(location.parent);
  }, [gameState?.currentLocation]);

  // Close map zone dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        mapDropdownRef.current &&
        !mapDropdownRef.current.contains(e.target)
      ) {
        setMapOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Close faction dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        factionDropdownRef.current &&
        !factionDropdownRef.current.contains(e.target)
      ) {
        setFactionOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Process a parsed engine command, append result + fresh context to the log.
  const processCommand = useCallback(
    (cmd, inputText) => {
      // When a custom GUI is active, the App doesn't process commands.
      if (useCustomGui) return;

      const state = gameRef.current;
      if (!state || !engineRef.current) return;

      const result = engineRef.current.processInput(state, cmd, activeChar);

      // App-level state change: character switch
      if (result.type === "character_switch") {
        const newIdx = cmd.index ?? 0;
        if (newIdx >= 0 && newIdx < (state.characters || []).length) {
          setActiveChar(newIdx);
        }
      }

      const newMsgs = [...messages];

      if (inputText) {
        newMsgs.push({ type: "player", text: inputText });
      }

      if (result.type === "error") {
        newMsgs.push({ type: "result", text: result.message });
      } else {
        const label = formatTypeLabel(result);
        if (label) newMsgs.push({ type: "result", text: label });
      }

      if (result.missionSummary) {
        newMsgs.push({ type: "mission_complete", text: result.missionSummary });
      }

      // App-level handling: save/load via server
      if (result.type === "save") {
        const name = result.name || "autosave";
        const ser = serializeState(state);
        ser._defSrc = defSrc;
        fetch(`/api/save/${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: ser }),
        }).catch((e) => console.error("Save failed:", e));
        setLastSaveName(name);
        refreshSaves();
      }

      if (result.type === "load") {
        const name = result.name || "autosave";
        fetch(`/api/load/${encodeURIComponent(name)}`)
          .then((r) => r.json())
          .then(async (data) => {
            if (!data.state) return;
            const gameId = data.state._defSrc || defSrc;
            await bootGame(gameId, { isLoad: true, savedState: data.state, saveName: name });
            setLastSaveName(name);
          })
          .catch((e) => console.error("Load failed:", e));
      }

      if (result.type === "saves") {
        fetch("/api/saves")
          .then((r) => r.json())
          .then((data) => {
            const saveList = data.saves || [];
            const text = saveList.length
              ? `Saved games:\n${saveList.map((s) => `  ${s.id}`).join("\n")}`
              : "No saved games found.";
            setMessages((prev) => {
              const filtered = prev.filter((m) => m.type !== "context");
              filtered.push({ type: "result", text });
              filtered.push({
                type: "context",
                context: engineRef.current.getContext(gameRef.current),
              });
              return filtered;
            });
          });
      }

      const ctx = engineRef.current.getContext(state);
      // keep only the latest context so old location/scene buttons disappear
      const filtered = newMsgs.filter((m) => m.type !== "context");
      filtered.push({ type: "context", context: ctx });

      gameRef.current = state;
      setGameState({ ...state });
      setMessages(filtered);
    },
    [messages, activeChar, defSrc, refreshSaves, useCustomGui],
  );

  // Parse raw input and dispatch to processCommand.
  const handleInput = useCallback(
    (text) => {
      if (!text.trim()) return;
      const cmd = parserRef.current.parseInput(text);
      if (!cmd) {
        setMessages((prev) => [
          ...prev,
          { type: "player", text },
          { type: "result", text: "I do not understand." },
        ]);
        return;
      }
      setHistory((prev) => [text, ...prev].slice(0, 50));
      setHistoryIdx(-1);
      processCommand(cmd, text);
    },
    [processCommand],
  );

  // Dispatch a pre-parsed command object (used by UI buttons).
  const handleCmd = useCallback(
    (cmd) => {
      processCommand(cmd, null);
    },
    [processCommand],
  );

  const handleSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name || !gameRef.current) return;
    const state = serializeState(gameRef.current);
    state._defSrc = defSrc;
    try {
      await fetch(`/api/save/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      setLastSaveName(name);
      setSaveName("");
      refreshSaves();
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, [saveName, defSrc, refreshSaves]);

  const handleLoad = useCallback(
    async (name) => {
      try {
        const r = await fetch(`/api/load/${encodeURIComponent(name)}`);
        const data = await r.json();
        if (!data.state) return;

        const gameId = data.state._defSrc || defSrc;
        await bootGame(gameId, { isLoad: true, savedState: data.state, saveName: name });
        setLastSaveName(name);
        setShowModal(false);
      } catch (e) {
        console.error("Load failed:", e);
      }
    },
    [defSrc, bootGame],
  );

  const handleGameSelect = useCallback(
    async (gameId) => {
      try {
        await bootGame(gameId);
        setShowModal(false);
      } catch (e) {
        console.error("Game load failed:", e);
      }
    },
    [bootGame],
  );

  const handleDelete = useCallback(
    async (name) => {
      try {
        await fetch(`/api/save/${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        refreshSaves();
      } catch (e) {
        console.error("Delete failed:", e);
      }
    },
    [refreshSaves],
  );

  const openModal = useCallback(
    (tab) => {
      setModalTab(tab);
      setSaveName("");
      setShowModal(true);
      refreshSaves();
    },
    [refreshSaves],
  );

  if (loading) {
    return html`<div class="app">
      <div class="output"><div class="msg msg-system">Loading...</div></div>
    </div>`;
  }

  // If a custom gui.js has taken over, render a container div for it
  if (useCustomGui) {
    return html`<div ref=${customGuiRootRef} class="custom-gui-root" style="height:100vh;"></div>`;
  }

  const crew = gameState?.crew;
  const activeCharObj = gameState?.characters?.[activeChar];
  const onMission = !!gameState?.activeMissionId;
  const availableItems = getAvailableItems(activeCharObj || { items: [] }, gameState?.items || []);

  function toggleSidebar(mode) {
    if (sidebarMode === mode) {
      setSidebarMode(null);
    } else {
      setSidebarMode(mode);
    }
  }

  function toggleTop() {
    setTopCollapsed((prev) => !prev);
  }

  const mapZone = gameState?.zones?.find((z) => z.id === mapZoneId);
  const childZones =
    gameState?.zones?.filter((z) => z.parent === mapZoneId) || [];
  const childLocations =
    gameState?.locations?.filter((l) => l.parent === mapZoneId) || [];
  const currentLocationId = gameState?.currentLocation;

  return html`
    <div class="app">
       <${Header}
         gameName=${gameState?.gameName || "Action-IF"}
         saveLabel=${lastSaveName || "Unsaved Game"}
         onTitleClick=${() => openModal("games")}
         onGameClick=${() => openModal("save")}
         onHelp=${() => handleCmd({ type: "help" })}
       />
      <div class="top-area">
        <div class="top-content">
          <div class="intro ${introFaded ? "faded" : ""}">
            ${messages
              .filter((m) => m.intro)
              .map(
                (msg, i) => html`
                  <div class="msg msg-system">${msg.text}</div>
                `,
              )}
          </div>
        </div>
        <div class="top-bar ${topCollapsed ? "collapsed" : ""}">
          <div class="map-section">
            <div class="dropdown-group" ref=${mapDropdownRef}>
              <button
                class="btn top-side-btn dropdown-toggle"
                onClick=${(e) => {
                  e.stopPropagation();
                  setMapOpen(!mapOpen);
                }}
              >
                ${mapZone ? `${mapZone.name} (${mapZone.type})` : "Map"}
              </button>
              ${mapOpen
                ? html` <div class="dropdown-menu" style="min-width:180px;">
                    ${(gameState?.zones || []).map(
                      (z) => html`
                        <button
                          class="btn dropdown-item ${z.id === mapZoneId
                            ? "selected"
                            : ""}"
                          key=${z.id}
                          onClick=${(e) => {
                            e.stopPropagation();
                            setMapZoneId(z.id);
                            setMapOpen(false);
                          }}
                        >
                          ${z.name} (${z.type})
                        </button>
                      `,
                    )}
                  </div>`
                : ""}
            </div>
            ${mapZone
              ? html` <div style="margin-top:4px;">
                  ${childZones.length || childLocations.length
                    ? html`
                        ${childZones.map(
                          (z) =>
                            html`<div style="margin-left:8px;">
                              ${z.name} (${z.type})
                            </div>`,
                        )}
                        ${childLocations.map(
                          (l) =>
                            html`<div style="margin-left:8px;">
                              ${l.id === currentLocationId
                                ? "> "
                                : "  "}${l.name}
                            </div>`,
                        )}
                      `
                    : html`<div style="margin-left:8px;">(no children)</div>`}
                </div>`
              : ""}
          </div>
          <div class="side-btns">
            <div class="dropdown-group" ref=${factionDropdownRef}>
              <button
                class="btn top-side-btn dropdown-toggle"
                onClick=${(e) => {
                  e.stopPropagation();
                  setFactionOpen(!factionOpen);
                }}
              >
                ${crew?.name || "Crew"}
              </button>
              ${factionOpen
                ? html` <div class="dropdown-menu" style="min-width:160px;">
                    <button
                      class="btn dropdown-item ${sidebarMode === "crew" &&
                      !factionId
                        ? "selected"
                        : ""}"
                      onClick=${(e) => {
                        e.stopPropagation();
                        setFactionId(null);
                        setSidebarMode("crew");
                        setFactionOpen(false);
                      }}
                    >
                      ${crew?.name || "Crew"}
                    </button>
                    ${(gameState?.factions || []).map(
                      (f) => html`
                        <button
                          class="btn dropdown-item ${factionId === f.id
                            ? "selected"
                            : ""}"
                          key=${f.id}
                          onClick=${(e) => {
                            e.stopPropagation();
                            setFactionId(f.id);
                            setSidebarMode("faction");
                            setFactionOpen(false);
                          }}
                        >
                          ${f.name}
                        </button>
                      `,
                    )}
                  </div>`
                : ""}
            </div>
            <div class="dropdown-group" ref=${charDropdownRef}>
              <button
                class="btn top-side-btn dropdown-toggle"
                onClick=${(e) => {
                  e.stopPropagation();
                  setCharDropdown(!charDropdown);
                }}
              >
                ${activeCharObj?.name || "Character"}
              </button>
              <button
                class="btn top-side-btn dropdown-chevron"
                onClick=${() => toggleSidebar("character")}
                title="Character sheet"
              >
                ▶
              </button>
              ${charDropdown
                ? html`
                    <div class="dropdown-menu" style="right:0;left:auto;">
                      ${(gameState?.characters || []).map(
                        (c, i) => html`
                          <button
                            class="btn dropdown-item ${i === activeChar
                              ? "selected"
                              : ""}"
                            key=${c.name}
                            onClick=${(e) => {
                              e.stopPropagation();
                              setActiveChar(i);
                              setCharDropdown(false);
                            }}
                          >
                            ${c.name}
                          </button>
                        `,
                      )}
                    </div>
                  `
                : ""}
            </div>
          </div>
        </div>
        <button class="top-toggle" onClick=${toggleTop}>
          ${topCollapsed ? "▼" : "▲"}
        </button>
      </div>
      <div class="terminal-wrap">
        <div class="terminal-main">
          <${OutputArea}
            messages=${messages.filter((m) => !m.intro)}
            onCommand=${handleCmd}
            gameState=${gameState}
            engine=${engineRef.current}
          />
          <${CommandInput}
            value=${input}
            onChange=${setInput}
            onSubmit=${handleInput}
            history=${history}
            historyIdx=${historyIdx}
            setHistoryIdx=${setHistoryIdx}
          />
        </div>
        ${sidebarMode && gameState
          ? html`<${SidePanel}
              mode=${sidebarMode}
              state=${gameState}
              activeChar=${activeChar}
              onMission=${onMission}
              availableItems=${availableItems}
              onClose=${() => setSidebarMode(null)}
              onCommand=${handleCmd}
              factionId=${factionId}
            />`
          : ""}
      </div>
      ${showModal
        ? html` <${SaveLoadModal}
            tab=${modalTab}
            onTabChange=${setModalTab}
            saveName=${saveName}
            onSaveNameChange=${setSaveName}
            onSave=${handleSave}
            onLoad=${handleLoad}
            onDelete=${handleDelete}
            saves=${saves}
            games=${gameList}
            currentGameId=${defSrc}
            onGameSelect=${handleGameSelect}
            onClose=${() => setShowModal(false)}
          />`
        : ""}
    </div>
  `;
}

// Scrollable log of system, player, result, and context messages.
function OutputArea({ messages, onCommand, gameState, engine }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return html`
    <div class="output">
      ${messages.map(
        (msg, i) => html`
          <${MessageRow}
            key=${i}
            msg=${msg}
            onCommand=${onCommand}
            gameState=${gameState}
            engine=${engine}
          />
        `,
      )}
      <div ref=${bottomRef} />
    </div>
  `;
}

// Render one message row, delegating context to interactive buttons.
function MessageRow({ msg, onCommand, gameState, engine }) {
  if (msg.intro) return null;
  switch (msg.type) {
    case "system":
      return html`<div class="msg msg-system">${msg.text}</div>`;
    case "player":
      return html`<div class="msg msg-player">
        <span class="prompt">></span>${msg.text}
      </div>`;
    case "result":
      return html`<div class="msg msg-result">${msg.text}</div>`;
    case "mission_complete":
      return html`<div class="msg msg-mission">${msg.text}</div>`;
    case "divider":
      return html`<hr class="divider" />`;
    case "context":
      return html`
        <div class="context-bar"></div>
        <${ContextView}
          ctx=${msg.context}
          onCommand=${onCommand}
          gameState=${gameState}
          engine=${engine}
        />
      `;
    default:
      return null;
  }
}

// Render the interactive view for a location or active scene context.
function ContextView({ ctx, onCommand, gameState, engine }) {
  if (!ctx) return null;

  if (ctx.type === "location") {
    return html`
      <div class="context location">
        <div class="loc-name">${ctx.name}</div>
        <div class="loc-desc">${ctx.description}</div>
        ${ctx.missionName
          ? html`<div class="mission-info">
              <span>Mission: ${ctx.missionName}</span>
              <span class="mission-detail"
                >Momentum: ${ctx.momentum ?? 2}</span
              >
            </div>`
          : ""}
        ${ctx.links?.length
          ? html`
              <div class="section-label">You can go:</div>
              <div class="options">
                ${ctx.links.map(
                  (l) => html`
                    <${OptionButton}
                      label=${l.label}
                      cmd=${{ type: "go_num", index: l.index }}
                      locked=${l.locked}
                      onCommand=${onCommand}
                    />
                  `,
                )}
              </div>
            `
          : ""}
        ${ctx.actions?.length
          ? html`
              <div class="section-label">Actions:</div>
              <div class="options">
                ${ctx.actions.map(
                  (a) => html`
                    <${OptionButton}
                      label=${a.label}
                      cmd=${{ type: "action", text: a.label }}
                      onCommand=${onCommand}
                    />
                  `,
                )}
              </div>
            `
          : ""}
        ${ctx.npcs?.length
          ? html`
              <div class="section-label">Talk to:</div>
              <div class="options">
                ${ctx.npcs.map(
                  (npc) => html`
                    <${OptionButton}
                      label=${npc.name}
                      cmd=${{ type: "talk", index: npc.index }}
                      onCommand=${onCommand}
                    />
                  `,
                )}
              </div>
            `
          : ""}
      </div>
    `;
  }

  if (ctx.type === "scene") {
    return html`
      <div class="context scene">
        ${ctx.missionName
          ? html` <div class="mission-info">
              <span class="mission-name">${ctx.missionName}</span>
              <span class="mission-detail"
                >Momentum: ${ctx.momentum ?? 2}</span
              >
              <span class="mission-detail"
                >Danger:
                ${ctx.dangerClock ? ctx.dangerClock.current : "—"}</span
              >
              <span class="mission-detail"
                >Heat: ${(ctx.heatGenerated || 0) + (ctx.baseHeat || 0)}</span
              >
            </div>`
          : ""}
        <div class="scene-fiction">${ctx.fiction}</div>
        ${ctx.tags?.length
          ? html`<div class="tag-list">
              Tags: ${ctx.tags.map((t, i) => html`${i > 0 ? ", " : ""}${t}`)}
            </div>`
          : ""}
        ${ctx.sceneType === "action" && ctx.challenges?.length
          ? html`
              <div class="section-label">Challenges:</div>
              ${ctx.challenges.map(
                (c) => html`
                  <${ChallengeBlock}
                    challenge=${c}
                    onCommand=${onCommand}
                    gameState=${gameState}
                    sceneId=${ctx.sceneId}
                  />
                `,
              )}
              ${ctx.resolvedChallenges != null
                ? html`
                    <div
                      class="msg msg-system"
                      style="margin-top:4px;font-size:12px;"
                    >
                      ${ctx.resolvedChallenges}/${ctx.totalChallenges} resolved
                    </div>
                  `
                : ""}
            `
          : ""}
        ${ctx.sceneType === "dialogue" && ctx.options?.length
          ? html`
              <div class="section-label">Choose:</div>
              <div class="options">
                ${ctx.options.map(
                  (o) => html`
                    <${OptionButton}
                      label=${o.text}
                      cmd=${{ type: "select", index: o.index }}
                      disabled=${!o.available}
                      keyLabel=${String(o.index + 1)}
                      onCommand=${onCommand}
                    />
                  `,
                )}
              </div>
            `
          : ""}
      </div>
    `;
  }

  return html`<div class="context">...</div>`;
}

// Determine the risk label from a consequence object.
function getRiskLabel(consequence) {
  if (!consequence) return "—";
  if (typeof consequence === "string") return "—";
  const template = consequence.template;
  if (template === "harm") return "Harm";
  if (template === "tickClock") return "Danger";
  if (template === "condition")
    return consequence.params?.condition || "Condition";
  if (template === "loseItem") return "Lose Item";
  return "—";
}

// Determine the risk label + params value from a consequence result object.
function getRiskLabelFromResult(consequenceResult) {
  if (!consequenceResult) return "—";
  const tr = consequenceResult.templateResult;
  if (!tr) return "—";
  const type = tr.type;
  if (type === "harm") return `Harm ${tr.amount || 1}`;
  if (type === "tickClock") return `Danger ${tr.amount || 1}`;
  if (type === "condition") return tr.condition || "Condition";
  if (type === "loseItem") return "Lose Item";
  return "—";
}

// Format the random effect triggered when the danger clock fills.
function formatDangerTrigger(trigger) {
  if (!trigger) return null;
  switch (trigger.effect) {
    case "heat":
      return `Danger clock filled — +${trigger.amount || 1} mission heat!`;
    case "boostClock":
      return `Danger clock filled — +${trigger.amount || 2} ticks on challenge "${trigger.challengeId}"!`;
    case "condition":
      return `Danger clock filled — ${trigger.character || "a character"} gains "doomed"!`;
    default:
      return `Danger clock filled!`;
  }
}

// Single unresolved challenge with clock and selectable action entries.
function ChallengeBlock({ challenge, onCommand, gameState, sceneId }) {
  const challengeIdx = gameState
    ? getChallengeFullIdx(gameState, challenge.id)
    : -1;
  if (challengeIdx < 0)
    return html`<div class="challenge">Unknown challenge</div>`;

  const max = challenge.clock.max;
  const current = challenge.clock.current;

  return html`
    <div class="challenge">
      <div class="challenge-clock-topright">
        ${Array.from({ length: max }).map(
          (_, i) => html`
            <span
              class="clock-box ${i < current ? "filled" : ""}"
              key=${i}
            ></span>
          `,
        )}
      </div>
      <div class="challenge-desc">${challenge.description}</div>
      ${challenge.tags?.length
        ? html`<div class="tag-list" style="margin-bottom:4px;">
            Tags:
            ${challenge.tags.map((t, i) => html`${i > 0 ? ", " : ""}${t}`)}
          </div>`
        : ""}
      <div class="action-entries">
        ${gameState?.characters?.length > 1 && (gameState.momentum ?? 2) >= 1
          ? html`<div class="teamwork-row" style="margin-bottom:4px;">
              <span style="font-size:11px;font-weight:600;">Teamwork:</span>
              ${gameState.characters.map((c, ci) => html`
                <button
                  class="btn"
                  style="font-size:10px;padding:1px 4px;"
                  key=${ci}
                  onClick=${() => onCommand({ type: "assist", characterIndex: ci })}
                >
                  Assist ${c.name} (1mp)
                </button>
              `)}
              <button
                class="btn"
                style="font-size:10px;padding:1px 4px;"
                onClick=${() => onCommand({ type: "setup", action: "Notice" })}
              >
                Set Up (Notice)
              </button>
            </div>`
          : ""}
        ${challenge.actions.map(
          (a, ai) => html`
            <div class="action-row" key=${ai}>
              <button
                class="action-btn"
                onClick=${() =>
                  onCommand({
                    type: "resolve",
                    challengeIndex: challengeIdx,
                    actionIndex: ai,
                  })}
              >
                <span class="action-name">${a.actionName}</span>
                <span class="action-risk">☇ ${getRiskLabel(a.consequences)}</span>
              </button>
              <button
                class="action-btn push-btn"
                disabled=${(gameState?.momentum ?? 2) < 2}
                title=${(gameState?.momentum ?? 2) < 2 ? "Need 2 momentum" : "Push yourself (+1d, costs 2 momentum)"}
                onClick=${() =>
                  onCommand({
                    type: "resolve",
                    challengeIndex: challengeIdx,
                    actionIndex: ai,
                    push: true,
                  })}
              >
                <span class="action-name">Push</span>
                <span class="action-risk">+1d</span>
              </button>
              <button
                class="action-btn push-btn"
                disabled=${(gameState?.momentum ?? 2) < 2}
                title=${(gameState?.momentum ?? 2) < 2 ? "Need 2 momentum" : "Push yourself (+effect, costs 2 momentum)"}
                onClick=${() =>
                  onCommand({
                    type: "resolve",
                    challengeIndex: challengeIdx,
                    actionIndex: ai,
                    push: true,
                    pushForEffect: true,
                  })}
              >
                <span class="action-name">Push</span>
                <span class="action-risk">+eff</span>
              </button>
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

// Reusable button for location links, scene options, and location actions.
function OptionButton({ label, cmd, locked, disabled, onCommand, keyLabel }) {
  const display = keyLabel
    ? html`<span class="btn-num">${keyLabel}</span>`
    : null;
  const cls = locked ? "btn" : "btn";

  return html`
    <button
      class=${cls}
      disabled=${disabled || locked}
      onClick=${() => onCommand(cmd)}
      title=${locked ? "Locked" : label}
    >
      ${display}${locked ? `${label} 🔒` : label}
    </button>
  `;
}

// Terminal-style text input with command history navigation.
function CommandInput({
  value,
  onChange,
  onSubmit,
  history,
  historyIdx,
  setHistoryIdx,
}) {
  const inputRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        const v = value.trim();
        if (v) {
          onSubmit(v);
          onChange("");
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        const newIdx =
          historyIdx < history.length - 1 ? historyIdx + 1 : historyIdx;
        setHistoryIdx(newIdx);
        onChange(history[newIdx]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx <= 0) {
          setHistoryIdx(-1);
          onChange("");
        } else {
          const newIdx = historyIdx - 1;
          setHistoryIdx(newIdx);
          onChange(history[newIdx]);
        }
      }
    },
    [value, onChange, onSubmit, history, historyIdx, setHistoryIdx],
  );

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.target.closest(".modal")) return;
      inputRef.current?.focus();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return html`
    <div class="input-line">
      <span class="input-prompt">></span>
      <input ref=${inputRef} class="input-field" type="text"
        value=${value}
        onInput=${(e) => onChange(e.target.value)}
        onKeyDown=${handleKeyDown}
        placeholder="type a command... or \"help\" for basics"
        autocomplete="off" spellcheck="false"
      />
    </div>
  `;
}

// Top bar: clickable game title left, save button + help right.
function Header({ gameName, saveLabel, onTitleClick, onGameClick, onHelp }) {
  return html`
    <div class="header">
      <button class="header-title-btn" onClick=${onTitleClick}>
        <span class="header-title">${gameName}</span>
      </button>
      <div class="header-right">
        <button class="header-btn" onClick=${onGameClick}>${saveLabel}</button>
        <button class="header-btn" onClick=${onHelp}>?</button>
      </div>
    </div>
  `;
}

// Collapsible panel: mode='crew' shows crew stats, mode='character' shows character stats.
function SidePanel({
  mode,
  state,
  activeChar,
  onMission,
  availableItems,
  onClose,
  onCommand,
  factionId,
}) {
  const [gearDropdown, setGearDropdown] = useState(false);
  const gearDropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (
        gearDropdownRef.current &&
        !gearDropdownRef.current.contains(e.target)
      ) {
        setGearDropdown(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const char = state.characters?.[activeChar];
  const crew = state.crew;
  const faction = factionId
    ? state.factions?.find((f) => f.id === factionId)
    : null;
  const allItems = state.items || [];
  const charItems = char?.inventory || [];
  const charItemIds = new Set(charItems.map((i) => i.id));
  const location = state.locations?.find((l) => l.id === state.currentLocation);
  const mayChangeInventory = location?.mayChangeInventory ?? false;
  const effectiveMaxLoad = onMission ? (char?.maxLoad ?? 5) : 10;
  const individualItems = charItems.filter((i) => i.individual);
  const regularItems = charItems.filter((i) => !i.individual);

  const hasDowntime = char && (char.downtimeRemaining || 0) > 0;
  const canLevelUp = char && (char.xp || 0) >= 8;

  // Check if there's at least one upgradeable action or available stunt
  const hasUpgradeableAction =
    char && Object.values(char.actions || {}).some((v) => v < 4);
  const availableStunts =
    char &&
    (char.stuntChoices || []).length > 0
      ? (char.stuntChoices || []).filter(
          (s) => !char.stunts.some((hs) => hs.id === s.id),
        )
      : (state.gameStunts || []).filter(
          (s) => !char?.stunts.some((hs) => hs.id === s.id),
        );
  const hasAvailableStunt = availableStunts.length > 0;
  const canLevelUpFull = canLevelUp && (hasUpgradeableAction || hasAvailableStunt);

  const projectButtons =
    char &&
    (char.projects || [])
      .filter((p) => !p.completed)
      .map(
        (p) =>
          html`<button
            class="btn"
            style="font-size:11px;padding:2px 6px;"
            key=${p.id}
            onClick=${() =>
              onCommand({ type: "downtime", action: "project", param: p.id })}
          >
            ${p.description} [${p.clock.current}/${p.clock.max}]
          </button>`,
      );

  const crewUpgrades = (crew?.upgrades || []).map((id) => {
    const def = crew?.type?.upgrades?.find((u) => u.id === id);
    return def ? def.name : id;
  });
  const crewClaims = (crew?.claims || []).map((id) => {
    const c = state.claims?.find((cl) => cl.id === id);
    return c ? c.name : id;
  });

  return html`
    <div class="sidebar">
      <button class="sidebar-close" onClick=${onClose}>×</button>

      ${mode === "crew" && crew
        ? html`
            <div class="sidebar-section">
              <h3>Crew</h3>
              <div class="stat-row">
                <span class="stat-label">Name</span>
                <span>${crew.name}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Type</span>
                <span>${crew.description || crew.name}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Coin</span>
                <span>${crew.coin || 0}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Rep</span>
                <span>${crew.reputation || 0}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Hold</span>
                <span>${crew.hold || "—"}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">XP</span>
                <span>${crew.xp || 0}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Momentum</span>
                <span>${state.momentum ?? 2}</span>
              </div>
              ${crew.stunts?.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Stunts</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${crew.stunts.map((s) => s.name).join(", ")}
                    </div>`
                : ""}
              ${crewUpgrades.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Upgrades</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${crewUpgrades.join(", ")}
                    </div>`
                : ""}
              ${crewClaims.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Claims</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${crewClaims.join(", ")}
                    </div>`
                : ""}
            </div>
          `
        : ""}
      ${mode === "character" && char
        ? html`
            <div class="sidebar-section">
              <h3>Character</h3>
              <div class="stat-row">
                <span class="stat-label">Name</span>
                <span>${char.name}</span>
              </div>
              ${(char.aspects || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Aspects</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${char.aspects.map((a) => html`<div>• ${a}</div>`)}
                    </div>`
                : ""}
              ${char.actions
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Actions</span>
                    </div>
                    <div class="action-grid">
                      ${Object.entries(char.actions).map(
                        ([name, rating]) => html`
                          <span class="action-rating" key=${name}
                            >${name} ${rating}</span
                          >
                        `,
                      )}
                    </div>`
                : ""}
              <div class="stat-row">
                <span class="stat-label">Guard</span>
                <span>${char.guard ?? 3}/${char.maxGuard ?? 3}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Body</span>
                <span>${char.body ?? 6}/6</span>
              </div>
              ${char.healing
                ? html`<div class="stat-row" style="margin-top:2px;">
                    <span class="stat-label">Healing</span>
                    <span class="healing-clocks">
                      ${Array.from({ length: 4 }).map(
                        (_, i) => html`
                          <span
                            class="healing-box ${i < char.healing.ticks
                              ? "filled"
                              : ""}"
                            key=${i}
                          ></span>
                        `,
                      )}
                    </span>
                  </div>`
                : ""}
              <div class="stat-row">
                <span class="stat-label">XP</span>
                <span>${char.xp ?? 0}</span>
              </div>
              ${(char.conditions || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Conditions</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${char.conditions.join(", ")}
                    </div>`
                : ""}
              ${char.stunts?.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Stunts</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${char.stunts.map((s) => s.name).join(", ")}
                    </div>`
                : ""}
              ${canLevelUpFull
                ? html` <div
                    style="margin-top:8px;border-top:1px solid #ccc;padding-top:6px;"
                  >
                    <button
                      class="btn"
                      style="font-size:11px;padding:2px 6px;"
                      onClick=${() => onCommand({ type: "levelup" })}
                    >
                      Level Up (${char.xp} XP)
                    </button>
                  </div>`
                : ""}
              ${hasDowntime
                ? html` <div
                    class="sidebar-section"
                    style="margin-top:8px;border-top:1px solid #ccc;padding-top:6px;"
                  >
                    <h3>Downtime (${char.downtimeRemaining} left)</h3>
                    <div class="options" style="flex-wrap:wrap;gap:3px;">
                      <button
                        class="btn"
                        style="font-size:11px;padding:2px 6px;"
                        onClick=${() =>
                          onCommand({ type: "downtime", action: "recover" })}
                      >
                        Recover
                      </button>
                      <button
                        class="btn"
                        style="font-size:11px;padding:2px 6px;"
                        onClick=${() =>
                          onCommand({ type: "downtime", action: "train" })}
                      >
                        Train (+1 XP)
                      </button>
                    </div>
                    ${projectButtons.length
                      ? html` <div
                            style="margin-top:4px;font-size:11px;font-weight:600;"
                          >
                            Projects:
                          </div>
                          <div class="options" style="flex-wrap:wrap;gap:3px;">
                            ${projectButtons}
                          </div>`
                      : ""}
                  </div>`
                : ""}
              <div
                style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;"
              >
                <span class="stat-label" style="margin:0;"
                  >Gear (${char.load ?? 0}/${effectiveMaxLoad})</span
                >
                ${onMission
                  ? html`<div class="dropdown-group" ref=${gearDropdownRef}>
                      <button
                        class="btn top-side-btn dropdown-chevron"
                        style="font-size:12px;"
                        onClick=${(e) => {
                          e.stopPropagation();
                          setGearDropdown(!gearDropdown);
                        }}
                      >
                        Max: ${char.maxLoad ?? 0} ▼
                      </button>
                      ${gearDropdown
                        ? html` <div
                            class="dropdown-menu"
                            style="right:0;left:auto;"
                          >
                            <button
                              class="btn dropdown-item ${char.maxLoad === 3
                                ? "selected"
                                : ""}"
                              onClick=${(e) => {
                                e.stopPropagation();
                                setGearDropdown(false);
                                onCommand({ type: "loadlevel", level: "light" });
                              }}
                            >
                              Light (3)
                            </button>
                            <button
                              class="btn dropdown-item ${char.maxLoad === 5
                                ? "selected"
                                : ""}"
                              onClick=${(e) => {
                                e.stopPropagation();
                                setGearDropdown(false);
                                onCommand({ type: "loadlevel", level: "normal" });
                              }}
                            >
                              Normal (5)
                            </button>
                            <button
                              class="btn dropdown-item ${char.maxLoad === 6
                                ? "selected"
                                : ""}"
                              onClick=${(e) => {
                                e.stopPropagation();
                                setGearDropdown(false);
                                onCommand({ type: "loadlevel", level: "heavy" });
                              }}
                            >
                              Heavy (6)
                            </button>
                          </div>`
                        : ""}
                    </div>`
                  : html`<span
                      class="stat-label"
                      style="margin:0;font-size:11px;color:#888;"
                      >Max: ${effectiveMaxLoad}</span
                    >`}
              </div>
              ${regularItems.length
                ? html`
                    <div class="gear-list">
                      ${regularItems.map(
                        (item) => html`
                          <div class="gear-item" key=${item.id}>
                            <span class="gear-name">${item.name}</span>
                            ${item.load
                              ? html`<span class="gear-load"
                                  >(${item.load})</span
                                >`
                              : ""}
                          </div>
                        `,
                      )}
                    </div>
                  `
                : html`<div class="gear-empty">No gear.</div>`}
              ${individualItems.length
                ? html`
                    <div
                      class="gear-list"
                      style="margin-top:4px;border-top:1px dashed #ccc;padding-top:4px;"
                    >
                      <div style="font-size:10px;color:#888;margin-bottom:2px;">
                        Special Items
                      </div>
                      ${individualItems.map(
                        (item) => html`
                          <div class="gear-item" key=${item.id}>
                            <span class="gear-name">${item.name}</span>
                          </div>
                        `,
                      )}
                    </div>
                  `
                : ""}
              ${onMission
                ? html`
                    <div class="section-label" style="margin-top:4px;">
                      Mission loadout:
                    </div>
                    ${availableItems.length
                      ? html` <div class="gear-list">
                          ${availableItems.map(
                            (item) => html`
                              <label
                                class="gear-item equip-row"
                                key=${item.id}
                              >
                                <input
                                  type="checkbox"
                                  class="equip-checkbox"
                                  checked=${charItemIds.has(item.id)}
                                  disabled=${charItemIds.has(item.id)}
                                  onChange=${() =>
                                    onCommand({
                                      type: "toggleitem",
                                      itemId: item.id,
                                    })}
                                />
                                <span class="gear-name">${item.name}</span>
                                ${item.load
                                  ? html`<span class="gear-load"
                                      >(${item.load})</span
                                    >`
                                  : ""}
                                ${charItemIds.has(item.id)
                                  ? ""
                                  : char.load + item.load > effectiveMaxLoad
                                    ? html`<span
                                        class="gear-warning"
                                        style="font-size:10px;color:#c00;"
                                        >exceeds load</span
                                      >`
                                    : ""}
                              </label>
                            `,
                          )}
                        </div>`
                      : html`<div style="font-size:11px;color:#888;">
                          No gear available for this character.
                        </div>`}
                  `
                : mayChangeInventory
                  ? html`
                      <div class="section-label" style="margin-top:4px;">
                        Available gear (at ${location?.name || "this location"}):
                      </div>
                      ${availableItems.length
                        ? html` <div class="gear-list">
                            ${availableItems.map(
                              (item) => html`
                                <label
                                  class="gear-item equip-row"
                                  key=${item.id}
                                >
                                  <input
                                    type="checkbox"
                                    class="equip-checkbox"
                                    checked=${charItemIds.has(item.id)}
                                    onChange=${() =>
                                      onCommand({
                                        type: "toggleitem",
                                        itemId: item.id,
                                      })}
                                  />
                                  <span class="gear-name">${item.name}</span>
                                  ${item.load
                                    ? html`<span class="gear-load"
                                        >(${item.load})</span
                                      >`
                                    : ""}
                                  ${charItemIds.has(item.id)
                                    ? ""
                                    : char.load + item.load > effectiveMaxLoad
                                      ? html`<span
                                          class="gear-warning"
                                          style="font-size:10px;color:#c00;"
                                          >exceeds load</span
                                        >`
                                      : ""}
                                </label>
                              `,
                            )}
                          </div>`
                        : html`<div style="font-size:11px;color:#888;">
                            No gear available for this character.
                          </div>`}
                    `
                  : html`<div
                      style="font-size:11px;color:#888;margin-top:4px;"
                    >
                      Visit an armory or supply area to change gear.
                    </div>`}
            </div>
          `
        : ""}
      ${mode === "faction" && faction
        ? html`
            <div class="sidebar-section">
              <h3>${faction.name}</h3>
              <div style="font-size:11px;margin-bottom:8px;">
                ${faction.description}
              </div>
              <div class="stat-row">
                <span class="stat-label">Tier ${faction.tier}</span>
                <span>${faction.hold}</span>
              </div>
              ${faction.heat
                ? html` <div class="stat-row">
                    ${faction.heat > 0
                      ? html`<span class="stat-label">Heat</span>`
                      : html`<span class="stat-label">Favor</span>`}
                    <span
                      >${Math.abs(faction.heat) % 6}/${Math.floor(
                        Math.abs(faction.heat) / 6,
                      )}</span
                    >
                  </div>`
                : ""}
              ${(faction.territory || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Territory</span>
                    </div>
                    <div
                      style="font-size:11px;padding-left:8px;margin-bottom:4px;"
                    >
                      ${faction.territory
                        .map((id) => {
                          const loc = state.locations?.find((l) => l.id === id);
                          return loc ? loc.name : id;
                        })
                        .join(", ")}
                    </div>`
                : ""}
              ${(faction.goals || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Goals</span>
                    </div>
                    <ul
                      style="font-size:11px;margin:2px 0 0 0;padding-left:20px;"
                    >
                      ${faction.goals.map((g) => html`<li>${g}</li>`)}
                    </ul>`
                : ""}
            </div>
          `
        : ""}
    </div>
  `;
}

// Modal for game selection, saving, and loading.
function SaveLoadModal({
  tab,
  onTabChange,
  saveName,
  onSaveNameChange,
  onSave,
  onLoad,
  onDelete,
  saves,
  games,
  currentGameId,
  onGameSelect,
  onClose,
}) {
  return html`
    <div
      class="modal-overlay"
      onClick=${(e) => e.target === e.currentTarget && onClose()}
    >
      <div class="modal">
        <div class="modal-header">
          <h2>${tab === "games" ? "Select Game" : tab === "save" ? "Save Game" : "Load Game"}</h2>
          <button class="modal-close" onClick=${onClose}>×</button>
        </div>
        <div class="modal-body">
          <div class="tabs">
            <button
              class="tab ${tab === "games" ? "active" : ""}"
              onClick=${() => onTabChange("games")}
            >
              Games
            </button>
            <button
              class="tab ${tab === "save" ? "active" : ""}"
              onClick=${() => onTabChange("save")}
            >
              Save
            </button>
            <button
              class="tab ${tab === "load" ? "active" : ""}"
              onClick=${() => onTabChange("load")}
            >
              Load
            </button>
          </div>

          ${tab === "games"
            ? html`
                <div class="section-label">Available games:</div>
                ${games.length === 0
                  ? html`<div class="save-empty">No games found.</div>`
                  : html`
                      <ul class="save-list">
                        ${games.map(
                          (g) => html`
                            <li class="save-item">
                              <div>
                                <div class="save-name">${g}</div>
                                <div class="save-time">${g === currentGameId ? "(current)" : ""}</div>
                              </div>
                              <div class="save-actions">
                                <button class="btn" onClick=${() => onGameSelect(g)}>
                                  ${g === currentGameId ? "Current" : "Load"}
                                </button>
                              </div>
                            </li>
                          `,
                        )}
                      </ul>
                    `}
              `
            : ""}

          ${tab === "save"
            ? html`
                <div class="modal-input-row">
                  <input
                    class="modal-input"
                    type="text"
                    value=${saveName}
                    onInput=${(e) => onSaveNameChange(e.target.value)}
                    placeholder="save name..."
                    onKeyDown=${(e) => e.key === "Enter" && onSave()}
                  />
                  <button
                    class="btn"
                    onClick=${onSave}
                    disabled=${!saveName.trim()}
                  >
                    Save
                  </button>
                </div>
              `
            : ""}
          ${tab !== "games"
            ? html`
                <div class="section-label">Saved games:</div>
                ${saves.length === 0
                  ? html`<div class="save-empty">No saves yet.</div>`
                  : html`
                      <ul class="save-list">
                        ${saves.map(
                          (s) => html`
                            <li class="save-item">
                              <div>
                                <div class="save-name">${s.id}</div>
                                <div class="save-time">${fmtTime(s.at)}</div>
                              </div>
                              <div class="save-actions">
                                <button class="btn" onClick=${() => onLoad(s.id)}>
                                  Load
                                </button>
                                <button
                                  class="btn"
                                  onClick=${() => onDelete(s.id)}
                                  style="opacity:0.6;"
                                >
                                  Del
                                </button>
                              </div>
                            </li>
                          `,
                        )}
                      </ul>
                    `}
              `
            : ""}
        </div>
      </div>
    </div>
  `;
}

// ---- Mount ----
render(html`<${App} />`, document.getElementById("root"));
