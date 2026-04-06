import { describe, expect, it } from "bun:test";
import { executeTool, toolDefinitions } from "../tools";

describe("calculator tool", () => {
	it("evaluates basic arithmetic", async () => {
		const result = await executeTool("calculator", { expression: "2 + 3 * 4" });
		expect(result).toBe("14");
	});

	it("handles division", async () => {
		const result = await executeTool("calculator", { expression: "100 / 4" });
		expect(result).toBe("25");
	});

	it("returns error for invalid expressions", async () => {
		const result = await executeTool("calculator", { expression: "not math" });
		expect(result).toContain("Error");
	});
});

describe("toolDefinitions", () => {
	it("includes calculator, web_search, and read_url", () => {
		const names = toolDefinitions.map((t) => t.function.name);
		expect(names).toContain("calculator");
		expect(names).toContain("web_search");
		expect(names).toContain("read_url");
	});
});

describe("executeTool", () => {
	it("returns error for unknown tool", async () => {
		const result = await executeTool("nonexistent", {});
		expect(result).toContain("Error");
		expect(result).toContain("Unknown tool");
	});
});
