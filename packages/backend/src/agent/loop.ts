import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
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
	console.log("[loop] starting agent loop");
	const openai = client ?? new OpenAI();
	const conversationMessages: ChatCompletionMessageParam[] = [
		{ role: "system", content: SYSTEM_PROMPT },
		...messages,
	];

	for (let iteration = 1; iteration <= maxIterations; iteration++) {
		onEvent({ type: "thinking", iteration });

		let completion: OpenAI.Chat.Completions.ChatCompletion;
		try {
			console.log("[loop] calling OpenAI...");
			completion = (await openai.chat.completions.create({
				model: "gpt-4.1-mini",
				messages: conversationMessages,
				tools: toolDefinitions,
			})) as OpenAI.Chat.Completions.ChatCompletion;
			console.log("[loop] OpenAI responded");
		} catch (error) {
			console.error("[loop] OpenAI error:", error);
			onEvent({
				type: "error",
				message: `OpenAI API error: ${error instanceof Error ? error.message : "unknown"}`,
			});
			return;
		}

		const choice = completion.choices[0];
		const assistantMessage = choice.message;

		// IMPORTANT: append assistant message BEFORE tool results (OpenAI API requirement)
		conversationMessages.push(assistantMessage);

		// No tool calls → final response
		if (
			!assistantMessage.tool_calls ||
			assistantMessage.tool_calls.length === 0
		) {
			onEvent({ type: "response", content: assistantMessage.content ?? "" });
			return;
		}

		// Execute tools sequentially for clear debug event ordering
		for (const toolCall of assistantMessage.tool_calls) {
			const toolName = toolCall.function.name;
			let toolArgs: Record<string, unknown>;

			try {
				toolArgs = JSON.parse(toolCall.function.arguments) as Record<
					string,
					unknown
				>;
			} catch {
				onEvent({
					type: "error",
					message: `Failed to parse arguments for tool "${toolName}"`,
				});
				return;
			}

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

	onEvent({
		type: "error",
		message: "Maximum iterations reached without a final response",
	});
}
