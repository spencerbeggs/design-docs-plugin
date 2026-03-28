#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: inject design documentation system context.
# Fires on all SessionStart sources (startup, resume, compact, clear).
# Outputs philosophy-first context so agents internalize the purpose
# of design docs, not just the command list.

# Kill switch: disable all design-docs hooks
if [ "${DESIGN_DOCS_CONTEXT_ENABLED:-true}" = "false" ]; then
  exit 0
fi

# First-install detection: if no design docs directory exists,
# show initialization guidance instead of the full context.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ ! -d "$CLAUDE_PROJECT_DIR/.claude/design" ]; then
  cat <<'INIT'
## Design Documentation System

The design-docs plugin is installed but not yet initialized. Run
`/design-docs:design-config` to set up the design documentation system
for this project. Once initialized, design docs will live in
`.claude/design/` and implementation plans in `.claude/plans/`.
INIT
  exit 0
fi

cat <<'CONTEXT'
## Design Documentation System

After completing implementation work, delegate design doc updates to the
**design-doc-agent**. Do not edit design docs directly — the agent knows
the system's conventions and will handle frontmatter, cross-references,
and validation.

### What Design Docs Are

Design docs record the current state of implementation: architecture
decisions, system boundaries, data flows, and the reasoning behind
design choices. They live in `.claude/design/` with implementation
plans in `.claude/plans/`.

### Why They Matter

Design docs are this project's institutional memory. Without them,
every new session starts from zero — re-reading code to understand
intent that was already documented. Keeping them current after
implementation work is as important as the implementation itself.

### When To Update

Update design docs when you have:
- Added or changed system architecture
- Modified data flows or API boundaries
- Made decisions that future sessions should know about
- Completed work described in an implementation plan

### How To Update

Delegate to specialized agents rather than editing directly:
- **design-doc-agent** — design docs and implementation plans
- **context-doc-agent** — CLAUDE.md context files
- **docs-gen-agent** — user-facing documentation (READMEs, etc.)

### Available Skills

**Design docs:** `/design-docs:design-init`, `design-validate`, `design-update`, `design-sync`, `design-review`, `design-audit`, `design-search`, `design-compare`, `design-link`, `design-index`, `design-report`, `design-export`, `design-archive`, `design-prune`, `design-config`

**Plans:** `/design-docs:plan-create`, `plan-validate`, `plan-list`, `plan-explore`, `plan-complete`

**Context:** `/design-docs:context-validate`, `context-audit`, `context-review`, `context-update`, `context-split`

**User docs:** `/design-docs:docs-generate-readme`, `docs-generate-repo`, `docs-generate-site`, `docs-generate-contributing`, `docs-generate-security`, `docs-review`, `docs-review-package`, `docs-sync`, `docs-update`

**Finalization:** `/design-docs:finalize` — end-of-branch workflow (update all docs, create changeset, commit, push, open PR)
CONTEXT

exit 0
