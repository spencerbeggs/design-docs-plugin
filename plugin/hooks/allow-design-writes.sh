#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: auto-approve Write/Edit to design docs and plans directories.
# Prevents repeated permission prompts when agents update documentation.

# Read stdin JSON
INPUT=$(cat)

# Extract the file path from tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# If no file path, let the normal permission flow handle it
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Auto-approve writes to design docs and plans directories
if echo "$FILE_PATH" | grep -qE '(/|^)\.claude/(design|plans)/'; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Design docs plugin: auto-approved write to design docs directory"
  }
}
JSON
  exit 0
fi

# All other paths: don't interfere, let normal permissions apply
exit 0
