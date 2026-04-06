import type { ChatCompletionTool } from "openai/resources/chat/completions";
import * as calculator from "./calculator";
import * as readUrl from "./read-url";
import * as webSearch from "./web-search";

const tools = [calculator, webSearch, readUrl];

export const toolDefinitions: ChatCompletionTool[] = tools.map(
	(t) => t.definition,
);

const toolHandlers: Record<
	string,
	(args: Record<string, unknown>) => Promise<string>
> = {
	calculator: (args) => calculator.handler(args as { expression: string }),
	web_search: (args) => webSearch.handler(args as { query: string }),
	read_url: (args) => readUrl.handler(args as { url: string }),
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
