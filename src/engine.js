import {
  createGameState,
  setCurrentLocation,
  getCurrentLocation,
  addLocation,
  addScene,
  setActiveScene,
  getActiveScene,
  addCharacter,
  addPlotline,
  addStunt as stateAddStunt,
  hasFlag,
  addNPC,
  getNPCsAtLocation,
  getNPC,
  findSceneById,
} from "./state.js";
import {
  createLocation,
  createLink,
  createAction,
  addLink,
  addAction,
  enterLocation,
  exitLocation,
  getVisibleLinks,
  getAvailableActions,
  useLink,
  useAction,
  setLocation,
} from "./location.js";
import {
  createZone,
  addZone,
  generateZoneNodeGraph,
} from "./zone.js";
import {
  createScene,
  getVisibleOptions,
  getVisibleChallenges,
  selectOption,
  updateSceneResolution,
  isSceneResolved,
  getChallenge,
} from "./scene.js";
import {
  createChallenge,
  addActionToChallenge,
  resolveAction as resolveChallengeAction,
  increaseEffect,
} from "./challenge.js";
import {
  createCharacter,
  assignActionDots,
  addItem,
  removeItem,
  addStunt as charAddStunt,
  setLoadLevel,
  getAvailableItems,
  ACTION_ACTIONS,
} from "./character.js";
import { createItem } from "./item.js";
import { createStunt } from "./stunt.js";
import {
  createPlotline,
  updatePlotlines,
  startPlotlineMission,
  getActiveMission,
  updateMission,
  addMissionHeat,
} from "./plotline.js";
import { createCrew } from "./crew.js";
import {
  createClaim,
  registerClaimTemplate,
  knownClaimTemplates,
  takeClaim,
} from "./claim.js";
import { createFactionClock } from "./factionClock.js";
import { createFaction, addHeat as addFactionHeat } from "./faction.js";
import { startDowntime, clearDowntime, doProject, doRecovery, doTraining, canDoActivity, activitiesRemaining } from "./downtime.js";
import { heatForAction, createMissionConfig } from "./mission.js";
import { actionRoll } from "./action.js";
import { resolveHook } from "./hook.js";
import { spendMomentum, canSpendMomentum } from "./momentum.js";
import { fortuneRoll } from "./dice.js";
import { parseInput } from "./parser.js";
import { filterConditional } from "./condition.js";
import {
  createNPC,
  createNPCDialogueScene,
} from "./npc.js";

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

export function createGame(definition) {
  const state = createGameState();
  state.gameName = definition.name || null;
  const itemCache = {};

  for (const def of definition.items || []) {
    itemCache[def.id] = createItem(
      def.id,
      def.name,
      def.description,
      def.load || 0,
      def.tags || [],
      def.effects || {},
    );
    state.items.push(itemCache[def.id]);
  }

  const stuntCache = {};
  for (const def of definition.stunts || []) {
    stuntCache[def.id] = createStunt(
      def.id,
      def.name,
      def.description,
      def.tags || [],
      def.effects || {},
    );
    state.gameStunts.push(stuntCache[def.id]);
  }

  for (const def of definition.characters || []) {
    const char = createCharacter(def.name);

    if (def.actions) {
      for (const [actionName, dots] of Object.entries(def.actions)) {
        if (char.actions[actionName] !== undefined) {
          char.actions[actionName] = dots;
        }
      }
    }

    if (def.actionDots) assignActionDots(char, def.actionDots);
    if (def.aspects) char.aspects = [...def.aspects];
    if (def.items) char.items = [...def.items];
    if (def.xp) char.xp = def.xp;
    if (def.stuntChoices) char.stuntChoices = [...def.stuntChoices];
    for (const sDef of def.stunts || []) {
      if (typeof sDef === "string") {
        if (stuntCache[sDef]) charAddStunt(char, stuntCache[sDef]);
      } else {
        charAddStunt(
          char,
          createStunt(
            sDef.id,
            sDef.name,
            sDef.description,
            sDef.tags || [],
            sDef.effects || {},
          ),
        );
      }
    }
    addCharacter(state, char);
  }

  for (const def of definition.zones || []) {
    const zone = createZone(
      def.id,
      def.type,
      def.name,
      def.description,
      def.parent || null,
    );
    for (const lDef of def.links || []) {
      addLink(
        zone,
        createLink(
          lDef.targetId,
          lDef.label,
          lDef.condition || null,
          lDef.locked || false,
          lDef.key || null,
          lDef.journey || null,
        ),
      );
    }
    addZone(state, zone);
  }

  for (const def of definition.locations || []) {
    const loc = createLocation(
      def.id,
      def.name,
      def.description,
      def.parent || null,
      def.mayChangeInventory || false,
    );
    for (const lDef of def.links || []) {
      addLink(
        loc,
        createLink(
          lDef.targetId,
          lDef.label,
          lDef.condition || null,
          lDef.locked || false,
          lDef.key || null,
          lDef.journey || null,
        ),
      );
    }
    for (const aDef of def.actions || []) {
      addAction(
        loc,
        createAction(
          aDef.id,
          aDef.label,
          aDef.description || "",
          aDef.once || false,
          aDef.triggerScene || null,
          aDef.setFlag || null,
          aDef.provideKeys || [],
          aDef.condition || null,
          aDef.hooks || null,
        ),
      );
    }
    loc.onEnter = def.onEnter || null;
    loc.onExit = def.onExit || null;
    addLocation(state, loc);
  }

  for (const def of definition.npcs || []) {
    const npc = createNPC(def);
    addNPC(state, npc);
    
    for (const d of def.dialogue || []) {
      const scene = createNPCDialogueScene(npc.id, d, def.dialogue);
      addScene(state, scene);
    }
  }

  generateZoneNodeGraph(state);

  for (const def of definition.plotlines || []) {
    const plotScenes = [];
    for (const sDef of def.scenes || []) {
      const scene = createScene(
        sDef.id,
        sDef.type,
        sDef.fiction,
        sDef.tags || [],
        sDef.triggerScene || null,
        sDef.onEnter || null,
        sDef.onExit || null,
        sDef.heat !== undefined ? sDef.heat : false,
      );
      scene._plotlineId = def.id;
      scene.tickFactionClockOnResolve = sDef.tickFactionClockOnResolve || null;
      if (sDef.type === "action") {
        for (const cDef of sDef.challenges || []) {
          const challenge = createChallenge(
            cDef.id,
            cDef.description,
            cDef.clockMax,
            cDef.tags || [],
            cDef.onAct || null,
            cDef.onComplete || null,
            cDef.condition || null,
            cDef.defaultEffect || "standard",
          );
          challenge.tickFactionClock = cDef.tickFactionClock || null;
          challenge.reducedEffect = 0;
          for (const aDef of cDef.actions || []) {
            addActionToChallenge(
              challenge,
              aDef.actionName,
              aDef.consequences,
              aDef.heat,
            );
          }
          scene.challenges.push(challenge);
        }
      } else if (sDef.type === "dialogue") {
        for (const oDef of sDef.options || []) {
          scene.options.push({
            text: oDef.text,
            setFlag: oDef.setFlag || null,
            triggerScene: oDef.triggerScene || null,
            condition: oDef.condition || null,
            tickFactionClock: oDef.tickFactionClock || null,
            hooks: oDef.hooks || null,
          });
        }
      }
      plotScenes.push(scene);
    }
    const missionConfig = def.mission
      ? createMissionConfig(def.mission)
      : null;
    const plot = createPlotline(
      def.id,
      def.name,
      def.description || "",
      plotScenes,
      missionConfig,
    );
    addPlotline(state, plot);
  }

  for (const eDef of definition.encounters || []) {
    const scene = createScene(
      eDef.id,
      eDef.type,
      eDef.fiction,
      eDef.tags || [],
      eDef.triggerScene || null,
      eDef.onEnter || null,
      eDef.onExit || null,
      eDef.heat !== undefined ? eDef.heat : false,
    );
    scene._encounter = true;
    scene.tickFactionClockOnResolve = eDef.tickFactionClockOnResolve || null;
    if (eDef.type === "action") {
      for (const cDef of eDef.challenges || []) {
        const challenge = createChallenge(
          cDef.id,
          cDef.description,
          cDef.clockMax,
          cDef.tags || [],
          cDef.onAct || null,
          cDef.onComplete || null,
          cDef.condition || null,
          cDef.defaultEffect || "standard",
        );
        challenge.tickFactionClock = cDef.tickFactionClock || null;
        challenge.reducedEffect = 0;
        for (const aDef of cDef.actions || []) {
          addActionToChallenge(
            challenge,
            aDef.actionName,
            aDef.consequences,
            aDef.heat,
          );
        }
        scene.challenges.push(challenge);
      }
    } else if (eDef.type === "dialogue") {
      for (const oDef of eDef.options || []) {
        scene.options.push({
          text: oDef.text,
          setFlag: oDef.setFlag || null,
          triggerScene: oDef.triggerScene || null,
          condition: oDef.condition || null,
          tickFactionClock: oDef.tickFactionClock || null,
          hooks: oDef.hooks || null,
        });
      }
    }
    addScene(state, scene);
    state.encounters.push(scene);
  }

  for (const def of definition.factionClocks || []) {
    state.factionClocks.push(
      createFactionClock(
        def.id,
        def.name,
        def.description,
        def.clockMax,
        def.onComplete || null,
      ),
    );
  }

  for (const def of definition.factions || []) {
    state.factions.push(
      createFaction(def.id, def.name, def.description, {
        tier: def.tier,
        hold: def.hold,
        heat: def.heat,
        territory: def.territory,
        members: def.members,
        notes: def.notes,
        goals: def.goals,
        clockId: def.clockId,
      }),
    );
  }

  for (const [name, def] of Object.entries(definition.claimTemplates || {})) {
    if (!def.apply || !def.remove) {
      throw new Error(
        `Claim template "${name}" must have apply and remove functions`,
      );
    }
    registerClaimTemplate(
      name,
      def.name || name,
      def.description || "",
      def.apply,
      def.remove,
    );
  }

  for (const def of definition.claims || []) {
    state.claims.push(
      createClaim(
        def.id,
        def.name,
        def.description,
        def.location,
        def.template,
        def.params || {},
        {
          prerequisites: def.prerequisites || [],
          connections: def.connections || [],
        },
      ),
    );
  }

  if (definition.crew) {
    const c = definition.crew;
    const resolvedStunts = (c.stunts || []).map((s) => {
      if (typeof s === "string") return stuntCache[s];
      return s;
    }).filter((s) => s);
    state.crew = createCrew(c.id, c.name, {
      description: c.description || "",
      lair: c.lair || null,
      reputation: c.reputation || 0,
      coin: c.coin || 0,
      hold: c.hold || "weak",
      upgrades: c.upgrades || [],
      stunts: resolvedStunts,
      xp: c.xp || 0,
    });

    for (const claimId of c.claims || []) {
      try {
        takeClaim(state, claimId);
      } catch (_) {}
    }
  }

  if (definition.startLocation) {
    setCurrentLocation(state, definition.startLocation);
  }

  return state;
}

export function getContext(state) {
  const activeScene = getActiveScene(state);
  const activeMission = getActiveMission(state);

  if (activeScene) {
    const ctx = {
      type: "scene",
      sceneId: activeScene.id,
      fiction: activeScene.fiction,
      sceneType: activeScene.type,
      tags: activeScene.tags,
      heat: activeScene.heat,
      onMission: !!activeMission,
      momentum: state.momentum,
    };

    if (activeMission) {
      ctx.missionId = activeMission.id;
      ctx.missionName = activeMission.name;
      ctx.heatGenerated = activeMission.mission.heatGenerated;
      ctx.baseHeat = activeMission.mission.baseHeat;
      ctx.dangerClock = activeMission.mission.dangerClock;
      ctx.payoff = activeMission.mission.payoff;
      ctx.patron = activeMission.mission.patron;
      ctx.targetFaction = activeMission.mission.targetFaction;
    }

    if (activeScene.type === "action") {
      const resolved = activeScene.challenges.filter((c) => c.resolved);
      const active = activeScene.challenges.filter((c) => !c.resolved);
      ctx.challenges = active.map((c) => ({
        id: c.id,
        description: c.description,
        clock: { current: c.clock.current, max: c.clock.max },
        tags: c.tags,
        actions: c.actions,
        resolved: c.resolved,
      }));
      ctx.resolvedChallenges = resolved.length;
      ctx.totalChallenges = activeScene.challenges.length;
    }

    if (activeScene.type === "dialogue") {
      ctx.options = activeScene.options.map((o, i) => ({
        index: i,
        text: o.text,
        available: !o.condition || checkCondition(o.condition, state),
      }));
    }

    return ctx;
  }

  const location = getCurrentLocation(state);
  if (!location) {
    return { type: "empty" };
  }

  const links = getVisibleLinks(location, state);
  const actions = getAvailableActions(location, state);
  const npcsAtLocation = getNPCsAtLocation(state, location.id);

  const ctx = {
    type: "location",
    locationId: location.id,
    name: location.name,
    description: location.description,
    links: links.map((l, i) => ({
      index: i,
      label: l.label,
      locked: l.locked && l.key && !hasFlag(state, l.key),
    })),
    actions: actions.map((a, i) => ({
      index: i,
      id: a.id,
      label: a.label,
      description: a.description,
    })),
    npcs: npcsAtLocation.map((npc, i) => ({
      index: i,
      id: npc.id,
      name: npc.name,
      description: npc.description,
    })),
    mayChangeInventory: location.mayChangeInventory || false,
    onMission: !!activeMission,
    momentum: state.momentum,
  };

  if (activeMission) {
    ctx.missionId = activeMission.id;
    ctx.missionName = activeMission.name;
    ctx.heatGenerated = activeMission.mission.heatGenerated;
    ctx.baseHeat = activeMission.mission.baseHeat;
    ctx.dangerClock = activeMission.mission.dangerClock;
    ctx.payoff = activeMission.mission.payoff;
    ctx.patron = activeMission.mission.patron;
    ctx.targetFaction = activeMission.mission.targetFaction;
  }

  const totalRemaining = (state.characters || []).reduce((sum, c) => sum + (c.downtimeRemaining || 0), 0);
  if (totalRemaining > 0) {
    ctx.downtime = state.characters.map((c) => ({
      name: c.name,
      remaining: c.downtimeRemaining || 0,
    }));
  }

  return ctx;
}

// ---- Level-Up Scene Generation ----

const LEVEL_UP_COST = 8;

/**
 * Check if a character has at least one upgradeable action or available stunt.
 */
function canLevelUp(state, characterIndex) {
  const char = state.characters[characterIndex];
  if (!char) return false;
  if ((char.xp || 0) < LEVEL_UP_COST) return false;

  const hasAction = ACTION_ACTIONS.some((a) => (char.actions[a] || 0) < 4);
  if (hasAction) return true;

  const hasStunt = getAvailableStuntsForLevelUp(state, char).length > 0;
  return hasStunt;
}

/**
 * Get the list of stunts available for a character to gain via level-up.
 * Uses stuntChoices first, falls back to all game stunts minus known ones.
 */
function getAvailableStuntsForLevelUp(state, char) {
  const choices = char.stuntChoices || [];
  if (choices.length > 0) {
    return choices.filter((s) => !char.stunts.some((hs) => hs.id === s.id));
  }
  return (state.gameStunts || []).filter(
    (s) => !char.stunts.some((hs) => hs.id === s.id),
  );
}

/**
 * Create the top-level "Level Up" choice dialogue scene.
 */
function createLevelUpChoiceScene(state, characterIndex) {
  const char = state.characters[characterIndex];
  const sceneId = `_levelup_choice:${characterIndex}`;

  const scene = createScene(
    sceneId,
    "dialogue",
    `${char.name} has ${char.xp} XP. Choose how to advance:`,
    [],
    null,
    null,
    null,
    false,
  );

  scene.options = [
    {
      text: "Improve an Action",
      setFlag: null,
      triggerScene: `_levelup_actions:${characterIndex}`,
      condition: null,
      tickFactionClock: null,
      hooks: null,
    },
    {
      text: "Add a Stunt",
      setFlag: null,
      triggerScene: `_levelup_stunts:${characterIndex}`,
      condition: null,
      tickFactionClock: null,
      hooks: null,
    },
  ];

  return scene;
}

/**
 * Create the "Improve an Action" sub-scene with one option per upgradeable action.
 */
function createLevelUpActionsScene(state, characterIndex) {
  const char = state.characters[characterIndex];
  const sceneId = `_levelup_actions:${characterIndex}`;

  const scene = createScene(
    sceneId,
    "dialogue",
    `Choose an action to improve (costs ${LEVEL_UP_COST} XP):`,
    [],
    null,
    null,
    null,
    false,
  );

  scene.options = ACTION_ACTIONS.filter((a) => (char.actions[a] || 0) < 4).map(
    (actionName) => ({
      text: `${actionName}: ${char.actions[actionName]} → ${char.actions[actionName] + 1}`,
      setFlag: null,
      triggerScene: null,
      condition: null,
      tickFactionClock: null,
      hooks: {
        type: "level_up_action",
        characterIndex,
        action: actionName,
      },
    }),
  );

  return scene;
}

/**
 * Create the "Add a Stunt" sub-scene with one option per available stunt.
 */
function createLevelUpStuntsScene(state, characterIndex) {
  const char = state.characters[characterIndex];
  const sceneId = `_levelup_stunts:${characterIndex}`;

  const scene = createScene(
    sceneId,
    "dialogue",
    `Choose a stunt to gain (costs ${LEVEL_UP_COST} XP):`,
    [],
    null,
    null,
    null,
    false,
  );

  const available = getAvailableStuntsForLevelUp(state, char);

  scene.options = available.map((stunt) => ({
    text: `${stunt.name} — ${stunt.description}`,
    setFlag: null,
    triggerScene: null,
    condition: null,
    tickFactionClock: null,
    hooks: {
      type: "level_up_stunt",
      characterIndex,
      stuntId: stunt.id,
    },
  }));

  return scene;
}

/**
 * Handle the "levelup" command — creates the level-up scene chain dynamically.
 */
export function handleLevelUp(state, characterIndex) {
  const char = state.characters[characterIndex];
  if (!char) {
    return { type: "error", message: "Invalid character." };
  }

  if ((char.xp || 0) < LEVEL_UP_COST) {
    return {
      type: "error",
      message: `${char.name} needs ${LEVEL_UP_COST} XP to level up, has ${char.xp || 0}.`,
    };
  }

  if (!canLevelUp(state, characterIndex)) {
    return {
      type: "error",
      message: `${char.name} has nothing to level up (all actions at max and no stunts available).`,
    };
  }

  // Create the three level-up scenes and add them to state
  const choiceScene = createLevelUpChoiceScene(state, characterIndex);
  const actionsScene = createLevelUpActionsScene(state, characterIndex);
  const stuntsScene = createLevelUpStuntsScene(state, characterIndex);

  addScene(state, choiceScene);
  addScene(state, actionsScene);
  addScene(state, stuntsScene);

  setActiveScene(state, choiceScene.id);

  return {
    type: "scene_start",
    sceneId: choiceScene.id,
    sceneFiction: choiceScene.fiction,
    context: getContext(state),
  };
}

export function processInput(state, command, characterIndex = 0) {
  const activeScene = getActiveScene(state);

  if (activeScene) {
    return processSceneInput(state, activeScene, command, characterIndex);
  }

  return processLocationInput(state, command, characterIndex);
}

function processSceneInput(state, scene, command, characterIndex) {
  if (scene.type === "dialogue") {
    switch (command.type) {
      case "select":
        return handleSelectOption(state, scene, command.index);
      case "help":
      case "save":
      case "load":
      case "saves":
      case "levelup":
        return handleInfoCommand(state, command, characterIndex);
      default:
        return { type: "error", message: "Use a number to select an option." };
    }
  }

  if (scene.type === "action") {
    switch (command.type) {
      case "select":
        return handleSelectOption(state, scene, command.index);

      case "resolve":
        return handleResolveAction(state, scene, command, characterIndex);

      case "action":
        return handleActionParse(state, scene, command, characterIndex);

      case "assist":
        return handleAssist(state, command, characterIndex);

      case "protect":
        return handleProtect(state, command, characterIndex);

      case "setup":
        return handleSetUp(state, command, characterIndex);

      case "help":
      case "back":
      case "save":
      case "load":
      case "saves":
        return handleInfoCommand(state, command, characterIndex);

      default:
        return { type: "error", message: "Invalid command in scene." };
    }
  }

  return { type: "error", message: "Unknown scene type." };
}

function processLocationInput(state, command, characterIndex) {
  switch (command.type) {
    case "go":
    case "go_num":
      return handleGo(state, command.index);

    case "action":
      return handleLocationAction(state, command, characterIndex);

    case "act_num":
      return handleActNumber(state, command.index);

    case "select":
      return handleLocationSelect(state, command.index);

    case "talk":
      return handleTalk(state, command.index);

    case "fortune":
      return handleFortune(state, command);

    case "downtime":
      return handleDowntime(state, command, characterIndex);

    case "levelup":
      return handleLevelUp(state, characterIndex);

    case "gm":
      return handleGmCommand(state, command, characterIndex);

    case "help":
    case "back":
    case "save":
    case "load":
    case "saves":
    case "loadlevel":
      return handleInfoCommand(state, command, characterIndex);

    case "toggleitem":
      return handleToggleItem(state, command, characterIndex);
  }

  return {
    type: "error",
    message: "You can't do that here. Try a number or 'search'.",
  };
}

function handleGo(state, index) {
  const location = getCurrentLocation(state);
  if (!location) return { type: "error", message: "You are nowhere." };

  const links = getVisibleLinks(location, state);
  if (index < 0 || index >= links.length) {
    return {
      type: "error",
      message: `Invalid option. Choose 1-${links.length}.`,
    };
  }

  const link = links[index];
  if (link.locked && link.key && !hasFlag(state, link.key)) {
    return { type: "error", message: `"${link.label}" is locked.` };
  }

  const linkIndex = location.links.indexOf(link);
  const result = useLink(location, linkIndex, state);
  const targetId = result.targetId;

  if (result.journey) {
    exitLocation(location, state);
    return startJourney(state, result.journey, targetId, location.id);
  }

  exitLocation(location, state);
  setCurrentLocation(state, targetId);
  const next = getCurrentLocation(state);
  enterLocation(next, state);

  return {
    type: "transition",
    from: location.id,
    fromName: location.name,
    to: targetId,
    toName: next.name,
    context: getContext(state),
  };
}

function startJourney(state, journeyDefs, targetId, locationId) {
  const scenes = [];
  for (let i = 0; i < journeyDefs.length; i++) {
    const sDef = journeyDefs[i];
    const sceneId = `journey:${locationId}:${i}`;
    const scene = createScene(
      sceneId,
      sDef.type,
      sDef.fiction,
      sDef.tags || [],
      sDef.triggerScene || null,
      sDef.onEnter || null,
      sDef.onExit || null,
      sDef.heat !== undefined ? sDef.heat : false,
    );
    scene._journey = true;
    scene._journeyIndex = i;
    scene.encounter = sDef.encounter || null;
    scene.tickFactionClockOnResolve = sDef.tickFactionClockOnResolve || null;
    if (sDef.type === "action") {
      for (const cDef of sDef.challenges || []) {
        const challenge = createChallenge(
          cDef.id,
          cDef.description,
          cDef.clockMax,
          cDef.tags || [],
          cDef.onAct || null,
          cDef.onComplete || null,
          cDef.condition || null,
          cDef.defaultEffect || "standard",
        );
        challenge.tickFactionClock = cDef.tickFactionClock || null;
        challenge.reducedEffect = 0;
        for (const aDef of cDef.actions || []) {
          addActionToChallenge(
            challenge,
            aDef.actionName,
            aDef.consequences,
            aDef.heat,
          );
        }
        scene.challenges.push(challenge);
      }
    } else if (sDef.type === "dialogue") {
      for (const oDef of sDef.options || []) {
        scene.options.push({
          text: oDef.text,
          setFlag: oDef.setFlag || null,
          triggerScene: oDef.triggerScene || null,
          condition: oDef.condition || null,
          tickFactionClock: oDef.tickFactionClock || null,
          hooks: oDef.hooks || null,
        });
      }
    }
    scenes.push(scene);
    addScene(state, scene);
  }
  state.journeyScenes = scenes;
  state.journeyTarget = targetId;
  state.journeyIndex = 0;

  const encounterId = resolveEncounter(state, scenes[0].encounter);
  if (encounterId) {
    const encScene = findSceneById(state, encounterId);
    if (encScene) {
      setActiveScene(state, encounterId);
      return {
        type: "scene_start",
        sceneId: encounterId,
        sceneFiction: encScene.fiction,
        context: getContext(state),
      };
    }
  }

  if (scenes[0].encounter) {
    const journeyResult = resolveJourney(state, scenes[0]);
    if (journeyResult) return journeyResult;
  }

  setActiveScene(state, scenes[0].id);
  return {
    type: "scene_start",
    sceneId: scenes[0].id,
    sceneFiction: scenes[0].fiction,
    context: getContext(state),
  };
}

export function resolveEncounter(state, encounterDef) {
  if (encounterDef == null) return null;

  if (typeof encounterDef === "string") {
    return encounterDef;
  }

  if (Array.isArray(encounterDef)) {
    const ids = encounterDef[0];
    const weights = encounterDef[1];
    if (!ids || !weights || ids.length === 0) return null;

    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) return null;

    const r = Math.random() * total;
    let cumulative = 0;
    for (let i = 0; i < ids.length; i++) {
      cumulative += weights[i];
      if (r < cumulative) {
        return ids[i];
      }
    }
    return ids[ids.length - 1];
  }

  return null;
}

function resolveJourney(state, scene) {
  if (!state.journeyScenes) return null;

  if (scene._journey) {
    state.journeyIndex = scene._journeyIndex + 1;
  }

  if (state.journeyIndex < state.journeyScenes.length) {
    const nextScene = state.journeyScenes[state.journeyIndex];

    if (nextScene.encounter) {
      const encounterId = resolveEncounter(state, nextScene.encounter);
      if (encounterId) {
        const encScene = findSceneById(state, encounterId);
        if (encScene) {
          setActiveScene(state, encounterId);
          return {
            type: "scene_start",
            sceneId: encounterId,
            sceneFiction: encScene.fiction,
            context: getContext(state),
          };
        }
      }
      state.journeyIndex++;
      return resolveJourney(state, nextScene);
    }

    setActiveScene(state, nextScene.id);
    return {
      type: "scene_start",
      sceneId: nextScene.id,
      sceneFiction: nextScene.fiction,
      context: getContext(state),
    };
  }

  const targetId = state.journeyTarget;
  state.journeyScenes = null;
  state.journeyTarget = null;
  state.journeyIndex = 0;

  const currentLoc = getCurrentLocation(state);
  if (currentLoc && currentLoc.id !== targetId) {
    exitLocation(currentLoc, state);
    setCurrentLocation(state, targetId);
    const next = getCurrentLocation(state);
    enterLocation(next, state);
  }

  return {
    type: "transition",
    from: currentLoc?.id,
    fromName: currentLoc?.name,
    to: targetId,
    toName: getCurrentLocation(state)?.name,
    context: getContext(state),
  };
}

function handleActNumber(state, index) {
  const location = getCurrentLocation(state);
  if (!location) return { type: "error", message: "You are nowhere." };

  const actions = getAvailableActions(location, state);
  if (index < 0 || index >= actions.length) {
    return {
      type: "error",
      message: `Invalid option. Choose 1-${actions.length}.`,
    };
  }

  const actionIndex = location.actions.indexOf(actions[index]);
  const result = useAction(location, actionIndex, state);

  if (result.triggerScene) {
    setActiveScene(state, result.triggerScene);
      const scene = findSceneById(state, result.triggerScene);
      return {
        type: "scene_start",
        sceneId: result.triggerScene,
        sceneFiction: scene?.fiction,
        context: getContext(state),
      };
    }

    return {
      type: "action_done",
      actionId: result.action.id,
      actionLabel: result.action.label,
      context: getContext(state),
    };
  };

function handleTalk(state, index) {
  const location = getCurrentLocation(state);
  if (!location) return { type: "error", message: "You are nowhere." };

  const npcs = getNPCsAtLocation(state, location.id);
  if (index < 0 || index >= npcs.length) {
    return { type: "error", message: `Invalid NPC. Choose 1-${npcs.length}.` };
  }

  const npc = npcs[index];
  const dialogueDef = npc.dialogue[0];
  if (!dialogueDef) {
    return { type: "error", message: `${npc.name} has nothing to say.` };
  }

  const sceneId = `npc:${npc.id}:${dialogueDef.id}`;
  const scene = findSceneById(state, sceneId);
  if (!scene) {
    return { type: "error", message: `Dialogue scene "${sceneId}" not found.` };
  }

  setActiveScene(state, sceneId);
  return {
    type: "scene_start",
    sceneId,
    sceneFiction: scene.fiction,
    context: getContext(state),
  };
}

function handleLocationAction(state, command, characterIndex) {
  const location = getCurrentLocation(state);
  if (!location) return { type: "error", message: "You are nowhere." };

  const available = getAvailableActions(location, state);
  const match = findActionByText(available, command.text);

  if (!match) {
    return { type: "error", message: `You can't do that here.` };
  }

  const actionIndex = location.actions.indexOf(match);
  const result = useAction(location, actionIndex, state);

  if (result.triggerScene) {
    setActiveScene(state, result.triggerScene);
    const scene = findSceneById(state, result.triggerScene);
    return {
      type: "scene_start",
      sceneId: result.triggerScene,
      sceneFiction: scene?.fiction,
      context: getContext(state),
    };
  }

  return {
    type: "action_done",
    actionId: result.action.id,
    actionLabel: result.action.label,
    context: getContext(state),
  };
}

function handleLocationSelect(state, index) {
  const location = getCurrentLocation(state);
  if (!location) return { type: "error", message: "You are nowhere." };

  const links = getVisibleLinks(location, state);
  const actions = getAvailableActions(location, state);
  const npcs = getNPCsAtLocation(state, location.id);
  const total = links.length + actions.length + npcs.length;

  if (index < 0 || index >= total) {
    return { type: "error", message: `Invalid option. Choose 1-${total}.` };
  }

  if (index < links.length) {
    const linkIndex = location.links.indexOf(links[index]);
    const result = useLink(location, linkIndex, state);
    const targetId = result.targetId;

    if (result.journey) {
      exitLocation(location, state);
      return startJourney(state, result.journey, targetId, location.id);
    }

    exitLocation(location, state);
    setCurrentLocation(state, targetId);
    const next = getCurrentLocation(state);
    enterLocation(next, state);
    return {
      type: "transition",
      from: location.id,
      fromName: location.name,
      to: targetId,
      toName: next.name,
      context: getContext(state),
    };
  }

  index -= links.length;
  if (index < actions.length) {
    const actionIndex = location.actions.indexOf(actions[index]);
    const result = useAction(location, actionIndex, state);

    if (result.triggerScene) {
      setActiveScene(state, result.triggerScene);
      const scene = findSceneById(state, result.triggerScene);
      return {
        type: "scene_start",
        sceneId: result.triggerScene,
        sceneFiction: scene?.fiction,
        context: getContext(state),
      };
    }

    return {
      type: "action_done",
      actionId: result.action.id,
      actionLabel: result.action.label,
      context: getContext(state),
    };
  }

  index -= actions.length;
  if (index < npcs.length) {
    const npc = npcs[index];
    const dialogueDef = npc.dialogue[0];
    if (!dialogueDef) {
      return { type: "error", message: `${npc.name} has nothing to say.` };
    }

    const sceneId = `npc:${npc.id}:${dialogueDef.id}`;
    const scene = findSceneById(state, sceneId);
    if (!scene) {
      return { type: "error", message: `Dialogue scene "${sceneId}" not found.` };
    }

    setActiveScene(state, sceneId);
    return {
      type: "scene_start",
      sceneId,
      sceneFiction: scene.fiction,
      context: getContext(state),
    };
  }

  return { type: "error", message: "Invalid option." };
}

function handleFortune(state, command) {
  const pool = command.pool || 0;
  const result = fortuneRoll(pool);
  return {
    type: "fortune_result",
    pool: result.pool,
    results: result.results,
    outcome: result.outcome,
    context: getContext(state),
  };
}

function resetGuards(state) {
  for (const char of state.characters) {
    char.guard = char.maxGuard ?? 3;
    char.actionMods = null;
  }
}

function handleSelectOption(state, scene, index) {
  try {
    const result = selectOption(scene, index, state);
    const nextScene = result.triggerScene ? getActiveScene(state) : null;

    const missionSummary = result.missionSummary || updateMission(state);
    resetGuards(state);

    if (result.triggerScene) {
      const ns = findSceneById(state, result.triggerScene);
      return {
        type: "scene_start",
        sceneId: result.triggerScene,
        sceneFiction: ns?.fiction,
        missionSummary,
        context: getContext(state),
      };
     }

    const journeyResult = resolveJourney(state, scene);
    if (journeyResult) return journeyResult;

    return {
      type: "scene_end",
      missionSummary,
      context: getContext(state),
    };
  } catch (e) {
    return { type: "error", message: e.message };
  }
}

function handleAssist(state, command, characterIndex) {
  const assistChar = state.characters[command.characterIndex];
  if (!assistChar) return { type: "error", message: "Invalid assisting character." };

  if (command.characterIndex === characterIndex) {
    return { type: "error", message: "You can't assist yourself." };
  }

  if (!canSpendMomentum(state, 1)) {
    return { type: "error", message: `${assistChar.name} doesn't have enough momentum to assist (need 1).` };
  }

  spendMomentum(state, 1);

  // Store assist bonus for the next resolve action
  state.assistBonusDice = (state.assistBonusDice || 0) + 1;

  return {
    type: "assist_result",
    text: `${assistChar.name} assists! +1d to next action. (1 momentum spent)`,
    characterName: assistChar.name,
    context: getContext(state),
  };
}

function handleProtect(state, command, characterIndex) {
  const protectChar = state.characters[command.characterIndex];
  if (!protectChar) return { type: "error", message: "Invalid protecting character." };

  if (command.characterIndex === characterIndex) {
    return { type: "error", message: "You can't protect yourself." };
  }

  // Store protect target for the next resolve action
  state.protectTargetIndex = command.characterIndex;

  return {
    type: "protect_result",
    text: `${protectChar.name} steps in to protect ${state.characters[characterIndex]?.name || "an ally"}!`,
    characterName: protectChar.name,
    context: getContext(state),
  };
}

function handleSetUp(state, command, characterIndex) {
  const char = state.characters[characterIndex];
  if (!char) return { type: "error", message: "Invalid character." };

  const actionName = command.action;
  if (!char.actions[actionName]) {
    return { type: "error", message: `${char.name} doesn't have the action ${actionName}.` };
  }

  // Roll the setup action (no clock, no consequences)
  const roll = actionRoll(char, actionName, 0, 0, []);
  const outcomeLevel = roll.outcome.level;

  if (outcomeLevel === "failure") {
    return {
      type: "setup_result",
      text: `${char.name} sets up with ${actionName}... [${roll.pool}d] ${roll.results.join(", ")} → Failure. No benefit.`,
      context: getContext(state),
    };
  }

  // On success: grant next teammate a choice of +1d or +effect
  state.nextActionBonusDice = 1;
  state.nextActionChoice = "dice_or_effect";

  const outcomeLabel = roll.outcome.label;
  return {
    type: "setup_result",
    text: `${char.name} sets up with ${actionName}! [${roll.pool}d] ${roll.results.join(", ")} → ${outcomeLabel}. Next teammate chooses +1d or +effect.`,
    context: getContext(state),
  };
}

function handleResolveAction(state, scene, command, characterIndex) {
  const char = state.characters[command.characterIndex ?? characterIndex];
  if (!char) return { type: "error", message: "Invalid character." };

  const challenge = scene.challenges[command.challengeIndex];
  if (!challenge || challenge.resolved)
    return { type: "error", message: "Invalid or already resolved challenge." };

  const entry = challenge.actions[command.actionIndex];
  if (!entry) return { type: "error", message: "Invalid action." };

  let bonusDice = 0;
  let momentumSpent = false;
  let effectOverride = null;

  if (command.push) {
    if (!canSpendMomentum(state, 2))
      return { type: "error", message: "Not enough momentum to push. Need 2." };
    spendMomentum(state, 2);
    momentumSpent = true;
    if (command.pushForEffect) {
      // Push for effect: upgrade effect by one level
      effectOverride = increaseEffect(challenge.defaultEffect || "standard");
    } else {
      // Push for dice: +1d
      bonusDice = 1;
    }
  }

  // Apply assist bonus from Assist maneuver (consumed once)
  const assistBonus = state.assistBonusDice || 0;
  if (assistBonus > 0) {
    bonusDice += assistBonus;
    state.assistBonusDice = 0;
  }

  // Apply nextActionBonusDice from Set Up (consumed once)
  const setUpBonus = state.nextActionBonusDice || 0;
  if (setUpBonus > 0) {
    bonusDice += setUpBonus;
    state.nextActionBonusDice = 0;
    state.nextActionChoice = null;
  }

  // Apply protect target (consequence redirected to this character)
  const protectTarget = state.protectTargetIndex;
  if (protectTarget !== undefined && protectTarget !== null) {
    state.protectTargetIndex = null;
  }

  try {
    const crewStunts = state.crew?.stunts || [];
    const activeMission = getActiveMission(state);
    const outcome = resolveChallengeAction(
      challenge,
      entry,
      char,
      scene,
      state,
      bonusDice,
      crewStunts,
      momentumSpent,
      effectOverride,
    );

    if (activeMission && scene.heat) {
      const actionHeat = entry.heat ?? 3;
      addMissionHeat(
        state,
        heatForAction(outcome.roll.outcome.level, actionHeat),
      );
    }

    const sceneSummary = updateSceneResolution(scene, state);
    const missionSummary = updateMission(state);
    const summary = sceneSummary || missionSummary;

    if (isSceneResolved(scene)) resetGuards(state);

    if (challenge.resolved) {
      if (isSceneResolved(scene)) {
        const journeyResult = resolveJourney(state, scene);
        if (journeyResult) return journeyResult;
        return {
          type: "scene_end",
          sceneId: scene.id,
          challengeDesc: challenge.description,
          actionName: entry.actionName,
          roll: outcome.roll,
          result: outcome.result,
          missionSummary: summary,
          context: getContext(state),
        };
      }
      return {
        type: "challenge_done",
        sceneId: scene.id,
        challengeDesc: challenge.description,
        actionName: entry.actionName,
        roll: outcome.roll,
        result: outcome.result,
        missionSummary: summary,
        context: getContext(state),
      };
    }

    return {
      type: "roll_result",
      sceneId: scene.id,
      challengeDesc: challenge.description,
      actionName: entry.actionName,
      roll: outcome.roll,
      result: outcome.result,
      missionSummary: summary,
      context: getContext(state),
    };
  } catch (e) {
    return { type: "error", message: e.message };
  }
}

function handleGmCommand(state, command) {
  switch (command.sub) {
    case "downtime": {
      if (command.value) {
        const activeMission = getActiveMission(state);
        if (activeMission) {
          return { type: "error", message: "Can't start downtime while on a mission." };
        }
        startDowntime(state);
        return { type: "gm_result", text: "GM: Downtime started. Every character may perform 2 actions." };
      } else {
        clearDowntime(state);
        return { type: "gm_result", text: "GM: Downtime ended." };
      }
    }
    case "addHeat": {
      const faction = (state.factions || []).find((f) => f.id === command.factionId);
      if (!faction) {
        return { type: "error", message: `Unknown faction: ${command.factionId}` };
      }
      addFactionHeat(faction, command.amount);
      return { type: "gm_result", text: `GM: Added ${command.amount} heat to ${faction.name}. Heat is now ${faction.heat}.` };
    }
    default:
      return { type: "error", message: `Unknown GM command: ${command.sub}` };
  }
}

function handleDowntime(state, command, characterIndex) {
  const char = state.characters[characterIndex];
  if (!char) return { type: "error", message: "Invalid character." };
  if (!canDoActivity(state, characterIndex)) {
    return { type: "error", message: `${char.name} has no downtime activities remaining.` };
  }

  try {
    switch (command.action) {
      case "levelup": {
        const r = doLevelUp(state, characterIndex, command.param);
        if (r.choice === "stunt") {
          return { type: "downtime_result", text: `${r.character} gained stunt: ${r.stuntName}! ${r.xpRemaining} XP remaining. ${r.activitiesLeft} activities left.`, context: getContext(state) };
        }
        return { type: "downtime_result", text: `${r.character} leveled up ${r.action}: ${r.from}→${r.to}. ${r.xpRemaining} XP remaining. ${r.activitiesLeft} activities left.`, context: getContext(state) };
      }
      case "project": {
        const r = doProject(state, characterIndex, command.param);
        const clockText = `${r.clock.current}/${r.clock.max}${r.completed ? " \u2014 COMPLETE!" : ""}`;
        return { type: "downtime_result", text: `${r.character} worked on project. ${clockText}. ${r.activitiesLeft} activities left.`, context: getContext(state) };
      }
      case "recover": {
        const r = doRecovery(state, characterIndex);
        return { type: "downtime_result", text: `${r.character} recovered: body healed, conditions cleared. ${r.activitiesLeft} activities left.`, context: getContext(state) };
      }
      case "train": {
        const r = doTraining(state, characterIndex);
        return { type: "downtime_result", text: `${r.character} trained: +1 XP. ${r.activitiesLeft} activities left.`, context: getContext(state) };
      }
      default:
        return { type: "error", message: "Unknown downtime action. Use levelup or project." };
    }
  } catch (e) {
    return { type: "error", message: e.message };
  }
}

// Dispatch info/utility commands to the appropriate handler.
function handleInfoCommand(state, command, characterIndex) {
  switch (command.type) {
    case "help":
      return handleHelp(state);
    case "back":
      return handleBack(state);
    case "save":
      return { type: "save", name: command.name || "" };
    case "load":
      return { type: "load", name: command.name || "" };
    case "saves":
      return { type: "saves" };
    case "loadlevel":
      return handleLoadLevel(state, command, characterIndex);
    case "levelup":
      return handleLevelUp(state, characterIndex);
    default:
return { type: "error", message: "Unknown command." };
  }
}

function handleHelp(state) {
  const scene = getActiveScene(state);
  const loc = getCurrentLocation(state);
  if (!loc) return { type: "help", text: "Game not started." };

  const lines = ["Available commands:"];
  lines.push("• help — show this message");

  if (scene) {
    if (scene.type === "dialogue") {
      lines.push("• [number] — select a choice by number");
    } else {
      lines.push("• [action name] — roll an action on a challenge");
      lines.push("• [number] — select a choice by number");
    }
  } else {
    lines.push("• go [number] — select an option by number");
    lines.push("• act [number] — select an action by number");
    lines.push("• [number] — select a choice by number");
  }

  lines.push("• save [name] — save the game");
  lines.push("• saves — list saved games");
  lines.push("• load [name] — load a saved game");
  lines.push("• loadlevel <light|normal|heavy|N> — set max load (drops excess items)");
  lines.push("• levelup — spend 8 XP to improve an action or gain a stunt (opens a choice scene)");
  lines.push("• project <id> — downtime: advance a project clock (costs 1 activity)");
  lines.push("• recover — downtime: heal body, clear conditions (costs 1 activity)");
  lines.push("• train — downtime: gain 1 XP (costs 1 activity)");
  lines.push("• push <action> — push yourself (+1d, costs 2 momentum)");
  lines.push("• push effect <action> — push yourself (+effect, costs 2 momentum)");

  return { type: "help", text: lines.join("\n") };
}

function handleBack(state) {
  const scene = getActiveScene(state);
  if (scene) return { type: "error", message: "Can't leave an active scene." };
  return { type: "error", message: "There's nowhere to go back to." };
}

function handleLoadLevel(state, command, characterIndex) {
  const activeMission = getActiveMission(state);
  if (activeMission) {
    return { type: "error", message: "You can't change your load while on a mission." };
  }

  const char = state.characters[characterIndex];
  if (!char) return { type: "error", message: "Invalid character." };

  const result = setLoadLevel(char, command.level);

  let text = `Max load set to ${char.maxLoad}.`;
  if (result.dropped && result.dropped.length > 0) {
    text += ` Dropped: ${result.dropped.join(", ")}.`;
  }
  return { type: "loadlevel", text, maxLoad: char.maxLoad, dropped: result.dropped };
}

function handleToggleItem(state, command, characterIndex) {
  const char = state.characters[characterIndex];
  if (!char) return { type: "error", message: "Invalid character." };

  const activeMission = getActiveMission(state);
  const hasItem = char.inventory.some((i) => i.id === command.itemId);

  if (hasItem) {
    if (activeMission) {
      return { type: "error", message: "Cannot drop items during a mission." };
    }
    const item = char.inventory.find((i) => i.id === command.itemId);
    if (item && item.individual) {
      return { type: "error", message: "Individual items cannot be dropped through the gear panel." };
    }
    removeItem(char, command.itemId);
    return { type: "item_toggled", itemId: command.itemId, equipped: false, context: getContext(state) };
  }

  const available = getAvailableItems(char, state.items);
  const item = state.items.find((i) => i.id === command.itemId);
  if (!item || !available.some((i) => i.id === command.itemId)) {
    return { type: "error", message: `Item "${command.itemId}" is not available to this character.` };
  }

  const location = getCurrentLocation(state);
  if (!activeMission && location && !location.mayChangeInventory) {
    return { type: "error", message: "You can only change gear at locations with equipment access." };
  }

  const effectiveMax = activeMission ? char.maxLoad : 10;
  if (char.load + item.load > effectiveMax) {
    return { type: "error", message: `Cannot equip ${item.name} — exceeds max load of ${effectiveMax}.` };
  }

  if (activeMission && command.itemId && char.inventory.some((i) => i.id === command.itemId)) {
    return { type: "error", message: "Cannot equip more than one of the same item." };
  }

  addItem(char, item);
  return { type: "item_toggled", itemId: command.itemId, equipped: true, context: getContext(state) };
}

function handleActionParse(state, scene, command, characterIndex) {
  const visible = getVisibleChallenges(scene, state);
  for (let ci = 0; ci < visible.length; ci++) {
    const ch = visible[ci];
    for (let ai = 0; ai < ch.actions.length; ai++) {
      const a = ch.actions[ai];
      if (a.actionName.toLowerCase() === command.text.toLowerCase()) {
        return handleResolveAction(
          state,
          scene,
          {
            type: "resolve",
            challengeIndex: scene.challenges.indexOf(ch),
            actionIndex: ai,
            characterIndex,
            push: command.push,
            pushForEffect: command.pushForEffect,
          },
          characterIndex,
        );
      }
    }
  }
  return { type: "error", message: `You can't use "${command.text}" here.` };
}

function findActionByText(actions, text) {
  const lower = text.toLowerCase();
  return actions.find(
    (a) =>
      a.label.toLowerCase() === lower ||
      a.label.toLowerCase().includes(lower) ||
      lower.includes(a.label.toLowerCase()),
  );
}

function checkCondition(condition, state) {
  if (!condition) return true;
  if (typeof condition === "function") return condition(state);
  if (condition.flag && !state.flags[condition.flag]) return false;
  if (condition.notFlag && state.flags[condition.notFlag]) return false;
  return true;
}
