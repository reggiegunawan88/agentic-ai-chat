import { describe, expect, it } from "bun:test";
import { runAgentLoop } from "../loop";
import type { AgentEvent } from "../types";

function createMockStream(
	chunks: Array<{
		content?: string | null;
		tool_calls?: Array<{
			index: number;
			id?: string;
			type?: "function";
			function?: { name?: string; arguments?: string };
		}>;
		finish_reason?: string | null;
	}>,
): AsyncIterable<unknown> {
	return {
		async *[Symbol.asyncIterator]() {
			for (const chunk of chunks) {
				yield {
					choices: [
						{
							delta: {
								content: chunk.content ?? null,
								tool_calls: chunk.tool_calls ?? undefined,
							},
							finish_reason: chunk.finish_reason ?? null,
							index: 0,
						},
					],
				};
			}
		},
	};
}

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
					if (response.tool_calls) {
						return createMockStream([
							...response.tool_calls.map((tc, i) => ({
								tool_calls: [
									{
										index: i,
										id: tc.id,
										type: tc.type,
										function: tc.function,
									},
								],
							})),
							{ finish_reason: "tool_calls" },
						]);
					}
					return createMockStream([
						{ content: response.content ?? "" },
						{ finish_reason: "stop" },
					]);
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
			{ type: "response_delta", delta: "Hello!" },
			{ type: "response_end", content: "Hello!" },
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
			type: "response_delta",
			delta: "The answer is 4.",
		});
		expect(events[5]).toEqual({
			type: "response_end",
			content: "The answer is 4.",
		});
	});

	it("executes parallel tool calls and loops back", async () => {
		const events: AgentEvent[] = [];
		const client = createMockClient([
			{
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: {
							name: "calculator",
							arguments: '{"expression":"100/4"}',
						},
					},
					{
						id: "call_2",
						type: "function",
						function: {
							name: "calculator",
							arguments: '{"expression":"3+5"}',
						},
					},
				],
			},
			{ content: "25 and 8." },
		]);

		await runAgentLoop({
			messages: [{ role: "user", content: "What is 100/4 and 3+5?" }],
			onEvent: (event) => events.push(event),
			client: client as any,
		});

		// All tool_call events emitted before any tool_result
		expect(events[0]).toEqual({ type: "thinking", iteration: 1 });
		expect(events[1]).toEqual({
			type: "tool_call",
			tool: "calculator",
			args: { expression: "100/4" },
			iteration: 1,
		});
		expect(events[2]).toEqual({
			type: "tool_call",
			tool: "calculator",
			args: { expression: "3+5" },
			iteration: 1,
		});
		expect(events[3]).toEqual({
			type: "tool_result",
			tool: "calculator",
			result: "25",
			iteration: 1,
		});
		expect(events[4]).toEqual({
			type: "tool_result",
			tool: "calculator",
			result: "8",
			iteration: 1,
		});
		expect(events[5]).toEqual({ type: "thinking", iteration: 2 });
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
