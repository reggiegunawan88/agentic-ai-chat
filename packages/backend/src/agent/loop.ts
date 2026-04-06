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

		let contentAccumulator = "";
		const toolCallAccumulators = new Map<
			number,
			{
				id: string;
				type: "function";
				function: { name: string; arguments: string };
			}
		>();
		let finishReason: string | null = null;

		try {
			console.log("[loop] calling OpenAI (streaming)...");
			const stream = await openai.chat.completions.create({
				model: "gpt-4.1-mini",
				messages: conversationMessages,
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

				if (delta.content) {
					contentAccumulator += delta.content;
					onEvent({ type: "response_delta", delta: delta.content });
				}

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
		} catch (error) {
			console.error("[loop] OpenAI error:", error);
			onEvent({
				type: "error",
				message: `OpenAI API error: ${error instanceof Error ? error.message : "unknown"}`,
			});
			return;
		}

		// No tool calls → final text response
		if (
			finishReason === "stop" ||
			(finishReason !== "tool_calls" && toolCallAccumulators.size === 0)
		) {
			onEvent({ type: "response_end", content: contentAccumulator });
			conversationMessages.push({
				role: "assistant",
				content: contentAccumulator,
			});
			return;
		}

		// Assemble tool calls and push assistant message to history
		const assembledToolCalls = [...toolCallAccumulators.entries()]
			.sort(([a], [b]) => a - b)
			.map(([, tc]) => tc);

		conversationMessages.push({
			role: "assistant",
			content: contentAccumulator || null,
			tool_calls: assembledToolCalls,
		});

		// Execute tools sequentially for clear debug event ordering
		for (const toolCall of assembledToolCalls) {
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

			onEvent({
				type: "tool_call",
				tool: toolName,
				args: toolArgs,
				iteration,
			});

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
