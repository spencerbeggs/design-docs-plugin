import type { CommandOutput } from "claude-binary-plugin";
import type { Commands } from "../plugin.config.js";

// =============================================================================
// Greet Command Handler
// =============================================================================
//
// Demo command showing the command handler pattern and exit code conventions.
//
// The handler receives { args, state, options }:
//   - args:    Validated arguments from the Zod schema in plugin.config.ts
//   - state:   The primary API. setup() has already transformed raw options
//              into typed, computed values. Operate on state, not options.
//   - options: Escape hatch for raw Layer 2 values (prefer state).
//
// Exit code conventions — what Claude Code does with each:
//
//   exitCode: 0  → Success. The `output` markdown is shown to the user/agent.
//   exitCode: 1  → Issues found. Output contains warnings or errors for the
//                  agent to act on.
//   exitCode: 2  → Fatal error. Command could not execute (missing config,
//                  runtime failure). Agent should report the error.
//
// The `output` field is always a markdown string consumed by the LLM.
// =============================================================================

const handler: Commands["greet"] = async ({ args, state }): Promise<CommandOutput> => {
	const name = args._positionals[0] ?? "World";
	const repeat = args.repeat;

	// ── Exit code 2: Fatal error — required state missing ───────────────
	// setup() transforms options into state. If greetingPrefix is absent,
	// it means setup() couldn't produce the data we need.
	if (!state.greetingPrefix) {
		return {
			exitCode: 2,
			output: [
				"## Error",
				"",
				"Plugin setup did not provide a greeting prefix.",
				"Check that `MY_PLUGIN_GREETING` is set and `setup()` runs correctly.",
			].join("\n"),
		};
	}

	// ── Exit code 1: Issues found — validation warning ──────────────────
	if (repeat > 10) {
		return {
			exitCode: 1,
			output: [
				"## Warning",
				"",
				`Repeat count ${repeat} exceeds maximum of 10.`,
				"Use a smaller value for `--repeat`.",
			].join("\n"),
		};
	}

	// ── Exit code 0: Success ────────────────────────────────────────────
	// state.greetingPrefix was computed by setup() from the GREETING option.
	// The command composes the final greeting: "${prefix}, ${name}".
	// state.environment was detected from NODE_ENV by setup().
	let greeting = `${state.greetingPrefix}, ${name}! (${state.environment})`;

	if (args.shout) {
		greeting = greeting.toUpperCase();
	}

	const lines = Array.from({ length: repeat }, () => greeting);

	return {
		exitCode: 0,
		output: ["## Greeting", "", ...lines].join("\n"),
	};
};

export default handler;
