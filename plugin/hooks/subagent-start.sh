#!/usr/bin/env bash
set -euo pipefail

# SubagentStart hook: inject condensed design docs awareness into subagents.
# Outputs JSON with additionalContext so subagents know the system exists
# and can flag design-doc-relevant changes to the parent agent.

# Kill switch
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  exit 0
fi

# Skip if design docs system is not initialized
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ ! -d "$CLAUDE_PROJECT_DIR/.claude/design" ]; then
  exit 0
fi

# Consume stdin (required by hook protocol even if unused)
cat > /dev/null

# Output JSON with additionalContext for the subagent.
# Kept under 50 words to minimize context budget impact.
cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "This project uses design docs (.claude/design/) and plans (.claude/plans/). If your work changes architecture, data flows, or API boundaries, note this in your response so the parent agent can delegate updates to the design-doc-agent."
  }
}
JSON

exit 0
