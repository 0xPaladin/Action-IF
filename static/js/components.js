// Preact presentational components for the Action-IF terminal-style WebUI.
// All components use htm template literals and are exported for use by App.

import { h } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import htm from "htm";
import { getAvailableItems } from "/src/character.js";
import {
  getChallengeFullIdx,
  getRiskLabel,
  fmtTime,
} from "./helpers.js";

const html = htm.bind(h);

// Scrollable log of system, player, result, and context messages.
export function OutputArea({ messages, onCommand, gameState, engine }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return html`
    <div class="output">
      ${messages.map(
        (msg, i) => html`
          <${MessageRow}
            key=${i}
            msg=${msg}
            onCommand=${onCommand}
            gameState=${gameState}
            engine=${engine}
          />
        `,
      )}
      <div ref=${bottomRef} />
    </div>
  `;
}

// Render one message row, delegating context to interactive buttons.
export function MessageRow({ msg, onCommand, gameState, engine }) {
  if (msg.intro) return null;
  switch (msg.type) {
    case "system":
      return html`<div class="msg msg-system">${msg.text}</div>`;
    case "player":
      return html`<div class="msg msg-player">
        <span class="prompt">></span>${msg.text}
      </div>`;
    case "result":
      return html`<div class="msg msg-result">${msg.text}</div>`;
    case "mission_complete":
      return html`<div class="msg msg-mission">${msg.text}</div>`;
    case "divider":
      return html`<hr class="divider" />`;
    case "context":
      return html`
        <div class="context-bar"></div>
        <${ContextView}
          ctx=${msg.context}
          onCommand=${onCommand}
          gameState=${gameState}
          engine=${engine}
        />
      `;
    default:
      return null;
  }
}

// Render the interactive view for a location or active scene context.
export function ContextView({ ctx, onCommand, gameState, engine }) {
  if (!ctx) return null;

  if (ctx.type === "location") {
    return html`
      <div class="context location">
        <div class="loc-name">${ctx.name}</div>
        <div class="loc-desc">${ctx.description}</div>
        ${ctx.missionName
          ? html`<div class="mission-info">
              <span>Mission: ${ctx.missionName}</span>
              <span class="mission-detail"
                >Momentum: ${ctx.momentum ?? 2}</span
              >
            </div>`
          : ""}
        ${ctx.links?.length
          ? html`
              <div class="section-label">You can go:</div>
              <div class="options">
                ${ctx.links.map(
                  (l) => html`
                    <${OptionButton}
                      label=${l.label}
                      cmd=${{ type: "go_num", index: l.index }}
                      locked=${l.locked}
                      onCommand=${onCommand}
                    />
                  `,
                )}
              </div>
            `
          : ""}
        ${ctx.actions?.length
          ? html`
              <div class="section-label">Actions:</div>
              <div class="options">
                ${ctx.actions.map(
                  (a) => html`
                    <${OptionButton}
                      label=${a.label}
                      cmd=${{ type: "action", text: a.label }}
                      onCommand=${onCommand}
                    />
                  `,
                )}
              </div>
            `
          : ""}
        ${ctx.npcs?.length
          ? html`
              <div class="section-label">Talk to:</div>
              <div class="options">
                ${ctx.npcs.map(
                  (npc) => html`
                    <${OptionButton}
                      label=${npc.name}
                      cmd=${{ type: "talk", index: npc.index }}
                      onCommand=${onCommand}
                    />
                    ${npc.actions?.length
                      ? html`
                          <div class="npc-actions">
                            ${npc.actions.map(
                              (a) => html`
                                <${OptionButton}
                                  label=${a.label}
                                  cmd=${{ type: "action", text: a.label }}
                                  onCommand=${onCommand}
                                />
                              `,
                            )}
                          </div>
                        `
                      : ""}
                  `,
                )}
              </div>
            `
          : ""}
      </div>
    `;
  }

  if (ctx.type === "scene") {
    return html`
      <div class="context scene">
        ${ctx.missionName
          ? html` <div class="mission-info">
              <span class="mission-name">${ctx.missionName}</span>
              <span class="mission-detail"
                >Momentum: ${ctx.momentum ?? 2}</span
              >
              <span class="mission-detail"
                >Danger:
                ${ctx.dangerClock ? ctx.dangerClock.current : "—"}</span
              >
              <span class="mission-detail"
                >Heat: ${(ctx.heatGenerated || 0) + (ctx.baseHeat || 0)}</span
              >
            </div>`
          : ""}
        <div class="scene-fiction">${ctx.fiction}</div>
        ${ctx.tags?.length
          ? html`<div class="tag-list">
              Tags: ${ctx.tags.map((t, i) => html`${i > 0 ? ", " : ""}${t}`)}
            </div>`
          : ""}
        ${ctx.sceneType === "action" && ctx.challenges?.length
          ? html`
              <div class="section-label">Challenges:</div>
              ${ctx.challenges.map(
                (c) => html`
                  <${ChallengeBlock}
                    challenge=${c}
                    onCommand=${onCommand}
                    gameState=${gameState}
                    sceneId=${ctx.sceneId}
                  />
                `,
              )}
              ${ctx.resolvedChallenges != null
                ? html`
                    <div
                      class="msg msg-system"
                      style="margin-top:4px;font-size:12px;"
                    >
                      ${ctx.resolvedChallenges}/${ctx.totalChallenges} resolved
                    </div>
                  `
                : ""}
            `
          : ""}
        ${ctx.sceneType === "dialogue" && ctx.options?.length
          ? html`
              <div class="section-label">Choose:</div>
              <div class="options">
                ${ctx.options.map(
                  (o) => html`
                    <${OptionButton}
                      label=${o.text}
                      cmd=${{ type: "select", index: o.index }}
                      disabled=${!o.available}
                      keyLabel=${String(o.index + 1)}
                      onCommand=${onCommand}
                    />
                  `,
                )}
              </div>
            `
          : ""}
      </div>
    `;
  }

  return html`<div class="context">...</div>`;
}

// Single unresolved challenge with clock and selectable action entries.
export function ChallengeBlock({ challenge, onCommand, gameState, sceneId }) {
  const challengeIdx = gameState
    ? getChallengeFullIdx(gameState, challenge.id)
    : -1;
  if (challengeIdx < 0)
    return html`<div class="challenge">Unknown challenge</div>`;

  const max = challenge.clock.max;
  const current = challenge.clock.current;

  return html`
    <div class="challenge">
      <div class="challenge-clock-topright">
        ${Array.from({ length: max }).map(
          (_, i) => html`
            <span
              class="clock-box ${i < current ? "filled" : ""}"
              key=${i}
            ></span>
          `,
        )}
      </div>
      <div class="challenge-desc">${challenge.description}</div>
      ${challenge.tags?.length
        ? html`<div class="tag-list" style="margin-bottom:4px;">
            Tags:
            ${challenge.tags.map((t, i) => html`${i > 0 ? ", " : ""}${t}`)}
          </div>`
        : ""}
      <div class="action-entries">
        ${gameState?.characters?.length > 1 && (gameState.momentum ?? 2) >= 1
          ? html`<div class="teamwork-row" style="margin-bottom:4px;">
              <span style="font-size:11px;font-weight:600;">Teamwork:</span>
              ${gameState.characters.map((c, ci) => html`
                <button
                  class="btn"
                  style="font-size:10px;padding:1px 4px;"
                  key=${ci}
                  onClick=${() => onCommand({ type: "assist", characterIndex: ci })}
                >
                  Assist ${c.name} (1mp)
                </button>
              `)}
              <button
                class="btn"
                style="font-size:10px;padding:1px 4px;"
                onClick=${() => onCommand({ type: "setup", action: "Notice" })}
              >
                Set Up (Notice)
              </button>
            </div>`
          : ""}
        ${challenge.actions.map(
          (a, ai) => html`
            <div class="action-row" key=${ai}>
              <button
                class="action-btn"
                onClick=${() =>
                  onCommand({
                    type: "resolve",
                    challengeIndex: challengeIdx,
                    actionIndex: ai,
                  })}
              >
                <span class="action-name">${a.actionName}</span>
                <span class="action-risk">☇ ${getRiskLabel(a.consequences)}</span>
              </button>
              <button
                class="action-btn push-btn"
                disabled=${(gameState?.momentum ?? 2) < 2}
                title=${(gameState?.momentum ?? 2) < 2 ? "Need 2 momentum" : "Push yourself (+1d, costs 2 momentum)"}
                onClick=${() =>
                  onCommand({
                    type: "resolve",
                    challengeIndex: challengeIdx,
                    actionIndex: ai,
                    push: true,
                  })}
              >
                <span class="action-name">Push</span>
                <span class="action-risk">+1d</span>
              </button>
              <button
                class="action-btn push-btn"
                disabled=${(gameState?.momentum ?? 2) < 2}
                title=${(gameState?.momentum ?? 2) < 2 ? "Need 2 momentum" : "Push yourself (+effect, costs 2 momentum)"}
                onClick=${() =>
                  onCommand({
                    type: "resolve",
                    challengeIndex: challengeIdx,
                    actionIndex: ai,
                    push: true,
                    pushForEffect: true,
                  })}
              >
                <span class="action-name">Push</span>
                <span class="action-risk">+eff</span>
              </button>
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

// Reusable button for location links, scene options, and location actions.
export function OptionButton({ label, cmd, locked, disabled, onCommand, keyLabel }) {
  const display = keyLabel
    ? html`<span class="btn-num">${keyLabel}</span>`
    : null;
  const cls = locked ? "btn" : "btn";

  return html`
    <button
      class=${cls}
      disabled=${disabled || locked}
      onClick=${() => onCommand(cmd)}
      title=${locked ? "Locked" : label}
    >
      ${display}${locked ? `${label} 🔒` : label}
    </button>
  `;
}

// Terminal-style text input with command history navigation.
export function CommandInput({
  value,
  onChange,
  onSubmit,
  history,
  historyIdx,
  setHistoryIdx,
}) {
  const inputRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        const v = value.trim();
        if (v) {
          onSubmit(v);
          onChange("");
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        const newIdx =
          historyIdx < history.length - 1 ? historyIdx + 1 : historyIdx;
        setHistoryIdx(newIdx);
        onChange(history[newIdx]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx <= 0) {
          setHistoryIdx(-1);
          onChange("");
        } else {
          const newIdx = historyIdx - 1;
          setHistoryIdx(newIdx);
          onChange(history[newIdx]);
        }
      }
    },
    [value, onChange, onSubmit, history, historyIdx, setHistoryIdx],
  );

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.target.closest(".modal")) return;
      inputRef.current?.focus();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return html`
    <div class="input-line">
      <span class="input-prompt">></span>
      <input ref=${inputRef} class="input-field" type="text"
        value=${value}
        onInput=${(e) => onChange(e.target.value)}
        onKeyDown=${handleKeyDown}
        placeholder="type a command... or \"help\" for basics"
        autocomplete="off" spellcheck="false"
      />
    </div>
  `;
}

// Top bar: clickable game title left, save button + help right.
export function Header({ gameName, saveLabel, onTitleClick, onGameClick, onHelp }) {
  return html`
    <div class="header">
      <button class="header-title-btn" onClick=${onTitleClick}>
        <span class="header-title">${gameName}</span>
      </button>
      <div class="header-right">
        <button class="header-btn" onClick=${onGameClick}>${saveLabel}</button>
        <button class="header-btn" onClick=${onHelp}>?</button>
      </div>
    </div>
  `;
}

// Collapsible panel: mode='crew' shows crew stats, mode='character' shows character stats.
export function SidePanel({
  mode,
  state,
  activeChar,
  onMission,
  availableItems,
  onClose,
  onCommand,
  factionId,
}) {
  const [gearDropdown, setGearDropdown] = useState(false);
  const gearDropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (
        gearDropdownRef.current &&
        !gearDropdownRef.current.contains(e.target)
      ) {
        setGearDropdown(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const char = state.characters?.[activeChar];
  const crew = state.crew;
  const faction = factionId
    ? state.factions?.find((f) => f.id === factionId)
    : null;
  const charItems = char?.inventory || [];
  const charItemIds = new Set(charItems.map((i) => i.id));
  const location = state.locations?.find((l) => l.id === state.currentLocation);
  const mayChangeInventory = location?.mayChangeInventory ?? false;
  const effectiveMaxLoad = onMission ? (char?.maxLoad ?? 5) : 10;
  const individualItems = charItems.filter((i) => i.individual);
  const regularItems = charItems.filter((i) => !i.individual);

  const hasDowntime = char && (char.downtimeRemaining || 0) > 0;
  const canLevelUp = char && (char.xp || 0) >= 8;

  // Check if there's at least one upgradeable action or available stunt
  const hasUpgradeableAction =
    char && Object.values(char.actions || {}).some((v) => v < 4);
  const availableStunts =
    char &&
    (char.stuntChoices || []).length > 0
      ? (char.stuntChoices || []).filter(
          (s) => !char.stunts.some((hs) => hs.id === s.id),
        )
      : (state.gameStunts || []).filter(
          (s) => !char?.stunts.some((hs) => hs.id === s.id),
        );
  const hasAvailableStunt = availableStunts.length > 0;
  const canLevelUpFull = canLevelUp && (hasUpgradeableAction || hasAvailableStunt);

  const projectButtons =
    char &&
    (char.projects || [])
      .filter((p) => !p.completed)
      .map(
        (p) =>
          html`<button
            class="btn"
            style="font-size:11px;padding:2px 6px;"
            key=${p.id}
            onClick=${() =>
              onCommand({ type: "downtime", action: "project", param: p.id })}
          >
            ${p.description} [${p.clock.current}/${p.clock.max}]
          </button>`,
      );

  const crewUpgrades = (crew?.upgrades || []).map((id) => {
    const def = crew?.type?.upgrades?.find((u) => u.id === id);
    return def ? def.name : id;
  });
  const crewClaims = (crew?.claims || []).map((id) => {
    const c = state.claims?.find((cl) => cl.id === id);
    return c ? c.name : id;
  });

  return html`
    <div class="sidebar">
      <button class="sidebar-close" onClick=${onClose}>×</button>

      ${mode === "crew" && crew
        ? html`
            <div class="sidebar-section">
              <h3>Crew</h3>
              <div class="stat-row">
                <span class="stat-label">Name</span>
                <span>${crew.name}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Type</span>
                <span>${crew.description || crew.name}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Coin</span>
                <span>${crew.coin || 0}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Rep</span>
                <span>${crew.reputation || 0}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Hold</span>
                <span>${crew.hold || "—"}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">XP</span>
                <span>${crew.xp || 0}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Momentum</span>
                <span>${state.momentum ?? 2}</span>
              </div>
              ${crew.stunts?.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Stunts</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${crew.stunts.map((s) => s.name).join(", ")}
                    </div>`
                : ""}
              ${crewUpgrades.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Upgrades</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${crewUpgrades.join(", ")}
                    </div>`
                : ""}
              ${crewClaims.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Claims</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${crewClaims.join(", ")}
                    </div>`
                : ""}
            </div>
          `
        : ""}
      ${mode === "character" && char
        ? html`
            <div class="sidebar-section">
              <h3>Character</h3>
              <div class="stat-row">
                <span class="stat-label">Name</span>
                <span>${char.name}</span>
              </div>
              ${(char.aspects || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Aspects</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${char.aspects.map((a) => html`<div>• ${a}</div>`)}
                    </div>`
                : ""}
              ${char.actions
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Actions</span>
                    </div>
                    <div class="action-grid">
                      ${Object.entries(char.actions).map(
                        ([name, rating]) => html`
                          <span class="action-rating" key=${name}
                            >${name} ${rating}</span
                          >
                        `,
                      )}
                    </div>`
                : ""}
              <div class="stat-row">
                <span class="stat-label">Guard</span>
                <span>${char.guard ?? 3}/${char.maxGuard ?? 3}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Body</span>
                <span>${char.body ?? 6}/6</span>
              </div>
              ${char.healing
                ? html`<div class="stat-row" style="margin-top:2px;">
                    <span class="stat-label">Healing</span>
                    <span class="healing-clocks">
                      ${Array.from({ length: 4 }).map(
                        (_, i) => html`
                          <span
                            class="healing-box ${i < char.healing.ticks
                              ? "filled"
                              : ""}"
                            key=${i}
                          ></span>
                        `,
                      )}
                    </span>
                  </div>`
                : ""}
              <div class="stat-row">
                <span class="stat-label">XP</span>
                <span>${char.xp ?? 0}</span>
              </div>
              ${(char.conditions || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Conditions</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${char.conditions.join(", ")}
                    </div>`
                : ""}
              ${char.stunts?.length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Stunts</span>
                    </div>
                    <div style="font-size:11px;padding-left:8px;">
                      ${char.stunts.map((s) => s.name).join(", ")}
                    </div>`
                : ""}
              ${canLevelUpFull
                ? html` <div
                    style="margin-top:8px;border-top:1px solid #ccc;padding-top:6px;"
                  >
                    <button
                      class="btn"
                      style="font-size:11px;padding:2px 6px;"
                      onClick=${() => onCommand({ type: "levelup" })}
                    >
                      Level Up (${char.xp} XP)
                    </button>
                  </div>`
                : ""}
              ${hasDowntime
                ? html` <div
                    class="sidebar-section"
                    style="margin-top:8px;border-top:1px solid #ccc;padding-top:6px;"
                  >
                    <h3>Downtime (${char.downtimeRemaining} left)</h3>
                    <div class="options" style="flex-wrap:wrap;gap:3px;">
                      <button
                        class="btn"
                        style="font-size:11px;padding:2px 6px;"
                        onClick=${() =>
                          onCommand({ type: "downtime", action: "recover" })}
                      >
                        Recover
                      </button>
                      <button
                        class="btn"
                        style="font-size:11px;padding:2px 6px;"
                        onClick=${() =>
                          onCommand({ type: "downtime", action: "train" })}
                      >
                        Train (+1 XP)
                      </button>
                    </div>
                    ${projectButtons.length
                      ? html` <div
                            style="margin-top:4px;font-size:11px;font-weight:600;"
                          >
                            Projects:
                          </div>
                          <div class="options" style="flex-wrap:wrap;gap:3px;">
                            ${projectButtons}
                          </div>`
                      : ""}
                  </div>`
                : ""}
              <div
                style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;"
              >
                <span class="stat-label" style="margin:0;"
                  >Gear (${char.load ?? 0}/${effectiveMaxLoad})</span
                >
                ${onMission
                  ? html`<div class="dropdown-group" ref=${gearDropdownRef}>
                      <button
                        class="btn top-side-btn dropdown-chevron"
                        style="font-size:12px;"
                        onClick=${(e) => {
                          e.stopPropagation();
                          setGearDropdown(!gearDropdown);
                        }}
                      >
                        Max: ${char.maxLoad ?? 0} ▼
                      </button>
                      ${gearDropdown
                        ? html` <div
                            class="dropdown-menu"
                            style="right:0;left:auto;"
                          >
                            <button
                              class="btn dropdown-item ${char.maxLoad === 3
                                ? "selected"
                                : ""}"
                              onClick=${(e) => {
                                e.stopPropagation();
                                setGearDropdown(false);
                                onCommand({ type: "loadlevel", level: "light" });
                              }}
                            >
                              Light (3)
                            </button>
                            <button
                              class="btn dropdown-item ${char.maxLoad === 5
                                ? "selected"
                                : ""}"
                              onClick=${(e) => {
                                e.stopPropagation();
                                setGearDropdown(false);
                                onCommand({ type: "loadlevel", level: "normal" });
                              }}
                            >
                              Normal (5)
                            </button>
                            <button
                              class="btn dropdown-item ${char.maxLoad === 6
                                ? "selected"
                                : ""}"
                              onClick=${(e) => {
                                e.stopPropagation();
                                setGearDropdown(false);
                                onCommand({ type: "loadlevel", level: "heavy" });
                              }}
                            >
                              Heavy (6)
                            </button>
                          </div>`
                        : ""}
                    </div>`
                  : html`<span
                      class="stat-label"
                      style="margin:0;font-size:11px;color:#888;"
                      >Max: ${effectiveMaxLoad}</span
                    >`}
              </div>
              ${regularItems.length
                ? html`
                    <div class="gear-list">
                      ${regularItems.map(
                        (item) => html`
                          <div class="gear-item" key=${item.id}>
                            <span class="gear-name">${item.name}</span>
                            ${item.load
                              ? html`<span class="gear-load"
                                  >(${item.load})</span
                                >`
                              : ""}
                          </div>
                        `,
                      )}
                    </div>
                  `
                : html`<div class="gear-empty">No gear.</div>`}
              ${individualItems.length
                ? html`
                    <div
                      class="gear-list"
                      style="margin-top:4px;border-top:1px dashed #ccc;padding-top:4px;"
                    >
                      <div style="font-size:10px;color:#888;margin-bottom:2px;">
                        Special Items
                      </div>
                      ${individualItems.map(
                        (item) => html`
                          <div class="gear-item" key=${item.id}>
                            <span class="gear-name">${item.name}</span>
                          </div>
                        `,
                      )}
                    </div>
                  `
                : ""}
              ${onMission
                ? html`
                    <div class="section-label" style="margin-top:4px;">
                      Mission loadout:
                    </div>
                    ${availableItems.length
                      ? html` <div class="gear-list">
                          ${availableItems.map(
                            (item) => html`
                              <label
                                class="gear-item equip-row"
                                key=${item.id}
                              >
                                <input
                                  type="checkbox"
                                  class="equip-checkbox"
                                  checked=${charItemIds.has(item.id)}
                                  disabled=${charItemIds.has(item.id)}
                                  onChange=${() =>
                                    onCommand({
                                      type: "toggleitem",
                                      itemId: item.id,
                                    })}
                                />
                                <span class="gear-name">${item.name}</span>
                                ${item.load
                                  ? html`<span class="gear-load"
                                      >(${item.load})</span
                                    >`
                                  : ""}
                                ${charItemIds.has(item.id)
                                  ? ""
                                  : char.load + item.load > effectiveMaxLoad
                                    ? html`<span
                                        class="gear-warning"
                                        style="font-size:10px;color:#c00;"
                                        >exceeds load</span
                                      >`
                                    : ""}
                              </label>
                            `,
                          )}
                        </div>`
                      : html`<div style="font-size:11px;color:#888;">
                          No gear available for this character.
                        </div>`}
                  `
                : mayChangeInventory
                  ? html`
                      <div class="section-label" style="margin-top:4px;">
                        Available gear (at ${location?.name || "this location"}):
                      </div>
                      ${availableItems.length
                        ? html` <div class="gear-list">
                            ${availableItems.map(
                              (item) => html`
                                <label
                                  class="gear-item equip-row"
                                  key=${item.id}
                                >
                                  <input
                                    type="checkbox"
                                    class="equip-checkbox"
                                    checked=${charItemIds.has(item.id)}
                                    onChange=${() =>
                                      onCommand({
                                        type: "toggleitem",
                                        itemId: item.id,
                                      })}
                                  />
                                  <span class="gear-name">${item.name}</span>
                                  ${item.load
                                    ? html`<span class="gear-load"
                                        >(${item.load})</span
                                      >`
                                    : ""}
                                  ${charItemIds.has(item.id)
                                    ? ""
                                    : char.load + item.load > effectiveMaxLoad
                                      ? html`<span
                                          class="gear-warning"
                                          style="font-size:10px;color:#c00;"
                                          >exceeds load</span
                                        >`
                                      : ""}
                                </label>
                              `,
                            )}
                          </div>`
                        : html`<div style="font-size:11px;color:#888;">
                            No gear available for this character.
                          </div>`}
                    `
                  : html`<div
                      style="font-size:11px;color:#888;margin-top:4px;"
                    >
                      Visit an armory or supply area to change gear.
                    </div>`}
            </div>
          `
        : ""}
      ${mode === "faction" && faction
        ? html`
            <div class="sidebar-section">
              <h3>${faction.name}</h3>
              <div style="font-size:11px;margin-bottom:8px;">
                ${faction.description}
              </div>
              <div class="stat-row">
                <span class="stat-label">Tier ${faction.tier}</span>
                <span>${faction.hold}</span>
              </div>
              ${faction.heat
                ? html` <div class="stat-row">
                    ${faction.heat > 0
                      ? html`<span class="stat-label">Heat</span>`
                      : html`<span class="stat-label">Favor</span>`}
                    <span
                      >${Math.abs(faction.heat) % 6}/${Math.floor(
                        Math.abs(faction.heat) / 6,
                      )}</span
                    >
                  </div>`
                : ""}
              ${(faction.territory || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Territory</span>
                    </div>
                    <div
                      style="font-size:11px;padding-left:8px;margin-bottom:4px;"
                    >
                      ${faction.territory
                        .map((id) => {
                          const loc = state.locations?.find((l) => l.id === id);
                          return loc ? loc.name : id;
                        })
                        .join(", ")}
                    </div>`
                : ""}
              ${(faction.goals || []).length
                ? html` <div class="stat-row" style="margin-top:4px;">
                      <span class="stat-label">Goals</span>
                    </div>
                    <ul
                      style="font-size:11px;margin:2px 0 0 0;padding-left:20px;"
                    >
                      ${faction.goals.map((g) => html`<li>${g}</li>`)}
                    </ul>`
                : ""}
            </div>
          `
        : ""}
    </div>
  `;
}

// Modal for game selection, saving, and loading.
export function SaveLoadModal({
  tab,
  onTabChange,
  saveName,
  onSaveNameChange,
  onSave,
  onLoad,
  onDelete,
  saves,
  games,
  currentGameId,
  onGameSelect,
  onClose,
}) {
  return html`
    <div
      class="modal-overlay"
      onClick=${(e) => e.target === e.currentTarget && onClose()}
    >
      <div class="modal">
        <div class="modal-header">
          <h2>${tab === "games" ? "Select Game" : tab === "save" ? "Save Game" : "Load Game"}</h2>
          <button class="modal-close" onClick=${onClose}>×</button>
        </div>
        <div class="modal-body">
          <div class="tabs">
            <button
              class="tab ${tab === "games" ? "active" : ""}"
              onClick=${() => onTabChange("games")}
            >
              Games
            </button>
            <button
              class="tab ${tab === "save" ? "active" : ""}"
              onClick=${() => onTabChange("save")}
            >
              Save
            </button>
            <button
              class="tab ${tab === "load" ? "active" : ""}"
              onClick=${() => onTabChange("load")}
            >
              Load
            </button>
          </div>

          ${tab === "games"
            ? html`
                <div class="section-label">Available games:</div>
                ${games.length === 0
                  ? html`<div class="save-empty">No games found.</div>`
                  : html`
                      <ul class="save-list">
                        ${games.map(
                          (g) => html`
                            <li class="save-item">
                              <div>
                                <div class="save-name">${g}</div>
                                <div class="save-time">${g === currentGameId ? "(current)" : ""}</div>
                              </div>
                              <div class="save-actions">
                                <button class="btn" onClick=${() => onGameSelect(g)}>
                                  ${g === currentGameId ? "Current" : "Load"}
                                </button>
                              </div>
                            </li>
                          `,
                        )}
                      </ul>
                    `}
              `
            : ""}

          ${tab === "save"
            ? html`
                <div class="modal-input-row">
                  <input
                    class="modal-input"
                    type="text"
                    value=${saveName}
                    onInput=${(e) => onSaveNameChange(e.target.value)}
                    placeholder="save name..."
                    onKeyDown=${(e) => e.key === "Enter" && onSave()}
                  />
                  <button
                    class="btn"
                    onClick=${onSave}
                    disabled=${!saveName.trim()}
                  >
                    Save
                  </button>
                </div>
              `
            : ""}
          ${tab !== "games"
            ? html`
                <div class="section-label">Saved games:</div>
                ${saves.length === 0
                  ? html`<div class="save-empty">No saves yet.</div>`
                  : html`
                      <ul class="save-list">
                        ${saves.map(
                          (s) => html`
                            <li class="save-item">
                              <div>
                                <div class="save-name">${s.id}</div>
                                <div class="save-time">${fmtTime(s.at)}</div>
                              </div>
                              <div class="save-actions">
                                <button class="btn" onClick=${() => onLoad(s.id)}>
                                  Load
                                </button>
                                <button
                                  class="btn"
                                  onClick=${() => onDelete(s.id)}
                                  style="opacity:0.6;"
                                >
                                  Del
                                </button>
                              </div>
                            </li>
                          `,
                        )}
                      </ul>
                    `}
              `
            : ""}
        </div>
      </div>
    </div>
  `;
}
