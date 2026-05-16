# design-docs-plugin

## 0.6.0

### Features

* [`b63177a`](https://github.com/spencerbeggs/design-docs-plugin/commit/b63177a3aaeb228084983f5a3b43760f81b57e4c) ### Session handoff skill

Adds the `/design-docs:handoff` skill for transferring task state between Claude Code sessions.

* In a failing or context-exhausted session, captures the current task state to `.claude/handoffs/HANDOFF.md`
* In a fresh session, reads an existing handoff back into context and archives it
* Flags: `--resume`, `--update`, `--archive`, `--list`, `--dry-run`
* The skill is listed in the SessionStart hook's skill catalog; pickup is manual — run `/design-docs:handoff` in the fresh session to resume

## 0.5.0

### Breaking Changes

* [`db0b640`](https://github.com/spencerbeggs/design-docs-plugin/commit/db0b6405c0fa33874cf56a5e85ea762ef4e0209e) The `--docs-only` flag has been removed from `/design-docs:finalize`. Replace it with the two new negative-form skip flags:

| Old           | New                                                                   |
| :------------ | :-------------------------------------------------------------------- |
| `--docs-only` | *(no equivalent — run the full pipeline or use the skip flags below)* |
| *(n/a)*       | `--no-context-docs` — skips CLAUDE.md updates                         |
| *(n/a)*       | `--no-user-docs` — skips user-facing doc updates                      |

`--no-push` and `--no-pr` are now separate flags with distinct semantics: `--no-push` keeps the work local (skip step 8 entirely), while `--no-pr` pushes the branch but skips PR creation (useful when CI or a separate tool opens the PR). `--no-squash` and `--dry-run` are unchanged.

### Features

* [`db0b640`](https://github.com/spencerbeggs/design-docs-plugin/commit/db0b6405c0fa33874cf56a5e85ea762ef4e0209e) ### Model-invokable finalize skill

`/design-docs:finalize` now runs when the model recognizes end-of-branch phrases. Trigger phrases such as "finalize this branch", "wrap up", "ship it", "ready to merge — run the prep", and "I'm done with this work, prep it for merge" automatically route to the skill. `/design-docs:review` and `/design-docs:merge-prep` remain user-invocable only.

### Agent-dispatch architecture for doc steps

Steps 3–5 of the finalize pipeline now dispatch the bundled documentation agents (`design-doc-agent`, `context-doc-agent`, `user-docs`) via the `Agent` tool instead of invoking individual sub-skills directly. Each agent loads its matching `*-docs-style` skill automatically, tightening style enforcement across the full pipeline.

### Documentation agent color badges

`design-doc-agent`, `context-doc-agent`, and `user-docs` now carry `color` metadata for transcript badge identification (red, pink, and blue respectively). Each agent also declares its matching style skill so it auto-loads on dispatch.

## 0.4.1

### Features

* [`878d8a2`](https://github.com/spencerbeggs/design-docs-plugin/commit/878d8a2424d11ac497006e7456b870da73b4d56b) ### PreToolUse now covers MultiEdit

The `allow-design-writes` matcher was extended from `Write|Edit` to `Write|Edit|MultiEdit`. MultiEdit operations against `.claude/design/` and `.claude/plans/` are now auto-approved on the same terms as Write and Edit, eliminating a permission prompt that previously interrupted multi-step doc edits.

### Documentation

* [`878d8a2`](https://github.com/spencerbeggs/design-docs-plugin/commit/878d8a2424d11ac497006e7456b870da73b4d56b) Synced the plugin architecture design doc with the new hook layout, shared `lib/`, and updated diagrams.
* Updated root and plugin `CLAUDE.md` to reflect the per-event subdirectory convention and the third `lib/` helper.
* Corrected `CONTRIBUTING.md` hook-path convention to `plugin/hooks/<event-kebab>/{name}.sh`.
* Style-skill content (`context-docs-style`, `design-docs-style`) refined; finalize/review/merge-prep workflow `SKILL.md` files updated.

### Refactoring

* [`878d8a2`](https://github.com/spencerbeggs/design-docs-plugin/commit/878d8a2424d11ac497006e7456b870da73b4d56b) ### Per-event hook directory layout

Hook scripts now live in event-name subdirectories under `plugin/hooks/`, with shared helpers in a `lib/` sibling. The flat layout (`plugin/hooks/session-start.sh`, `plugin/hooks/allow-design-writes.sh`) is gone.

* `plugin/hooks/session-start/context-inject.sh` — SessionStart context injection
* `plugin/hooks/pre-tool-use/allow-design-writes.sh` — PreToolUse auto-approve for `.claude/design/` and `.claude/plans/`
* `plugin/hooks/lib/` — shared helpers (`hook-output.sh`, `hook-debug.sh`, `source-session-env.sh`) sourced via relative paths

The new layout makes path-based plugin-bash-engineer skills auto-load when hook scripts are edited, and keeps shared code out of the registration surface. `hooks.json` was updated to point at the new paths and quotes `${CLAUDE_PLUGIN_ROOT}` so paths with spaces survive expansion.

### Skill script hardening

Bash scripts across `design-audit/`, `design-validate/`, `design-update/`, `plan-complete/`, `plan-explore/`, `plan-validate/`, and `review/` were tightened — stricter shell options, clearer error reporting, safer path handling, and consistent exit-code semantics. No behavior change for existing successful invocations; failure modes are clearer.

## 0.4.0

### Features

* [`ffddfb2`](https://github.com/spencerbeggs/design-docs-plugin/commit/ffddfb292ea87ae85c36596fd34457b7c963b9aa) Integrate user-docs skill suite, add path-based style skills, remove unused hooks and update audit metrics.

- Add 10 `user-docs-*` skills and `user-docs` agent, replacing the `docs-gen-agent` and two superseded skills (`docs-generate-readme`, `docs-review`)
- Add `user-docs-style` and `design-docs-style` path-based skills that inject style rules when matching files are read
- Add `context-docs-style` path-based skill for `CLAUDE.md`/`AGENTS.md` files enforcing LoadWhen references and lean context structure
- Remove `subagent-start`, `stop-reminder`, `git-safety` and `git-safety-mcp` hooks (responsibilities delegated externally)
- Switch context audit and validate from line-count to word-count metric (`rootMaxWords: 2000`, `childMaxWords: 1000`)
- Move `design-docs.schema.json` to repo root with a canonical GitHub raw URL; remove from plugin distribution
- Add `--squash` flag to `review` skill: folds fix commits into the previous commit and force-pushes
- Persist `GITHUB_PERSONAL_ACCESS_TOKEN` as `GH_TOKEN` in session-start hook via `CLAUDE_ENV_FILE`; derive `GITHUB_REPOSITORY` from git remote
- Expand `review` skill with pre-review cleanup (minimize stale bot summaries), triage of already-fixed and invalid comments, and `resolve-thread` calls for those two categories — legitimate fixes leave threads open for cloud re-review

## 0.3.1

### Bug Fixes

* [`addaf6e`](https://github.com/spencerbeggs/design-docs-plugin/commit/addaf6ee214966fd1af5c9b6c9e601cafd3fe95e) Fixed `stop-reminder` hook emitting an invalid JSON output format that caused a Claude Code schema validation error on every trigger. The hook was emitting `hookSpecificOutput.additionalContext`, which is only valid for `UserPromptSubmit`, `PostToolUse`, and `PostToolBatch` hooks. Stop hooks require the top-level `systemMessage` field — the output is now `{ "systemMessage": "..." }`.

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
