import type OpenAI from "openai";
import type {
	ChatCompletionCreateParams,
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { AgentEvent } from "../types";

export type AgentLoopParams = {
	messages: ChatCompletionMessageParam[];
	onEvent: (event: AgentEvent) => void;
	client?: Pick<OpenAI, "chat">;
	model?: ChatCompletionCreateParams["model"];
	maxIterations?: number;
};

export type AssembledToolCall = {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
};
