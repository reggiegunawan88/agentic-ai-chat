# Agentic AI Chatbot

A full-stack chatbot built to **expose how AI agents actually work under the hood**. Built from scratch with the raw OpenAI SDK — no LangChain, no agent frameworks — so every decision the agent makes is visible in your code and in the live debug panel.

The goal isn't to wrap an LLM in a chat UI. The goal is to make the **think → act → observe** loop something you can read in ~90 lines of TypeScript and watch happen in real-time.

---

## What Makes This an Agent (Not Just a Chatbot)

A chatbot is a single-shot function: prompt in, text out.

An **agent** is what happens when you put that function inside a loop that can:

1. **Reason** about what to do next
2. **Call tools** in the outside world
3. **Observe** the results
4. **Reason again** with the new information

That loop is the entire difference. This repo implements the **ReAct** pattern (Reason + Act) — the same pattern behind Claude Code, ChatGPT plugins, and most production agents today.

---

## The Agentic Loop — End-to-End Flow

Here's what happens when you type a message like *"What's the weather in Tokyo and what's 25 × 4?"*:

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

**1. The message enters the system.**
The frontend sends `{ type: "message", content, model }` over WebSocket. `handleWebSocketMessage` in `routes/chat.ts` appends it to the per-connection session history and calls `runAgentLoop`.

**2. THINK — the LLM decides what to do.**
`consumeStream` (`agentic-loop/think.ts`) calls OpenAI with the full conversation, the tool definitions, and `stream: true`. As chunks arrive, two things happen in parallel:
- **Text deltas** are emitted as `response_delta` events for the typewriter UI
- **Tool-call fragments** (which arrive split across many chunks — e.g. `{`, `"exp`, `ression":`, …) are reassembled into complete tool call objects, keyed by index

When the stream ends, `consumeStream` returns `{ content, toolCalls, finishReason }`.

**3. Decision point — respond or act?**

- `finishReason === "stop"` (no tools requested) → emit `response_end`, exit the loop. **Done.**
- Tool calls present → continue to ACT.

This isn't *our* decision — the LLM itself signals it through the structure of its response.

**4. ACT — execute all tools in parallel.**
`executeToolCalls` (`agentic-loop/act.ts`):
- Parses JSON arguments for each tool call
- Emits a `tool_call` event for each (so the debug panel shows them firing)
- Runs them concurrently with `Promise.all` — `calculator` and `weather` fire at the same time, not one after the other
- Emits a `tool_result` event for each as they complete

**5. OBSERVE — feed the results back into the LLM's memory.**
Each tool result is pushed onto `conversationMessages[]` as `{ role: "tool", tool_call_id, content }`. This array **is** the LLM's memory — it has no other state between calls. The next iteration sends the whole growing array back to OpenAI.

```
Iteration 1: [ system, user_msg ]
Iteration 2: [ system, user_msg, assistant(tool_calls), tool_result, tool_result ]
Iteration 3: [ system, user_msg, assistant(tool_calls), tool_result, tool_result, assistant(tool_calls), tool_result ]
```

**6. Loop back to THINK** with the new context. The LLM now sees its own prior tool calls and their results, and either answers the user or requests more tools.

**7. Safety valve.** If `maxIterations` (default 10) is reached without a final answer, the loop emits an error rather than burning tokens forever.

---

## The Event Protocol

Every phase of the loop emits a typed `AgentEvent`:

| Event | When | Used For |
|---|---|---|
| `thinking` | Start of each iteration | "Thinking…" label + elapsed timer |
| `tool_call` | Before a tool executes | Debug panel shows tool name + args |
| `tool_result` | After a tool returns | Debug panel shows the output |
| `response_delta` | Per text token from the LLM | Typewriter streaming in the UI |
| `response_end` | Final response complete | Persist to localStorage, exit loop |
| `error` | API failure, parse failure, max-iter | Surface to user |

The same discriminated union (`agent/types.ts`) is the **WebSocket wire format**, the **debug panel renderer key**, and the **frontend state machine input**. TypeScript enforces exhaustiveness across all three.

---

## Why the Debug Panel Matters

The right-side debug panel renders every `AgentEvent` in real-time. As an agent runs, you literally see:

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

This is the educational core. Watching the loop iterate is what turns "AI agent" from a buzzword into something you understand.

---

## Project Structure

```
packages/
├── backend/src/
│   ├── index.ts                      Hono server + WebSocket setup
│   ├── env.ts                        Loads from .env locally, SSM on Lambda
│   ├── routes/chat.ts                WebSocket handler, session state
│   └── agent/
│       ├── types.ts                  AgentEvent + ClientMessage union types
│       ├── agentic-loop/
│       │   ├── index.ts              The ReAct loop orchestrator (~90 lines)
│       │   ├── think.ts              LLM streaming + tool-call fragment reassembly
│       │   ├── act.ts                Parallel tool execution + observe
│       │   └── types.ts              AgentLoopParams, AssembledToolCall
│       ├── tools/
│       │   ├── index.ts              Tool registry + dispatcher
│       │   ├── calculator.ts         mathjs (safe — not eval)
│       │   ├── web-search.ts         Tavily API
│       │   ├── read-url.ts           Fetch + HTML→text, capped at 5KB
│       │   ├── date-time.ts          now / diff / add
│       │   ├── weather.ts            Open-Meteo (no API key)
│       │   └── code-runner.ts        node:vm sandbox, 5s timeout
│       └── __tests__/
│           ├── loop.test.ts          Mocks the OpenAI stream
│           └── tools.test.ts
└── frontend/app/
    ├── routes/
    │   ├── layout.tsx                Sidebar + main layout
    │   ├── home.tsx                  Landing page with suggestions
    │   └── chat.tsx                  Chat interface
    ├── components/
    │   ├── ChatPanel.tsx             Messages + streaming typewriter
    │   ├── ChatSidebar.tsx           Chat history list
    │   ├── DebugPanel.tsx            Real-time agent event viewer
    │   └── MessageInput.tsx          Input + model selector
    ├── hooks/useChat.ts              WebSocket + state machine
    └── storage/localStorage.ts       Chat persistence (swappable interface)
```

The three files in `agent/agentic-loop/` are the whole agent. If you read them in this order — `index.ts`, then `think.ts`, then `act.ts` — you'll have the entire loop in your head in about 10 minutes.

---

## The Tools (Action Space)

The agent has 6 tools it can choose from. Each tool exports `{ definition, handler }` — `definition` is the JSON schema sent to the LLM, `handler` is the TypeScript function executed when the LLM picks it.

| Tool | What it does | API key? |
|---|---|---|
| `calculator` | Evaluates math expressions via `mathjs` (not `eval` — no arbitrary code) | No |
| `web_search` | Searches the web via Tavily, returns top 3 results | `TAVILY_API_KEY` |
| `read_url` | Fetches a URL, strips HTML, caps at 5KB, 10s timeout | No |
| `date_time` | Current date/time, date diffs, date math | No |
| `weather` | City → coordinates → current weather (Open-Meteo, free) | No |
| `code_runner` | Executes JavaScript in a `node:vm` sandbox with 5s timeout | No |

Adding a new tool is one file in `agent/tools/` plus one import in `agent/tools/index.ts`.

---

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Bun workspaces |
| Frontend | React 19, React Router 7, Tailwind CSS 4 |
| Backend | Hono on Bun runtime |
| LLM | OpenAI Chat Completions (raw SDK, streaming) |
| Transport | WebSocket (`AgentEvent` stream) |
| Storage | localStorage (PostgreSQL-ready interface) |
| Code quality | Biome |
| Deploy | Multi-stage Docker, ECR via GitHub Actions OIDC |

---

## Setup

```bash
# Install
bun install

# Configure
cp .env.example .env
# Fill in OPENAI_API_KEY (required) and TAVILY_API_KEY (optional)

# Run frontend + backend together
bun run dev
```

Frontend: `http://localhost:3000`  ·  Backend: `http://localhost:5000`

---

## Reading Order

If you're here to learn how agents work, read in this order:

1. **`docs/agentic-loop-process.md`** — narrative walkthrough of one request through the loop
2. **`packages/backend/src/agent/agentic-loop/index.ts`** — the loop itself
3. **`packages/backend/src/agent/agentic-loop/think.ts`** — streaming + tool-call reassembly
4. **`packages/backend/src/agent/agentic-loop/act.ts`** — parallel execution + observe
5. **`docs/agentic-reasoning-patterns.md`** — how ReAct compares to ReWOO, CodeAct, Reflexion, Plan-and-Execute, Tree of Thoughts, LATS

---

## Key Features

- **Hand-built ReAct loop** — every decision point is your code, not a framework's
- **Token-level streaming** — typewriter UI with 30ms flush, decoupled from network rate
- **Parallel tool execution** — independent tools run concurrently via `Promise.all`
- **Real-time debug panel** — see thinking → tool calls → results → response, live
- **Multi-iteration chaining** — the agent can call tools, observe, then call more tools
- **Chat persistence** — localStorage today, swappable `ChatStorage` interface for any backend
- **Sandboxed code execution** — `code_runner` lets the agent solve problems by writing JS
- **Typed event protocol** — one `AgentEvent` union drives WebSocket, debug panel, and chat UI
