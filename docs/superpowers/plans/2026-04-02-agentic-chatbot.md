# Agentic Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a learning-focused chatbot that exposes AI agentic processes (think-act-observe loop, tool dispatch, debug events) using raw OpenAI SDK, Hono WebSocket backend, and React frontend with debug panel.

**Architecture:** Backend runs a hand-built agent loop: receive user message via WebSocket, call OpenAI with tool definitions, execute any requested tools, loop until final response — emitting typed debug events at each step. Frontend displays chat messages on the left and a collapsible debug panel on the right showing real-time agent internals.

**Tech Stack:** Bun workspaces, Hono + Bun WebSocket, OpenAI GPT-4o (raw SDK), mathjs, Tavily API, React Router 7, Tailwind CSS 4, TypeScript.

---

## File Structure

### Backend — Create

| File | Responsibility |
|------|---------------|
| `packages/backend/src/agent/types.ts` | AgentEvent union type, ClientMessage type, tool schema types |
| `packages/backend/src/agent/tools.ts` | Calculator + web search implementations, OpenAI function-calling schemas, tool dispatcher |
| `packages/backend/src/agent/loop.ts` | Core agent loop: think → act → observe cycle with OpenAI, emits events via callback |
| `packages/backend/src/routes/chat.ts` | WebSocket route handler: session history, message parsing, agent loop invocation |
| `packages/backend/src/agent/__tests__/tools.test.ts` | Unit tests for calculator and web search tools |
| `packages/backend/src/agent/__tests__/loop.test.ts` | Unit tests for agent loop with mocked OpenAI client |

### Backend — Modify

| File | Change |
|------|--------|
| `packages/backend/src/index.ts` | Add WebSocket upgrade support via `createBunWebSocket`, mount chat route |

### Frontend — Create

| File | Responsibility |
|------|---------------|
| `packages/frontend/app/hooks/useWebSocket.ts` | Custom hook: WebSocket connection, message sending, event parsing, connection state |
| `packages/frontend/app/components/ChatPanel.tsx` | Chat bubble UI: user and assistant messages, auto-scroll, thinking indicator |
| `packages/frontend/app/components/MessageInput.tsx` | Text input + send button, Enter to send, disabled while agent is thinking |
| `packages/frontend/app/components/DebugPanel.tsx` | Collapsible debug panel: color-coded events, timestamps, grouped by turn |

### Frontend — Modify

| File | Change |
|------|--------|
| `packages/frontend/app/routes/home.tsx` | Replace Welcome component with chat layout |
| `packages/frontend/app/app.css` | Full-height layout styles for chat UI |
| `packages/frontend/vite.config.ts` | Add WebSocket proxy to backend (port 5000) |

---

## Task 1: Agent Event Types

**Files:**
- Create: `packages/backend/src/agent/types.ts`

- [ ] **Step 1: Create the types file with all event and message types**

```typescript
export type AgentEvent =
	| { type: "thinking"; iteration: number }
	| { type: "tool_call"; tool: string; args: Record<string, unknown>; iteration: number }
	| { type: "tool_result"; tool: string; result: string; iteration: number }
	| { type: "response"; content: string }
	| { type: "error"; message: string };

export type ClientMessage = {
	type: "message";
	content: string;
};
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd packages/backend && bunx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/agent/types.ts
git commit -m "feat: add agent event and client message types"
```

---

## Task 2: Tool Implementations

**Files:**
- Create: `packages/backend/src/agent/__tests__/tools.test.ts`
- Create: `packages/backend/src/agent/tools.ts`

- [ ] **Step 1: Write failing tests for the calculator tool**

```typescript
import { describe, expect, it } from "bun:test";
import { executeTool, toolDefinitions } from "../tools";

describe("calculator tool", () => {
	it("evaluates basic arithmetic", async () => {
		const result = await executeTool("calculator", { expression: "2 + 3 * 4" });
		expect(result).toBe("14");
	});

	it("handles division", async () => {
		const result = await executeTool("calculator", { expression: "100 / 4" });
		expect(result).toBe("25");
	});

	it("returns error for invalid expressions", async () => {
		const result = await executeTool("calculator", { expression: "not math" });
		expect(result).toContain("Error");
	});
});

describe("toolDefinitions", () => {
	it("includes calculator and web_search", () => {
		const names = toolDefinitions.map((t) => t.function.name);
		expect(names).toContain("calculator");
		expect(names).toContain("web_search");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/backend && bun test src/agent/__tests__/tools.test.ts`
Expected: FAIL — cannot resolve `../tools`

- [ ] **Step 3: Implement the tools module**

```typescript
import { evaluate } from "mathjs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const toolDefinitions: ChatCompletionTool[] = [
	{
		type: "function",
		function: {
			name: "calculator",
			description:
				"Evaluate a mathematical expression. Supports basic arithmetic, exponents, square roots, trig, etc.",
			parameters: {
				type: "object",
				properties: {
					expression: {
						type: "string",
						description: 'The math expression to evaluate, e.g. "2 + 3 * 4"',
					},
				},
				required: ["expression"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "web_search",
			description: "Search the web for current information on a topic.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "The search query",
					},
				},
				required: ["query"],
			},
		},
	},
];

async function calculator(args: { expression: string }): Promise<string> {
	try {
		const result = evaluate(args.expression);
		return String(result);
	} catch (error) {
		return `Error: Could not evaluate "${args.expression}"`;
	}
}

async function webSearch(args: { query: string }): Promise<string> {
	const apiKey = process.env.TAVILY_API_KEY;
	if (!apiKey) {
		return "Error: TAVILY_API_KEY is not configured";
	}
	try {
		const response = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: apiKey,
				query: args.query,
				max_results: 3,
			}),
		});
		if (!response.ok) {
			return `Error: Search API returned ${response.status}`;
		}
		const data = (await response.json()) as {
			results: Array<{ title: string; url: string; content: string }>;
		};
		return data.results
			.map((r) => `${r.title}\n${r.url}\n${r.content}`)
			.join("\n\n");
	} catch (error) {
		return `Error: Search failed — ${error instanceof Error ? error.message : "unknown error"}`;
	}
}

const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
	calculator: (args) => calculator(args as { expression: string }),
	web_search: (args) => webSearch(args as { query: string }),
};

export async function executeTool(
	name: string,
	args: Record<string, unknown>,
): Promise<string> {
	const handler = toolHandlers[name];
	if (!handler) {
		return `Error: Unknown tool "${name}"`;
	}
	return handler(args);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && bun test src/agent/__tests__/tools.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/agent/tools.ts packages/backend/src/agent/__tests__/tools.test.ts
git commit -m "feat: implement calculator and web search tools with tests"
```

---

## Task 3: Agent Loop

**Files:**
- Create: `packages/backend/src/agent/__tests__/loop.test.ts`
- Create: `packages/backend/src/agent/loop.ts`

- [ ] **Step 1: Write failing tests for the agent loop**

These tests use a mock OpenAI client to verify loop behavior without hitting the API.

```typescript
import { describe, expect, it } from "bun:test";
import { runAgentLoop } from "../loop";
import type { AgentEvent } from "../types";

function createMockClient(responses: Array<{
	content?: string | null;
	tool_calls?: Array<{
		id: string;
		type: "function";
		function: { name: string; arguments: string };
	}>;
}>) {
	let callIndex = 0;
	return {
		chat: {
			completions: {
				create: async () => {
					const response = responses[callIndex++];
					return {
						choices: [
							{
								message: {
									role: "assistant" as const,
									content: response.content ?? null,
									tool_calls: response.tool_calls ?? undefined,
								},
								finish_reason: response.tool_calls ? "tool_calls" : "stop",
							},
						],
					};
				},
			},
		},
	};
}

describe("runAgentLoop", () => {
	it("returns a direct response when no tools are called", async () => {
		const events: AgentEvent[] = [];
		const client = createMockClient([{ content: "Hello!" }]);

		await runAgentLoop({
			messages: [{ role: "user", content: "Hi" }],
			onEvent: (event) => events.push(event),
			client: client as any,
		});

		expect(events).toEqual([
			{ type: "thinking", iteration: 1 },
			{ type: "response", content: "Hello!" },
		]);
	});

	it("executes a tool call and loops back", async () => {
		const events: AgentEvent[] = [];
		const client = createMockClient([
			{
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: { name: "calculator", arguments: '{"expression":"2+2"}' },
					},
				],
			},
			{ content: "The answer is 4." },
		]);

		await runAgentLoop({
			messages: [{ role: "user", content: "What is 2+2?" }],
			onEvent: (event) => events.push(event),
			client: client as any,
		});

		expect(events[0]).toEqual({ type: "thinking", iteration: 1 });
		expect(events[1]).toEqual({
			type: "tool_call",
			tool: "calculator",
			args: { expression: "2+2" },
			iteration: 1,
		});
		expect(events[2]).toEqual({
			type: "tool_result",
			tool: "calculator",
			result: "4",
			iteration: 1,
		});
		expect(events[3]).toEqual({ type: "thinking", iteration: 2 });
		expect(events[4]).toEqual({ type: "response", content: "The answer is 4." });
	});

	it("stops after max iterations and emits error", async () => {
		const events: AgentEvent[] = [];
		const infiniteToolCall = {
			tool_calls: [
				{
					id: "call_n",
					type: "function" as const,
					function: { name: "calculator", arguments: '{"expression":"1+1"}' },
				},
			],
		};
		const client = createMockClient(
			Array.from({ length: 12 }, () => infiniteToolCall),
		);

		await runAgentLoop({
			messages: [{ role: "user", content: "loop forever" }],
			onEvent: (event) => events.push(event),
			client: client as any,
			maxIterations: 3,
		});

		const errorEvent = events.find((e) => e.type === "error");
		expect(errorEvent).toBeDefined();
		expect((errorEvent as any).message).toContain("Maximum iterations");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/backend && bun test src/agent/__tests__/loop.test.ts`
Expected: FAIL — cannot resolve `../loop`

- [ ] **Step 3: Implement the agent loop**

```typescript
import OpenAI from "openai";
import type {
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { executeTool, toolDefinitions } from "./tools";
import type { AgentEvent } from "./types";

const DEFAULT_MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are a helpful assistant with access to tools. Use them when appropriate to answer the user's questions accurately. When you use a tool, explain what you found in your response.`;

type AgentLoopParams = {
	messages: ChatCompletionMessageParam[];
	onEvent: (event: AgentEvent) => void;
	client?: Pick<OpenAI, "chat">;
	maxIterations?: number;
};

export async function runAgentLoop({
	messages,
	onEvent,
	client,
	maxIterations = DEFAULT_MAX_ITERATIONS,
}: AgentLoopParams): Promise<void> {
	const openai = client ?? new OpenAI();
	const conversationMessages: ChatCompletionMessageParam[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		...messages,
	];

	for (let iteration = 1; iteration <= maxIterations; iteration++) {
		onEvent({ type: "thinking", iteration });

		let completion: OpenAI.Chat.Completions.ChatCompletion;
		try {
			completion = (await openai.chat.completions.create({
				model: "gpt-4o",
				messages: conversationMessages,
				tools: toolDefinitions,
			})) as OpenAI.Chat.Completions.ChatCompletion;
		} catch (error) {
			onEvent({
				type: "error",
				message: `OpenAI API error: ${error instanceof Error ? error.message : "unknown"}`,
			});
			return;
		}

		const choice = completion.choices[0];
		const assistantMessage = choice.message;

		conversationMessages.push(assistantMessage);

		if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
			onEvent({ type: "response", content: assistantMessage.content ?? "" });
			return;
		}

		for (const toolCall of assistantMessage.tool_calls) {
			const toolName = toolCall.function.name;
			const toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

			onEvent({ type: "tool_call", tool: toolName, args: toolArgs, iteration });

			const result = await executeTool(toolName, toolArgs);

			onEvent({ type: "tool_result", tool: toolName, result, iteration });

			conversationMessages.push({
				role: "tool",
				tool_call_id: toolCall.id,
				content: result,
			});
		}
	}

	onEvent({ type: "error", message: "Maximum iterations reached without a final response" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && bun test src/agent/__tests__/loop.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/agent/loop.ts packages/backend/src/agent/__tests__/loop.test.ts
git commit -m "feat: implement agent loop with think-act-observe cycle"
```

---

## Task 4: WebSocket Chat Route + Server Integration

**Files:**
- Create: `packages/backend/src/routes/chat.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Create the WebSocket chat route handler**

```typescript
import type { WSContext } from "hono/ws";
import { runAgentLoop } from "../agent/loop";
import type { AgentEvent, ClientMessage } from "../agent/types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type SessionState = {
	history: ChatCompletionMessageParam[];
};

const sessions = new WeakMap<WSContext, SessionState>();

export function handleWebSocketOpen(ws: WSContext): void {
	sessions.set(ws, { history: [] });
}

export async function handleWebSocketMessage(
	ws: WSContext,
	event: MessageEvent,
): Promise<void> {
	const session = sessions.get(ws);
	if (!session) return;

	let parsed: ClientMessage;
	try {
		parsed = JSON.parse(String(event.data)) as ClientMessage;
	} catch {
		ws.send(
			JSON.stringify({ type: "error", message: "Invalid JSON" } satisfies AgentEvent),
		);
		return;
	}

	if (parsed.type !== "message" || !parsed.content) {
		ws.send(
			JSON.stringify({ type: "error", message: "Invalid message format" } satisfies AgentEvent),
		);
		return;
	}

	session.history.push({ role: "user", content: parsed.content });

	await runAgentLoop({
		messages: [...session.history],
		onEvent: (agentEvent: AgentEvent) => {
			ws.send(JSON.stringify(agentEvent));

			if (agentEvent.type === "response") {
				session.history.push({ role: "assistant", content: agentEvent.content });
			}
		},
	});
}

export function handleWebSocketClose(ws: WSContext): void {
	sessions.delete(ws);
}
```

- [ ] **Step 2: Update the server entry point to mount WebSocket route**

Replace the full contents of `packages/backend/src/index.ts` with:

```typescript
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
	fetch: app.fetch,
	websocket,
};
```

- [ ] **Step 3: Verify the backend compiles and starts**

Run: `cd packages/backend && bunx tsc --noEmit`
Expected: No errors

Run: `cd packages/backend && timeout 3 bun run src/index.ts || true`
Expected: Server starts without crashing (will timeout after 3s — that's OK)

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/routes/chat.ts packages/backend/src/index.ts
git commit -m "feat: add WebSocket chat route with session management"
```

---

## Task 5: Frontend Vite Proxy + Shared Types

**Files:**
- Modify: `packages/frontend/vite.config.ts`
- Create: `packages/frontend/app/types.ts`

- [ ] **Step 1: Add WebSocket proxy configuration to Vite**

Replace the full contents of `packages/frontend/vite.config.ts` with:

```typescript
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: {
		port: 3000,
		proxy: {
			"/ws": {
				target: "http://localhost:5000",
				ws: true,
			},
		},
	},
	plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
```

- [ ] **Step 2: Create frontend type definitions matching backend events**

```typescript
export type AgentEvent =
	| { type: "thinking"; iteration: number }
	| { type: "tool_call"; tool: string; args: Record<string, unknown>; iteration: number }
	| { type: "tool_result"; tool: string; result: string; iteration: number }
	| { type: "response"; content: string }
	| { type: "error"; message: string };

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

export type DebugEntry = AgentEvent & {
	timestamp: number;
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/vite.config.ts packages/frontend/app/types.ts
git commit -m "feat: add vite WebSocket proxy and frontend types"
```

---

## Task 6: WebSocket Hook

**Files:**
- Create: `packages/frontend/app/hooks/useWebSocket.ts`

- [ ] **Step 1: Implement the custom WebSocket hook**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, ChatMessage, DebugEntry } from "~/types";

type UseWebSocketReturn = {
	messages: ChatMessage[];
	debugEvents: DebugEntry[];
	isConnected: boolean;
	isThinking: boolean;
	sendMessage: (content: string) => void;
};

export function useWebSocket(): UseWebSocketReturn {
	const wsRef = useRef<WebSocket | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [debugEvents, setDebugEvents] = useState<DebugEntry[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isThinking, setIsThinking] = useState(false);

	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
		wsRef.current = ws;

		ws.addEventListener("open", () => setIsConnected(true));
		ws.addEventListener("close", () => {
			setIsConnected(false);
			setIsThinking(false);
		});

		ws.addEventListener("message", (event) => {
			const data = JSON.parse(event.data) as AgentEvent;
			const entry: DebugEntry = { ...data, timestamp: Date.now() };
			setDebugEvents((prev) => [...prev, entry]);

			switch (data.type) {
				case "thinking":
					setIsThinking(true);
					break;
				case "response":
					setIsThinking(false);
					setMessages((prev) => [
						...prev,
						{
							id: crypto.randomUUID(),
							role: "assistant",
							content: data.content,
						},
					]);
					break;
				case "error":
					setIsThinking(false);
					setMessages((prev) => [
						...prev,
						{
							id: crypto.randomUUID(),
							role: "assistant",
							content: `Error: ${data.message}`,
						},
					]);
					break;
			}
		});

		return () => {
			ws.close();
		};
	}, []);

	const sendMessage = useCallback((content: string) => {
		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

		setMessages((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: "user", content },
		]);
		setDebugEvents((prev) => [
			...prev,
			{ type: "thinking", iteration: 0, timestamp: Date.now() },
		]);

		wsRef.current.send(JSON.stringify({ type: "message", content }));
	}, []);

	return { messages, debugEvents, isConnected, isThinking, sendMessage };
}
```

- [ ] **Step 2: Verify the frontend compiles**

Run: `cd packages/frontend && bunx tsc --noEmit`
Expected: No errors (or only pre-existing type generation warnings from React Router)

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/hooks/useWebSocket.ts
git commit -m "feat: add WebSocket hook for chat communication"
```

---

## Task 7: MessageInput Component

**Files:**
- Create: `packages/frontend/app/components/MessageInput.tsx`

- [ ] **Step 1: Implement the message input component**

```tsx
import { useState } from "react";

type MessageInputProps = {
	onSend: (content: string) => void;
	disabled: boolean;
};

export function MessageInput({ onSend, disabled }: MessageInputProps) {
	const [input, setInput] = useState("");

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = input.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setInput("");
	}

	return (
		<form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
			<input
				type="text"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				placeholder={disabled ? "Waiting for response..." : "Type a message..."}
				disabled={disabled}
				className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 disabled:opacity-50"
			/>
			<button
				type="submit"
				disabled={disabled || !input.trim()}
				className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Send
			</button>
		</form>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/components/MessageInput.tsx
git commit -m "feat: add MessageInput component"
```

---

## Task 8: ChatPanel Component

**Files:**
- Create: `packages/frontend/app/components/ChatPanel.tsx`

- [ ] **Step 1: Implement the chat panel component**

```tsx
import { useEffect, useRef } from "react";
import type { ChatMessage } from "~/types";

type ChatPanelProps = {
	messages: ChatMessage[];
	isThinking: boolean;
};

export function ChatPanel({ messages, isThinking }: ChatPanelProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isThinking]);

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-4">
			{messages.length === 0 && !isThinking && (
				<div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
					<p>Send a message to start chatting</p>
				</div>
			)}
			{messages.map((msg) => (
				<div
					key={msg.id}
					className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
				>
					<div
						className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
							msg.role === "user"
								? "bg-blue-600 text-white"
								: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
						}`}
					>
						{msg.content}
					</div>
				</div>
			))}
			{isThinking && (
				<div className="flex justify-start">
					<div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
						<span className="inline-flex gap-1">
							<span className="animate-bounce">.</span>
							<span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
							<span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
						</span>
					</div>
				</div>
			)}
			<div ref={bottomRef} />
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/components/ChatPanel.tsx
git commit -m "feat: add ChatPanel component with message bubbles"
```

---

## Task 9: DebugPanel Component

**Files:**
- Create: `packages/frontend/app/components/DebugPanel.tsx`

- [ ] **Step 1: Implement the debug panel component**

```tsx
import { useEffect, useRef, useState } from "react";
import type { DebugEntry } from "~/types";

type DebugPanelProps = {
	events: DebugEntry[];
};

const EVENT_STYLES: Record<string, { icon: string; color: string }> = {
	thinking: { icon: "\u{1F9E0}", color: "text-gray-500 dark:text-gray-400" },
	tool_call: { icon: "\u{1F527}", color: "text-yellow-600 dark:text-yellow-400" },
	tool_result: { icon: "\u2705", color: "text-green-600 dark:text-green-400" },
	response: { icon: "\u{1F4AC}", color: "text-blue-600 dark:text-blue-400" },
	error: { icon: "\u274C", color: "text-red-600 dark:text-red-400" },
};

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function EventDetail({ event }: { event: DebugEntry }) {
	switch (event.type) {
		case "thinking":
			return <span>Thinking... (iteration {event.iteration})</span>;
		case "tool_call":
			return (
				<span>
					Call <code className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">{event.tool}</code>
					<pre className="mt-1 text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded overflow-x-auto">
						{JSON.stringify(event.args, null, 2)}
					</pre>
				</span>
			);
		case "tool_result":
			return (
				<span>
					Result from <code className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">{event.tool}</code>
					<pre className="mt-1 text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
						{event.result}
					</pre>
				</span>
			);
		case "response":
			return <span className="truncate block max-w-full">{event.content}</span>;
		case "error":
			return <span>{event.message}</span>;
	}
}

export function DebugPanel({ events }: DebugPanelProps) {
	const [isOpen, setIsOpen] = useState(true);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [events]);

	return (
		<div
			className={`border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900 transition-all ${
				isOpen ? "w-96" : "w-10"
			}`}
		>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="p-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-b border-gray-200 dark:border-gray-700"
			>
				{isOpen ? "\u2590 Debug" : "\u258C"}
			</button>
			{isOpen && (
				<div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
					{events.length === 0 && (
						<p className="text-gray-400 dark:text-gray-500 text-xs">
							Agent events will appear here...
						</p>
					)}
					{events.map((event, i) => {
						const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.error;
						return (
							<div key={i} className={`${style.color}`}>
								<div className="flex items-start gap-2">
									<span>{style.icon}</span>
									<div className="flex-1 min-w-0">
										<span className="text-xs text-gray-400 mr-2">
											{formatTime(event.timestamp)}
										</span>
										<EventDetail event={event} />
									</div>
								</div>
							</div>
						);
					})}
					<div ref={bottomRef} />
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/components/DebugPanel.tsx
git commit -m "feat: add DebugPanel component with color-coded events"
```

---

## Task 10: Route Integration + Layout

**Files:**
- Modify: `packages/frontend/app/routes/home.tsx`
- Modify: `packages/frontend/app/app.css`

- [ ] **Step 1: Update the CSS for full-height chat layout**

Replace the full contents of `packages/frontend/app/app.css` with:

```css
@import "tailwindcss";

@theme {
	--font-sans:
		"Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
		"Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}

html,
body {
	@apply bg-white dark:bg-gray-950 h-full;

	@media (prefers-color-scheme: dark) {
		color-scheme: dark;
	}
}

#root {
	@apply h-full;
}
```

- [ ] **Step 2: Update the home route to render the chat UI**

Replace the full contents of `packages/frontend/app/routes/home.tsx` with:

```tsx
import type { Route } from "./+types/home";
import { ChatPanel } from "~/components/ChatPanel";
import { DebugPanel } from "~/components/DebugPanel";
import { MessageInput } from "~/components/MessageInput";
import { useWebSocket } from "~/hooks/useWebSocket";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Agentic Chatbot" },
		{ name: "description", content: "AI chatbot with visible agent internals" },
	];
}

export default function Home() {
	const { messages, debugEvents, isConnected, isThinking, sendMessage } =
		useWebSocket();

	return (
		<div className="flex h-full">
			<div className="flex flex-1 flex-col">
				<header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
						Agentic Chatbot
					</h1>
					<span
						className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
						title={isConnected ? "Connected" : "Disconnected"}
					/>
				</header>
				<ChatPanel messages={messages} isThinking={isThinking} />
				<MessageInput onSend={sendMessage} disabled={isThinking || !isConnected} />
			</div>
			<DebugPanel events={debugEvents} />
		</div>
	);
}
```

- [ ] **Step 3: Verify the frontend builds**

Run: `cd packages/frontend && bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/routes/home.tsx packages/frontend/app/app.css
git commit -m "feat: integrate chat UI with WebSocket hook and debug panel"
```

---

## Task 11: End-to-End Smoke Test

- [ ] **Step 1: Run all backend tests**

Run: `cd packages/backend && bun test`
Expected: All tests pass

- [ ] **Step 2: Start both servers and manually verify**

Run in terminal 1: `cd packages/backend && bun run dev`
Run in terminal 2: `cd packages/frontend && bun run dev`

Open http://localhost:3000 in a browser. Verify:
1. Connection indicator shows green
2. Type "What is 25 * 4?" and send
3. Debug panel shows thinking → tool_call (calculator) → tool_result → thinking → response events
4. Chat panel shows the final answer
5. Debug panel collapse/expand toggle works

- [ ] **Step 3: Commit any adjustments, then tag the milestone**

```bash
git add -A
git commit -m "feat: complete agentic chatbot MVP"
```
