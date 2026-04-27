import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

const REQUIRED = ["OPENAI_API_KEY", "TAVILY_API_KEY", "TAVILY_BASE_URL"] as const;

const SSM_PARAM_NAMES: Record<(typeof REQUIRED)[number], string> = {
	OPENAI_API_KEY: "/agentic-ai/openai-api-key",
	TAVILY_API_KEY: "/agentic-ai/tavily-api-key",
	TAVILY_BASE_URL: "/agentic-ai/tavily-base-url",
};

async function fetchFromSSM(
	missing: readonly (typeof REQUIRED)[number][],
): Promise<void> {
	// Lambda sets AWS_REGION automatically; the fallback only matters when
	// simulating Lambda locally with AWS_LAMBDA_FUNCTION_NAME set by hand.
	const client = new SSMClient({
		region: process.env.AWS_REGION ?? "ap-northeast-1",
	});
	const res = await client.send(
		new GetParametersCommand({
			Names: missing.map((key) => SSM_PARAM_NAMES[key]),
			WithDecryption: true,
		}),
	);
	const valuesByName = new Map(
		(res.Parameters ?? []).map((p) => [p.Name ?? "", p.Value ?? ""]),
	);
	for (const key of missing) {
		const value = valuesByName.get(SSM_PARAM_NAMES[key]);
		if (value) process.env[key] = value;
	}
}

export async function loadEnv(): Promise<void> {
	const missing = REQUIRED.filter((name) => !process.env[name]);
	if (missing.length === 0) return;

	// On Lambda, missing values are pulled from SSM Parameter Store at cold start.
	// Locally we rely on .env to provide them.
	if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
		await fetchFromSSM(missing);
	}

	const stillMissing = REQUIRED.filter((name) => !process.env[name]);
	if (stillMissing.length === 0) return;

	throw new Error(
		`Missing required environment variables: ${stillMissing.join(", ")}. ` +
			"Set them in .env (local) or under /agentic-ai/* in SSM Parameter Store (Lambda).",
	);
}
