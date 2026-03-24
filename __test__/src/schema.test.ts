import { describe, expect, test } from "bun:test";
import { optionsSchema } from "../../plugin/src/schema.js";

describe("optionsSchema", () => {
	describe("GREETING", () => {
		test("defaults to 'Hello'", () => {
			const result = optionsSchema.parse({});
			expect(result.GREETING).toBe("Hello");
		});

		test("accepts a custom string", () => {
			const result = optionsSchema.parse({ GREETING: "Howdy" });
			expect(result.GREETING).toBe("Howdy");
		});
	});

	describe("CONTEXT_ENABLED", () => {
		test("defaults to true", () => {
			const result = optionsSchema.parse({});
			expect(result.CONTEXT_ENABLED).toBe(true);
		});

		test("coerces 'true' string to boolean true", () => {
			const result = optionsSchema.parse({ CONTEXT_ENABLED: "true" });
			expect(result.CONTEXT_ENABLED).toBe(true);
		});

		test("coerces 'false' string to boolean false", () => {
			const result = optionsSchema.parse({ CONTEXT_ENABLED: "false" });
			expect(result.CONTEXT_ENABLED).toBe(false);
		});

		test("treats any non-'false' string as true", () => {
			const result = optionsSchema.parse({ CONTEXT_ENABLED: "yes" });
			expect(result.CONTEXT_ENABLED).toBe(true);
		});
	});
});
