import type { InferPluginPipeline, SetupContext } from "claude-binary-plugin";
import { ClaudeBinaryPlugin } from "claude-binary-plugin";
import type { PluginOptions } from "./src/schema.js";
import { optionsSchema } from "./src/schema.js";

const plugin = ClaudeBinaryPlugin.create({
	prefix: "DESIGN_DOCS",

	options: optionsSchema,

	setup: async (ctx: SetupContext<PluginOptions>) => {
		const { options } = ctx;
		const contextEnabled = options.CONTEXT_ENABLED;

		return {
			contextEnabled,
		};
	},

	bytecode: true,
	persistLocal: true,

	hooks: {
		SessionStart: [
			{
				name: "context",
				description: "Injects design documentation system context into the session",
				pipeline: "./hooks/context.hook.ts",
			},
		],
	},

	commands: {},
});

export type Pipeline = InferPluginPipeline<typeof plugin>;

export default plugin;
