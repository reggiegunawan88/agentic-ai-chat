export type AgentEvent =
	| { type: "thinking"; iteration: number }
	| {
			type: "tool_call";
			tool: string;
			args: Record<string, unknown>;
			iteration: number;
	  }
	| { type: "tool_result"; tool: string; result: string; iteration: number }
	| { type: "response_delta"; delta: string }
	| { type: "response_end"; content: string }
	| { type: "error"; message: string };

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

export type DebugEntry = AgentEvent & {
	timestamp: number;
};

export type ChatMeta = {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
};
