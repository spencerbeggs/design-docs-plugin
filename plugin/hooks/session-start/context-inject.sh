#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: inject design documentation system context.
# Fires on all SessionStart sources (startup, resume, compact, clear).
# Outputs XML-structured context so agents internalize the purpose
# of design docs, not just the command list. Requires jq.

_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)"
# shellcheck source=../lib/hook-output.sh
source "$_LIB_DIR/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
source "$_LIB_DIR/hook-debug.sh"

# Kill switch: disable all design-docs hooks
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  emit_noop
  exit 0
fi

# Fail open without jq — log and emit a no-op rather than blocking the session
if ! command -v jq &>/dev/null; then
  hook_error "jq not found, skipping context injection"
  emit_noop
  exit 0
fi

# Read the SessionStart envelope. The host pipes a JSON object containing
# at least session_id, cwd, and hook_event_name. Capture it so we can
# fall back to the envelope's cwd if CLAUDE_PROJECT_DIR is unset.
INPUT=$(cat 2>/dev/null || echo "")
ENVELOPE_CWD=$(jq -r '.cwd // empty' <<< "$INPUT" 2>/dev/null || echo "")
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$ENVELOPE_CWD}"

# Persist GitHub credentials for gh-pr-review.sh across this session.
# Maps GITHUB_PERSONAL_ACCESS_TOKEN → DESIGN_DOCS_GH_TOKEN so the review
# script can authenticate without overriding the user's own GH_TOKEN.
# gh-pr-review.sh translates DESIGN_DOCS_GH_TOKEN → GH_TOKEN per-call.
# Also derives GITHUB_REPOSITORY from the git remote if not already set.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  if [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
    grep -q "^export DESIGN_DOCS_GH_TOKEN=" "$CLAUDE_ENV_FILE" 2>/dev/null || \
      printf 'export DESIGN_DOCS_GH_TOKEN=%q\n' "${GITHUB_PERSONAL_ACCESS_TOKEN}" >> "$CLAUDE_ENV_FILE"
  fi
  if [ -z "${GITHUB_REPOSITORY:-}" ] && command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+/[^/]+) ]]; then
      DETECTED_REPO="${BASH_REMATCH[1]%.git}"
      grep -q "^export GITHUB_REPOSITORY=" "$CLAUDE_ENV_FILE" 2>/dev/null || \
        printf 'export GITHUB_REPOSITORY=%q\n' "$DETECTED_REPO" >> "$CLAUDE_ENV_FILE"
    fi
  fi

  # Persist the three canonical plugin paths under the DESIGN_DOCS_ namespace
  # so skill scripts invoked in sub-subshells (where direct CLAUDE_* env
  # inheritance may not survive) can recover them via the documented
  # three-tier fallback (DESIGN_DOCS_X → CLAUDE_X → standalone fallback).
  for _kv in \
    "DESIGN_DOCS_PROJECT_DIR=$PROJECT_DIR" \
    "DESIGN_DOCS_DATA_DIR=${CLAUDE_PLUGIN_DATA:-}" \
    "DESIGN_DOCS_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-}"; do
    _name="${_kv%%=*}"
    _val="${_kv#*=}"
    [ -z "$_val" ] && continue
    grep -q "^export ${_name}=" "$CLAUDE_ENV_FILE" 2>/dev/null || \
      printf 'export %s=%q\n' "$_name" "$_val" >> "$CLAUDE_ENV_FILE"
  done
  unset _kv _name _val
fi

# --- Session tag management ---
# Creates or reports a session/start tag on feature branches to mark where
# the session began. Used by finalize/review/merge-prep for squash boundaries.
BRANCH_SESSION_CONTEXT=""
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null; then
  CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
  DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@') || DEFAULT_BRANCH=""
  DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

  # Only manage tags on feature branches (not default, not detached HEAD)
  if [ -n "$CURRENT_BRANCH" ] && [ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ]; then
    if git rev-parse "session/start" &>/dev/null; then
      # Tag already exists — report it, do NOT move it
      TAG_COMMIT=$(git rev-parse "session/start")
      TAG_SHORT=$(git rev-parse --short "session/start")
      COMMITS_AHEAD=$(git rev-list "session/start..HEAD" --count 2>/dev/null || echo "0")
      TAG_STATUS="existing"
    else
      # No tag — create at merge-base with default branch
      MERGE_BASE=$(git merge-base "$DEFAULT_BRANCH" HEAD 2>/dev/null || git rev-parse HEAD)
      TAG_COMMIT="$MERGE_BASE"
      TAG_SHORT=$(git rev-parse --short "$MERGE_BASE")
      COMMITS_AHEAD=$(git rev-list "${MERGE_BASE}..HEAD" --count 2>/dev/null || echo "0")
      if git tag "session/start" "$MERGE_BASE" 2>/dev/null; then
        TAG_STATUS="created"
      else
        # Tag creation failed (e.g., tag already exists from a race, lock file).
        # Report observed state rather than the optimistic "created" value.
        TAG_STATUS="unmanaged"
      fi
    fi

    BRANCH_SESSION_CONTEXT="
<branch_session>
  <branch>${CURRENT_BRANCH}</branch>
  <session_tag commit=\"${TAG_SHORT}\">${TAG_COMMIT}</session_tag>
  <commits_ahead>${COMMITS_AHEAD}</commits_ahead>
  <status>${TAG_STATUS}</status>
</branch_session>"
  fi
fi

# Ensure design docs directories exist
NEEDS_INIT=false
if [ -n "$PROJECT_DIR" ] && [ ! -d "$PROJECT_DIR/.claude/design" ]; then
  mkdir -p "$PROJECT_DIR/.claude/design" "$PROJECT_DIR/.claude/plans"
  NEEDS_INIT=true
fi

# Build XML-structured context
CONTEXT="<EXTREMELY_IMPORTANT>"

if [ "$NEEDS_INIT" = "true" ]; then
  CONTEXT+="
<action_required>
The design docs directories (.claude/design/ and .claude/plans/) were just created but are empty.
Run /design-docs:design-init to initialize the design documentation system for this project.
</action_required>"
fi

CONTEXT+="
<design_documentation_system>

<purpose>
After completing implementation work, delegate design doc updates to the design-doc-agent.
Do not edit design docs directly — the agent knows the system's conventions and will handle
frontmatter, cross-references, and validation.
</purpose>

<what_design_docs_are>
Design docs record the current state of implementation: architecture decisions, system
boundaries, data flows, and the reasoning behind design choices. They live in .claude/design/
with implementation plans in .claude/plans/.
</what_design_docs_are>

<why_they_matter>
Design docs are this project's institutional memory. Without them, every new session starts
from zero — re-reading code to understand intent that was already documented. Keeping them
current after implementation work is as important as the implementation itself.
</why_they_matter>

<when_to_update>
Update design docs when you have:
- Added or changed system architecture
- Modified data flows or API boundaries
- Made decisions that future sessions should know about
- Completed work described in an implementation plan
</when_to_update>

<how_to_update>
Delegate to specialized agents rather than editing directly:
- design-doc-agent — design docs and implementation plans
- context-doc-agent — CLAUDE.md context files
- user-docs — user-facing documentation (READMEs, etc.)
</how_to_update>

<available_skills>
  <skill_group name=\"design_docs\">
    /design-docs:design-init, design-validate, design-update, design-sync, design-review,
    design-audit, design-search, design-compare, design-link, design-index, design-report,
    design-export, design-archive, design-prune, design-config
  </skill_group>
  <skill_group name=\"plans\">
    /design-docs:plan-create, plan-validate, plan-list, plan-explore, plan-complete
  </skill_group>
  <skill_group name=\"context\">
    /design-docs:context-validate, context-audit, context-review, context-update, context-split
  </skill_group>
  <skill_group name=\"user_docs\">
    /design-docs:user-docs-create-readme, user-docs-create-docs, user-docs-add-page,
    user-docs-badges, user-docs-build-badges, user-docs-build-toc, user-docs-detect-shape,
    user-docs-humanize, user-docs-review, docs-generate-contributing, docs-generate-security,
    docs-review-package, docs-sync, docs-update
  </skill_group>
  <skill_group name=\"finalization\">
    /design-docs:finalize — end-of-branch workflow (update all docs, create changeset, squash, push, open PR)
    /design-docs:review — fetch and address PR review feedback, lightweight doc check, commit and push
    /design-docs:merge-prep — final squash of all branch commits, force push for merge
  </skill_group>
</available_skills>
${BRANCH_SESSION_CONTEXT}
</design_documentation_system>
</EXTREMELY_IMPORTANT>"

# Output JSON via the canonical emitter
emit_session_start "$CONTEXT"

exit 0
