export function parseInput(text) {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;

  // Pure number → index selection
  if (/^\d+$/.test(trimmed)) {
    return { type: "select", index: parseInt(trimmed, 10) - 1 };
  }

  // "option 2", "opt 2", "choice 3"
  const optMatch = trimmed.match(/^(?:option|opt|choice)\s+(\d+)$/);
  if (optMatch) {
    return { type: "select", index: parseInt(optMatch[1], 10) - 1 };
  }

  // "go 3" — go to link by number
  const goNumMatch = trimmed.match(/^go\s+(\d+)$/);
  if (goNumMatch) {
    return { type: "go_num", index: parseInt(goNumMatch[1], 10) - 1 };
  }

  // "act 3" — perform an action by number
  const actNumMatch = trimmed.match(/^act\s+(\d+)$/);
  if (actNumMatch) {
    return { type: "act_num", index: parseInt(actNumMatch[1], 10) - 1 };
  }

  // "push effect <action>" — push yourself (+effect, costs 2 momentum)
  const pushEffectMatch = trimmed.match(/^push\s+effect\s+(.+)$/);
  if (pushEffectMatch) {
    const actionText = pushEffectMatch[1].trim();
    const capped = actionText.charAt(0).toUpperCase() + actionText.slice(1).toLowerCase();
    return { type: "action", text: capped, push: true, pushForEffect: true };
  }

  // "push <action>" — push yourself (+1d, costs 2 momentum)
  const pushMatch = trimmed.match(/^push\s+(.+)$/);
  if (pushMatch) {
    const actionText = pushMatch[1].trim();
    const capped = actionText.charAt(0).toUpperCase() + actionText.slice(1).toLowerCase();
    return { type: "action", text: capped, push: true };
  }

  // "talk 1" — talk to NPC by index
  const talkMatch = trimmed.match(/^talk\s+(\d+)$/);
  if (talkMatch) {
    return { type: "talk", index: parseInt(talkMatch[1], 10) - 1 };
  }

  // "assist <charIndex>" — assist a teammate (costs 1 momentum, +1d)
  const assistMatch = trimmed.match(/^assist\s+(\d+)$/);
  if (assistMatch) {
    return { type: "assist", characterIndex: parseInt(assistMatch[1], 10) - 1 };
  }

  // "setup <action>" — set up a teammate (roll for indirect benefit)
  const setupMatch = trimmed.match(/^setup\s+(.+)$/);
  if (setupMatch) {
    const actionText = setupMatch[1].trim();
    const capped = actionText.charAt(0).toUpperCase() + actionText.slice(1).toLowerCase();
    return { type: "setup", action: capped };
  }

  // "fortune <pool>" — fortune roll
  const fortuneMatch = trimmed.match(/^fortune\s+(\d+)$/);
  if (fortuneMatch) {
    return { type: "fortune", pool: parseInt(fortuneMatch[1], 10) };
  }
  if (trimmed === "fortune") {
    return { type: "fortune", pool: 0 };
  }

  // "gm <subcommand> [args]" — GM commands (hidden from help)
  const gmMatch = trimmed.match(/^gm\s+(.+)$/);
  if (gmMatch) {
    const sub = gmMatch[1].trim();
    const downtimeMatch = sub.match(/^downtime\s+(true|false)$/);
    if (downtimeMatch) {
      return { type: "gm", sub: "downtime", value: downtimeMatch[1] === "true" };
    }
    const addHeatMatch = sub.match(/^addheat\s+(\S+)\s+(-?\d+)$/);
    if (addHeatMatch) {
      return { type: "gm", sub: "addHeat", factionId: addHeatMatch[1], amount: parseInt(addHeatMatch[2], 10) };
    }
    return { type: "error", message: `Unknown GM command: ${sub}` };
  }

  // "help" — show contextual command list
  if (trimmed === "help" || trimmed === "commands" || trimmed === "?") {
    return { type: "help" };
  }

  // "loadlevel [light|normal|heavy|N]" — set max load
  const loadlevelMatch = trimmed.match(/^loadlevel\s+(light|normal|heavy|\d+)$/);
  if (loadlevelMatch) {
    const level = loadlevelMatch[1];
    return { type: "loadlevel", level: isNaN(level) ? level : parseInt(level, 10) };
  }

  // "equip <item name>" / "unequip <item name>" — toggle items
  const equipMatch = trimmed.match(/^(equip|unequip)\s+(.+)$/);
  if (equipMatch) {
    return { type: "toggleitem", itemId: equipMatch[2].trim() };
  }

  // "levelup" or "levelup <action>" or "levelup stunt" — spend 8 XP to upgrade an action or gain a stunt
  const levelupMatch = trimmed.match(/^levelup(?:\s+(.+))?$/);
  if (levelupMatch) {
    const param = levelupMatch[1];
    if (param) {
      const capped = param.charAt(0).toUpperCase() + param.slice(1).toLowerCase();
      return { type: "downtime", action: "levelup", param: capped };
    }
    return { type: "levelup" };
  }

  // "project <id>" — downtime project (e.g. "project fortify_defenses")
  const projectMatch = trimmed.match(/^project\s+(.+)$/);
  if (projectMatch) {
    return { type: "downtime", action: "project", param: projectMatch[1].trim() };
  }

  // "recover" / "recovery" / "heal" — downtime recovery
  if (trimmed === "recover" || trimmed === "recovery" || trimmed === "heal") {
    return { type: "downtime", action: "recover" };
  }

  // "train" — downtime training
  if (trimmed === "train") {
    return { type: "downtime", action: "train" };
  }

  // "back" / "exit" — leave current scene
  if (trimmed === "back" || trimmed === "exit") {
    return { type: "back" };
  }

  // "save [name]" — save game
  const saveMatch = trimmed.match(/^save\s+(.+)$/);
  if (saveMatch) {
    return { type: "save", name: saveMatch[1].trim() };
  }
  if (trimmed === "save") {
    return { type: "save", name: "" };
  }

  // "load [name]" — load game
  const loadMatch = trimmed.match(/^load\s+(.+)$/);
  if (loadMatch) {
    return { type: "load", name: loadMatch[1].trim() };
  }
  if (trimmed === "load") {
    return { type: "load", name: "" };
  }

  // "saves" — list saved games
  if (trimmed === "saves" || trimmed === "list saves" || trimmed === "saved games") {
    return { type: "saves" };
  }

  // "use <item>" — location action by label match
  const words = trimmed.split(/\s+/);
  if (words[0] === "use" || words[0] === "take" || words[0] === "activate" || words[0] === "pull") {
    return { type: "action", text: words.slice(1).join(" ") || words[0] };
  }

  // Single word — try action name match for challenges ("sway", "muscle", etc.)
  // or location action match ("search", "examine")
  if (words.length === 1) {
    return { type: "action", text: words[0] };
  }

  // Multi-word verb phrase — try as action
  return { type: "action", text: trimmed };
}
