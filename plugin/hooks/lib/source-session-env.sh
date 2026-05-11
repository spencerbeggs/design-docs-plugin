#!/usr/bin/env bash
# source-session-env.sh — load DESIGN_DOCS_* exports written by the
# SessionStart hook so that non-producer hooks (PreToolUse, PostToolUse,
# etc.) can see them. The host automatically sources $CLAUDE_ENV_FILE
# into the Bash-tool subprocess, but hook subprocesses do not receive
# that pre-load. Sourcing this script bridges the gap.
#
# Usage from a non-producer hook script:
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/source-session-env.sh"
#
# Safe to source even when $CLAUDE_ENV_FILE is unset or empty.

if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -f "${CLAUDE_ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "$CLAUDE_ENV_FILE"
fi
