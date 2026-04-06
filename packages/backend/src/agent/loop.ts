import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { executeTool, toolDefinitions } from "./tools";
import type { AgentEvent } from "./types";

const DEFAULT_MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are a helpful assistant with access to tools. Use them when appropriate to answer the user's questions accurately. When you use a tool, explain what you found in your response. When using web_search, you can follow up with read_url to get the full content of a promising result.`;

type AgentLoopParams = {
	messages: ChatCompletionMessageParam[];
	onEvent: (event: AgentEvent) => void;
	client?: Pick<OpenAI, "chat">;
	maxIterations?: number;
};

type AssembledToolCall = {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
};

/**
 * ── THINK ─────────────────────────────────────────────────────────────
 * Calls the LLM with streaming enabled and reconstructs the full response
 * from incremental deltas. Text tokens are emitted as response_delta events
 * for the frontend typewriter effect.
 * Tool call fragments (which arrive split across multiple chunks) are accumulated by index and assembled
 * into complete tool call objects once the stream ends.
 */
async function consumeStream(
	openai: Pick<OpenAI, "chat">,
	messages: ChatCompletionMessageParam[],
	onEvent: (event: AgentEvent) => void,
): Promise<{
	content: string;
	toolCalls: AssembledToolCall[];
	finishReason: string | null;
}> {
	let content = "";
	const toolCallAccumulators = new Map<number, AssembledToolCall>();
	let finishReason: string | null = null;

	console.log("[loop] calling OpenAI (streaming)...");
	const stream = await openai.chat.completions.create({
		model: "gpt-4.1-mini",
		messages,
		tools: toolDefinitions,
		stream: true,
	});

	for await (const chunk of stream) {
		const choice = chunk.choices[0];
		if (!choice) continue;

		if (choice.finish_reason) {
			finishReason = choice.finish_reason;
		}

		const delta = choice.delta;

		// Stream text tokens to the frontend immediately
		if (delta.content) {
			content += delta.content;
			onEvent({ type: "response_delta", delta: delta.content });
		}

		// Accumulate tool call fragments by index
		if (delta.tool_calls) {
			for (const tc of delta.tool_calls) {
				let acc = toolCallAccumulators.get(tc.index);
				if (!acc) {
					acc = {
						id: tc.id ?? "",
						type: "function",
						function: { name: "", arguments: "" },
					};
					toolCallAccumulators.set(tc.index, acc);
				}
				if (tc.id) acc.id = tc.id;
				if (tc.function?.name) acc.function.name += tc.function.name;
				if (tc.function?.arguments)
					acc.function.arguments += tc.function.arguments;
			}
		}
	}
	console.log("[loop] stream ended");

	// Sort by index to preserve the order OpenAI intended
	const toolCalls = [...toolCallAccumulators.entries()]
		.sort(([a], [b]) => a - b)
		.map(([, tc]) => tc);

	return { content, toolCalls, finishReason };
}

/**
 * ── ACT + OBSERVE ─────────────────────────────────────────────────────
 * 1. Parses tool call arguments, emits all tool_call events upfront, then executes all tools in parallel via Promise.all.
 * 2. Results are emitted as tool_result events and pushed to the conversation so the LLM can see them on the next iteration.
 * 3. Returns false if arg parsing fails.
 */
async function executeToolCalls(
	toolCalls: AssembledToolCall[],
	iteration: number,
	conversationMessages: ChatCompletionMessageParam[],
	onEvent: (event: AgentEvent) => void,
): Promise<boolean> {
	// Parse args and emit tool_call events before any execution
	const parsed: { id: string; name: string; args: Record<string, unknown> }[] =
		[];

	for (const toolCall of toolCalls) {
		const name = toolCall.function.name;
		let args: Record<string, unknown>;

		try {
			args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
		} catch {
			onEvent({
				type: "error",
				message: `Failed to parse arguments for tool "${name}"`,
			});
			return false;
		}

		parsed.push({ id: toolCall.id, name, args });
		onEvent({ type: "tool_call", tool: name, args, iteration });
	}

	// Execute all tools in parallel
	const results = await Promise.all(
		parsed.map((tc) => executeTool(tc.name, tc.args)),
	);

	// Feed results back into the conversation (OBSERVE)
	for (let i = 0; i < parsed.length; i++) {
		const tc = parsed[i];
		const result = results[i];

		onEvent({ type: "tool_result", tool: tc.name, result, iteration });
		conversationMessages.push({
			role: "tool",
			tool_call_id: tc.id,
			content: result,
		});
	}

	return true;
}

/**
 * The core ReAct (Reason + Act) agent loop.
 *
 * Each iteration follows the think-act-observe cycle:
 *   1. THINK   — call the LLM with the full conversation + tool definitions
 *   2. ACT     — if the LLM requests tool calls, execute them (in parallel)
 *   3. OBSERVE — feed tool results back into the conversation as context
 *   4. Repeat until the LLM produces a final text response (no tool calls)
 *
 * The loop is guarded by maxIterations to prevent infinite tool-calling chains.
 * Every phase emits AgentEvents so the frontend can visualize the process
 * in real-time through the debug panel.
 */
export async function runAgentLoop({
	messages,
	onEvent,
	client,
	maxIterations = DEFAULT_MAX_ITERATIONS,
}: AgentLoopParams): Promise<void> {
	console.log("[loop] starting agent loop");
	const openai = client ?? new OpenAI();
	const conversationMessages: ChatCompletionMessageParam[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		...messages,
	];

	for (let iteration = 1; iteration <= maxIterations; iteration++) {
		onEvent({ type: "thinking", iteration });

		// THINK — stream the LLM response and collect content + tool calls
		let content: string;
		let toolCalls: AssembledToolCall[];
		let finishReason: string | null;

		try {
			({ content, toolCalls, finishReason } = await consumeStream(
				openai,
				conversationMessages,
				onEvent,
			));
		} catch (error) {
			console.error("[loop] OpenAI error:", error);
			onEvent({
				type: "error",
				message: `OpenAI API error: ${error instanceof Error ? error.message : "unknown"}`,
			});
			return;
		}

		// RESPOND — no tools requested, emit final response and exit
		if (finishReason === "stop" || toolCalls.length === 0) {
			onEvent({ type: "response_end", content });
			conversationMessages.push({ role: "assistant", content });
			return;
		}

		// ACT + OBSERVE — execute tools, feed results back for next iteration
		conversationMessages.push({
			role: "assistant",
			content: content || null,
			tool_calls: toolCalls,
		});

		const ok = await executeToolCalls(
			toolCalls,
			iteration,
			conversationMessages,
			onEvent,
		);
		if (!ok) return;
	}

	// Safety valve: prevent runaway API costs
	onEvent({
		type: "error",
		message: "Maximum iterations reached without a final response",
	});
}
