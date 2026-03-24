import { afterEach, describe, expect, test } from "bun:test";
import plugin from "../../plugin/plugin.config.js";
import { defaultState } from "../utils/fixtures.js";

// =============================================================================
// Greet Command Tests
// =============================================================================
//
// Demonstrates testing commands with the fluent test API. Commands use the same
// plugin.test() builder as hooks, but execute via .runCommand(name, args).
//
// Key differences from hook tests:
//   - .runCommand() returns CommandTestResult (exitCode, stdout, stderr, logs)
//   - Args are partial — omitted fields use Zod schema defaults
//   - The args object matches the Zod schema defined in plugin.config.ts
//
// CommandTestResult shape:
//   exitCode: number   — 0 success, 1 issues found, 2 fatal error
//   stdout: string     — Command output (markdown for LLM consumption)
//   stderr: string     — Error output
//   logs: string[]     — Captured console.log calls
//   errors: string[]   — Captured console.error calls
//
// Note: .withOptions({}) is REQUIRED by the test framework even when tests
// operate purely on state. It validates the options schema. Pass {} to accept
// all defaults.
// =============================================================================

describe("greet command", () => {
	let ctx: ReturnType<typeof plugin.test>;

	afterEach(() => {
		ctx?.dispose();
	});

	// ─── exitCode 0: Success ────────────────────────────────────────────

	describe("exitCode 0: success", () => {
		test("greets World by default", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet");

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Hello, World!");
		});

		test("greets a specific name via positional arg", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", {
				_positionals: ["Claude"],
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Hello, Claude!");
		});

		test("uses only first positional arg, ignores extras", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", {
				_positionals: ["Claude", "extra", "ignored"],
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Hello, Claude!");
			expect(result.stdout).not.toContain("extra");
		});

		test("uppercases greeting with shout flag", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", {
				_positionals: ["Claude"],
				shout: true,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("HELLO, CLAUDE!");
		});

		test("repeats greeting N times", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", { repeat: 3 });

			expect(result.exitCode).toBe(0);
			const lines = result.stdout.trim().split("\n");
			const greetingLines = lines.filter((l) => l.includes("Hello, World!"));
			expect(greetingLines).toHaveLength(3);
		});

		test("produces empty body with repeat=0", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", { repeat: 0 });

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("## Greeting");
			expect(result.stdout).not.toContain("Hello, World!");
		});

		test("accepts repeat=10 (boundary value)", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", { repeat: 10 });

			expect(result.exitCode).toBe(0);
			const lines = result.stdout.trim().split("\n");
			const greetingLines = lines.filter((l) => l.includes("Hello, World!"));
			expect(greetingLines).toHaveLength(10);
		});

		test("includes environment from state", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, environment: "production" });

			const result = await ctx.runCommand("greet");

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("(production)");
		});

		test("uses custom greeting prefix from state", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, greetingPrefix: "Howdy" });

			const result = await ctx.runCommand("greet", {
				_positionals: ["Partner"],
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Howdy, Partner!");
		});

		test("combines shout and repeat flags", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", {
				shout: true,
				repeat: 2,
			});

			expect(result.exitCode).toBe(0);
			const lines = result.stdout.trim().split("\n");
			const shoutLines = lines.filter((l) => l.includes("HELLO, WORLD!"));
			expect(shoutLines).toHaveLength(2);
		});
	});

	// ─── exitCode 1: Issues found (validation warning) ──────────────────

	describe("exitCode 1: issues found", () => {
		test("warns when repeat exceeds maximum", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runCommand("greet", { repeat: 11 });

			expect(result.exitCode).toBe(1);
			expect(result.stdout).toContain("Warning");
			expect(result.stdout).toContain("exceeds maximum");
		});
	});

	// ─── exitCode 2: Fatal error (missing state) ────────────────────────

	describe("exitCode 2: fatal error", () => {
		test("returns error when greetingPrefix is missing from state", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, greetingPrefix: "" });

			const result = await ctx.runCommand("greet");

			expect(result.exitCode).toBe(2);
			expect(result.stdout).toContain("Error");
		});
	});
});
