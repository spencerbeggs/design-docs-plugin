import { describe, expect, test } from "bun:test";
import { optionsSchema } from "../../plugin/src/schema.js";

describe("options schema", () => {
	test("CONTEXT_ENABLED defaults to true", () => {
		const result = optionsSchema.parse({});
		expect(result.CONTEXT_ENABLED).toBe(true);
	});

	test("CONTEXT_ENABLED transforms 'false' to false", () => {
		const result = optionsSchema.parse({ CONTEXT_ENABLED: "false" });
		expect(result.CONTEXT_ENABLED).toBe(false);
	});

	test("CONTEXT_ENABLED transforms 'true' to true", () => {
		const result = optionsSchema.parse({ CONTEXT_ENABLED: "true" });
		expect(result.CONTEXT_ENABLED).toBe(true);
	});
});
