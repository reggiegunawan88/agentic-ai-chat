import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { executeTool } from "../tools";
import type { AgentEvent } from "../types";
import type { AssembledToolCall } from "./types";

/**
 * ── ACT + OBSERVE ─────────────────────────────────────────────────────
 * 1. Parses tool call arguments, emits all tool_call events upfront, then executes all tools in parallel via Promise.all.
 * 2. Results are emitted as tool_result events and pushed to the conversation so the LLM can see them on the next iteration.
 * 3. Returns false if arg parsing fails.
 */
export async function executeToolCalls(
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
