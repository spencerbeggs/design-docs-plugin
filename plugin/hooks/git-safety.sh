#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: protect default branch from destructive git operations.
# Allows force push, reset, rebase on feature branches (squash-merge workflow).
# Always blocks repo deletion, branch protection removal, and admin merges.

# Kill switch
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  exit 0
fi

# Read stdin JSON
INPUT=$(cat)

# Extract the command from tool input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# --- Helper functions ---

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

# --- Always-blocked commands (any branch) ---

if echo "$COMMAND" | grep -qE '^\s*gh\s+repo\s+delete\b'; then
  deny "Repository deletion is always blocked by git safety hook"
fi

if echo "$COMMAND" | grep -qE '^\s*gh\s+api\b.*(/protection)\b.*-X\s+DELETE'; then
  deny "Branch protection deletion is always blocked by git safety hook"
fi

if echo "$COMMAND" | grep -qE '^\s*gh\s+pr\s+merge\b.*--admin'; then
  deny "Admin merge bypass is always blocked by git safety hook"
fi

# --- Check if this is a git/gh command worth inspecting ---

if ! echo "$COMMAND" | grep -qE '^\s*(git|gh)\b'; then
  exit 0
fi

# --- Pattern detection ---

IS_FORCE_PUSH=false
IS_RESET_HARD=false
IS_RESET_SOFT=false
IS_REBASE=false
IS_BRANCH_DELETE=false
DELETE_TARGET=""

if echo "$COMMAND" | grep -qE '^\s*git\s+push\b.*(-f|--force|--force-with-lease)'; then
  IS_FORCE_PUSH=true
fi

if echo "$COMMAND" | grep -qE '^\s*git\s+reset\b.*--hard'; then
  IS_RESET_HARD=true
fi

if echo "$COMMAND" | grep -qE '^\s*git\s+reset\b.*--soft'; then
  IS_RESET_SOFT=true
fi

if echo "$COMMAND" | grep -qE '^\s*git\s+rebase\b'; then
  IS_REBASE=true
fi

if echo "$COMMAND" | grep -qE '^\s*git\s+branch\s+-(D|d)\b'; then
  IS_BRANCH_DELETE=true
  DELETE_TARGET=$(echo "$COMMAND" | sed -nE 's/.*git[[:space:]]+branch[[:space:]]+-(D|d)[[:space:]]+([^[:space:]]+).*/\2/p')
fi

# If no dangerous patterns detected, exit silently
if [ "$IS_FORCE_PUSH" = "false" ] && \
   [ "$IS_RESET_HARD" = "false" ] && \
   [ "$IS_RESET_SOFT" = "false" ] && \
   [ "$IS_REBASE" = "false" ] && \
   [ "$IS_BRANCH_DELETE" = "false" ]; then
  exit 0
fi

# --- Branch detection ---

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Detect default branch: try remote HEAD, fall back to "main"
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH="main"
fi

# --- Branch-specific decisions ---

if [ "$CURRENT_BRANCH" = "$DEFAULT_BRANCH" ]; then
  # On default branch: deny destructive operations
  if [ "$IS_FORCE_PUSH" = "true" ]; then
    deny "Force push on default branch ($DEFAULT_BRANCH) is blocked by git safety hook"
  fi
  if [ "$IS_RESET_HARD" = "true" ]; then
    deny "Hard reset on default branch ($DEFAULT_BRANCH) is blocked by git safety hook"
  fi
  if [ "$IS_REBASE" = "true" ]; then
    deny "Rebase on default branch ($DEFAULT_BRANCH) is blocked by git safety hook"
  fi
  if [ "$IS_BRANCH_DELETE" = "true" ] && [ "$DELETE_TARGET" = "$DEFAULT_BRANCH" ]; then
    deny "Deleting default branch ($DEFAULT_BRANCH) is blocked by git safety hook"
  fi
else
  # On feature branch: allow destructive operations
  if [ "$IS_FORCE_PUSH" = "true" ]; then
    allow "Force push allowed on feature branch ($CURRENT_BRANCH)"
  fi
  if [ "$IS_RESET_HARD" = "true" ]; then
    allow "Hard reset allowed on feature branch ($CURRENT_BRANCH)"
  fi
  if [ "$IS_RESET_SOFT" = "true" ]; then
    allow "Soft reset allowed on feature branch ($CURRENT_BRANCH)"
  fi
  if [ "$IS_REBASE" = "true" ]; then
    allow "Rebase allowed on feature branch ($CURRENT_BRANCH)"
  fi
  if [ "$IS_BRANCH_DELETE" = "true" ] && [ "$DELETE_TARGET" = "$DEFAULT_BRANCH" ]; then
    deny "Deleting default branch ($DEFAULT_BRANCH) is blocked by git safety hook"
  elif [ "$IS_BRANCH_DELETE" = "true" ]; then
    allow "Branch deletion allowed on feature branch ($CURRENT_BRANCH)"
  fi
fi

exit 0
