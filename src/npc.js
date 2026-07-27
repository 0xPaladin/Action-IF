import { createScene } from "./scene.js";

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
      triggerDialogue: a.triggerDialogue || null,
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
  const scene = createScene(sceneId, "dialogue", dialogueDef.fiction, dialogueDef.tags || []);
  
  for (const optionDef of dialogueDef.options || []) {
    let triggerScene = null;
    if (optionDef.triggerDialogue) {
      triggerScene = `npc:${npcId}:${optionDef.triggerDialogue}`;
    }
    
    scene.options.push({
      text: optionDef.text,
      setFlag: optionDef.setFlag || null,
      triggerScene,
      condition: optionDef.condition || null,
      hooks: optionDef.hooks || null,
    });
  }
  
  return scene;
}

export function getNPCDialogue(state, npcId, dialogueId) {
  const sceneId = `npc:${npcId}:${dialogueId}`;
  return state.scenes.find((s) => s.id === sceneId) || null;
}