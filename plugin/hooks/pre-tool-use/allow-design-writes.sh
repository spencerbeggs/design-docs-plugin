#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: auto-approve Write/Edit/MultiEdit to design docs and plans.
# Prevents repeated permission prompts when agents update documentation.

_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)"
# shellcheck source=../lib/hook-output.sh
source "$_LIB_DIR/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
source "$_LIB_DIR/hook-debug.sh"

# Kill switch
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  emit_noop
  exit 0
fi

# Fail open without jq — without it we cannot parse the envelope, so let the
# normal permission flow handle the request instead of blocking the user.
if ! command -v jq &>/dev/null; then
  hook_error "jq not found, deferring to normal permissions"
  emit_noop
  exit 0
fi

# Read stdin JSON
INPUT=$(cat)

# Extract the file path from tool input
FILE_PATH=$(jq -r '.tool_input.file_path // ""' <<< "$INPUT")

# If no file path, let the normal permission flow handle it
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Auto-approve writes to design docs and plans directories
if echo "$FILE_PATH" | grep -qE '(/|^)\.claude/(design|plans)/'; then
  emit_permission_allow "Design docs plugin: auto-approved write to design docs directory"
  exit 0
fi

# All other paths: don't interfere, let normal permissions apply
exit 0
