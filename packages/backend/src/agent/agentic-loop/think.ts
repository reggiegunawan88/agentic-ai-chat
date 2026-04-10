import type OpenAI from "openai";
import type {
	ChatCompletionCreateParams,
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { toolDefinitions } from "../tools";
import type { AgentEvent } from "../types";
import type { AssembledToolCall } from "./types";

/**
 * ── THINK ─────────────────────────────────────────────────────────────
 * Calls the LLM with streaming enabled and reconstructs the full response
 * from incremental deltas. Text tokens are emitted as response_delta events
 * for the frontend typewriter effect.
 * Tool call fragments (which arrive split across multiple chunks) are accumulated by index and assembled
 * into complete tool call objects once the stream ends.
 */
export async function consumeStream(
	openai: Pick<OpenAI, "chat">,
	messages: ChatCompletionMessageParam[],
	model: ChatCompletionCreateParams["model"],
	onEvent: (event: AgentEvent) => void,
): Promise<{
	content: string;
	toolCalls: AssembledToolCall[];
	finishReason: string | null;
}> {
	let content = "";
	const toolCallAccumulators = new Map<number, AssembledToolCall>();
	let finishReason: string | null = null;

	console.log(`[loop] calling OpenAI (streaming) with model: ${model}...`);
	const stream = await openai.chat.completions.create({
		model,
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
