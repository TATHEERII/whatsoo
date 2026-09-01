"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const engine_1 = require("./engine");
const PORT = parseInt(process.env.PORT || "3001", 10);
const ENGINE_TOKEN = process.env.ENGINE_TOKEN || null;
const SESSION_DIR = process.env.SESSION_DIR || path_1.default.resolve(process.cwd(), ".wwebjs_auth");
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || null;
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
function authMiddleware(req, res, next) {
    if (!ENGINE_TOKEN) {
        next();
        return;
    }
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer (.+)$/);
    if (!match || match[1] !== ENGINE_TOKEN) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    next();
}
app.use(authMiddleware);
const engine = new engine_1.WhatsAppEngine();
engine.on("qr", (qr) => {
    console.log(`[engine] event: qr (${qr.length} chars)`);
});
engine.on("ready", () => {
    console.log("[engine] event: ready");
});
engine.on("disconnected", (reason) => {
    console.log(`[engine] event: disconnected (${reason})`);
});
engine.on("auth_failure", () => {
    console.log("[engine] event: auth_failure");
});
let nextClientId = 1;
const sseClients = [];
function broadcastSSE(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        client.res.write(payload);
    }
}
engine.on("qr", (qr) => broadcastSSE("qr", qr));
engine.on("ready", () => broadcastSSE("ready", {}));
engine.on("disconnected", (reason) => broadcastSSE("disconnected", reason));
engine.on("auth_failure", () => broadcastSSE("auth_failure", {}));
app.get("/health", (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});
app.get("/status", async (_req, res) => {
    try {
        const status = await engine.getStatus();
        res.json(status);
    }
    catch (err) {
        res.status(500).json({ error: "Failed to get status" });
    }
});
app.post("/connect", (_req, res) => {
    engine.initialize().catch((err) => {
        console.error("[engine] initialize failed:", err);
    });
    res.json({ success: true, message: "Initializing WhatsApp…" });
});
app.post("/disconnect", async (req, res) => {
    const clearSession = !!req.body?.clearSession;
    try {
        await engine.disconnect(clearSession);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: "Disconnect failed" });
    }
});
app.post("/send", async (req, res) => {
    const { to, text, filePath, mediaType } = req.body || {};
    if (!to) {
        res.status(400).json({ error: "Missing 'to' field" });
        return;
    }
    try {
        if (filePath) {
            const mt = mediaType === "video" ? "video" : "image";
            if (text) {
                await engine.sendCombined(to, filePath, text, mt);
            }
            else {
                if (mt === "video") {
                    await engine.sendVideo(to, filePath);
                }
                else {
                    await engine.sendImage(to, filePath);
                }
            }
        }
        else {
            if (!text) {
                res.status(400).json({ error: "Missing 'text' or 'filePath'" });
                return;
            }
            await engine.sendText(to, text);
        }
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : "Send failed",
        });
    }
});
app.get("/events", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.write("retry: 5000\n\n");
    const clientId = nextClientId++;
    const client = { id: clientId, res };
    sseClients.push(client);
    console.log(`[engine] SSE client ${clientId} connected (${sseClients.length} total)`);
    const heartbeat = setInterval(() => {
        res.write(": ping\n\n");
    }, 25000);
    req.on("close", () => {
        clearInterval(heartbeat);
        const idx = sseClients.indexOf(client);
        if (idx !== -1)
            sseClients.splice(idx, 1);
        console.log(`[engine] SSE client ${clientId} disconnected (${sseClients.length} remaining)`);
    });
});
function main() {
    console.log(`[engine] starting on port ${PORT}`);
    console.log(`[engine] session dir: ${SESSION_DIR}`);
    console.log(`[engine] PUPPETEER_EXECUTABLE_PATH: ${PUPPETEER_EXECUTABLE_PATH || "(not set, using bundled)"}`);
    console.log(`[engine] ENGINE_TOKEN: ${ENGINE_TOKEN ? "set" : "not set (dev mode)"}`);
    if (!ENGINE_TOKEN) {
        console.warn("[engine] WARNING: ENGINE_TOKEN is not set  all endpoints are unprotected!");
    }
    app.listen(PORT, () => {
        console.log(`[engine] listening on :${PORT}`);
    });
}
main();
