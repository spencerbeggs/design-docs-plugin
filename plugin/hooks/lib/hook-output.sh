#!/usr/bin/env bash
# hook-output.sh — canonical JSON emitters for design-docs hooks.
#
# Source this file from any hook script that needs to produce
# hookSpecificOutput. Functions are guarded against missing jq.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/hook-output.sh"
#   emit_session_start "<context xml>"
#   emit_permission_allow "<reason>"
#   emit_noop

# Emit `{}` — the explicit no-op response. Safer than `exit 0` with empty
# stdout if the host ever tightens its response parsing.
emit_noop() {
  printf '{}\n'
}

# Emit a SessionStart hookSpecificOutput with additionalContext.
# Arg 1: context string (will be JSON-encoded safely via jq).
emit_session_start() {
  local ctx="$1"
  if ! command -v jq &>/dev/null; then
    return 1
  fi
  jq -n --arg ctx "$ctx" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $ctx
    }
  }'
}

# Emit a PreToolUse hookSpecificOutput with permissionDecision=allow.
# Arg 1: reason string included as permissionDecisionReason.
emit_permission_allow() {
  local reason="$1"
  if ! command -v jq &>/dev/null; then
    return 1
  fi
  jq -n --arg reason "$reason" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: $reason
    }
  }'
}
