import { readFileSync, mkdirSync, readdirSync, writeFileSync, unlinkSync, existsSync, statSync } from "fs";
import { extname, join } from "path";

const port = process.env.PORT || 3333;
const SAVE_DIR = "saves";
const STATIC_DIR = "static";

mkdirSync(SAVE_DIR, { recursive: true });

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveFile(filePath) {
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    return new Response(content, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return null;
  }
}

function serveStatic(pathname) {
  const stripped = (pathname === "/" ? "/index.html" : pathname).replace(/^\//, "");

  const staticPath = join(STATIC_DIR, stripped);
  if (existsSync(staticPath)) {
    const s = statSync(staticPath);
    if (s.isDirectory()) {
      const idx = join(staticPath, "index.html");
      return existsSync(idx) ? serveFile(idx) : null;
    }
    return serveFile(staticPath);
  }

  if (stripped.startsWith("src/") || stripped.startsWith("games/")) {
    if (existsSync(stripped)) return serveFile(stripped);
  }

  return null;
}

function saveState(id, state) {
  try {
    writeFileSync(`${SAVE_DIR}/${id}.json`, JSON.stringify({ id, state }), "utf-8");
    return true;
  } catch (e) {
    console.error(`Failed to save "${id}":`, e.message);
    return false;
  }
}

function loadState(id) {
  try {
    const raw = readFileSync(`${SAVE_DIR}/${id}.json`, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deleteState(id) {
  const filePath = `${SAVE_DIR}/${id}.json`;
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}

function listSaves() {
  try {
    const files = readdirSync(SAVE_DIR).filter((f) => f.endsWith(".json"));
    return files.map((f) => {
      const id = f.slice(0, -5);
      const raw = readFileSync(`${SAVE_DIR}/${f}`, "utf-8");
      try {
        const data = JSON.parse(raw);
        return { id, at: data.state?._savedAt || null };
      } catch {
        return { id, at: null };
      }
    });
  } catch {
    return [];
  }
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      const parts = pathname.slice(5).split("/").filter(Boolean);

      if (parts[0] === "saves" && parts.length === 1 && method === "GET") {
        return json({ saves: listSaves() });
      }

      if (parts[0] === "games" && parts.length === 1 && method === "GET") {
        const gamesDir = "games";
        if (!existsSync(gamesDir)) return json({ games: [] });
        const dirs = readdirSync(gamesDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
        return json({ games: dirs });
      }

      if (parts[0] === "games" && parts.length === 3 && parts[2] === "files" && method === "GET") {
        const gameId = parts[1];
        const gameDir = join("games", gameId);
        if (!existsSync(gameDir)) return error("Game not found", 404);
        const files = readdirSync(gameDir)
          .filter((f) => f.endsWith(".json"))
          .sort();
        return json({ files });
      }

      if (parts[0] === "save" && parts.length >= 2) {
        const id = parts[1];
        if (method === "POST") {
          const body = await req.json().catch(() => null);
          if (!body || !body.state) return error("Request body must include { state }", 400);
          body.state._savedAt = Date.now();
          const ok = saveState(id, body.state);
          return ok ? json({ saved: id }) : error("Save failed", 500);
        }
        if (method === "DELETE") {
          const ok = deleteState(id);
          return ok ? json({ deleted: id }) : error("Save not found", 404);
        }
      }

      if (parts[0] === "load" && parts.length >= 2 && method === "GET") {
        const id = parts[1];
        const data = loadState(id);
        return data ? json(data) : error("Save not found", 404);
      }

      return error("Not Found", 404);
    }

    const staticResponse = serveStatic(pathname);
    if (staticResponse) return staticResponse;

    return error("Not Found", 404);
  },
});

console.log(`Action-IF server running on http://localhost:${port}`);