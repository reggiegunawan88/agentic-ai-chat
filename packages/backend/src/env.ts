import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

const REQUIRED = ["OPENAI_API_KEY", "TAVILY_API_KEY", "TAVILY_BASE_URL"] as const;

const SSM_PREFIX = "/agentic-chat-app";
const ssmName = (key: (typeof REQUIRED)[number]) => `${SSM_PREFIX}/${key}`;

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
			Names: missing.map(ssmName),
			WithDecryption: true,
		}),
	);
	const valuesByName = new Map(
		(res.Parameters ?? []).map((p) => [p.Name ?? "", p.Value ?? ""]),
	);
	for (const key of missing) {
		const value = valuesByName.get(ssmName(key));
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
			`Set them in .env (local) or under ${SSM_PREFIX}/* in SSM Parameter Store (Lambda).`,
	);
}
