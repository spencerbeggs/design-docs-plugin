#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: inject design documentation system context.
# Fires on all SessionStart sources (startup, resume, compact, clear).
# Outputs XML-structured context so agents internalize the purpose
# of design docs, not just the command list. Requires jq.

# Kill switch: disable all design-docs hooks
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  exit 0
fi

# Consume stdin to prevent broken pipe errors
cat > /dev/null

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
      git tag "session/start" "$MERGE_BASE" 2>/dev/null || true
      TAG_STATUS="created"
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
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ ! -d "$CLAUDE_PROJECT_DIR/.claude/design" ]; then
  mkdir -p "$CLAUDE_PROJECT_DIR/.claude/design" "$CLAUDE_PROJECT_DIR/.claude/plans"
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
- docs-gen-agent — user-facing documentation (READMEs, etc.)
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
    /design-docs:docs-generate-readme, docs-generate-repo, docs-generate-site,
    docs-generate-contributing, docs-generate-security, docs-review, docs-review-package,
    docs-sync, docs-update
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

# Output JSON with jq for safe string encoding
jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $ctx
  }
}'

exit 0
