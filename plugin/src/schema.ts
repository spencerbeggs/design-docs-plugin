import { z } from "zod";

// =============================================================================
// Plugin Options Schema (Layer 2)
// =============================================================================
//
// Options are the raw user-facing configuration surface. Each field becomes an
// environment variable: <PREFIX>_<FIELD_NAME> (e.g., MY_PLUGIN_GREETING).
//
// Options flow INTO the setup() function, which transforms them into typed state.
// Hooks and commands should primarily operate on state, not options directly.
//
//   Options (raw config) → setup() → State (typed, computed) → hooks/commands
//
// To add a new option:
//   1. Add a field here with a Zod schema, default, and description
//   2. Consume it in setup() within plugin.config.ts
//   3. Return the computed result as part of the state object
//   4. Access it in hooks/commands via state.fieldName
// =============================================================================

export const optionsSchema = z.object({
	/** Custom greeting message (default: "Hello") */
	GREETING: z.string().default("Hello"),

	/** Enable context injection into sessions (default: true) */
	CONTEXT_ENABLED: z
		.string()
		.default("true")
		.transform((v) => v !== "false"),
});

/** Inferred TypeScript type from the options schema */
export type PluginOptions = z.infer<typeof optionsSchema>;
