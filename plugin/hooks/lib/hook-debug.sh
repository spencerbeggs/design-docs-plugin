#!/usr/bin/env bash
# hook-debug.sh — structured stderr logging for design-docs hooks.
#
# Writes to stderr with a timestamp and the hook script's basename so log
# lines from different hooks can be correlated. Optionally appends to
# /tmp/design-docs-hook-errors.log if DESIGN_DOCS_HOOK_LOG=1 is set in
# the environment.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/hook-debug.sh"
#   hook_debug "session_id=$sid starting"
#   hook_error "git tag failed: $err"

_HOOK_LOG_PATH="${DESIGN_DOCS_HOOK_LOG_PATH:-/tmp/design-docs-hook-errors.log}"
_HOOK_TAG="$(basename "${BASH_SOURCE[1]:-${0}}" .sh)"

_hook_log_line() {
  local level="$1"
  shift
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local line="[$ts] [$level] [$_HOOK_TAG] $*"
  printf '%s\n' "$line" >&2
  if [ "${DESIGN_DOCS_HOOK_LOG:-0}" = "1" ]; then
    printf '%s\n' "$line" >> "$_HOOK_LOG_PATH" 2>/dev/null || true
  fi
}

hook_debug() {
  [ "${DESIGN_DOCS_HOOK_DEBUG:-0}" = "1" ] || return 0
  _hook_log_line DEBUG "$@"
}

hook_error() {
  _hook_log_line ERROR "$@"
}
