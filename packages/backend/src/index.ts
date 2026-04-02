import { Hono } from "hono";
import { cors } from "hono/cors";
import { createBunWebSocket } from "hono/bun";
import {
	handleWebSocketClose,
	handleWebSocketMessage,
	handleWebSocketOpen,
} from "./routes/chat";

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

export default {
	port: 5000,
	fetch: (req: Request, server: unknown) => app.fetch(req, { server }),
	websocket,
};
