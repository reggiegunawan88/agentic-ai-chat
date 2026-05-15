# Agentic AI Chatbot

A full-stack chatbot built to **expose how AI agents actually work under the hood** — raw OpenAI SDK, no LangChain, no agent frameworks. Every decision is visible both in your code and in the live debug panel. The **think → act → observe** loop fits in ~90 lines of TypeScript that you can watch run in real-time.

---

## What Makes This an Agent (Not Just a Chatbot)

A chatbot is a single-shot function: prompt in, text out. An **agent** wraps that function in a loop that can (1) **reason** about what to do, (2) **call tools** in the outside world, (3) **observe** the results, and (4) **reason again** with the new information. That loop is the entire difference. This repo implements the **ReAct** pattern (Reason + Act) — the same shape behind Claude Code, ChatGPT plugins, and most production agents today.

---

## The Agentic Loop — End-to-End Flow

What happens when you type *"What's the weather in Tokyo and what's 25 × 4?"*:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   [Browser]                                              [OpenAI API]    │
│       │                                                        ▲         │
│       │  1. user types message                                 │         │
│       │     { type: "message", content: "...", model: "..." } │         │
│       ▼                                                        │         │
│   ┌─────────────┐    WebSocket :5000/ws                        │         │
│   │  useChat    │ ◄─── AgentEvent stream ──┐                   │         │
│   └─────────────┘                          │                   │         │
│                                            │                   │         │
│                                  ┌─────────┴──────────┐        │         │
│                                  │  routes/chat.ts    │        │         │
│                                  │  (session state)   │        │         │
│                                  └─────────┬──────────┘        │         │
│                                            │                   │         │
│                                            ▼                   │         │
│                              ┌──────────────────────────┐      │         │
│                              │     runAgentLoop()       │      │         │
│                              │   (max 10 iterations)    │      │         │
│                              │                          │      │         │
│                              │   ┌──────────────────┐   │      │         │
│                              │   │  1. THINK        │───┼──────┘         │
│                              │   │  stream LLM      │   │                │
│                              │   │  reassemble      │   │                │
│                              │   │  tool calls      │   │                │
│                              │   └────────┬─────────┘   │                │
│                              │            │             │                │
│                              │            ▼             │                │
│                              │      tool calls?         │                │
│                              │       /        \         │                │
│                              │     NO         YES       │                │
│                              │      │          │        │                │
│                              │      ▼          ▼        │                │
│                              │   DONE     ┌─────────┐   │                │
│                              │   exit     │ 2. ACT  │   │                │
│                              │            │ Promise │   │                │
│                              │            │  .all   │   │                │
│                              │            └────┬────┘   │                │
│                              │                 │        │                │
│                              │                 ▼        │                │
│                              │           ┌──────────┐   │                │
│                              │           │3. OBSERVE│   │                │
│                              │           │push tool │   │                │
│                              │           │results to│   │                │
│                              │           │ messages │   │                │
│                              │           └────┬─────┘   │                │
│                              │                │         │                │
│                              │     loop back to THINK   │                │
│                              └──────────────────────────┘                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Step by step

**1. Message enters.** Frontend sends `{ type: "message", content, model }` over WebSocket. `handleWebSocketMessage` (`routes/chat.ts`) appends it to per-connection session history and calls `runAgentLoop`.

**2. THINK — the LLM decides.** `consumeStream` (`agentic-loop/think.ts`) calls OpenAI with the full conversation, tool definitions, and `stream: true`. As chunks arrive, text deltas are emitted as `response_delta` events (driving the typewriter UI) and tool-call fragments — which arrive split across many chunks (e.g. `{`, `"exp`, `ression":`, …) — are reassembled by index into complete tool call objects. Returns `{ content, toolCalls, finishReason }`.

**3. Decision point.** `finishReason === "stop"` (no tools requested) → emit `response_end`, exit. Tool calls present → continue to ACT. *The LLM signals this through the structure of its own response — not our code.*

**4. ACT — execute in parallel.** `executeToolCalls` (`agentic-loop/act.ts`) parses each call's JSON args, emits a `tool_call` event, runs them concurrently via `Promise.all` (so `calculator` and `weather` fire simultaneously), and emits a `tool_result` event per result.

**5. OBSERVE — feed results back.** Each result is pushed onto `conversationMessages[]` as `{ role: "tool", tool_call_id, content }`. **This array is the LLM's memory** — there is no other state between calls. The next iteration resends the whole growing array:

```
Iteration 1: [ system, user_msg ]
Iteration 2: [ system, user_msg, assistant(tool_calls), tool_result, tool_result ]
Iteration 3: [ system, user_msg, assistant(tool_calls), tool_result, tool_result, assistant(tool_calls), tool_result ]
```

**6. Loop back to THINK** with the new context. The LLM now sees its prior calls + results and either answers or requests more tools.

**7. Safety valve.** `maxIterations` (default 10) caps runaway loops with an error event rather than burning tokens forever.

---

## The Event Protocol

Every loop phase emits a typed `AgentEvent`:

| Event | When | Used For |
|---|---|---|
| `thinking` | Start of each iteration | "Thinking…" label + elapsed timer |
| `tool_call` | Before a tool executes | Debug panel: tool name + args |
| `tool_result` | After a tool returns | Debug panel: the output |
| `response_delta` | Per text token from the LLM | Typewriter streaming in the UI |
| `response_end` | Final response complete | Persist to localStorage, exit loop |
| `error` | API/parse failure, max-iter reached | Surface to user |

The same discriminated union in `agent/types.ts` is simultaneously the **WebSocket wire format**, the **debug panel renderer key**, and the **frontend state machine input** — TypeScript enforces exhaustiveness across all three.

---

## Why the Debug Panel Matters

The right-side panel renders every `AgentEvent` live. While an agent runs, you literally see:

```
⋯  Thinking            Iteration 1
⚒  Tool Call           weather       { city: "Tokyo" }
⚒  Tool Call           calculator    { expression: "25 * 4" }
✓  Tool Result         weather       Weather for Tokyo, JP: …
✓  Tool Result         calculator    100
⋯  Thinking            Iteration 2
▸  Streaming           Streaming tokens…
››  Response Complete   The weather in Tokyo is …
```

This is the educational core: watching the loop iterate turns "AI agent" from buzzword into mental model.

---

## The Tools (Action Space)

Six tools, each a single file in `agent/tools/` exporting `{ definition, handler }` — `definition` is the JSON schema sent to the LLM, `handler` is the TS function dispatched to when the LLM picks it.

| Tool | What it does | API key? |
|---|---|---|
| `calculator` | Math expressions via `mathjs` (safe — not `eval`) | No |
| `web_search` | Tavily search, top 3 results | `TAVILY_API_KEY` |
| `read_url` | Fetch + HTML→text, 5KB cap, 10s timeout | No |
| `date_time` | now / diff / add | No |
| `weather` | City → coords → Open-Meteo (free) | No |
| `code_runner` | JS in `node:vm` sandbox, 5s timeout | No |

Adding a new tool is one file in `agent/tools/` plus one import in `agent/tools/index.ts`.

---

## Setup

```bash
bun install
cp .env.example .env       # add OPENAI_API_KEY (required), TAVILY_API_KEY (optional)
bun run dev                # runs frontend + backend together
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:5000`

---

## Key Features

- **Hand-built ReAct loop** — every decision point is your code, not a framework's
- **Token-level streaming** — typewriter UI with 30ms flush, decoupled from network rate
- **Parallel tool execution** — independent tools run concurrently via `Promise.all`
- **Real-time debug panel** — thinking → tool calls → results → response, live
- **Multi-iteration chaining** — the agent can call tools, observe, then call more tools
- **Chat persistence** — localStorage today, swappable `ChatStorage` interface for any backend
- **Sandboxed code execution** — `code_runner` lets the agent solve problems by writing JS
- **Typed event protocol** — one `AgentEvent` union drives WebSocket, debug panel, and chat UI
