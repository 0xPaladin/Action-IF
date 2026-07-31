# Action-IF Development Agent

You are the action-if-dev agent for the Action-IF Interactive Fiction engine project.
  
  PURPOSE:
  You assist with development tasks for this Charge SRD-based interactive fiction engine.
  The project uses vanilla JS (ESM), Preact + htm for the WebUI, and runs in-browser via a thin Bun server.
  
  HOW TO ACT:
  - Be concise and efficient in your responses
  - Follow the project's conventions: vanilla JS, no build tools, B&W terminal aesthetic
  - Reference games/example_game_objects.md for object definitions rather than duplicating them
  - Use the explore skill to understand codebase structure before making changes
  - Write tests alongside code changes (tests live in src/*.test.js)
  - Run tests with `bun test` after making changes
  - Document any new (or change to) patterns or conventions
  
  SKILLS TO DEMONSTRATE:
  - explore: Thoroughly understand the codebase structure and module relationships
  - agent-customization: Create and manage agent configuration files properly
  - chronicle: Track session history and provide usage insights when relevant
  - search: Find relevant code patterns and usages across the codebase
  - edit: Make precise, minimal changes following best practices
  
  KEY ARCHITECTURE:
  - Engine runs in-browser, server only handles persistence
  - Games are folder-based under games/ with game.json as main definition
  - All game state is serializable and lives in a single object
  - Hook system provides declarative state changes
  - Preact + htm for WebUI (no build step via importmap)
  
  When working on tasks:
  1. First explore the relevant code
  2. Understand the existing patterns
  3. Make minimal, focused changes
  4. Run tests to verify changes
  5. Document any new patterns or conventions 
    * First update the documentation at the start of the file (if present)
    * Only update this file with major new/changes

## Project Goal

Interactive Fiction engine using **Charge SRD** mechanics. Pure JS API modules in `src/` run in-browser via a thin Bun server that serves static files and handles save/load persistence.

## Architecture

```
Browser (Preact SPA — default / custom per-game)   Server (thin Bun)
─────────────────────────────────────────          ──────────────────
static/index.html     ────→                       serves / (static/)
static/app.js         ────→                       serves /app.js
static/style.css      ────→                       serves /style.css
import: src/*.js      ────→                       serves /src/*.js
import: games/*/game.json ────→                   serves /games/*/*.json
import: games/*/hooks.js ────→                    serves /games/*/hooks.js
import: games/*/gui.js  ────→                     serves /games/*/gui.js
GET  /api/games       ────→                       lists game folder names
GET  /api/games/:id/files ────→                   lists JSON files in a game folder
POST /api/save/:id    ────→                       writes saves/:id.json
GET  /api/load/:id    ────→                       reads saves/:id.json
GET  /api/saves       ────→                       lists saves/:id.json
```

## Conventions

- **Vanilla JS (ESM)** — no frameworks, no build tools. Engine modules are plain `.js` files.
- **Preact + htm** — WebUI uses Preact via importmap (no build step), `htm` for template-literal JSX.
- **B&W terminal aesthetic** — white background, black text, monospace, minimal CSS.
- **CSS** - make css generic in order to re-use as much as possible.
- **All game state lives in the browser** — the server only persists serialized state to JSON files.
- **Engine runs in-browser** — `src/*.js` modules are imported directly by the browser via `<script type="module">`.
- **Games are folder-based** — each game lives in its own folder under `games/`. The main definition is `game.json`; additional JSON files (e.g. `zones.json`, `factions.json`) are merged together (arrays concatenate, objects deep-merge). An optional `hooks.js` exports custom hook handlers as `{ hookId: (state, params) => void }`.

### Game Folder Structure

```
games/
  sample-game/
    game.json          # Main definition (required)
    zones.json         # Optional additional JSON (merged)
    factions.json      # Optional additional JSON (merged)
    hooks.js           # Optional custom hooks (export default { hookId: fn })
    gui.js             # Optional custom SPA (replaces terminal UI)
```

An optional `gui.js` file can be placed in a game folder to completely replace the default terminal SPA with a custom UI. When present, the engine detects it at load time and delegates rendering to it. The module must export an `init(api)` or `default(api)` function that receives an API object and renders into `api.root`. It may return a cleanup function. See the [`games/custom-gui-demo/`](../../games/custom-gui-demo/) folder for a working example.

### Game Definition `name` Field

The game definition accepts a top-level `name` field (string). This is displayed in the WebUI header. If absent, "Action-IF" is used as the fallback title. The title is clickable — clicking it opens a modal that lists available games (folder names) for selection.

### Server API

- `GET /api/games` — returns `{ games: ["folder1", "folder2", ...] }`
- `GET /api/games/:id/files` — returns `{ files: ["game.json", "zones.json", ...] }`

## Module Design

Each aspect of the Charge SRD system lives in its own module:

```
src/
├── action.js          # Action rolls, resistance (no position/effect)
├── challenge.js       # Challenge: description, action set, clock, tags, resolution
├── character.js       # Character creation, 12 actions, Guard/Body, conditions
├── claim.js           # Claims: territory holdings with formula templates
├── clock.js           # Generic progress clocks (create, tick, check)
├── condition.js       # Prerequisite evaluation + character conditions registry
├── crew.js            # Crew: description, coin, reputation, hold, upgrades, stunts
├── dice.js            # Dice pool helpers (zero-to-die, crits, 6/4-5/1-3)
├── downtime.js        # Downtime activities: recovery, training, projects
├── engagement.js      # Engagement roll: dice pool, outcome, complication
├── faction.js         # Factions: name, description, tier, hold, territory, members
├── factionClock.js    # Faction clocks with onComplete hooks
├── hook.js            # Declarative hook system: built-in effect types, resolveHook
├── mission.js         # Mission utilities: heatForAction, createMissionConfig
├── engine.js          # Orchestrator: createGame, getContext, processInput
├── item.js            # Items: name, desc, load, tags, bonusDice, bonusTicks, armor
├── location.js        # Location: leaf nodes, links, actions, enter/exit hooks
├── momentum.js        # Momentum: add, spend, reset, outcome-based generation
├── npc.js             # NPCs: characters with dialogue, actions, hooks
├── parser.js          # Command parser: text → structured commands
├── plotline.js        # Plotline: connected scenes forming a story arc
├── scene.js           # Scene: fiction text, tags, challenges/options, resolution
├── state.js           # Central serialisable game state
├── stunt.js           # Stunts: +1d, bonusTicks, substitute action
└── zone.js            # Zone hierarchy, graph generation
```

## Game Object Definitions

See [`games/example_game_objects.md`](../../games/example_game_objects.md) for detailed JSON examples of all game object types including:
- Zone, Location, Link, Encounter
- Character, Item, Stunt
- Scene (Action & Dialogue), Challenge, ActionEntry, Consequence
- Faction, Claim, Crew, Project
- NPC, FactionClock, Plotline, Mission

## Core Systems

### Zones & Locations

The game world is a node map of **Zones** with **Locations** as leaf nodes. Zone types (largest → smallest):
`galaxy > expanse > sector > reach > subsector > cluster > system > world > realm > region > area > site`

- **Zones** have: `id`, `type`, `name`, `description`, `parent`, `children`, `links`
- **Locations** have: `id`, `name`, `description`, `parent`, `links`, `actions`, `onEnter`, `onExit`
- **Links** connect locations with optional `condition`, `locked`, `key`, and `journey`
- **Encounters** are free scenes for random encounters, referenced via `encounter` key

### Characters

Characters have 12 actions (Muscle, Move, Finesse, Sneak, Shoot, Tinker, Study, Notice, Bond, Command, Focus, Sway) rated 0-4.

- **Health**: Guard (absorbs harm, resets per scene) and Body (persistent, ≤0 = incapacitated)
- **Conditions**: Codified conditions with tags that impose penalties
- **Loadout**: Items with load cost, tags, and effects (bonusDice, bonusTicks, armor)

### Scenes & Challenges

- **Action Scenes**: Have challenges with clocks, tags, and action entries with consequences
- **Dialogue Scenes**: Have options with conditions and hooks
- **Action Resolution**: Roll dice pool, determine outcome (crit/full/partial/failure), apply consequences on failure

See [CHARGE SRD — QUICK REFERENCE](../../rules/charge_quick.md) for a complete reference on the "game" mechanics for characters, action resolution, momentum, etc. 

### Hooks

Declarative hook system for state changes. Built-in types include:
- `setFlag`, `clearFlag`, `tickClock`
- `addResource`, `spendResource`, `addXp`
- `healHarm`, `rest`, `engagement`, `completeMission`
- `giveItem`, `takeItem`, `addCondition`, `removeCondition`
- `addMomentum`, `spendMomentum`, `level_up_action`, `level_up_stunt`

See [`games/example_game_objects.md`](../../games/example_game_objects.md) for hook usage examples.

### Engine

`engine.js` is the orchestrator — the single entry point for the game loop:
- `createGame(definition)` — initializes state from a declarative definition
- `getContext(state)` — returns what the player currently sees
- `processInput(state, command, characterIndex)` — dispatches parsed commands

### Command Parser

`parser.js` converts player text into structured commands:
- `"north"`, `"n"` → `{ type: "go", target: "north" }`
- `"1"`, `"option 3"` → `{ type: "select", index: 0 }`
- `"search"`, `"use key"` → `{ type: "action", text: "..." }`
- `"save"`, `"load"` → save/load commands
- `"levelup"` → opens level-up scene (requires 8 XP)
- `"push Sway"` → spend 2 momentum for +1d

### GM Commands (hidden from help)
- `"gm downtime true"` — starts downtime
- `"gm downtime false"` — ends downtime
- `"gm addHeat guardians 5"` — adds heat to faction

## Testing

Tests live in `src/*.test.js` alongside modules, runnable via:

```sh
bun test
```

## Dev Server

```
bun dev              # starts server.js at localhost:3333
```

## WebUI

Default terminal UI uses Preact components. See [`static/app.js`](../../static/app.js) for the component structure. Custom UIs can be created via `gui.js` in game folders.