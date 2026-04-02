# Agentic Chatbot — Design Spec

## Purpose

A learning-focused chatbot application that exposes how AI agentic processes work under the hood. The user builds the entire agent orchestration layer from scratch — the think-act-observe loop, tool dispatch, and multi-step reasoning — using only the raw OpenAI SDK. A debug panel shows every internal decision in real-time.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Bun workspaces |
| Frontend | React Router (TypeScript) |
| Backend | Hono (TypeScript, running on Bun) |
| LLM | OpenAI GPT-4o (raw SDK, no agent frameworks) |
| Communication | WebSocket (real-time debug events + chat) |

## Project Structure

```
agentic-ai/
├── package.json                  # Bun workspace root
├── bun.lock
├── packages/
│   ├── frontend/                 # React Router app
│   │   ├── package.json
│   │   ├── app/
│   │   │   ├── root.tsx
│   │   │   ├── routes/
│   │   │   │   └── _index.tsx    # Main chat page
│   │   │   └── components/
│   │   │       ├── ChatPanel.tsx      # Chat messages UI
│   │   │       ├── MessageInput.tsx   # User input box
│   │   │       └── DebugPanel.tsx     # Agent internals viewer
│   │   └── vite.config.ts
│   └── backend/                  # Hono API server
│       ├── package.json
│       ├── src/
│       │   ├── index.ts          # Hono app entry + WebSocket upgrade
│       │   ├── agent/
│       │   │   ├── loop.ts       # Core agent loop (think → act → observe)
│       │   │   ├── tools.ts      # Tool definitions + implementations
│       │   │   └── types.ts      # Event types for debug stream
│       │   └── routes/
│       │       └── chat.ts       # Chat WebSocket route handler
│       └── .env                  # OpenAI API key (gitignored)
├── .gitignore
└── tsconfig.json                 # Shared TS config
```

## Core Architecture

### The Agent Loop (`packages/backend/src/agent/loop.ts`)

This is the central learning piece. The orchestrator is built from scratch — no LangChain, no Vercel AI SDK agent mode, no frameworks. Only the raw OpenAI SDK (`openai.chat.completions.create()`).

**Cycle:**

```
User Message
    ↓
┌──────────────────────────────────────┐
│  1. THINK: Send messages + history   │
│     to OpenAI with tool definitions  │
│     → LLM decides: respond or call   │
│       a tool                         │
│                                      │
│  2. ACT: If tool_calls in response,  │
│     execute the requested tool(s)    │
│     → Append tool results to history │
│                                      │
│  3. OBSERVE: Loop back to step 1     │
│     → LLM sees tool results, decides │
│       next action or final response  │
└──────────────────────────────────────┘
    ↓ (when LLM responds without tool calls)
Final Response to User
```

**Key behaviors:**
- Maximum iteration limit (10) to prevent runaway loops
- Each step emits a typed debug event over WebSocket
- Conversation history maintained per WebSocket session
- The orchestrator code is fully hand-written — the user controls every decision point

### Tools (`packages/backend/src/agent/tools.ts`)

MVP includes two tools:

**1. Calculator**
- Input: `{ expression: string }` (e.g., `"2 + 2 * 3"`)
- Uses a safe math expression evaluator (e.g., `mathjs` library) — no `eval()`
- Demonstrates: basic synchronous tool calling

**2. Web Search**
- Input: `{ query: string }` (e.g., `"latest AI news"`)
- Uses a search API (Tavily recommended — simple API, good free tier, built for LLM use cases)
- Demonstrates: async tool execution, handling external API results

Both tools are defined as OpenAI function-calling JSON schemas so the LLM knows what's available and can choose which to invoke.

### Debug Events (`packages/backend/src/agent/types.ts`)

Typed events emitted at each step of the agent loop:

```typescript
type AgentEvent =
  | { type: "thinking"; iteration: number }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; iteration: number }
  | { type: "tool_result"; tool: string; result: string; iteration: number }
  | { type: "response"; content: string }
  | { type: "error"; message: string }
```

### WebSocket Communication (`packages/backend/src/routes/chat.ts`)

**Client → Server:**
```json
{ "type": "message", "content": "What is 25 * 4 and search for today's weather?" }
```

**Server → Client (stream of events):**
```json
{ "type": "thinking", "iteration": 1 }
{ "type": "tool_call", "tool": "calculator", "args": { "expression": "25 * 4" }, "iteration": 1 }
{ "type": "tool_result", "tool": "calculator", "result": "100", "iteration": 1 }
{ "type": "thinking", "iteration": 2 }
{ "type": "tool_call", "tool": "web_search", "args": { "query": "today's weather" }, "iteration": 2 }
{ "type": "tool_result", "tool": "web_search", "result": "...", "iteration": 2 }
{ "type": "thinking", "iteration": 3 }
{ "type": "response", "content": "25 × 4 = 100. As for the weather..." }
```

## Frontend Design

### Layout

Side-by-side layout: chat panel (left) + collapsible debug panel (right).

### Chat Panel (left)
- Standard chat bubble UI (user messages and agent responses)
- Message input at the bottom with send button
- Displays only the final, clean response from the agent

### Debug Panel (right, collapsible)
- Real-time stream of agent events from WebSocket
- Visual distinction per event type (color-coded or icon-coded):
  - **Thinking** — brain icon, muted color
  - **Tool Call** — wrench icon, shows tool name + arguments
  - **Tool Result** — checkmark, shows returned data
  - **Error** — red, shows error message
- Timestamp on each event
- Events grouped by conversation turn (collapsible)
- Toggle button to show/hide the panel

## Environment & Configuration

- OpenAI API key stored in `packages/backend/.env` (gitignored)
- Tavily API key (for web search) in same `.env`
- Frontend proxies WebSocket to backend during development

## Out of Scope (future improvements)

- Persistent chat history (in-memory only for MVP)
- Authentication
- Additional tools (file ops, code execution)
- Streaming LLM text (full response only for MVP)
- Deployment / production hosting
