# Agentic AI — Project Progress

An educational chatbot that exposes how AI agentic processes work in real-time. Built from scratch using the raw OpenAI SDK — no LangChain, no Vercel AI SDK — so every decision point in the agent loop is visible through a debug panel.

## Stack

- **Monorepo**: Bun workspaces
- **Frontend**: React Router v7, React 19, Tailwind CSS v4, Vite
- **Backend**: Hono v4, Bun runtime
- **LLM**: OpenAI GPT-4.1-mini (raw SDK)
- **Transport**: WebSocket (real-time event streaming)
- **Code Quality**: Biome (formatter + linter)

## Architecture

```
┌─────────────┬──────────────────────┬──────────────┐
│  ChatSidebar│   ChatPanel + Input  │  DebugPanel  │
│  (left)     │   (center)           │  (right)     │
│  280px      │   flex-1             │  384px       │
│             │                      │              │
│  Recents    │  [user message]      │  ⋯ Thinking  │
│  - Chat 1   │  [assistant reply]   │  ⚒ Tool Call │
│  - Chat 2   │  [streaming...|]     │  ✓ Result    │
│  - ...      │                      │  ▸ Streaming │
│             │  [input field]       │  ›› Complete  │
└─────────────┴──────────────────────┴──────────────┘
```

**Mobile (< 768px):** Both side panels become full-screen overlays with floating toggle buttons. Min supported width: 360px.

## Commit History

### `e311ffa` — Scaffold monorepo
- Bun workspaces with `packages/backend` and `packages/frontend`
- Shared tsconfig, Biome config
- `bun run dev` runs both packages in parallel

### `b2b92dd` — Design spec
- Added agentic chatbot design document (`docs/superpowers/specs/`)

### `e4c60c7` — Scaffold backend
- Hono server on port 5000
- Health check endpoint (`GET /health`)

### `f04fa32` — Chat UI
- Dark theme (`#1a1a1a`) with Claude-style design
- Landing page with time-based greeting and suggestion pills
- `/chat/:id` route with ChatPanel, DebugPanel, MessageInput
- WebSocket hook (`useChat`) for real-time agent event streaming
- Collapsible debug panel showing color-coded agent events (thinking, tool calls, results, responses, errors)

### `7b11354` — Agentic loop + tools
- Hand-built think-act-observe cycle using raw OpenAI SDK
- Agent loop: calls GPT-4.1-mini with tool definitions, executes tools sequentially, loops until final response (max 10 iterations)
- **Calculator tool**: uses `mathjs` for safe math evaluation
- **Web search tool**: Tavily API, returns top 3 results
- Tool registry pattern: each tool exports `definition` + `handler`
- WebSocket route with per-session conversation history
- Unit tests for loop (3 tests) and tools (5 tests) with mocked OpenAI client

### `9159e80` — Thinking indicator polish
- Replaced bouncing dots with rotating thinking labels (Thinking, Pondering, Reasoning, etc.)
- Added elapsed time counter (seconds)

### `5d91761` — Refactor tools
- Split monolithic `tools.ts` into `tools/` directory
- Each tool file (`calculator.ts`, `web-search.ts`) collocates its definition + handler
- `tools/index.ts` composes tool definitions and dispatcher

### `95e47b8` — Streaming responses (backend)
- Replaced non-streaming `openai.chat.completions.create()` with `stream: true`
- New event types: `response_delta` (per-token) and `response_end` (final content)
- Tool call fragments accumulated server-side before executing
- Added `restore` message type: populates session history for resumed chats without triggering the agent loop
- Updated tests with async iterable mocks for streaming API

### `1819887` — Streaming UI, persistence, sidebar, responsive
- **Typewriter effect**: Tokens buffered in a queue, flushed at 30ms intervals for readable pacing
- **Chat persistence**: localStorage with swappable `ChatStorage` interface (designed for future PostgreSQL migration)
  - Storage keys: `chat:meta` (index) + `chat:messages:{id}` (per-chat)
  - Saves after each completed response
  - SSR-safe with `typeof window` guard
- **Left sidebar**: Shows recent chats, title = first user message (truncated)
  - Desktop: 280px collapsible panel
  - Mobile: floating hamburger button + full-screen overlay
  - Active chat highlighted, delete on hover
  - "New Chat" button
- **Layout route**: Wraps home + chat routes, manages sidebar state, passes `refreshChats` via outlet context
- **Responsive UI**: Min 360px support
  - Message bubbles: `max-w-[85%]` on mobile, `70%` on desktop
  - Scaled text and spacing throughout
  - Both panels (sidebar + debug) become full-screen overlays on mobile
- **Auto-focus**: Input field auto-focuses when response completes

### `9030b91` — Parallel tool execution, URL reader, loop refactor
- Parallel tool execution using `Promise.all` for concurrent tool calls
- New **URL reader tool** (`read-url.ts`): fetches and extracts content from URLs
- Refactored agent loop into `agentic-loop/` directory for better separation

### `515e17f` — Code comments
- Step-by-step comments added to WebSocket message handler

### `21fe3ff` — Linter fixes
- Applied Biome formatting fixes

### `add2e59` — Markdown rendering
- Assistant responses rendered with `react-markdown` and syntax highlighting
- Locked dependency versions

### `c295b20` — Model selection
- Model selection dropdown in the UI (gpt-4.1-nano, gpt-5-nano)

## Current File Structure

```
packages/
├── backend/
│   └── src/
│       ├── index.ts                  (Hono app + WebSocket setup)
│       ├── routes/
│       │   └── chat.ts              (WebSocket handler, session state, restore)
│       └── agent/
│           ├── types.ts             (AgentEvent, ClientMessage)
│           ├── agentic-loop/
│           │   ├── index.ts         (main loop orchestrator)
│           │   ├── think.ts         (LLM call step)
│           │   ├── act.ts           (parallel tool execution step)
│           │   └── types.ts         (loop-specific types)
│           ├── tools/
│           │   ├── index.ts         (registry + executor)
│           │   ├── calculator.ts
│           │   ├── web-search.ts
│           │   └── read-url.ts
│           └── __tests__/
│               ├── loop.test.ts
│               └── tools.test.ts
└── frontend/
    └── app/
        ├── root.tsx                  (HTML layout, fonts, error boundary)
        ├── routes.ts                 (route config with layout wrapper)
        ├── types.ts                  (AgentEvent, ChatMessage, ChatMeta, DebugEntry)
        ├── storage/
        │   ├── types.ts             (ChatStorage interface)
        │   ├── localStorage.ts      (localStorage implementation)
        │   └── index.ts             (default instance)
        ├── hooks/
        │   └── useChat.ts           (WebSocket, streaming, persistence)
        ├── routes/
        │   ├── layout.tsx           (sidebar + outlet)
        │   ├── home.tsx             (landing page)
        │   └── chat.tsx             (chat page)
        └── components/
            ├── ChatPanel.tsx        (messages + thinking indicator)
            ├── ChatSidebar.tsx      (recent chats list)
            ├── DebugPanel.tsx       (agent event timeline)
            └── MessageInput.tsx     (textarea + send)
```

## What's Working

- Full agent loop: think → act (tools) → observe → respond
- Token-level streaming with typewriter effect
- Calculator, web search, and URL reader tools
- Parallel tool execution (multiple tools run concurrently)
- Markdown rendering with syntax highlighting for assistant responses
- Model selection dropdown (gpt-4.1-nano, gpt-5-nano)
- Chat persistence across page refreshes
- Chat resume with backend history restore
- Sidebar with recent chats, navigation, delete
- Responsive design (360px to desktop)
- Debug panel showing full agent internals
- 8 passing backend tests

## Potential Next Steps

- Streaming tool call detection (show "calling calculator..." before full args arrive)
- More tools (code interpreter, etc.)
- Chat search/filter in sidebar
- PostgreSQL storage backend (interface already defined)
- Frontend tests
- Authentication
- Deployment
