import { evaluate } from "mathjs";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const definition: ChatCompletionTool = {
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
};

export async function handler(args: { expression: string }): Promise<string> {
	try {
		const result = evaluate(args.expression);
		return String(result);
	} catch {
		return `Error: Could not evaluate "${args.expression}"`;
	}
}
