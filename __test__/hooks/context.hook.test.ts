import { afterEach, describe, expect, test } from "bun:test";
import plugin from "../../plugin/plugin.config.js";
import { defaultState } from "../utils/fixtures.js";

// =============================================================================
// Context Hook Tests
// =============================================================================
//
// These tests demonstrate the fluent test API provided by claude-binary-plugin.
//
// The pattern is:
//   1. Call plugin.test() to create a test context builder
//   2. Chain configuration methods: .withOptions(), .withState(), .withPluginRoot()
//   3. Execute with .runHook(eventType, hookName) or .runCommand(name, args)
//   4. Assert on the result (exitCode, stdout, stderr, output, action)
//   5. Call .dispose() in afterEach to clean up temp files
//
// Available builder methods:
//   .withOptions(opts)          — Set Layer 2 options (partial merge)
//   .withState(state)           — Set Layer 3 computed values (partial merge)
//   .withPluginRoot(path)       — Set the plugin directory
//   .withProjectDir(path)       — Set the user's project directory
//   .withTempProject()          — Create a temp directory (auto-cleaned on dispose)
//   .withFile(path, content)    — Write a file into the temp project
//   .withShell(cmd, result)     — Mock a shell command (exact match)
//   .withShellMatching(re, res) — Mock a shell command (regex match)
//   .mockBunShell()             — Enable Bun shell mocking
//   .runHook(event, name)       — Execute a hook handler
//   .runCommand(name, args?)    — Execute a command handler
//   .dispose()                  — Clean up temp files and state
//
// HookTestResult shape:
//   exitCode: number            — 0 for success
//   stdout: string              — Raw stdout
//   stderr: string              — Raw stderr
//   output: Record<string, unknown> — Parsed JSON response
//   action: string | undefined  — Hook action (allow/deny/block/context/none)
//
// SessionStart return statuses:
//   "executed" — Hook ran. action: "context" injects claudeContext, "none" skips.
//   "disabled" — Hook is turned off by user. Claude ignores it.
//   "error"    — Runtime error. Requires reason field.
//   "timeout"  — Hook exceeded time budget. Requires reason field.
//
// Note: .withOptions({}) is REQUIRED by the test framework even when tests
// operate purely on state. It validates the options schema. Pass {} to accept
// all defaults; the hook itself reads state, not options.
// =============================================================================

describe("context hook", () => {
	let ctx: ReturnType<typeof plugin.test>;

	afterEach(() => {
		ctx?.dispose();
	});

	// ─── status: "executed", action: "context" — injected context ────────

	describe('status: "executed" with action: "context"', () => {
		test("returns executed with context action when enabled", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runHook("SessionStart", "context");

			expect(result.exitCode).toBe(0);
			expect(result.output).toMatchObject({
				status: "executed",
				action: "context",
			});
		});

		test("includes greeting prefix and environment in claudeContext", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runHook("SessionStart", "context");
			const context = result.output.claudeContext as string;

			expect(context).toContain("Hello");
			expect(context).toContain("test");
		});

		test("reflects custom environment in summary", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, environment: "production" });

			const result = await ctx.runHook("SessionStart", "context");

			expect(result.output.summary).toContain("production");
		});
	});

	// ─── status: "executed", action: "none" — ran but nothing to inject ──

	describe('status: "executed" with action: "none"', () => {
		test("returns none when greetingPrefix is empty", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, greetingPrefix: "" });

			const result = await ctx.runHook("SessionStart", "context");

			expect(result.exitCode).toBe(0);
			expect(result.output).toMatchObject({
				status: "executed",
				action: "none",
			});
		});

		test("does not inject claudeContext when no greeting", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, greetingPrefix: "" });

			const result = await ctx.runHook("SessionStart", "context");

			expect(result.output.claudeContext).toBeUndefined();
		});
	});

	// ─── status: "disabled" — setup() set contextEnabled to false ────────

	describe('status: "disabled"', () => {
		test("returns disabled when contextEnabled is false", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, contextEnabled: false });

			const result = await ctx.runHook("SessionStart", "context");

			expect(result.exitCode).toBe(0);
			expect(result.output).toMatchObject({
				status: "disabled",
			});
		});

		test("does not inject claudeContext when disabled", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ ...defaultState, contextEnabled: false });

			const result = await ctx.runHook("SessionStart", "context");

			expect(result.output.claudeContext).toBeUndefined();
		});
	});
});
