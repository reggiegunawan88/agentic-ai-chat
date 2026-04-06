# Agentic Reasoning Patterns

A deep dive into the reasoning loop architectures that power AI agents — from the foundational ReAct pattern to advanced multi-path exploration. This document maps each pattern to our codebase and evaluates what we could implement next.

## Table of Contents

1. [The Core Idea: Why Loops Matter](#the-core-idea-why-loops-matter)
2. [ReAct: Reason + Act](#react-reason--act)
3. [ReWOO: Reasoning Without Observation](#rewoo-reasoning-without-observation)
4. [CodeAct: Think-Code-Observe](#codeact-think-code-observe)
5. [Reflexion: Learn from Mistakes](#reflexion-learn-from-mistakes)
6. [Plan-and-Execute](#plan-and-execute)
7. [Tree of Thoughts (ToT)](#tree-of-thoughts-tot)
8. [Language Agent Tree Search (LATS)](#language-agent-tree-search-lats)
9. [Pattern Comparison](#pattern-comparison)
10. [Where Our Agent Stands](#where-our-agent-stands)
11. [What We Could Build Next](#what-we-could-build-next)
12. [Sources](#sources)

---

## The Core Idea: Why Loops Matter

A language model on its own is a single-shot function: prompt in, text out. An **agent** is what happens when you put that function inside a loop that can interact with the outside world.

The simplest form:

```
while not done:
    think    →  LLM decides what to do
    act      →  execute a tool, call an API, write code
    observe  →  feed the result back to the LLM
```

This loop is what transforms a chatbot into an agent. The differences between the patterns below are about **how** the agent thinks, **when** it acts, and **what** it does with the observations.

---

## ReAct: Reason + Act

**Origin:** Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (ICLR 2023)

The foundational pattern. ReAct interleaves **chain-of-thought reasoning** with **tool use** in a single loop.

### How It Works

```
┌─────────────────────────────────────────┐
│              ReAct Loop                 │
│                                         │
│   Thought  →  "I need to search for X" │
│   Action   →  web_search("X")          │
│   Observation → [search results]        │
│                                         │
│   Thought  →  "Result #2 looks best,   │
│                let me read it"          │
│   Action   →  read_url(url)            │
│   Observation → [page content]          │
│                                         │
│   Thought  →  "Now I can answer"       │
│   Response →  final answer to user      │
└─────────────────────────────────────────┘
```

Each iteration, the model:

1. **Thinks** — verbalizes its reasoning (what do I know? what do I need?)
2. **Acts** — calls a tool based on the reasoning
3. **Observes** — receives the tool result
4. **Loops** — reasons again with the new information, or responds

### Key Insight

The power of ReAct is that reasoning and acting **inform each other**:
- **Reason to act**: The model uses chain-of-thought to decide *which* tool to call and *why*
- **Act to reason**: Tool results give the model new information to reason about, reducing hallucination

This is why ReAct significantly outperforms pure chain-of-thought (which hallucinates facts) and pure action-only agents (which act without strategy).

### Strengths

- Highly **explainable** — you can see the model's reasoning at every step
- **Adaptive** — can change strategy mid-execution based on what tools return
- **Self-correcting** — if a tool returns an error, the model can reason about it and try something else
- Natural fit for **tool-using agents** with OpenAI function calling

### Weaknesses

- **High token usage** — explicit reasoning at every step is expensive
- **Sequential** — each think-act-observe cycle waits for the previous one
- **No long-term memory** — errors from earlier iterations aren't explicitly learned from

### This Is What We Built

Our `loop.ts` implements ReAct. Here's the mapping:

| ReAct Concept | Our Implementation |
|---------------|-------------------|
| Think | `onEvent({ type: "thinking" })` — the LLM call itself is the reasoning step |
| Act | `executeTool(name, args)` — tool execution |
| Observe | Tool result pushed to `conversationMessages` as `role: "tool"` |
| Loop | `for` loop with `maxIterations` guard |
| Terminate | `finish_reason === "stop"` — model decides it's done |

The debug panel makes the ReAct loop visible in real-time, which is the educational core of the project.

---

## ReWOO: Reasoning Without Observation

**Origin:** Xu et al., "ReWOO: Decoupling Reasoning from Observations for Efficient Augmented Language Models" (2023)

ReWOO challenges ReAct's fundamental assumption: do you really need to observe each result before planning the next step?

### How It Works

```
┌──────────────────────────────────────────┐
│              ReWOO Flow                  │
│                                          │
│  ┌──────────┐                            │
│  │ Planner  │  Creates full plan upfront │
│  │          │  with placeholder variables │
│  └────┬─────┘                            │
│       │                                  │
│  ┌────▼─────┐   Executes ALL tools       │
│  │ Workers  │   in parallel, no LLM      │
│  │          │   calls between steps       │
│  └────┬─────┘                            │
│       │                                  │
│  ┌────▼─────┐   Combines plan + all      │
│  │ Solver   │   results into final       │
│  │          │   answer                    │
│  └──────────┘                            │
└──────────────────────────────────────────┘
```

Three distinct phases:

1. **Planner** — one LLM call that generates the entire plan with abstract placeholders (`#E1`, `#E2`) for data it doesn't have yet
2. **Workers** — execute all tool calls in parallel, no reasoning between them
3. **Solver** — one LLM call that combines the plan with all results

### Key Insight

By front-loading all reasoning into the planning phase, ReWOO eliminates the interleaved LLM calls that make ReAct expensive. Token usage drops **5-10x** compared to ReAct for structured tasks.

### Strengths

- **Dramatically cheaper** — only 2 LLM calls (plan + solve) regardless of tool count
- **Parallel execution** — all tools run simultaneously
- **Fast** — no waiting for reasoning between tool calls

### Weaknesses

- **Fragile** — if the initial plan is wrong, there's no way to recover
- **No adaptation** — can't pivot based on what tools return
- **Fails on ambiguity** — needs predictable, well-defined tasks

### When to Use

Best for structured, predictable workflows: "Fetch data from these 5 sources and compile a report." Not suitable for exploratory tasks where the next step depends on what you find.

---

## CodeAct: Think-Code-Observe

**Origin:** Wang et al., "Executable Code Actions Elicit Better LLM Agents" (2024)

Instead of calling pre-defined tools, the agent **writes and executes code** as its action mechanism.

### How It Works

```
┌─────────────────────────────────────────────┐
│              CodeAct Loop                   │
│                                             │
│   Thought  →  "I need to process this data" │
│   Code     →  writes Python/JS to solve it  │
│   Execute  →  runs in sandboxed interpreter  │
│   Observe  →  sees output, errors, traceback │
│                                             │
│   Thought  →  "Got a TypeError, let me fix" │
│   Code     →  writes corrected version       │
│   Execute  →  runs again                     │
│   Observe  →  success                        │
└─────────────────────────────────────────────┘
```

### Key Insight

Code is a more expressive action space than a fixed set of tool APIs. An agent that can write `for` loops, conditionals, and data transformations can solve problems that no pre-defined tool anticipated. The agent essentially **creates its own tools on the fly**.

### Strengths

- **General-purpose** — can solve novel problems by writing custom logic
- **Self-debugging** — sees errors and iterates on its own code
- **Composable** — can combine multiple operations in a single code block

### Weaknesses

- **Security risk** — executing arbitrary code requires strict sandboxing
- **Expensive on failure** — debugging iterations burn tokens
- **Infrastructure needed** — requires a sandboxed runtime environment

### Relevance to Our Project

A code interpreter tool would bring CodeAct into our agent. The model writes JS/TS, we execute it in a sandboxed Bun worker, return stdout/stderr. This would be a powerful addition that teaches the self-debugging loop.

---

## Reflexion: Learn from Mistakes

**Origin:** Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (NeurIPS 2023)

Reflexion extends ReAct by adding a **self-critique** step and **episodic memory** — the agent evaluates its own performance and stores lessons for future attempts.

### How It Works

```
┌─────────────────────────────────────────────────┐
│              Reflexion Loop                     │
│                                                 │
│   ┌──────────┐                                  │
│   │  Actor   │  Attempts the task (ReAct loop) │
│   └────┬─────┘                                  │
│        │                                        │
│   ┌────▼──────┐                                 │
│   │ Evaluator │  Scores the attempt             │
│   │           │  (tests pass? goal met?)        │
│   └────┬──────┘                                 │
│        │                                        │
│   ┌────▼──────────┐                             │
│   │ Self-Reflect   │  "What went wrong? What    │
│   │                │   should I do differently?" │
│   └────┬───────────┘                            │
│        │                                        │
│   ┌────▼──────┐                                 │
│   │  Memory   │  Stores reflection as text      │
│   └────┬──────┘                                 │
│        │                                        │
│        └──── Retry with reflections in context  │
└─────────────────────────────────────────────────┘
```

### Key Insight

Instead of updating model weights (expensive, requires training infrastructure), Reflexion uses **verbal reinforcement** — the agent writes down what it learned as text, and that text is included in future attempts as context. This is "learning" without fine-tuning.

### Strengths

- **Self-improving** — gets better across attempts
- **Reduces hallucination** — self-critique catches errors
- **No training required** — learning happens through text, not weight updates
- **Cheap** — compared to fine-tuning or RLHF

### Weaknesses

- **More LLM calls** — evaluation + reflection are extra passes
- **Needs structured evaluation** — requires a way to score attempts (tests, assertions, human feedback)
- **Memory management** — reflections accumulate and can fill the context window

### Relevance to Our Project

We could add a reflection step that fires when a tool returns an error: instead of just passing the error to the next iteration, the agent explicitly reflects on *why* it failed and *what to try instead*. This would be visible in the debug panel as a `reflection` event.

---

## Plan-and-Execute

**Origin:** Inspired by classical AI planning; adapted for LLMs by multiple teams (Wang et al., 2023)

Separates planning from execution into two distinct phases, like a project manager who writes a plan and then hands tasks to specialists.

### How It Works

```
┌──────────────────────────────────────────────┐
│           Plan-and-Execute Flow              │
│                                              │
│  ┌──────────┐                                │
│  │ Planner  │  "Here are the 4 steps needed" │
│  └────┬─────┘                                │
│       │                                      │
│  ┌────▼─────┐                                │
│  │ Step 1   │ → execute → result             │
│  ├──────────┤                                │
│  │ Step 2   │ → execute → result             │
│  ├──────────┤                                │
│  │ Step 3   │ → execute → result             │
│  ├──────────┤                                │
│  │ Step 4   │ → execute → result             │
│  └────┬─────┘                                │
│       │                                      │
│  ┌────▼──────┐  Optional: replan if needed   │
│  │ Re-planner│                               │
│  └───────────┘                               │
└──────────────────────────────────────────────┘
```

### Key Insight

By creating the full plan upfront, the agent can use a **stronger model for planning** and a **cheaper model for execution** — each subtask is simpler and doesn't need the full reasoning capability.

### Strengths

- **Efficient** — planning happens once, execution is deterministic
- **Auditable** — the plan is visible before execution begins
- **Scalable** — works well for long, multi-step workflows
- **Re-planning** — can optionally revise the plan if a step fails

### Weaknesses

- **Rigid** — less adaptive than ReAct when surprises occur
- **Plan quality bottleneck** — everything depends on the initial plan being good

---

## Tree of Thoughts (ToT)

**Origin:** Yao et al., "Tree of Thoughts: Deliberate Problem Solving with Large Language Models" (NeurIPS 2023)

Instead of following a single reasoning chain, the agent explores **multiple paths simultaneously** and picks the best one.

### How It Works

```
┌──────────────────────────────────────────────┐
│           Tree of Thoughts                   │
│                                              │
│                 [Problem]                     │
│                /    |    \                    │
│         [Path A] [Path B] [Path C]           │
│          /   \      |       |                │
│      [A1]  [A2]   [B1]   [C1]               │
│        ✗     ✓      ✓      ✗                │
│              |      |                        │
│            [A2a]  [B1a]                      │
│              ✓      ✗                        │
│              |                               │
│           [Answer]                           │
└──────────────────────────────────────────────┘
```

1. **Branch** — generate multiple candidate approaches
2. **Evaluate** — score each branch's promise
3. **Expand** — go deeper on promising branches
4. **Prune** — abandon unpromising paths
5. **Select** — choose the best path to the answer

### Key Insight

Linear chain-of-thought commits to one reasoning path. If that path is wrong, the model is stuck. ToT maintains **multiple hypotheses** simultaneously and can backtrack — like how humans think about hard problems by considering several angles before committing.

### Strengths

- **Higher accuracy** on complex problems
- **Creative** — explores unconventional solutions
- **Backtracking** — can abandon bad paths

### Weaknesses

- **Very expensive** — multiple LLM calls per branch per depth level
- **Needs evaluation criteria** — how do you score a partial reasoning path?
- **Overkill** for simple tasks

---

## Language Agent Tree Search (LATS)

**Origin:** Zhou et al., "Language Agent Tree Search Unifies Reasoning, Acting, and Planning in Language Models" (ICML 2024)

LATS combines ReAct + Tree of Thoughts + Monte Carlo Tree Search. It's currently the most sophisticated single-agent pattern.

### How It Works

LATS treats the agent's decision-making as a **tree search problem**:

1. **Select** — choose a node to expand (using UCB1 or similar)
2. **Expand** — generate possible actions from that state
3. **Evaluate** — use the LLM as a value function to score states
4. **Simulate** — roll out the action to see the result
5. **Backpropagate** — update value estimates of parent nodes
6. **Reflect** — on failed trajectories, generate self-critiques for future attempts

### Key Insight

LATS uses the LLM itself as both the **actor** (generating actions) and the **evaluator** (scoring how good a state is). Combined with external feedback (e.g., code test results), this creates a principled search over possible action sequences.

### Strengths

- **State of the art** performance on coding benchmarks (92.7% on HumanEval)
- Unifies reasoning, acting, and planning
- Uses external feedback for grounding
- Self-reflection for learning across attempts

### Weaknesses

- **Very expensive** — many LLM calls per decision
- **Complex to implement** — requires tree data structure, value estimation, backpropagation
- **Slow** — not suitable for real-time interaction

---

## Pattern Comparison

| Pattern | Loop Type | LLM Calls | Adaptability | Token Cost | Best For |
|---------|-----------|-----------|--------------|------------|----------|
| **ReAct** | Think→Act→Observe | Per step | High | High | Interactive, exploratory tasks |
| **ReWOO** | Plan→Parallel Execute→Solve | 2 total | Low | Very Low | Structured, predictable workflows |
| **CodeAct** | Think→Code→Run→Debug | Per iteration | High | Moderate | Data processing, novel computation |
| **Reflexion** | ReAct + Self-critique | Extra per reflection | Very High | High | Quality-critical, learning tasks |
| **Plan-and-Execute** | Plan once→Execute steps | Plan + per step | Medium | Medium | Long multi-step workflows |
| **Tree of Thoughts** | Branch→Evaluate→Expand | Per branch × depth | High | Very High | Complex problem solving |
| **LATS** | MCTS + ReAct + Reflection | Many | Very High | Very High | Maximum accuracy tasks |

### Decision Framework

```
Is the task predictable and structured?
  → Yes: ReWOO or Plan-and-Execute
  → No: Continue ↓

Does the task need real-time adaptation?
  → Yes: ReAct (what we have now)
  → No: Continue ↓

Does it need custom computation?
  → Yes: CodeAct
  → No: Continue ↓

Is accuracy more important than cost?
  → Yes: Reflexion, ToT, or LATS
  → No: ReAct is sufficient
```

---

## Where Our Agent Stands

Our current implementation is a **clean ReAct agent**:

```
loop.ts implements:
  for each iteration (max 10):
    THINK   → call OpenAI with conversation + tools (streaming)
    ACT     → if tool_calls: execute tools, push results to conversation
    OBSERVE → tool results become context for next iteration
    RESPOND → if no tool_calls: stream final response, exit
```

**What we do well:**
- The core think-act-observe loop is correct and complete
- Tool results feed back into reasoning (the model sees them and decides next steps)
- The debug panel makes the loop **visible**, which is the educational goal
- Streaming makes each phase observable in real-time
- Multi-iteration support means the agent can chain tool calls naturally

**What we don't do yet:**
- No parallel tool execution (tools run sequentially even when independent)
- No self-reflection on errors (errors just pass through)
- No multi-path exploration (single reasoning chain)
- No plan-then-execute separation
- Limited tool set (calculator + web search) means limited multi-step chaining

---

## What We Could Build Next

Ordered by educational value and implementation complexity:

### 1. Parallel Tool Execution
**Complexity:** Low (20 lines changed) | **Pattern:** ReAct optimization

Replace sequential tool execution with `Promise.all`. The debug panel would show multiple tool calls firing simultaneously. Our "Multi-step" suggestion already triggers this from the model — we're just not executing in parallel.

### 2. URL Reader Tool
**Complexity:** Low (new tool file) | **Pattern:** Enables multi-step ReAct chains

Pairs with web search to create natural think-act-observe chains: search → pick best result → read full page → synthesize. This is the simplest way to demonstrate multi-iteration ReAct where the model's second action depends on the first observation.

### 3. Code Interpreter Tool (CodeAct)
**Complexity:** Medium (new tool + sandboxed runtime) | **Pattern:** CodeAct

The agent writes JS/TS, we execute in a sandboxed environment, return stdout/stderr. The self-debugging loop (write → error → fix → success) is one of the most powerful agentic patterns to observe.

### 4. Reflection on Error
**Complexity:** Medium (loop modification) | **Pattern:** Reflexion-lite

When a tool returns an error, inject a reflection prompt: "The tool failed with: [error]. What went wrong and what should I try instead?" This adds a `reflection` event type to the debug panel and teaches the Reflexion pattern without a full evaluator.

### 5. Plan-and-Execute Mode
**Complexity:** High (new loop variant) | **Pattern:** Plan-and-Execute

A toggle between ReAct mode (current) and Plan-and-Execute mode. The planner generates a numbered plan, then executes each step. The debug panel shows the plan upfront, then tracks execution against it. Good comparison exercise: run the same query in both modes and compare the debug traces.

### 6. Tree of Thoughts Exploration
**Complexity:** High (tree data structure + evaluation) | **Pattern:** ToT

Generate multiple candidate approaches, evaluate each, pursue the best. Would require a new visualization in the debug panel (tree view instead of linear timeline). Best saved for after the simpler patterns are working.

---

## Sources

- [ReAct: Synergizing Reasoning and Acting in Language Models — Yao et al. (ICLR 2023)](https://arxiv.org/abs/2210.03629)
- [ReAct Prompting — Prompt Engineering Guide](https://www.promptingguide.ai/techniques/react)
- [What is a ReAct Agent? — IBM](https://www.ibm.com/think/topics/react-agent)
- [Reflexion: Language Agents with Verbal Reinforcement Learning — Shinn et al. (NeurIPS 2023)](https://arxiv.org/abs/2303.11366)
- [Language Agent Tree Search — Zhou et al. (ICML 2024)](https://arxiv.org/abs/2310.04406)
- [Agentic Reasoning Patterns: 5 Powerful Frameworks — ServicesGround](https://servicesground.com/blog/agentic-reasoning-patterns/)
- [Agentic AI Design Patterns: ReAct, ReWOO, CodeAct, and Beyond — Capabl](https://capabl.in/blog/agentic-ai-design-patterns-react-rewoo-codeact-and-beyond)
- [ReAct vs Plan-and-Execute — DEV Community](https://dev.to/jamesli/react-vs-plan-and-execute-a-practical-comparison-of-llm-agent-patterns-4gh9)
- [7 Must-Know Agentic AI Design Patterns — Machine Learning Mastery](https://machinelearningmastery.com/7-must-know-agentic-ai-design-patterns/)
- [Agentic AI's OODA Loop Problem — Schneier on Security](https://www.schneier.com/blog/archives/2025/10/agentic-ais-ooda-loop-problem.html)
- [A Practical Guide to Building Agents — OpenAI](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- [Google Cloud: Choose a Design Pattern for Your Agentic AI System](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)
