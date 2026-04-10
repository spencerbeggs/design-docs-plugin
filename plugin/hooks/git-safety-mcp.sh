#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: git safety checks for GitKraken MCP tools.
# Blocks destructive git operations on default branch via MCP.
# Auto-allows them on feature branches for squash workflows.

# Kill switch
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  exit 0
fi

# Read stdin JSON
INPUT=$(cat)

# Extract tool name
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')

if [ -z "$TOOL_NAME" ]; then
  exit 0
fi

# Helper: output a deny decision
deny() {
  local reason="$1"
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# Helper: output an allow decision
allow() {
  local reason="$1"
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# ========================================================================
# Branch detection
# ========================================================================

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

if [ -z "$CURRENT_BRANCH" ]; then
  exit 0
fi

ON_DEFAULT=false
if [ "$CURRENT_BRANCH" = "$DEFAULT_BRANCH" ]; then
  ON_DEFAULT=true
fi

# ========================================================================
# Tool-specific checks
# ========================================================================

case "$TOOL_NAME" in
  mcp__gitkraken__git_push)
    IS_FORCE=$(echo "$INPUT" | jq -r '.tool_input.force // false')
    if [ "$IS_FORCE" = "true" ]; then
      if [ "$ON_DEFAULT" = "true" ]; then
        deny "Force push to default branch \"${DEFAULT_BRANCH}\" via GitKraken MCP is blocked."
      else
        allow "Force push auto-allowed on feature branch \"${CURRENT_BRANCH}\" via GitKraken MCP."
      fi
    fi
    ;;
  mcp__gitkraken__git_branch)
    ACTION=$(echo "$INPUT" | jq -r '.tool_input.action // ""')
    TARGET_BRANCH=$(echo "$INPUT" | jq -r '.tool_input.branchName // ""')
    if [ "$ACTION" = "delete" ]; then
      if [ "$TARGET_BRANCH" = "$DEFAULT_BRANCH" ]; then
        deny "Deleting default branch \"${DEFAULT_BRANCH}\" via GitKraken MCP is blocked."
      elif [ "$ON_DEFAULT" = "false" ]; then
        allow "Branch deletion auto-allowed on feature branch via GitKraken MCP."
      fi
    fi
    ;;
  mcp__gitkraken__git_checkout)
    IS_FORCE=$(echo "$INPUT" | jq -r '.tool_input.force // false')
    TARGET_BRANCH=$(echo "$INPUT" | jq -r '.tool_input.branch // ""')
    if [ "$IS_FORCE" = "true" ] && [ "$TARGET_BRANCH" = "$DEFAULT_BRANCH" ]; then
      deny "Force checkout overwriting default branch \"${DEFAULT_BRANCH}\" via GitKraken MCP is blocked."
    fi
    ;;
  *)
    # Not a tool we handle — skip
    exit 0
    ;;
esac

# Nothing matched — skip
exit 0
