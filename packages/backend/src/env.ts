const REQUIRED = ["OPENAI_API_KEY", "TAVILY_API_KEY", "TAVILY_BASE_URL"] as const;

export function validateEnv(): void {
	const missing = REQUIRED.filter((name) => !process.env[name]);
	if (missing.length === 0) return;

	throw new Error(
		`Missing required environment variables: ${missing.join(", ")}. ` +
			"Set them in .env (local) or via the runtime environment (Lambda/ECS).",
	);
}
