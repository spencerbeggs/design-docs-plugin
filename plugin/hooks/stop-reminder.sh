#!/usr/bin/env bash
set -euo pipefail

# Stop hook: soft nudge to consider design doc updates after implementation.
# Reads stdin JSON for stop_hook_active (loop guard) and last_assistant_message
# (keyword detection). Outputs plain text context if implementation work
# is detected. Does NOT block — this is a soft reminder.

# Kill switch
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  exit 0
fi

# Skip if design docs system is not initialized
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ ! -d "$CLAUDE_PROJECT_DIR/.claude/design" ]; then
  exit 0
fi

# Read stdin JSON
INPUT=$(cat)

# Loop guard: if stop_hook_active is true (or missing/null), bail out.
# This prevents infinite loops when the hook's nudge causes Claude to
# continue and then stop again.
ACTIVE=$(echo "$INPUT" | jq -r 'if .stop_hook_active == false then "false" else "true" end')
if [ "$ACTIVE" != "false" ]; then
  exit 0
fi

# Extract last assistant message for keyword scanning
MESSAGE=$(echo "$INPUT" | jq -r '.last_assistant_message // ""')

# If message is empty, nothing to scan
if [ -z "$MESSAGE" ]; then
  exit 0
fi

# Scan for multi-word implementation signal patterns.
# Using grep -i for case-insensitive matching, -q for quiet (exit code only).
# Each pattern is a multi-word phrase to reduce false positives.
PATTERNS=(
  "created file"
  "created the file"
  "wrote the file"
  "written to"
  "edited the"
  "modified the"
  "updated the code"
  "changed the"
  "refactored"
  "restructured"
  "reorganized"
  "implemented"
  "added feature"
  "added a new"
  "built the"
  "fixed bug"
  "fixed the"
  "resolved the issue"
  "new function"
  "new component"
  "new module"
  "new endpoint"
  "deleted the"
  "removed the"
  "replaced the"
)

FOUND=false
for pattern in "${PATTERNS[@]}"; do
  if echo "$MESSAGE" | grep -qi "$pattern"; then
    FOUND=true
    break
  fi
done

# No implementation signals detected — exit silently
if [ "$FOUND" != "true" ]; then
  exit 0
fi

# Output soft nudge as JSON with hookEventName (using jq for safe encoding)
NUDGE_MSG="Implementation work was detected in this session. Consider whether design documentation should be updated to reflect these changes. If architecture, data flows, API boundaries, or system behavior changed, delegate to the design-doc-agent to update the relevant design docs in \`.claude/design/\`.

Use \`/design-docs:finalize\` for the full end-of-branch workflow (design docs, user docs, changeset, commit, PR).

If no design doc updates are needed, proceed normally."

jq -n --arg msg "$NUDGE_MSG" '{
  hookSpecificOutput: {
    hookEventName: "Stop",
    additionalContext: $msg
  }
}'

exit 0
