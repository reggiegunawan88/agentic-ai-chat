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

// Handles incoming WebSocket messages from the client.
// Two message types are supported:
//   1. "restore" — replays stored chat history into the session (used when
//      resuming a persisted chat). No agent loop is triggered.
//   2. "message" — a new user message. Appends it to the session history,
//      runs the agent loop (think → act → observe), and streams every
//      AgentEvent back to the client in real-time over the same WebSocket.
export async function handleWebSocketMessage(
	ws: WSContext,
	event: MessageEvent<WSMessageReceive>,
): Promise<void> {
	console.log("[ws] message received:", String(event.data));

	// Step 1: Look up the per-connection session that was created on open.
	const session = sessions.get(ws.raw);
	if (!session) return;

	// Step 2: Parse the incoming JSON payload into a typed ClientMessage.
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

	switch (parsed.type) {
		// Step 3a: Restore — populate session history from the client's
		// localStorage without triggering the agent loop. This lets the
		// backend "catch up" to a conversation the user had previously.
		case "restore": {
			session.history = parsed.history.map((msg) => ({
				role: msg.role,
				content: msg.content,
			}));
			console.log(`[ws] restored ${parsed.history.length} messages`);
			return;
		}

		// Step 3b: Message — the main path. A new user message enters the
		// ReAct loop: the LLM reasons, optionally calls tools, observes
		// results, and eventually produces a final streamed response.
		case "message": {
			if (!parsed.content) {
				ws.send(
					JSON.stringify({
						type: "error",
						message: "Empty message",
					} satisfies AgentEvent),
				);
				return;
			}

			// Step 4: Append the user message to the conversation history
			// so the agent loop has full context.
			session.history.push({ role: "user", content: parsed.content });

			// Step 5: Run the agent loop. Every event (thinking, tool_call,
			// tool_result, response_delta, response_end, error) is forwarded
			// to the client as it happens. When the final response arrives,
			// we also append it to the session history for future turns.
			try {
				await runAgentLoop({
					messages: [...session.history],
					onEvent: (agentEvent: AgentEvent) => {
						// Stream each event to the client in real-time
						ws.send(JSON.stringify(agentEvent));

						// Persist the assistant's final response to session
						// history so subsequent messages have full context
						if (agentEvent.type === "response_end") {
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
			return;
		}

		default: {
			ws.send(
				JSON.stringify({
					type: "error",
					message: "Unknown message type",
				} satisfies AgentEvent),
			);
		}
	}
}

export function handleWebSocketClose(ws: WSContext): void {
	console.log("[ws] client disconnected");
	sessions.delete(ws.raw);
}
