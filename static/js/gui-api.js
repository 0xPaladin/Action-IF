// Custom GUI loading and API construction for per-game gui.js modules.
// When a game folder includes a gui.js, the engine delegates rendering to it
// via the API object built here.

import {
  mergeDefinitions,
  serializeState,
  restoreState,
  loadGameDefinition,
} from "./helpers.js";

// Try to load a per-game custom GUI module. Returns the module or null.
export async function tryLoadGui(gameId) {
  try {
    const mod = await import(`/games/${gameId}/gui.js`);
    return mod;
  } catch (e) {
    return null;
  }
}

// Build the API object passed to a custom gui.js module.
export function buildGuiApi({
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
