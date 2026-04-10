import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
	type: "function",
	function: {
		name: "date_time",
		description:
			"Get the current date, time, and timezone. Can also calculate date differences or add/subtract days from a date.",
		parameters: {
			type: "object",
			properties: {
				operation: {
					type: "string",
					enum: ["now", "diff", "add"],
					description:
						'"now" returns current date/time, "diff" calculates days between two dates, "add" adds/subtracts days from a date',
				},
				date: {
					type: "string",
					description:
						'A date string (e.g. "2025-01-15"). Used as the base date for "diff" and "add" operations.',
				},
				date2: {
					type: "string",
					description:
						'A second date string for "diff" operation (e.g. "2025-03-01").',
				},
				days: {
					type: "number",
					description:
						'Number of days to add (positive) or subtract (negative) for "add" operation.',
				},
			},
			required: ["operation"],
		},
	},
};

type DateTimeArgs = {
	operation: "now" | "diff" | "add";
	date?: string;
	date2?: string;
	days?: number;
};

export async function handler(args: DateTimeArgs): Promise<string> {
	const { operation } = args;

	if (operation === "now") {
		const now = new Date();
		return [
			`Date: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
			`Time: ${now.toLocaleTimeString("en-GB", { hour12: false })}`,
			`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
			`ISO: ${now.toISOString()}`,
			`Unix: ${Math.floor(now.getTime() / 1000)}`,
		].join("\n");
	}

	if (operation === "diff") {
		if (!args.date || !args.date2) {
			return 'Error: "diff" requires both "date" and "date2"';
		}
		const d1 = new Date(args.date);
		const d2 = new Date(args.date2);
		if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
			return "Error: Invalid date format";
		}
		const diffMs = d2.getTime() - d1.getTime();
		const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
		return `${Math.abs(diffDays)} days between ${args.date} and ${args.date2}`;
	}

	if (operation === "add") {
		if (!args.date || args.days === undefined) {
			return 'Error: "add" requires "date" and "days"';
		}
		const base = new Date(args.date);
		if (isNaN(base.getTime())) {
			return "Error: Invalid date format";
		}
		base.setDate(base.getDate() + args.days);
		return `Result: ${base.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} (${base.toISOString().split("T")[0]})`;
	}

	return `Error: Unknown operation "${operation}"`;
}
