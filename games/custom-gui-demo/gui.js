// Custom GUI for the "Custom GUI Demo" game.
// This file demonstrates how a game designer can completely replace the
// default terminal UI with a custom SPA.
//
// The gui.js module must export an `init(api)` function (or a default export).
// `init` receives an API object and should render into `api.root`.
// It may return a cleanup function that runs before switching games or loading.

import { h, render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import htm from "htm";
const html = htm.bind(h);

// Import engine modules directly from /src/
import { getContext, processInput } from "/src/engine.js";
import { parseInput } from "/src/parser.js";

// Import custom GUI styles
import "./gui.css";

// ---- Custom Components ----

function App({ api }) {
  const [state, setState] = useState(api.state);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeChar, setActiveChar] = useState(0);
  const inputRef = useRef(null);

  // Helper: process a command and update state + messages
  const runCommand = (cmd, inputText) => {
    const result = processInput(state, cmd, activeChar);
    const newState = { ...state };
    setState(newState);

    setMessages((prev) => {
      const next = [...prev];
      if (inputText) next.push({ type: "player", text: inputText });
      if (result.type === "error") {
        next.push({ type: "result", text: result.message });
      } else if (result.type === "transition") {
        next.push({ type: "result", text: `${result.fromName} → ${result.toName}` });
      } else if (result.type === "scene_start") {
        next.push({ type: "result", text: `★ ${result.sceneFiction}` });
      } else if (result.type === "roll_result") {
        const pool = result.roll.pool;
        const results = (result.roll.results || []).join(", ");
        const level = result.roll.outcome.level;
        next.push({
          type: "result",
          text: `[${pool}d] ${results} → ${level}`,
        });
      } else if (result.type === "scene_end") {
        next.push({ type: "result", text: "Scene resolved." });
      }
      // Append fresh context
      const ctx = getContext(newState);
      const filtered = next.filter((m) => m.type !== "context");
      filtered.push({ type: "context", context: ctx });
      return filtered;
    });
  };

  // Handle text input
  const handleInput = (text) => {
    if (!text.trim()) return;
    const cmd = parseInput(text);
    if (!cmd) {
      setMessages((prev) => [
        ...prev,
        { type: "player", text },
        { type: "result", text: "I do not understand." },
      ]);
      return;
    }
    runCommand(cmd, text);
    setInput("");
  };

  // Handle button click (pre-parsed command)
  const handleCmd = (cmd) => {
    runCommand(cmd, null);
  };

  // Render context (location or scene)
  const renderContext = (ctx) => {
    if (!ctx) return null;

    if (ctx.type === "location") {
      return html`
        <div class="card">
          <h2>${ctx.name}</h2>
          <p>${ctx.description}</p>
          ${ctx.links?.length
            ? html`<div class="section">
                <h3>Exits</h3>
                ${ctx.links.map((l) =>
                  html`<button class="btn" onClick=${() => handleCmd({ type: "go_num", index: l.index })}>
                    ${l.label}${l.locked ? " [locked]" : ""}
                  </button>`,
                )}
              </div>`
            : null}
          ${ctx.actions?.length
            ? html`<div class="section">
                <h3>Actions</h3>
                ${ctx.actions.map((a) =>
                  html`<button class="btn" onClick=${() => handleCmd({ type: "act_num", index: a.index })}>
                    ${a.label}
                  </button>`,
                )}
              </div>`
            : null}
          ${ctx.npcs?.length
            ? html`<div class="section">
                <h3>Talk To</h3>
                ${ctx.npcs.map((n) =>
                  html`<button class="btn" onClick=${() => handleCmd({ type: "talk", index: n.index })}>
                    ${n.name}
                  </button>`,
                )}
              </div>`
            : null}
        </div>
      `;
    }

    if (ctx.type === "scene") {
      return html`
        <div class="card">
          <h2>Scene: ${ctx.sceneId}</h2>
          <p>${ctx.fiction}</p>
          ${ctx.tags?.length
            ? html`<div class="tags">${ctx.tags.map((t) => html`<span class="tag">${t}</span>`)}</div>`
            : null}
          ${ctx.sceneType === "action" && ctx.challenges
            ? html`<div class="section">
                ${ctx.challenges.map((c) => html`
                  <div class="challenge">
                    <h4>${c.description}</h4>
                    <div class="clock">Clock: ${c.clock.current}/${c.clock.max}</div>
                    ${c.actions.map((a) => html`
                      <button class="btn action-btn" onClick=${() => handleCmd({ type: "resolve", challengeId: c.id, actionName: a.actionName, characterIndex: activeChar })}>
                        ${a.actionName}
                      </button>
                    `)}
                  </div>
                `)}
              </div>`
            : null}
          ${ctx.sceneType === "dialogue" && ctx.options
            ? html`<div class="section">
                ${ctx.options.map((o) => html`
                  <button class="btn option-btn" onClick=${() => handleCmd({ type: "select", index: o.index })} disabled=${!o.available}>
                    ${o.text}${o.available ? "" : " [unavailable]"}
                  </button>
                `)}
              </div>`
            : null}
        </div>
      `;
    }

    return null;
  };

  // Render the message log
  const renderMessages = () =>
    messages.map((msg, i) => {
      if (msg.type === "context") {
        return html`<div key=${i} class="context-view">${renderContext(msg.context)}</div>`;
      }
      const cls = `msg msg-${msg.type}`;
      return html`<div key=${i} class=${cls}>${msg.type === "player" ? html`<span class="prompt">&gt; </span>` : ""}${msg.text}</div>`;
    });

  // Render character sheet
  const char = state?.characters?.[activeChar];
  const actions = [
    "Muscle", "Move", "Finesse", "Sneak", "Shoot", "Tinker",
    "Study", "Notice", "Bond", "Command", "Focus", "Sway",
  ];

  return html`
    <div class="custom-app">
      <header class="custom-header">
        <h1>${state?.gameName || "Custom GUI Demo"}</h1>
        <div class="header-right">
          <button class="btn small" onClick=${() => api.saveLoad.save("autosave", state)}>Save</button>
          <button class="btn small" onClick=${() => api.switchGame("sample-game")}>Switch to Terminal</button>
        </div>
      </header>
      <div class="custom-main">
        <div class="message-log">${renderMessages()}</div>
        <div class="input-area">
          <span class="prompt">&gt; </span>
          <input
            ref=${inputRef}
            class="custom-input"
            type="text"
            value=${input}
            onInput=${(e) => setInput(e.target.value)}
            onKeyDown=${(e) => {
              if (e.key === "Enter") {
                handleInput(input);
              }
            }}
            placeholder="Type a command..."
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </div>
      <aside class="custom-sidebar">
        ${char
          ? html`
            <div class="char-sheet">
              <h3>${char.name}</h3>
              <div class="stats">
                <div>Guard: ${char.guard}/${char.maxGuard}</div>
                <div>Body: ${char.body}/6</div>
                <div>XP: ${char.xp}</div>
                <div>Momentum: ${state?.momentum ?? 2}</div>
              </div>
              <div class="actions-grid">
                ${actions.map((a) => html`
                  <div class="action-row">
                    <span class="action-name">${a}</span>
                    <span class="action-dots">${char.actions?.[a] ?? 0}</span>
                  </div>
                `)}
              </div>
            </div>
          `
          : null}
      </aside>
    </div>
  `;
}

// ---- Init ----

export function init(api) {
  // Render the custom SPA into the root element
  render(html`<${App} api=${api} />`, api.root);

  // Return a cleanup function
  return () => {
    render(null, api.root);
  };
}
