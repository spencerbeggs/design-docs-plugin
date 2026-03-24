import type { Pipeline } from "../plugin.config.js";

// =============================================================================
// SessionStart Hook: Context Provider
// =============================================================================
//
// This hook runs once when a Claude Code session starts. Its job is to inject
// context into the session via the `claudeContext` return field.
//
// The handler receives { input, options, state }:
//   - state:   The primary API. Contains Layer 1 (base) + Layer 3 (computed)
//              values. Hooks should operate on state, not options.
//   - options: Escape hatch for raw Layer 2 values. Prefer state — setup()
//              has already transformed options into typed, computed values.
//   - input:   The raw hook event from Claude Code (session source, cwd, etc.)
//
// Return statuses — what Claude Code does with each:
//
//   status: "executed"  → Hook ran. Claude reads the action field:
//       action: "context"  → Injects `claudeContext` markdown into the session
//       action: "none"     → Hook ran but has nothing to inject
//
//   status: "disabled"  → Hook is turned off. Claude ignores it entirely.
//
//   status: "error"     → Hook hit a runtime error. Requires `reason` field.
//
//   status: "timeout"   → Hook exceeded its time budget. Requires `reason` field.
//
// =============================================================================

const handler: Pipeline["SessionStart"] = ({ state }) => {
	// ── Disabled: setup() determined context should be off ───────────────
	// The CONTEXT_ENABLED option was transformed into state.contextEnabled
	// by setup(). We read state here, not options.
	if (!state.contextEnabled) {
		return {
			status: "disabled",
			summary: "Context injection disabled via MY_PLUGIN_CONTEXT_ENABLED=false",
		};
	}

	// ── Executed, action: none — setup() didn't produce usable data ──────
	// This can happen if the GREETING option was empty or setup() failed
	// to compute a usable value.
	if (!state.greetingPrefix) {
		return {
			status: "executed",
			action: "none",
			summary: "No greeting configured — check MY_PLUGIN_GREETING",
		};
	}

	// ── Executed, action: context — inject markdown into the session ─────
	const context = [
		"## Plugin Context",
		"",
		`Greeting prefix: ${state.greetingPrefix}`,
		`Environment: ${state.environment}`,
	].join("\n");

	return {
		status: "executed",
		action: "context",
		summary: `Injected context for ${state.environment} environment`,
		claudeContext: context,
	};
};

export default handler;
