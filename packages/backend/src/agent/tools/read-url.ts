import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Cap extracted text to avoid flooding the LLM context window.
// A full web page can be 50k+ chars — sending all of it wastes tokens
// and may exceed the model's context limit. 5000 chars is enough for
// the agent to extract key information from most articles.
const MAX_CONTENT_LENGTH = 5000;

// Prevent the agent from hanging on slow or unresponsive servers.
// Without a timeout, a single bad URL could stall the entire loop.
const FETCH_TIMEOUT_MS = 10000;

export const definition: ChatCompletionTool = {
	type: "function",
	function: {
		name: "read_url",
		description:
			"Fetch and read the text content of a web page. Use this after web_search to read the full content of a specific result.",
		parameters: {
			type: "object",
			properties: {
				url: {
					type: "string",
					description: "The URL of the web page to read",
				},
			},
			required: ["url"],
		},
	},
};

/**
 * Converts raw HTML into readable plain text for the LLM.
 *
 * We strip tags with regex rather than using a DOM parser to avoid
 * adding an external dependency (keeping the "build from scratch"
 * approach). This is intentionally simple — it won't handle every
 * edge case but works well enough for most web pages.
 *
 * Example:
 *   Input:  "<h1>Hello</h1><p>World &amp; friends</p><script>evil()</script>"
 *   Output: "Hello\nWorld & friends"
 */
function htmlToText(html: string): string {
	return (
		html
			// Remove script and style blocks entirely
			.replace(/<script[\s\S]*?<\/script>/gi, "")
			.replace(/<style[\s\S]*?<\/style>/gi, "")
			// Remove HTML comments
			.replace(/<!--[\s\S]*?-->/g, "")
			// Replace block-level tags with newlines
			.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n")
			.replace(/<br\s*\/?>/gi, "\n")
			// Strip remaining tags
			.replace(/<[^>]+>/g, "")
			// Decode common HTML entities
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, " ")
			// Collapse whitespace
			.replace(/[ \t]+/g, " ")
			.replace(/\n\s*\n/g, "\n\n")
			.trim()
	);
}

export async function handler(args: { url: string }): Promise<string> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		const response = await fetch(args.url, {
			signal: controller.signal,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; AgenticAI/1.0; +https://github.com)",
			},
		});

		clearTimeout(timeout);

		if (!response.ok) {
			return `Error: HTTP ${response.status} fetching "${args.url}"`;
		}

		const contentType = response.headers.get("content-type") ?? "";
		if (
			!contentType.includes("text/html") &&
			!contentType.includes("text/plain")
		) {
			return `Error: Unsupported content type "${contentType}" — can only read HTML and plain text pages`;
		}

		const html = await response.text();
		const text = htmlToText(html);

		if (text.length <= MAX_CONTENT_LENGTH) {
			return text;
		}

		return `${text.slice(0, MAX_CONTENT_LENGTH)}\n\n[Content truncated — showing first ${MAX_CONTENT_LENGTH} characters of ${text.length}]`;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return `Error: Timed out after ${FETCH_TIMEOUT_MS / 1000}s fetching "${args.url}"`;
		}
		return `Error: Failed to fetch "${args.url}" — ${error instanceof Error ? error.message : "unknown error"}`;
	}
}
