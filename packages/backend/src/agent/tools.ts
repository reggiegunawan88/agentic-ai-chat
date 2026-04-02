import { evaluate } from "mathjs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const toolDefinitions: ChatCompletionTool[] = [
	{
		type: "function",
		function: {
			name: "calculator",
			description:
				"Evaluate a mathematical expression. Supports basic arithmetic, exponents, square roots, trig, etc.",
			parameters: {
				type: "object",
				properties: {
					expression: {
						type: "string",
						description: 'The math expression to evaluate, e.g. "2 + 3 * 4"',
					},
				},
				required: ["expression"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "web_search",
			description: "Search the web for current information on a topic.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "The search query",
					},
				},
				required: ["query"],
			},
		},
	},
];

async function calculator(args: { expression: string }): Promise<string> {
	try {
		const result = evaluate(args.expression);
		return String(result);
	} catch {
		return `Error: Could not evaluate "${args.expression}"`;
	}
}

async function webSearch(args: { query: string }): Promise<string> {
	const apiKey = process.env.TAVILY_API_KEY;
	if (!apiKey) {
		return "Error: TAVILY_API_KEY is not configured";
	}
	try {
		const response = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: apiKey,
				query: args.query,
				max_results: 3,
			}),
		});
		if (!response.ok) {
			return `Error: Search API returned ${response.status}`;
		}
		const data = (await response.json()) as {
			results: Array<{ title: string; url: string; content: string }>;
		};
		return data.results
			.map((r) => `${r.title}\n${r.url}\n${r.content}`)
			.join("\n\n");
	} catch (error) {
		return `Error: Search failed — ${error instanceof Error ? error.message : "unknown error"}`;
	}
}

const toolHandlers: Record<
	string,
	(args: Record<string, unknown>) => Promise<string>
> = {
	calculator: (args) => calculator(args as { expression: string }),
	web_search: (args) => webSearch(args as { query: string }),
};

export async function executeTool(
	name: string,
	args: Record<string, unknown>,
): Promise<string> {
	const handler = toolHandlers[name];
	if (!handler) {
		return `Error: Unknown tool "${name}"`;
	}
	return handler(args);
}
