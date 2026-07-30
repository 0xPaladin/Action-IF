// Utility helpers for the Action-IF WebUI.
// Pure functions: game definition merging, state serialization,
// result formatting, and context-to-text rendering.

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
export function abbreviate(text, max = 50) {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max) + "…";
}

// Compose a scene/challenge/action label for scene-based results.
export function formatSceneActionLabel(result) {
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
export function getChallengeFullIdx(state, challengeId) {
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

// Determine the risk label from a consequence object.
export function getRiskLabel(consequence) {
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
export function getRiskLabelFromResult(consequenceResult) {
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
export function formatDangerTrigger(trigger) {
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
export function fmtTime(ts) {
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
