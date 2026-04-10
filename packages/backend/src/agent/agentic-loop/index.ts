import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { executeToolCalls } from "./act";
import { consumeStream } from "./think";
import type { AgentLoopParams, AssembledToolCall } from "./types";

const DEFAULT_MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are a helpful assistant with access to tools. Use them when appropriate to answer the user's questions accurately. When you use a tool, explain what you found in your response. When using web_search, you can follow up with read_url to get the full content of a promising result.`;

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
	model = "gpt-4.1-mini",
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
				model,
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
