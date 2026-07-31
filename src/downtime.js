/**
 * ### Downtime
 *
 * `downtime.js` manages the between-scores phase where characters recuperate and advance.
 * Each downtime phase grants 2 activities per character.
 *
 * Downtime is automatically entered after a mission completes.
 *
 * API:
 * - `startDowntime(state)` — sets every character's `downtimeRemaining` to 2
 * - `canDoActivity(state, charIndex)` / `activitiesRemaining(state, charIndex)` — check remaining activities
 * - `doRecovery(state, characterIndex)` — heals + clears conditions (uses 1 activity)
 * - `doTraining(state, characterIndex)` — gains 1 XP (uses 1 activity)
 * - `doLevelUp(state, characterIndex, choice)` — levels up a character (8 XP required)
 * - `createProject(id, description, clockMax, onComplete)` — creates a long-term project
 * - `doProject(state, characterIndex, projectId)` — advances a project clock
 *
 * Project Presets:
 * - `fortifyDefensesProject()` — 4-tick clock, +1 maxGuard (capped at 5)
 * - `trainActionProject()` — 6-tick clock, +1 XP
 * - `cultivateContactProject(factionId)` — 4-tick clock, -1 heat with faction
 * - `craftItemProject(itemId)` — 6-tick clock, adds item to inventory
 */
import { tickHealing, restCharacter, addItem, addStunt } from "./character.js";
import { createStunt } from "./stunt.js";
import { addLogEntry } from "./state.js";
import { addHeat as addFactionHeat } from "./faction.js";
import { resolveHook } from "./hook.js";

export const LEVEL_UP_COST = 8;

export function startDowntime(state) {
  for (const char of state.characters) {
    char.downtimeRemaining = 2;
  }
  return state;
}

export function clearDowntime(state) {
  for (const char of state.characters) {
    char.downtimeRemaining = 0;
  }
  return state;
}

export function activitiesRemaining(state, characterIndex) {
  const char = state.characters[characterIndex];
  return char ? (char.downtimeRemaining || 0) : 0;
}

export function canDoActivity(state, characterIndex) {
  return activitiesRemaining(state, characterIndex) > 0;
}

function useActivity(char) {
  if ((char.downtimeRemaining || 0) <= 0) {
    throw new Error(`${char.name} has no downtime activities remaining`);
  }
  char.downtimeRemaining--;
}

export function doRecovery(state, characterIndex) {
  const char = state.characters[characterIndex];
  if (!char) throw new Error(`Character index ${characterIndex} not found`);

  const cleared = char.conditions.length;
  tickHealing(char);
  restCharacter(char);
  useActivity(char);

  return {
    type: "recovery",
    character: char.name,
    healing: char.healing,
    conditionsCleared: cleared,
    activitiesLeft: char.downtimeRemaining,
  };
}

export function doTraining(state, characterIndex) {
  const char = state.characters[characterIndex];
  if (!char) throw new Error(`Character index ${characterIndex} not found`);

  char.xp = (char.xp || 0) + 1;
  useActivity(char);

  return {
    type: "training",
    character: char.name,
    xpGained: 1,
    xpTotal: char.xp,
    canLevelUp: char.xp >= LEVEL_UP_COST,
    activitiesLeft: char.downtimeRemaining,
  };
}

export function doLevelUp(state, characterIndex, choice) {
  const char = state.characters[characterIndex];
  if (!char) throw new Error(`Character index ${characterIndex} not found`);

  if ((char.xp || 0) < LEVEL_UP_COST) {
    throw new Error(`Need ${LEVEL_UP_COST} XP to level up, have ${char.xp || 0}`);
  }

  char.xp -= LEVEL_UP_COST;

  if (choice === "stunt") {
    const stuntChoices = char.stuntChoices || [];
    if (!stuntChoices.length) {
      throw new Error(`${char.name} has no stunt choices available`);
    }
    const stuntDef = stuntChoices[0];
    const stunt = createStunt(
      stuntDef.id,
      stuntDef.name,
      stuntDef.description,
      stuntDef.tags || [],
      stuntDef.effects || {},
    );
    addStunt(char, stunt);
    addLogEntry(state, {
      type: "system",
      text: `${char.name} gained stunt: ${stunt.name}!`,
    });
    return {
      type: "levelup",
      character: char.name,
      choice: "stunt",
      stuntName: stunt.name,
      xpRemaining: char.xp,
      activitiesLeft: char.downtimeRemaining,
    };
  }

  const current = char.actions[choice];
  if (current === undefined) throw new Error(`Unknown action "${choice}"`);
  if (current >= 4) throw new Error(`"${choice}" is already at max (4)`);

  char.actions[choice] = current + 1;
  addLogEntry(state, {
    type: "system",
    text: `${char.name}"s ${choice} increased to ${current + 1}!`,
  });
  return {
    type: "levelup",
    character: char.name,
    choice: "action",
    action: choice,
    from: current,
    to: current + 1,
    xpRemaining: char.xp,
    activitiesLeft: char.downtimeRemaining,
  };
}

export function createProject(id, description, clockMax, onComplete = null) {
  return { id, description, clock: { max: clockMax, current: 0 }, completed: false, onComplete };
}

export function doProject(state, characterIndex, projectId) {
  const char = state.characters[characterIndex];
  if (!char) throw new Error(`Character index ${characterIndex} not found`);

  const project = char.projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project "${projectId}" not found for ${char.name}`);

  const wasCompleted = project.completed;
  project.clock.current = Math.min(project.clock.max, project.clock.current + 1);
  if (project.clock.current >= project.clock.max) {
    project.completed = true;
  }

  if (!wasCompleted && project.completed && project.onComplete) {
    resolveHook(state, project.onComplete, { character: char, project });
  }

  useActivity(char);

  return {
    type: "project",
    character: char.name,
    projectId,
    clock: { current: project.clock.current, max: project.clock.max },
    completed: project.completed,
    activitiesLeft: char.downtimeRemaining,
  };
}

export function fortifyDefensesProject() {
  return createProject(
    "fortify_defenses",
    "Fortify Defenses — push your physical limits to withstand more harm.",
    4,
    (state, { character }) => {
      const currentMax = character.maxGuard ?? 3;
      const newMax = Math.min(currentMax + 1, 5);
      character.maxGuard = newMax;
      if (character.guard != null) {
        character.guard = Math.min(character.guard + 1, newMax);
      }
      addLogEntry(state, {
        type: "system",
        text: `${character.name}"s Guard max increased to ${newMax}!`,
      });
    },
  );
}

export function trainActionProject() {
  return createProject(
    "train_action",
    "Train Action — dedicated practice to earn XP for a level-up.",
    6,
    (state, { character }) => {
      character.xp = (character.xp || 0) + 1;
      addLogEntry(state, {
        type: "system",
        text: `${character.name} earned 1 XP from training!`,
      });
    },
  );
}

export function cultivateContactProject(factionId) {
  return createProject(
    "cultivate_contact",
    "Cultivate Contact — develop a relationship with a faction contact.",
    4,
    (state) => {
      const faction = (state.factions || []).find((f) => f.id === factionId);
      if (faction) {
        addFactionHeat(faction, -1);
        addLogEntry(state, {
          type: "system",
          text: `Heat with ${faction.name} reduced!`,
        });
      }
    },
  );
}

export function craftItemProject(itemId) {
  return createProject(
    "craft_item",
    "Craft Custom Gear — build a signature piece of equipment.",
    6,
    (state, { character }) => {
      const item = (state.items || []).find((i) => i.id === itemId);
      if (item) {
        addItem(character, item);
        addLogEntry(state, {
          type: "system",
          text: `${character.name} crafted ${item.name}!`,
        });
      }
    },
  );
}
