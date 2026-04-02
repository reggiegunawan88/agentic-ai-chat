import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { WSContext, WSMessageReceive } from "hono/ws";
import { runAgentLoop } from "../agent/loop";
import type { AgentEvent, ClientMessage } from "../agent/types";

type SessionState = {
	history: ChatCompletionMessageParam[];
};

// Key by ws.raw — Hono creates a new WSContext wrapper per event,
// but the underlying Bun WebSocket (ws.raw) is the same object.
const sessions = new Map<unknown, SessionState>();

export function handleWebSocketOpen(ws: WSContext): void {
	console.log("[ws] client connected");
	sessions.set(ws.raw, { history: [] });
}

export async function handleWebSocketMessage(
	ws: WSContext,
	event: MessageEvent<WSMessageReceive>,
): Promise<void> {
	console.log("[ws] message received:", String(event.data));
	const session = sessions.get(ws.raw);
	if (!session) return;

	let parsed: ClientMessage;
	try {
		parsed = JSON.parse(String(event.data)) as ClientMessage;
	} catch {
		ws.send(
			JSON.stringify({
				type: "error",
				message: "Invalid JSON",
			} satisfies AgentEvent),
		);
		return;
	}

	if (parsed.type !== "message" || !parsed.content) {
		ws.send(
			JSON.stringify({
				type: "error",
				message: "Invalid message format",
			} satisfies AgentEvent),
		);
		return;
	}

	session.history.push({ role: "user", content: parsed.content });

	try {
		await runAgentLoop({
			messages: [...session.history],
			onEvent: (agentEvent: AgentEvent) => {
				ws.send(JSON.stringify(agentEvent));

				if (agentEvent.type === "response") {
					session.history.push({
						role: "assistant",
						content: agentEvent.content,
					});
				}
			},
		});
	} catch (error) {
		console.error("[ws] agent loop crashed:", error);
		ws.send(
			JSON.stringify({
				type: "error",
				message: `Agent error: ${error instanceof Error ? error.message : "unknown"}`,
			} satisfies AgentEvent),
		);
	}
}

export function handleWebSocketClose(ws: WSContext): void {
	console.log("[ws] client disconnected");
	sessions.delete(ws.raw);
}
