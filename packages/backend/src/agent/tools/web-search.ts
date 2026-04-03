import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
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
};

export async function handler(args: { query: string }): Promise<string> {
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
