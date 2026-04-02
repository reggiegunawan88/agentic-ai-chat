import { describe, expect, it } from "bun:test";
import { runAgentLoop } from "../loop";
import type { AgentEvent } from "../types";

function createMockClient(
	responses: Array<{
		content?: string | null;
		tool_calls?: Array<{
			id: string;
			type: "function";
			function: { name: string; arguments: string };
		}>;
	}>,
) {
	let callIndex = 0;
	return {
		chat: {
			completions: {
				create: async () => {
					const response = responses[callIndex++];
					return {
						choices: [
							{
								message: {
									role: "assistant" as const,
									content: response.content ?? null,
									tool_calls: response.tool_calls ?? undefined,
								},
								finish_reason: response.tool_calls ? "tool_calls" : "stop",
							},
						],
					};
				},
			},
		},
	};
}

describe("runAgentLoop", () => {
	it("returns a direct response when no tools are called", async () => {
		const events: AgentEvent[] = [];
		const client = createMockClient([{ content: "Hello!" }]);

		await runAgentLoop({
			messages: [{ role: "user", content: "Hi" }],
			onEvent: (event) => events.push(event),
			client: client as any,
		});

		expect(events).toEqual([
			{ type: "thinking", iteration: 1 },
			{ type: "response", content: "Hello!" },
		]);
	});

	it("executes a tool call and loops back", async () => {
		const events: AgentEvent[] = [];
		const client = createMockClient([
			{
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: {
							name: "calculator",
							arguments: '{"expression":"2+2"}',
						},
					},
				],
			},
			{ content: "The answer is 4." },
		]);

		await runAgentLoop({
			messages: [{ role: "user", content: "What is 2+2?" }],
			onEvent: (event) => events.push(event),
			client: client as any,
		});

		expect(events[0]).toEqual({ type: "thinking", iteration: 1 });
		expect(events[1]).toEqual({
			type: "tool_call",
			tool: "calculator",
			args: { expression: "2+2" },
			iteration: 1,
		});
		expect(events[2]).toEqual({
			type: "tool_result",
			tool: "calculator",
			result: "4",
			iteration: 1,
		});
		expect(events[3]).toEqual({ type: "thinking", iteration: 2 });
		expect(events[4]).toEqual({
			type: "response",
			content: "The answer is 4.",
		});
	});

	it("stops after max iterations and emits error", async () => {
		const events: AgentEvent[] = [];
		const infiniteToolCall = {
			tool_calls: [
				{
					id: "call_n",
					type: "function" as const,
					function: {
						name: "calculator",
						arguments: '{"expression":"1+1"}',
					},
				},
			],
		};
		const client = createMockClient(
			Array.from({ length: 12 }, () => infiniteToolCall),
		);

		await runAgentLoop({
			messages: [{ role: "user", content: "loop forever" }],
			onEvent: (event) => events.push(event),
			client: client as any,
			maxIterations: 3,
		});

		const errorEvent = events.find((e) => e.type === "error");
		expect(errorEvent).toBeDefined();
		expect((errorEvent as any).message).toContain("Maximum iterations");
	});
});
