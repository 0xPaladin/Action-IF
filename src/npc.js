/**
 * ### NPCs
 *
 * `npc.js` models non-player characters that exist at locations and provide dialogue interactions.
 *
 * NPC {
 *   id: string
 *   name: string
 *   faction: string | null
 *   location: string            // location ID where NPC resides
 *   description: string
 *   actions: NPCAction[]
 *   dialogue: NPCDialogue[]
 *   onEnter?: Hook | null
 *   onExit?: Hook | null
 * }
 *
 * NPCAction {
 *   id, label, description, once, used, triggerDialogue, setFlag, provideKeys, condition, hooks
 * }
 *
 * NPCDialogue {
 *   id, fiction, tags, options, onEnter, onExit
 * }
 *
 * DialogueOption {
 *   text, setFlag, triggerDialogue, condition, hooks
 * }
 *
 * Player Flow — NPC Interaction:
 * 1. Enter location → NPC onEnter fires → NPCs listed under "Talk to:"
 * 2. Player types `talk N` to start NPC's first dialogue
 * 3. NPC dialogue displays fiction + options
 * 4. Player selects option
 * 5. Option sets flag, resolves hooks, may chain to another dialogue
 * 6. If no triggerDialogue, returns to location context
 */
import { createScene, createOption } from "./scene.js";

export function createNPC(def) {
  return {
    id: def.id,
    name: def.name,
    faction: def.faction || null,
    location: def.location,
    description: def.description || "",
    actions: (def.actions || []).map((a) => ({
      id: a.id,
      label: a.label,
      description: a.description || "",
      once: a.once || false,
      used: false,
      triggerScene: a.triggerScene || null,
      setFlag: a.setFlag || null,
      provideKeys: a.provideKeys || [],
      condition: a.condition || null,
      hooks: a.hooks || null,
    })),
    dialogue: def.dialogue || [],
    onEnter: def.onEnter || null,
    onExit: def.onExit || null,
  };
}

export function createNPCDialogueScene(npcId, dialogueDef, allDialogues) {
  const sceneId = `npc:${npcId}:${dialogueDef.id}`;
  const scene = createScene(
    sceneId,
    "dialogue",
    dialogueDef.fiction,
    dialogueDef.tags || [],
    resolveDialogueTrigger(npcId, dialogueDef.triggerScene, allDialogues),
    dialogueDef.onEnter || null,
    dialogueDef.onExit || null,
    dialogueDef.heat || false,
  );

  if (dialogueDef.tickFactionClockOnResolve) {
    scene.tickFactionClockOnResolve = dialogueDef.tickFactionClockOnResolve;
  }

  for (const optionDef of dialogueDef.options || []) {
    scene.options.push(
      createOption(
        optionDef.text,
        optionDef.setFlag || null,
        resolveDialogueTrigger(npcId, optionDef.triggerScene, allDialogues),
        optionDef.condition || null,
        optionDef.hooks || null,
        optionDef.tickFactionClock || null,
      ),
    );
  }

  return scene;
}

function resolveDialogueTrigger(npcId, triggerScene, allDialogues) {
  if (!triggerScene) return null;
  const dialogueIds = (allDialogues || []).map((d) => d.id);
  if (dialogueIds.includes(triggerScene)) {
    return `npc:${npcId}:${triggerScene}`;
  }
  return triggerScene;
}

export function getNPCDialogue(state, npcId, dialogueId) {
  const sceneId = `npc:${npcId}:${dialogueId}`;
  return state.scenes.find((s) => s.id === sceneId) || null;
}