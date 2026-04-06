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

export type ClientMessage =
	| { type: "message"; content: string }
	| {
			type: "restore";
			history: { role: "user" | "assistant"; content: string }[];
	  };
