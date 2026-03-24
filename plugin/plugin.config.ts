import type { InferPluginCommands, InferPluginPipeline, SetupContext } from "claude-binary-plugin";
import { ClaudeBinaryPlugin } from "claude-binary-plugin";
import { z } from "zod";
import type { PluginOptions } from "./src/schema.js";
import { optionsSchema } from "./src/schema.js";

// =============================================================================
// Plugin Configuration
// =============================================================================
//
// This is the central definition file for a claude-binary-plugin. It uses a
// three-layer architecture:
//
//   Layer 1 (Base) — Built-in values provided automatically:
//     • projectDir:     The user's project root
//     • pluginDir:      This plugin's install directory
//     • pluginEnvFile:  Path to the plugin's persisted state file
//
//   Layer 2 (Options) — User-configurable via environment variables:
//     Defined in ./src/schema.ts. Each field becomes <PREFIX>_<FIELD_NAME>.
//     The Zod schema provides validation, defaults, and type transforms.
//
//   Layer 3 (Computed) — Dynamic values from the setup() function:
//     setup() receives validated options and transforms them into typed state.
//     This is where options are consumed — hooks and commands should operate
//     on the resulting state object, not raw options. The options object is
//     available in handlers as an escape hatch, but state is the primary API.
//
//     Options (raw config) → setup() → State (typed, computed) → hooks/commands
//
// The build system (claude-binary-plugin) compiles this config + all referenced
// hooks/commands into a single Bun bytecode binary (.plugin file).
//
// CUSTOMIZATION CHECKLIST:
//   ☐ Change `prefix` to your plugin's env var namespace (e.g., "MY_TOOL")
//   ☐ Update options schema in ./src/schema.ts
//   ☐ Implement setup() to transform options into typed state
//   ☐ Define hooks for the events your plugin handles
//   ☐ Add commands for user-invokable actions
// =============================================================================

const plugin = ClaudeBinaryPlugin.create({
	// ─────────────────────────────────────────────────────────────────────────
	// Prefix: namespace for all environment variables
	// ─────────────────────────────────────────────────────────────────────────
	// Environment variables are exposed as <PREFIX>_<OPTION_NAME>.
	// Example: prefix "MY_PLUGIN" + option "GREETING" → MY_PLUGIN_GREETING
	prefix: "MY_PLUGIN",

	// ─────────────────────────────────────────────────────────────────────────
	// Layer 2: Options with validation and defaults
	// ─────────────────────────────────────────────────────────────────────────
	options: optionsSchema,

	// ─────────────────────────────────────────────────────────────────────────
	// Layer 3: Setup — transforms options into typed state
	// ─────────────────────────────────────────────────────────────────────────
	// This function receives the SetupContext containing validated options,
	// the working directory, session ID, and base state paths.
	//
	// Its job is to consume options and produce the state object that hooks
	// and commands will operate on. Do any async work here: environment
	// detection, file reading, shell commands, tool discovery, etc.
	//
	// The return type is inferred — hooks/commands get full type safety on state.
	setup: async (ctx: SetupContext<PluginOptions>) => {
		const { options } = ctx;

		// Detect environment from NODE_ENV or default to "development"
		const environment = process.env.NODE_ENV ?? "development";

		// Transform the raw GREETING option into a reusable prefix.
		// This demonstrates the key pattern: options are raw user config,
		// setup() does the work, and state holds the computed result.
		// Commands compose the final output: `${greetingPrefix}, ${name}`.
		const greetingPrefix = options.GREETING;

		// Transform the CONTEXT_ENABLED boolean into a feature flag.
		// Hooks check state.contextEnabled instead of reading options directly.
		const contextEnabled = options.CONTEXT_ENABLED;

		return {
			environment,
			greetingPrefix,
			contextEnabled,
		};
	},

	// ─────────────────────────────────────────────────────────────────────────
	// Build options
	// ─────────────────────────────────────────────────────────────────────────
	// bytecode:      Compile to Bun bytecode for faster cold starts
	// persistLocal:  Cache the compiled binary locally between builds
	bytecode: true,
	persistLocal: true,

	// ─────────────────────────────────────────────────────────────────────────
	// Hooks — Event handlers for Claude Code lifecycle events
	// ─────────────────────────────────────────────────────────────────────────
	// Each hook event (SessionStart, PreToolUse, PostToolUse, Stop, etc.)
	// maps to an array of named handlers. Handlers are external .hook.ts files
	// for testability and separation of concerns.
	//
	// Hook handler files must export a default function matching the
	// Pipeline[EventName] type signature. See hooks/context.hook.ts for example.
	//
	// Available events:
	//   SessionStart   — Session initialization, context injection
	//   PreToolUse     — Before a tool executes (can allow/deny/block)
	//   PostToolUse    — After a tool executes (validation, side effects)
	//   Stop           — Before Claude stops (preflight checks)
	//   SubagentStop   — Before a subagent stops
	//   Notification   — On notification events
	hooks: {
		SessionStart: [
			{
				name: "context",
				description: "Provides environment detection and project context",
				pipeline: "./hooks/context.hook.ts",
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────
	// Commands — User-invokable slash commands
	// ─────────────────────────────────────────────────────────────────────────
	// Commands are paired files: a .md file (documentation/frontmatter) and
	// a .cmd.ts file (handler implementation). The .md filename determines
	// the command namespace:
	//
	//   commands/lint.md        → /plugin-name:lint
	//   commands/test/coverage.md → /plugin-name:test:coverage
	//
	// Each command needs:
	//   1. An args schema (Zod) defining the command's arguments
	//   2. A pipeline pointing to the .cmd.ts handler file
	//   3. A paired .md file in commands/ with frontmatter and documentation
	//   4. An entry in .claude-plugin/plugin.json commands array
	commands: {
		greet: {
			description: "Demo command that generates a greeting message",
			args: z.object({
				/** Name to greet (positional argument, defaults to "World") */
				_positionals: z.array(z.string()).optional().default([]),
				/** Uppercase the greeting */
				shout: z.boolean().optional().default(false),
				/** Number of times to repeat the greeting */
				repeat: z.number().optional().default(1),
			}),
			pipeline: "./commands/greet.cmd.ts",
		},
	},
});

// =============================================================================
// Type Exports
// =============================================================================
// These types are used by hook and command handlers to get typed access to the
// plugin's state (Layer 1 + 2 + 3 merged). Import them in your handlers:
//
//   import type { Pipeline } from "../plugin.config.js";
//   const handler: Pipeline["SessionStart"] = ({ state }) => { ... };

export type Pipeline = InferPluginPipeline<typeof plugin>;
export type Commands = InferPluginCommands<typeof plugin>;

export default plugin;
