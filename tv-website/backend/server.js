const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = 8080;
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, "uploads");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const UI_MEDIA_DIR = path.join(ROOT, "media");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".svg": "image/svg+xml",
};

async function ensureBaseFiles() {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  await fsp.mkdir(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    const initial = {
      media: [],
      queue: [],
      currentItemId: null,
      defaultDurationSec: 50,
      templates: [],
      updatedAt: new Date().toISOString(),
    };
    await fsp.writeFile(STATE_FILE, JSON.stringify(initial, null, 2), "utf-8");
  }
}

async function readState() {
  const raw = await fsp.readFile(STATE_FILE, "utf-8");
  return JSON.parse(raw);
}

async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  await fsp.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypes[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(bodyBuffer, boundary) {
  const raw = bodyBuffer.toString("binary");
  const marker = `--${boundary}`;
  const parts = raw.split(marker).slice(1, -1);
  for (const part of parts) {
    const [rawHeaders, rawContent] = part.split("\r\n\r\n");
    if (!rawHeaders || !rawContent) continue;
    const headers = rawHeaders.toLowerCase();
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/i);
    if (!headers.includes('name="media"') || !filenameMatch) continue;
    const filename = path.basename(filenameMatch[1]);
    const trimmed = rawContent.replace(/\r\n$/, "");
    return { filename, data: Buffer.from(trimmed, "binary") };
  }
  return null;
}

function withPublicMediaPath(filename) {
  return `/uploads/${filename}`;
}

function getCurrentQueueItem(state) {
  return state.queue.find((q) => q.id === state.currentItemId) || null;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/state" && req.method === "GET") {
      const state = await readState();
      sendJson(res, 200, { ...state, currentItem: getCurrentQueueItem(state) });
      return;
    }

    if (url.pathname === "/api/upload" && req.method === "POST") {
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) {
        sendJson(res, 400, { error: "Missing multipart boundary." });
        return;
      }

      const body = await readBody(req);
      const parsed = parseMultipart(body, boundaryMatch[1]);
      if (!parsed) {
        sendJson(res, 400, { error: "Expected field named media." });
        return;
      }

      const ext = path.extname(parsed.filename).toLowerCase();
      const mediaType = [".mp4", ".webm", ".mov"].includes(ext) ? "video" : "image";
      const storedName = `${randomUUID()}${ext}`;
      await fsp.writeFile(path.join(UPLOADS_DIR, storedName), parsed.data);

      const state = await readState();
      const media = {
        id: randomUUID(),
        name: parsed.filename,
        type: mediaType,
        fileName: storedName,
        url: withPublicMediaPath(storedName),
        createdAt: new Date().toISOString(),
      };
      state.media.push(media);
      await saveState(state);
      sendJson(res, 201, media);
      return;
    }

    if (url.pathname === "/api/queue/add" && req.method === "POST") {
      const payload = JSON.parse((await readBody(req)).toString("utf-8"));
      const state = await readState();
      const media = state.media.find((m) => m.id === payload.mediaId);
      if (!media) {
        sendJson(res, 404, { error: "Media not found." });
        return;
      }
      const queueItem = {
        id: randomUUID(),
        mediaId: media.id,
        durationSec: Number(payload.durationSec) || state.defaultDurationSec || 50,
        addedAt: new Date().toISOString(),
      };
      state.queue.push(queueItem);
      if (!state.currentItemId || payload.immediate) {
        state.currentItemId = queueItem.id;
      }
      await saveState(state);
      sendJson(res, 201, queueItem);
      return;
    }

    if (url.pathname === "/api/control/publish" && req.method === "POST") {
      const payload = JSON.parse((await readBody(req)).toString("utf-8"));
      const durationSec = Number(payload.durationSec) || 50;
      const state = await readState();
      state.defaultDurationSec = durationSec;
      state.queue = state.queue.map((item) => ({ ...item, durationSec }));
      state.currentItemId = state.queue[0]?.id || null;
      await saveState(state);
      sendJson(res, 200, { ok: true, currentItemId: state.currentItemId });
      return;
    }

    if (url.pathname === "/api/control/set-current" && req.method === "POST") {
      const payload = JSON.parse((await readBody(req)).toString("utf-8"));
      const state = await readState();
      const item = state.queue.find((q) => q.id === payload.queueItemId);
      if (!item) {
        sendJson(res, 404, { error: "Queue item not found." });
        return;
      }
      state.currentItemId = item.id;
      await saveState(state);
      sendJson(res, 200, { ok: true, currentItemId: state.currentItemId });
      return;
    }

    if (url.pathname === "/api/queue/remove" && req.method === "POST") {
      const payload = JSON.parse((await readBody(req)).toString("utf-8"));
      const state = await readState();
      state.queue = state.queue.filter((q) => q.id !== payload.queueItemId);
      if (state.currentItemId === payload.queueItemId) {
        state.currentItemId = state.queue[0]?.id || null;
      }
      await saveState(state);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/queue/clear" && req.method === "POST") {
      const state = await readState();
      state.queue = [];
      state.currentItemId = null;
      await saveState(state);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/media/delete" && req.method === "POST") {
      const payload = JSON.parse((await readBody(req)).toString("utf-8"));
      const state = await readState();
      const media = state.media.find((m) => m.id === payload.mediaId);
      if (!media) {
        sendJson(res, 404, { error: "Media not found." });
        return;
      }

      try {
        await fsp.unlink(path.join(UPLOADS_DIR, media.fileName));
      } catch {
        /* file may already be missing */
      }

      state.media = state.media.filter((m) => m.id !== payload.mediaId);
      state.queue = state.queue.filter((q) => q.mediaId !== payload.mediaId);
      if (!state.queue.find((q) => q.id === state.currentItemId)) {
        state.currentItemId = state.queue[0]?.id || null;
      }
      await saveState(state);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/media/clear-all" && req.method === "POST") {
      const state = await readState();
      for (const media of state.media) {
        try {
          await fsp.unlink(path.join(UPLOADS_DIR, media.fileName));
        } catch {
          /* ignore missing files */
        }
      }
      state.media = [];
      state.queue = [];
      state.currentItemId = null;
      await saveState(state);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/control/next" && req.method === "POST") {
      const state = await readState();
      if (!state.queue.length) {
        state.currentItemId = null;
      } else {
        const idx = state.queue.findIndex((q) => q.id === state.currentItemId);
        const nextIdx = idx < 0 ? 0 : (idx + 1) % state.queue.length;
        state.currentItemId = state.queue[nextIdx].id;
      }
      await saveState(state);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname.startsWith("/uploads/")) {
      const fileName = path.basename(url.pathname.replace("/uploads/", ""));
      sendFile(res, path.join(UPLOADS_DIR, fileName));
      return;
    }

    if (url.pathname.startsWith("/media/")) {
      const fileName = path.basename(url.pathname.replace("/media/", ""));
      sendFile(res, path.join(UI_MEDIA_DIR, fileName));
      return;
    }

    if (url.pathname === "/styles.css") {
      sendFile(res, path.join(ROOT, "styles.css"));
      return;
    }

    if (url.pathname === "/script.js") {
      sendFile(res, path.join(ROOT, "script.js"));
      return;
    }

    if (url.pathname === "/" || url.pathname === "/admin" || url.pathname === "/index.html") {
      sendFile(res, path.join(ROOT, "index.html"));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

ensureBaseFiles().then(() => {
  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
});
