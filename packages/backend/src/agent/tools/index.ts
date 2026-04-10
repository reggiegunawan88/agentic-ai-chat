import type { ChatCompletionTool } from "openai/resources/chat/completions";
import * as calculator from "./calculator";
import * as dateTime from "./date-time";
import * as readUrl from "./read-url";
import * as weather from "./weather";
import * as webSearch from "./web-search";

const tools = [calculator, webSearch, readUrl, dateTime, weather];

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
	date_time: (args) =>
		dateTime.handler(
			args as {
				operation: "now" | "diff" | "add";
				date?: string;
				date2?: string;
				days?: number;
			},
		),
	weather: (args) => weather.handler(args as { city: string }),
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
