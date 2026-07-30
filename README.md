# Action-IF

An interactive-fiction engine that runs on the bones of the **Charge SRD**, refracted through the lens of [Blades in the Dark](rules/charge_quick.md). Author a world as JSON, run it in the browser, resolve uncertainty with dice pools and progress clocks, and persist it to disk through a server no bigger than a postcard.

The whole thing is plain JavaScript — no build step, no framework lock-in. The engine lives in `src/`, games live in `games/`, and a thin Bun server in `server.js` stitches them together.

---

## § Gameplay

### What It Is

Action-IF is a fiction-first RPG engine. You play a crew of characters moving through a world made of zones and locations, talking your way past (or shooting your way through) the obstacles the game's author placed in your path. When the fiction is uncertain, you roll dice and read the outcome off a clock.

It borrows its heart from **Blades in the Dark** and its skeleton from the **Charge SRD**: twelve actions, dice pools of d6s, four-step outcomes, and progress clocks that fill as you push against a problem.

### Core Mechanics

The engine implements the moment-to-moment rules of the Charge SRD. A full reference lives in [`rules/charge_quick.md`](rules/charge_quick.md); the essentials:

**Twelve actions** rate every character from 0–4:

| Action | Description |
|--------|-------------|
| Muscle | Force to move, overcome, or wreck. |
| Move | Quickly shift position or escape danger. |
| Finesse | Dexterous manipulation or misdirection. |
| Sneak | Traverse skillfully and quietly. |
| Shoot | Carefully track and shoot a target. |
| Tinker | Understand, create, or repair mechanisms/organisms. |
| Study | Gather, scrutinize, and analyze information. |
| Notice | Observe and anticipate outcomes. |
| Bond | Reassure and socialize with friends/contacts. |
| Command | Compel swift obedience with skill/respect. |
| Focus | Concentrate for great mental strength. |
| Sway | Influence with guile, charm, or argument. |

**Action rolls** build a pool of `action rating + bonus dice − penalties`, roll that many d6s, and read the highest die:

- **6 / critical (two 6s)** — full success, tick the clock 2× the effect level (or 4× on a crit), no consequence.
- **4–5** — partial success, tick at the effect level, 50% chance of consequence vs. reduced effect.
- **1–3** — failure, no progress, the obstacle's consequence lands in full.

**Effect levels** determine how many ticks a successful roll puts on the clock: Great (3), Standard (2), Limited (1), or None (0). The challenge's `defaultEffect` sets the baseline, stunts and items with `bonusEffect` can raise it, and pushing for effect upgrades it one step. On a partial success, there's a 50/50 chance of either getting the full effect with a consequence, or getting reduced effect (one level lower, no consequence).

**Progress clocks** track every obstacle, mission, and faction arc as a ring of segments; fill it and the thing happens. **Guard** absorbs harm first and resets each scene; **Body** is persistent and, when it drops, drags your dice pools down with it. **Conditions** are sticky setbacks that cost a load slot and subtract a die whenever the scene's tags match theirs. **Stunts** and **items** triggered by tag overlap add bonus dice, extra ticks, bonus effect, or let you swap one action for another.

**Momentum** is a shared crew pool (starting at 2) that outcomes feed and that you can spend to **push** a roll for +1d or +effect. **Teamwork** maneuvers — Assist (1 momentum for +1d to an ally), Protect (take a teammate's consequence), and Set Up (roll for indirect benefit, granting the next teammate a choice of +1d or +effect) — let multiple characters act in concert. **Engagement rolls** kick a mission off; **heat** tracks how loud a score was; **downtime** is where you heal, train, and tend long-term projects between scores.

### How to Play

1. Start the dev server: `bun dev` (serves `http://localhost:3333`).
2. Open the page in your browser. The title bar lists available games — click to pick one.
3. You arrive at a **location**. Read the fiction. Below it are your options: links to follow, actions to take, NPCs to talk to.
4. Type or click. Movement is a link button; actions are represented by buttons; dialogue is `talk 1` or an NPC button. Numbered choices work as `1`, `2`, `option 3`.
5. Pulling a lever or talking to a contact may **trigger a scene** — an action scene with clocks and consequences, or a dialogue scene with branching options. Resolve it and control returns to the location.
6. Commands for meta-info: `help`, `status`, `inventory`, `crew`, `factions`. GM-only commands (`gm downtime true`, `gm addHeat <faction> <n>`) run the world from behind the screen.

### Save / Load

All mutable state lives in the browser; the server only persists it. `save` / `save <name>` writes to `saves/<name>.json`; `load` / `load <name>` pulls it back. On load, the engine re-imports the game definition (so authors can append new content), rebuilds fresh state with `createGame(def)`, then overlays your saved progress with `restoreState(fresh, saved)`. Your flags, character stats, active scene, in-progress journeys, faction clocks, plotline scene resolution, and crew XP all survive. Use `saves` to list them.

---

## § Game Design

This section is for **authors** — people who want to build a world to play in. A game is a folder under `games/` containing a `game.json` (the main definition) and any number of additional JSON files (`zones.json`, `factions.json`, `npcs.json`, …) that merge together at load time. Arrays concatenate, objects deep-merge. An optional `hooks.js` exports custom hook handlers for behaviour the built-in vocabulary can't express.

For concrete, full-shape examples of every object described below, see the bundled [`games/sample-game/game.json`](games/sample-game/game.json) (the "Echoes in the Void" sci-fi scenario).

### Object Outline

A game definition is a single object whose top-level keys are the building blocks of the world. None are mandatory beyond a name and somewhere to stand; mix and match as your story demands. For concrete, full-shape examples of every object described below, see the bundled [`games/example_game_objects.md`](games/example_game_objects.md).

**`name`** *(string)* — the title displayed in the header. Falls back to "Action-IF".

**`startLocation`** *(string)* — the location ID the player wakes up in.

**Characters** — `characters[]`. Each is a person with twelve action ratings (or a 12-integer `actionDots` array summing to 7), guard, body, conditions, items, stunts, XP, projects, and a downtime budget. Eight XP buys a level-up (raise an action or gain a stunt) via a dynamic scene-based encounter triggered by the `levelup` command or the sidebar button.

**Items** — `items[]`. Carryable gear with load cost, tag-matched effects (`bonusDice`, `bonusTicks`, `bonusEffect`, `armor`, `substituteAction`), and two classification flags: `specialized` (only equippable by named characters) and `individual` (granted at runtime, never in loadout).

**Stunts** — `stunts[]`. Character abilities, identical in shape to item effects, referenced by ID from characters and crew.

**Crew** — `crew{}`. The player's organisation: coin, reputation, hold, upgrades, crew-wide stunts, and taken claims.

**Factions** — `factions[]`. Power brokers with tier, hold, heat/favour toward the crew, territory, members, goals, and an optional clock.

**Faction clocks** — `factionClocks[]`. Progress rings that fire `onComplete` hooks when they fill. Tick them from dialogue options, challenge completions, or scene resolution.

**Claims** — `claims[]`. Territorial holdings the crew can take, driven by formula templates (`income`, `rep_boost`, `heat_sink`, `upgrade_slot`, `faction_contact`, `territory_control`, `crew_stunt`, `lair_room`, `bonus_payout`) with prerequisite graphs.

**Zones** — `zones[]`. The spatial hierarchy, largest to smallest:
`galaxy > expanse > sector > reach > subsector > cluster > system > world > realm > region > area > site`.

**Locations** — `locations[]`. Where play happens — each has a parent site, manual `links`, `actions`, an optional `mayChangeInventory` flag, and `onEnter`/`onExit` hooks.

**Links** *(within locations)* — connect one location to another. They may be conditionally invisible, locked behind a `key` flag, or carry a `journey` of intervening scenes played during transit. Journeys can roll for random **encounters**.

**Actions** *(within locations)* — physical verbs (search, pull lever) that set flags, grant keys, trigger scenes, resolve hooks, or some combination. Conditions gate their availability.

**NPCs** — `npcs[]`. Characters who live at a location, may belong to a faction, offer `actions`, and carry `dialogue` trees that the engine compiles into dialogue scenes with branching `triggerDialogue` chains.

**Plotlines** — `plotlines[]`. Connected sets of scenes forming a story arc. Each scene is nested inside its plotline. A plotline may optionally carry a **`mission`** config to turn it into a Charge-style score.

**Scenes** *(nested in plotlines, or as free `encounters[]`)* — come in two flavours:
- **Action scenes** — `fiction`, `tags`, and `challenges[]`. Each challenge has a clock, tags, `actions[]` (action entries with single failure-only `consequences`), and `onAct`/`onComplete` hooks.
- **Dialogue scenes** — `fiction`, `tags`, and `options[]` each setting flags, chaining via `triggerScene`, ticking faction clocks, or resolving hooks.

**Consequences** *(within action entries)* — template handlers applied on failure. Built-in type IDs: `harm`, `condition`, `tickClock`, `loseItem`. See [`games/example_game_objects.md`](games/example_game_objects.md#consequence) for the full description of each.

**Mission config** *(optional, on a plotline)* — `patron`, `patronFaction`, `targetFaction`, `payoff` {rep, coin}, `baseHeat`, `engagementAction`, `tags`, a 4-segment `dangerClock`, and an `onComplete` hook. Completion auto-applies payoff, faction heat, patron favour, and ushers the crew into downtime.

**Hooks** — the declarative glue. Wherever you would use a function to change game state — scene `onEnter`/`onExit`, challenge `onAct`/`onComplete`, location action `hooks`, mission `onComplete`, claim templates, dialogue options — pass a hook object (`{ type: "setFlag", flag: "done" }`) or an array of them. Built-in type IDs: `setFlag`, `clearFlag`, `tickClock`, `addRep`, `addCoin`, `addXp`, `spendCoin`, `setScene`, `encounter`, `log`, `adjustStatus`, `clearActiveScene`, `message`, `completePlotline`, `setLocation`, `rest`, `healHarm`, `engagement`, `completeMission`, `giveItem`, `takeItem`, `addCondition`, `removeCondition`, `clearConditions`, `dealHarm`, `resetGuard`, `addCharacterXp`, `moveNPC`, `removeNPC`, `addClock`, `removeClock`, `modifyAction`, `addMomentum`, `spendMomentum`, `level_up_action`, `level_up_stunt`. See [`games/example_game_objects.md`](games/example_game_objects.md#hook) for the full description of each. Register your own with `registerHook(type, handler)` from `hooks.js`.

### How It All Links Together

```
Zones (hierarchy) ──contain──▶ Locations (leaves)
                                   │
                                   ├── links ──▶ other locations (with optional journeys/encounters)
                                   ├── actions ──▶ trigger scenes / set flags / grant keys / resolve hooks
                                   └── npcs ──▶ dialogue trees ──▶ dialogue scenes (compiled)

Plotlines ──contain──▶ Scenes (action | dialogue)
                                   │
                                   ├── action scene ──▶ challenges ──▶ action entries ──▶ consequences
                                   └── optional mission config ──▶ engagement roll + heat + payoff + downtime

Factions ◀── heat/favour ── Crew ──▶ claims ──▶ territory + template effects
   │
   └── faction clocks ──▶ ticked by dialogue options, challenge completion, scene resolution

Hooks ──▶ resolve everywhere: a single declarative effect language across the whole definition
```

The world is locations you walk through; the story is plotlines of scenes you trigger; the politics is factions and clocks ticking around you. Hooks are the verb that lets any of these reach across the boundary and touch state. The engine does the wiring — your job is to lay down the nodes and let them pull on each other.

---

## § Project Design

This section is for **engineers** — people who want to read, extend, or hack on Action-IF itself.

### Architecture

```
Browser (Preact SPA — default / custom per-game)   Server (thin Bun)
─────────────────────────────────────────          ──────────────────
static/index.html     ────→                       serves / (static/)
static/app.js         ────→                       serves /app.js
static/style.css      ────→                       serves /style.css
import: src/*.js       ────→                      serves /src/*.js
import: games/*/game.json ────→                   serves /games/*/*.json
import: games/*/hooks.js ────→                    serves /games/*/hooks.js
import: games/*/gui.js  ────→                     serves /games/*/gui.js
GET  /api/games       ────→                       lists game folder names
GET  /api/games/:id/files ────→                   lists JSON files in a game folder
POST /api/save/:id    ────→                       writes saves/:id.json
GET  /api/load/:id    ────→                       reads saves/:id.json
GET  /api/saves       ────→                       lists saves/:id.json
DELETE /api/save/:id  ────→                       removes a save
```

The browser is a single-page **Preact** app built on `htm` (no JSX, no compiler). The server is ~170 lines of Bun that serves static files, proxies `src/` and `games/`, and round-trips saved state to JSON files in `saves/`. All game state lives in the browser; the server is just persistence.

### Layout

```
Action-IF/
├── server.js          # Bun static + save/load server (port 3333)
├── package.json        # { "type": "module", scripts.dev }
├── src/                # engine — plain ESM modules, imported by the browser
│   ├── engine.js       # orchestrator: createGame, getContext, processInput
│   ├── state.js        # central serialisable game state
│   ├── parser.js       # text → structured commands
│   ├── action.js       # action rolls, resistance, penalties
│   ├── dice.js         # pool helpers, outcome interpretation
│   ├── challenge.js    # obstacles: clock, tags, action set
│   ├── scene.js        # fiction, tags, challenges/options, resolution
│   ├── plotline.js     # story arcs + mission lifecycle
│   ├── mission.js      # heat computation, mission config
│   ├── engagement.js   # the opening score roll
│   ├── character.js    # the 12 actions, Guard/Body, conditions, loadout
│   ├── stunt.js        # tag-matched bonus/substitute effects
│   ├── item.js         # general/specialized/individual gear
│   ├── condition.js    # prerequisites + codified condition registry
│   ├── crew.js         # the player organisation
│   ├── faction.js      # tier, hold, heat, territory, members
│   ├── factionClock.js # faction-scale progress clocks
│   ├── claim.js        # template-driven crew holdings
│   ├── clock.js        # generic progress clocks
│   ├── momentum.js     # crew-level push resource
│   ├── downtime.js     # recovery, training, projects (4 presets)
│   ├── location.js     # leaf nodes, links, actions, hooks
│   ├── zone.js         # hierarchy + auto-generated node graph
│   ├── hook.js         # declarative effect system + resolveHook
│   └── npc.js          # dialogue-bearing characters
├── static/
│   ├── index.html      # importmap (preact, preact/hooks, htm), mounts <App>
│   ├── style.css       # B&W terminal aesthetic — white bg, mono, minimal
│   └── app.js          # all Preact components + game loop + gui.js orchestrator
├── games/
│   ├── sample-game/
│   │   └── game.json   # "Echoes in the Void" — the canonical example
│   └── custom-gui-demo/
│       ├── game.json   # Minimal game demonstrating the custom GUI pattern
│       └── gui.js      # Example custom SPA (replaces default terminal UI)
├── test/               # *.test.js — one per module, runnable via `bun test`
├── rules/
│   ├── charge_quick.md # the SRD reference the engine leans on
│   └── TAG_SUGGESTIONS.md  # curated tag vocabulary (~55, ~5 per action)
└── saves/              # runtime save files (gitignored)
```

### Principles

- **Vanilla ESM, no build step.** Engine modules are plain `.js` files imported straight by the browser via `<script type="module">`. The Preact UI rides an importmap and `htm` for JSX-less templating.
- **All game state in the browser.** The server is deliberately thin: static delivery plus a tiny save-load API. Nothing authoritative lives server-side between requests.
- **One module per concern.** Each column of the Charge/SRD ruleset gets its own file with a focused API. `engine.js` is the only orchestrator — the single entry point for the game loop (`createGame`, `getContext`, `processInput`).
- **Declarative over imperative.** Hooks are the centre of gravity: `{ type: "setFlag", flag: "x" }` works identically whether it fires on a scene exit, a challenge completion, a dialogue choice, or a claim template. Game authors shouldn't write functions unless they're doing something the vocabulary can't reach.
- **Games are folders, not code.** A game is a directory of JSON plus an optional `hooks.js`. New content can be added to a shipped game without invalidating saves — `restoreState` overlays progress onto a freshly rebuilt world.

### Custom GUI (gui.js)

Any game folder can include a `gui.js` module to completely replace the default terminal UI with a custom SPA. When present, `app.js` detects it at load time, delegates rendering to it, and the default Preact components are not rendered.

**Contract:** The module must export an `init(api)` or `default(api)` function. It receives:

```js
{
  gameId,           // string — current game folder name
  gameList,         // string[] — available game folder names
  definition,       // object — merged game definition JSON
  customHooks,      // object|null — hook handlers from hooks.js
  state,            // object — current mutable game state
  engine,           // module — engine.js
  parser,           // module — parser.js
  hookMod,          // module — hook.js
  root,             // HTMLElement — #root element to render into
  helpers:          // { mergeDefinitions, serializeState, restoreState, loadGameDefinition }
  saveLoad:         // { save(name, state), load(name), list(), del(name) }
  switchGame(id),   // load a different game
}
```

The function may return a cleanup function (called before switching games or loading a save). See [`games/custom-gui-demo/gui.js`](games/custom-gui-demo/gui.js) for a working example using Preact + htm.

### Running

```sh
bun dev    # starts server.js (with --watch) at http://localhost:3333
bun test   # runs the suite in test/
```

Open `http://localhost:3333` in a browser, pick a game from the header dropdown, and play.

### License

[`MIT License`](LICENSE).
