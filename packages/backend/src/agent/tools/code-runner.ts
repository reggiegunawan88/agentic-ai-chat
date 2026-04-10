import { runInNewContext } from "node:vm";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const TIMEOUT_MS = 5000;

export const definition: ChatCompletionTool = {
	type: "function",
	function: {
		name: "code_runner",
		description:
			"Execute JavaScript code and return the output. Use console.log() to produce output. Useful for calculations, data transformations, string manipulation, and any problem that benefits from running actual code. The code runs in a sandboxed context with a 5-second timeout.",
		parameters: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description:
						"JavaScript code to execute. Use console.log() to output results.",
				},
			},
			required: ["code"],
		},
	},
};

export async function handler(args: { code: string }): Promise<string> {
	try {
		const output: string[] = [];

		// Sandboxed context — only expose a custom console.log that captures output
		const sandbox = {
			console: {
				log: (...values: unknown[]) =>
					output.push(values.map(String).join(" ")),
				error: (...values: unknown[]) =>
					output.push(`[error] ${values.map(String).join(" ")}`),
			},
			Math,
			Date,
			JSON,
			Array,
			Object,
			String,
			Number,
			Boolean,
			Map,
			Set,
			RegExp,
			parseInt,
			parseFloat,
			isNaN,
			isFinite,
		};

		runInNewContext(args.code, sandbox, { timeout: TIMEOUT_MS });

		return output.join("\n") || "(no output — did you forget console.log()?)";
	} catch (error) {
		return `Error: ${error instanceof Error ? error.message : "unknown error"}`;
	}
}
