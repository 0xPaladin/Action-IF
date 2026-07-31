// Entry point for the Action-IF WebUI.
// Imports helpers, GUI API, and components from modular files,
// then defines the App orchestrator component and mounts it.

import { h, render } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import htm from "htm";
const html = htm.bind(h);

import { getAvailableItems } from "/src/character.js";
import {
  serializeState,
  restoreState,
  loadGameDefinition,
  formatTypeLabel,
  formatRollLabel,
} from "./js/helpers.js";
import { tryLoadGui, buildGuiApi } from "./js/gui-api.js";
import {
  Header,
  OutputArea,
  SidePanel,
  SaveLoadModal,
  CommandInput,
} from "./js/components.js";

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
  // Track scene IDs whose fiction has already been posted to the message log,
  // so re-enterable dialogue scenes don't repeat their fiction.
  const postedSceneIdsRef = useRef(new Set());
  // Monotonic counter for command-result message IDs (used for 15s fade-out removal).
  const msgIdRef = useRef(0);

  // Command result types that get a bordered, fading message (removed after 15s).
  const COMMAND_RESULT_TYPES = new Set([
    "help",
    "save",
    "load",
    "saves",
    "gm_result",
    "downtime_result",
    "fortune_result",
    "levelup",
    "loadlevel",
    "item_toggled",
  ]);

  // Command types whose player input should NOT be echoed as "> text" in the log
  // (option/action selections via buttons or number keys).
  const NO_ECHO_TYPES = new Set([
    "select",
    "go_num",
    "act_num",
    "talk",
    "resolve",
    "assist",
    "setup",
    "toggleitem",
  ]);

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
      // Reset the scene-fiction dedup tracker for a fresh game or load.
      postedSceneIdsRef.current = new Set();

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

      // Echo player input only for freeform typed commands; suppress echo for
      // option/action selections (numbers, buttons, resolve, etc.).
      // Echo player input only for freeform typed commands that produce a
      // permanent result; suppress echo for option/action selections and for
      // command results (which include the echo inside their bordered box).
      if (inputText && !NO_ECHO_TYPES.has(cmd.type) && !COMMAND_RESULT_TYPES.has(result.type)) {
        newMsgs.push({ type: "player", text: inputText });
      }

      if (result.type === "error") {
        newMsgs.push({ type: "result", text: result.message });
      } else if (result.type === "scene_start") {
        // Post the full scene fiction to the message log, but only once per
        // scene ID so re-enterable dialogue scenes don't repeat their fiction.
        const sceneId = result.sceneId;
        if (sceneId && !postedSceneIdsRef.current.has(sceneId)) {
          postedSceneIdsRef.current.add(sceneId);
          newMsgs.push({ type: "fiction", text: result.sceneFiction });
        }
      } else if (result.type === "roll_result") {
        newMsgs.push({ type: "roll", text: formatRollLabel(result), completed: false });
      } else if (result.type === "challenge_done") {
        newMsgs.push({ type: "roll", text: formatTypeLabel(result), completed: true });
      } else if (result.type === "scene_end") {
        // If the scene ended on a roll (e.g. final challenge resolved), show
        // the roll with a check mark. Dialogue scenes that end without a roll
        // post nothing — the fiction was already shown at scene_start.
        if (result.roll) {
          newMsgs.push({ type: "roll", text: formatTypeLabel(result), completed: true });
        }
      } else if (COMMAND_RESULT_TYPES.has(result.type)) {
        // Utility command results: bordered, fade out and remove after 15s.
        // The player's typed command (if any) is included in the box so it
        // fades out together with the result.
        const id = ++msgIdRef.current;
        const label = formatTypeLabel(result) || result.text || "";
        if (label) {
          const text = inputText && !NO_ECHO_TYPES.has(cmd.type)
            ? `> ${inputText}\n${label}`
            : label;
          newMsgs.push({ type: "command", text, id });
          setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== id));
          }, 15000);
        }
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
            const label = saveList.length
              ? `Saved games:\n${saveList.map((s) => `  ${s.id}`).join("\n")}`
              : "No saved games found.";
            const id = ++msgIdRef.current;
            const text = inputText && !NO_ECHO_TYPES.has(cmd.type)
              ? `> ${inputText}\n${label}`
              : label;
            setMessages((prev) => {
              const filtered = prev.filter((m) => m.type !== "context");
              filtered.push({ type: "command", text, id });
              filtered.push({
                type: "context",
                context: engineRef.current.getContext(gameRef.current),
              });
              return filtered;
            });
            setTimeout(() => {
              setMessages((prev) => prev.filter((m) => m.id !== id));
            }, 15000);
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

// ---- Mount ----
render(html`<${App} />`, document.getElementById("root"));
