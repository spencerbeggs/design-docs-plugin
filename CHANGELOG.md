# design-docs-plugin

## 0.3.0

### Features

* [`1853ba3`](https://github.com/spencerbeggs/design-docs-plugin/commit/1853ba362b1b1bf75cfbbaf149169ebf7751a624) ### Branch Lifecycle Workflow

Adds squash-merge workflow support with three skills and git safety hooks for feature branch development.

**Skills:**

* `/design-docs:finalize` — revised to squash all branch commits into a single clean commit before pushing and opening a PR. Adds `--no-squash` flag and session tag verification.
* `/design-docs:review` — new skill that fetches active PR review comments, triages by severity, addresses fixes, and commits with small fix commits during review cycles.
* `/design-docs:merge-prep` — new skill for final squash of all branch commits and force push after PR approval. Cleans up session tag.

**Git Safety Hooks:**

* `git-safety.sh` (PreToolUse, Bash) — blocks destructive git operations on the default branch while auto-allowing them on feature branches. Always blocks `gh repo delete`, branch protection removal, and admin PR merges.
* `git-safety-mcp.sh` (PreToolUse, GitKraken MCP) — same branch-aware rules for GitKraken MCP tools (`git_push`, `git_branch`, `git_checkout`).

**Session Tag Management:**

* `session-start.sh` now creates a local `session/start` git tag at the merge-base on feature branches for session boundary tracking.

### Bug Fixes

* [`1853ba3`](https://github.com/spencerbeggs/design-docs-plugin/commit/1853ba362b1b1bf75cfbbaf149169ebf7751a624) Fix hook JSON output validation errors on startup

SessionStart and Stop hooks now output valid JSON with `hookEventName` in `hookSpecificOutput`, matching the schema Claude Code expects. SessionStart context restructured from markdown to XML tags wrapped in `<EXTREMELY_IMPORTANT>` for better agent prioritization. SessionStart hook now auto-creates `.claude/design/` and `.claude/plans/` directories when missing instead of omitting context.

## 0.2.0

### Features

* [`7f4ec0d`](https://github.com/spencerbeggs/design-docs-plugin/commit/7f4ec0d6e8e41affa16cf6d9a2cfa604dff1631a) ### Hook Reinforcement System

Three new lifecycle hooks that reinforce design docs awareness across context-loss boundaries:

* **SessionStart** rewritten with philosophy-first context, fires on all session sources (startup, resume, compact, clear), includes first-install detection
* **SubagentStart** injects condensed design docs awareness into every spawned subagent
* **Stop** provides a soft post-implementation nudge using keyword detection with a loop guard

### Refactoring

* [`7f4ec0d`](https://github.com/spencerbeggs/design-docs-plugin/commit/7f4ec0d6e8e41affa16cf6d9a2cfa604dff1631a) ### Pure Bash Hooks

Replaced the compiled TypeScript binary plugin build system with pure bash hooks. Removes all build dependencies and simplifies distribution.

### Finalize Skill

New `/design-docs:finalize` skill orchestrates the end-of-branch workflow: update design docs, CLAUDE.md files, and user docs, create a changeset, commit, push, and open a PR. Supports `--no-pr`, `--docs-only`, and `--dry-run` flags.

### Skill Frontmatter Fixes

* Renamed `tools` to `allowed-tools` across all 35 skills
* Added missing `context: fork` to 5 skills
* Fixed agent tool lists (added WebSearch to docs-gen-agent)

## 0.1.0

### Features

* [`132b999`](https://github.com/spencerbeggs/design-docs-plugin/commit/132b999cc9de39803c308583c77c4e4cc14d43a8) ### Design Documentation Management System

A Claude Code plugin that brings structured design documentation, CLAUDE.md context management, implementation planning, and user-facing documentation generation into any project. Injects session context automatically and provides 34 skills across 4 categories plus 3 specialized agents.

**Skills:**

* **design-\* (15 skills)** — Full lifecycle management for internal design documents: initialize from templates, validate structure and frontmatter, update content, sync with codebase changes, review for quality, audit health, search across docs, compare versions, link cross-references, generate indexes and reports, export to other formats, archive outdated docs, prune historical cruft, and manage system configuration
* **context-\* (5 skills)** — Maintain CLAUDE.md context files that provide LLM assistants with project understanding: validate structure and formatting, audit quality and token efficiency, review for improvements, update based on codebase changes, and split oversized files into focused children
* **docs-\* (9 skills)** — Generate user-facing documentation from design docs and source code: create and update README files, repository documentation, documentation sites, CONTRIBUTING.md, and SECURITY.md, plus review documentation quality, audit package.json completeness, sync docs with code changes, and run comprehensive pre-merge documentation checks
* **plan-\* (5 skills)** — Create and track implementation plans as transitory documents that bridge design docs and active development: create plans from templates, validate structure, list and filter by status or module, explore plan relationships and health, and complete plans by persisting knowledge back to design docs

**Agents:**

* **design-doc-agent** — Orchestrates multi-skill workflows for design documentation and implementation plan management, with access to all design-\* and plan-\* skills
* **context-doc-agent** — Maintains CLAUDE.md context files across a project using all context-\* skills, ensuring accuracy, efficiency, and proper separation from design docs
* **docs-gen-agent** — Drives end-to-end user documentation generation from design docs and source code using all docs-\* skills

**SessionStart Context Hook:**

Automatically injects a design documentation system overview into every Claude Code session, listing all available skills and agents. Configurable via `DESIGN_DOCS_CONTEXT_ENABLED` environment variable (default: enabled).
