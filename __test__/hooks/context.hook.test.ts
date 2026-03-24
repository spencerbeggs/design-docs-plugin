import { afterEach, describe, expect, test } from "bun:test";
import plugin from "../../plugin/plugin.config.js";
import { defaultState } from "../utils/fixtures.js";

describe("context hook", () => {
	let ctx: ReturnType<typeof plugin.test>;

	afterEach(() => {
		ctx?.dispose();
	});

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

		test("claudeContext contains design documentation header", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState(defaultState);

			const result = await ctx.runHook("SessionStart", "context");
			const context = result.output.claudeContext as string;

			expect(context).toContain("Design Documentation");
		});
	});

	describe('status: "disabled"', () => {
		test("returns disabled when contextEnabled is false", async () => {
			ctx = plugin
				.test()
				.withPluginRoot(`${import.meta.dir}/../../plugin`)
				.withTempProject()
				.withOptions({})
				.withState({ contextEnabled: false });

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
				.withState({ contextEnabled: false });

			const result = await ctx.runHook("SessionStart", "context");

			expect(result.output.claudeContext).toBeUndefined();
		});
	});
});
