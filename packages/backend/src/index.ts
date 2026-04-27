import { Hono } from "hono";
import { cors } from "hono/cors";
import { createBunWebSocket, serveStatic } from "hono/bun";
import { validateEnv } from "./env";
import {
	handleWebSocketClose,
	handleWebSocketMessage,
	handleWebSocketOpen,
} from "./routes/chat";

validateEnv();

const app = new Hono();
const { upgradeWebSocket, websocket } = createBunWebSocket();

app.use("/*", cors({ origin: "http://localhost:3000" }));

app.get("/health", (c) => c.json({ status: "ok" }));

app.get(
	"/ws",
	upgradeWebSocket(() => ({
		onOpen(_event, ws) {
			handleWebSocketOpen(ws);
		},
		onMessage(event, ws) {
			handleWebSocketMessage(ws, event);
		},
		onClose(_event, ws) {
			handleWebSocketClose(ws);
		},
	})),
);

// SPA bundle: serve files; fall through to index.html so client-side routing works.
// In dev the build dir doesn't exist; vite serves the frontend on :3000 instead.
const SPA_ROOT = "./packages/frontend/build/client";
app.use("/*", serveStatic({ root: SPA_ROOT }));
app.use("/*", serveStatic({ path: `${SPA_ROOT}/index.html` }));

export default {
	port: 5000,
	fetch: (req: Request, server: unknown) => app.fetch(req, { server }),
	websocket,
};
