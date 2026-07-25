---
status: current
module: design-docs-plugin
category: architecture
created: 2026-03-24
updated: 2026-07-11
last-synced: 2026-07-11
completeness: 95
related: [system-model-vs-observed.md]
dependencies: []
---

# Design Docs Plugin - Architecture

Comprehensive architecture of the design-docs Claude Code plugin: a pure bash and markdown documentation management system distributed via sidecar sparse cloning.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [System Architecture](#system-architecture)
5. [Data Flow](#data-flow)
6. [Pointer Integrity (Content-Drift Detection)](#pointer-integrity-content-drift-detection)
7. [Integration Points](#integration-points)
8. [Testing Strategy](#testing-strategy)
9. [Future Enhancements](#future-enhancements)
10. [Related Documentation](#related-documentation)

---

## Overview

The design-docs plugin provides design documentation management, implementation plan tracking, CLAUDE.md context file maintenance, and user-facing documentation generation to Claude Code users. It ships as pure bash hooks and markdown skills/agents with no compiled binary, no TypeScript runtime, and no runtime dependencies. The plugin has 50 skills organized across 3 specialized agents, activated through two hooks: a SessionStart hook that injects context and manages session tags, and a PreToolUse hook for auto-approving design directory and CLAUDE.md writes. Hooks are organized by event name in subdirectories (`hooks/<event-kebab>/`) with shared bash helpers in `hooks/lib/`. SubagentStart, Stop, and git-safety hooks were removed in 0.3.x; those responsibilities were delegated to the session workflow and the commit plugin.

The plugin follows a **sidecar distribution pattern**: it is developed inside a monorepo with full dev tooling (linting, testing, CI), but only the `plugin/` directory reaches end users via git-subdir sparse cloning from a marketplace repository. This separation ensures dev infrastructure never ships.

**Key Design Principles:**

- Sidecar isolation: the `plugin/` directory is fully self-contained and independently distributable
- Pure bash hooks: no compiled binary, no TypeScript runtime, no build step -- hooks are plain bash scripts invoked via `bash ${CLAUDE_PLUGIN_ROOT}/hooks/<event-kebab>/<name>.sh`
- Event-subdirectory layout: hooks live under `hooks/<event-kebab>/<name>.sh` (e.g. `session-start/context-inject.sh`, `pre-tool-use/allow-design-writes.sh`); shared helpers live in `hooks/lib/` and are sourced via relative paths so the plugin works regardless of where it is installed
- Convention over configuration: skills follow a strict directory structure (`skills/{name}/SKILL.md`) with optional supporting files
- Agents as orchestrators: agents coordinate multiple skills within a shared context, reducing redundant file reads and enabling multi-step workflows
- Minimal hook footprint: two hooks (SessionStart, PreToolUse) handle context injection and auto-approval; git safety and subagent awareness are delegated externally

**When to reference this document:**

- When modifying the hook system or adding new hooks
- When adding, removing, or restructuring skills or agents
- When changing the distribution mechanism
- When debugging hook behavior or context injection
- When onboarding contributors to the plugin architecture

---

## Current State

### Repository Structure

The monorepo has four top-level areas with distinct responsibilities:

```text
design-docs-plugin/
+-- plugin/                       # DISTRIBUTABLE -- everything here ships to users
|   +-- .claude-plugin/           # Plugin manifest (plugin.json)
|   +-- lib/                      # Shared helper scripts for skills/agents (NOT hooks)
|   |   +-- ref-hash.sh           # body-only sha256 of a design doc (pointer drift)
|   |   +-- refs-record.sh        # turnkey recorder: upserts a CLAUDE.md's pointer hashes
|   +-- hooks/
|   |   +-- hooks.json            # Hook configuration (event -> script paths)
|   |   +-- lib/                  # Shared bash helpers sourced by hook scripts
|   |   +-- session-start/        # SessionStart scripts
|   |   +-- pre-tool-use/         # PreToolUse scripts
|   |   +-- fixtures/             # Reserved for hook-payload fixtures
|   +-- skills/                   # 50 skill directories
|   +-- agents/                   # 3 agent definitions
|   +-- commands/                 # (no commands yet)
|   +-- CLAUDE.md
+-- __test__/                     # ALL tests (mirrors plugin/ structure)
+-- docs/                         # User-facing public documentation
+-- lib/                          # Dev tooling configs and scripts
```

**Boundary rule:** Nothing outside `plugin/` ships to users. Tests live in `__test__/` to keep the distributable clean. The plugin directory has no `package.json`, no `tsconfig.json`, no build tooling -- it is purely markdown and bash.

There are two distinct shared-script locations under `plugin/`, separated by who sources them. `hooks/lib/` holds helpers sourced by hook scripts (Claude Code's hook runtime). `plugin/lib/` holds helpers invoked by skills and agents at task time -- `ref-hash.sh` and its turnkey recorder `refs-record.sh`, which together power pointer content-drift detection (see [Pointer Integrity](#pointer-integrity-content-drift-detection)). Keep them separate: hook helpers run in the constrained hook subprocess, skill/agent helpers run in the richer task context.

### Plugin Manifest

The plugin identity is declared in `plugin/.claude-plugin/plugin.json`:

- **name**: `design-docs`
- **version**: managed by changesets
- **skills**: 50 skill directory paths
- **agents**: 3 agent markdown files
- **commands**: none currently

### Hook System

Hooks are pure bash scripts declared in `plugin/hooks/hooks.json` (hand-written, not generated). Scripts live in per-event subdirectories (`hooks/<event-kebab>/<name>.sh`) so path-based plugin-bash-engineer skills auto-load when an author opens a hook file. Each hook entry in `hooks.json` uses the `command` type with `bash ${CLAUDE_PLUGIN_ROOT}/hooks/<event-kebab>/<name>.sh` to avoid executable bit issues when distributed from repos that strip them.

Shared helpers live in `hooks/lib/` and are sourced from each hook script via relative paths (`source "$(dirname "${BASH_SOURCE[0]}")/../lib/<name>.sh"`):

- `lib/hook-output.sh` -- canonical JSON emitters (`emit_session_start`, `emit_permission_allow`, `emit_noop`). Centralizes the response envelope so hooks never hand-roll JSON and so a future schema change touches one file.
- `lib/hook-debug.sh` -- structured stderr logging (`hook_debug`, `hook_error`) gated on `DESIGN_DOCS_HOOK_DEBUG`; optionally appends to `/tmp/design-docs-hook-errors.log` when `DESIGN_DOCS_HOOK_LOG=1`.
- `lib/source-session-env.sh` -- loads `$CLAUDE_ENV_FILE` exports written by the SessionStart hook so that non-producer hooks (PreToolUse, PostToolUse) see `DESIGN_DOCS_*` variables in their own subprocess.

All hooks check the `DESIGN_DOCS_CONTEXT_ENABLED` environment variable. Setting it to `"false"` disables all hook behavior (kill switch).

**session-start/context-inject.sh (SessionStart, timeout 5s):**

Injects philosophy-first design documentation context into every Claude Code session. Fires on all SessionStart sources (startup, resume, compact, clear). Reads the SessionStart envelope from stdin and falls back to the envelope's `cwd` if `CLAUDE_PROJECT_DIR` is unset. Includes first-install detection: if `.claude/design/` does not exist, creates the directory and emits initialization guidance instead of the full context. The context message explains what design docs are, why they matter, when to update them, and lists all available skills organized by category in `<skill_group>` blocks — `design_docs`, `plans`, `context`, `user_docs`, `finalization`, and `session` (the `handoff` skill). On feature branches, manages the `session/start` local git tag for session boundary tracking -- creates at merge-base if missing, reports existing tag without moving it. Outputs branch session context as XML within the design documentation system block. Writes `DESIGN_DOCS_GH_TOKEN` (mapped from `GITHUB_PERSONAL_ACCESS_TOKEN`), `GITHUB_REPOSITORY`, `DESIGN_DOCS_PROJECT_DIR`, `DESIGN_DOCS_DATA_DIR`, and `DESIGN_DOCS_PLUGIN_ROOT` to `$CLAUDE_ENV_FILE` so downstream skills can recover plugin paths and GitHub auth. The token mapping is optional: gh-backed skills (see `plugin/skills/review/scripts/gh-pr-review.sh`) resolve auth as `DESIGN_DOCS_GH_TOKEN` → `GH_TOKEN` → `GITHUB_TOKEN` (the middle two for CI environments that set them directly) → gh keyring credentials from `gh auth login`, and every gh call site scrubs stale env tokens (an empty `GH_TOKEN=` assignment) so the keyring wins when no env token is set. Emits JSON via `emit_session_start`; emits `{}` no-op when `jq` is missing.

**pre-tool-use/allow-design-writes.sh (PreToolUse, matcher: `Write|Edit|MultiEdit`, timeout 3s):**

Auto-approves Write, Edit, and MultiEdit operations targeting `.claude/design/` and `.claude/plans/` directories, plus any `CLAUDE.md` file — a deliberate trust expansion so `design-groom` and the documentation agents can update context files without permission prompts. Prevents repeated permission prompts when agents update documentation. Reads stdin JSON, extracts `tool_input.file_path`, and emits `permissionDecision: "allow"` via `emit_permission_allow` when the path matches. Fails open when `jq` is missing (logs an error via `hook_error` and exits 0, deferring to normal permissions). This plugin-level registration in `hooks/hooks.json` is the sole source of the auto-approval: it applies in subagent contexts too, because Claude Code drops `hooks`, `mcpServers`, and `permissionMode` from plugin agent frontmatter at load time.

**Removed hooks (0.3.x):**

`subagent-start.sh`, `stop-reminder.sh`, `git-safety.sh`, and `git-safety-mcp.sh` were removed. SubagentStart and Stop responsibilities are delegated to the session workflow; git safety is handled by the commit plugin. Their tests (`subagent-start.test.ts`, `stop-reminder.test.ts`, `git-safety.test.ts`, `git-safety-mcp.test.ts`) were also removed.

### Skills

50 skill directories organized in 6 categories:

| Category | Count | Skills |
| --- | --- | --- |
| design-* | 18 | init, validate, update, sync, review, audit, search, compare, link, index, report, export, archive, prune, config, groom, split, docs-style |
| context-* | 6 | validate, audit, review, update, split, docs-style |
| docs-* | 7 | generate-contributing, generate-security, generate-repo, generate-site, review-package, sync, update |
| plan-* | 5 | create, validate, list, explore, complete |
| user-docs-* | 10 | add-page, badges, build-badges, build-toc, create-docs, create-readme, detect-shape, humanize, review, style |
| workflow | 4 | finalize (end-of-branch orchestration with squash), review (PR feedback cycles), merge-prep (final squash before merge), handoff (bidirectional session handoff) |

Skill frontmatter uses `allowed-tools` (not `tools`) for declaring tool permissions; Bash grants are scoped to command patterns (e.g. `Bash(bash *)`, `Bash(grep *)`) rather than bare `Bash`. Skills that need isolation use `context: fork` in frontmatter. Skills are invoked as `/design-docs:{skill-name}`. All skill and agent cross-references in SKILL.md files and agent prompts are namespace-qualified — `design-docs:<name>` for the `Skill` tool, `/design-docs:<name>` for slash commands, `design-docs:<agent>` for `Agent` dispatch — so references resolve unambiguously when the plugin is installed alongside others. Skill docs reference their own shipped assets (validation scripts, templates) via `${CLAUDE_PLUGIN_ROOT}/skills/...` paths, never repo-local `.claude/skills/` paths, so instructions resolve wherever the plugin is installed. Every shipped script is documented in its owning SKILL.md, and oversized SKILL.md files are split into a lean entry point plus supporting files (instructions.md, examples.md, error-messages.md and skill-specific references such as checks.md or config-reference.md) — context-validate, context-split and design-config follow this pattern.

Three of the workflow skills form a branch lifecycle: `/finalize` orchestrates the end-of-branch documentation update and squash-then-PR sequence, `/review` addresses PR feedback in small fix commits (supports `--squash` to fold review commits into the previous commit), and `/merge-prep` does a final squash for merge. `/review` and `/merge-prep` are user-invocable only (`disable-model-invocation: true`); `/finalize` is model-invokable so trigger phrases like "finalize this branch" or "wrap up" route to it via its `when_to_use` frontmatter hint.

The fourth workflow skill, `/handoff`, is a **bidirectional session-handoff** skill that sits outside the branch lifecycle. It is the escape hatch for when a session has gone wrong in a way that cannot be fixed in flight — context exhaustion or a wedged environment — and restoring context by hand would cost more than starting fresh. The skill has no flags-required happy path: its mode is inferred from on-disk state. With no flags and no active handoff it runs in **write mode**, capturing the current task state into a fixed-template document; with no flags and an active handoff present it runs in **read mode**, resuming that work and then archiving the handoff. Explicit flags override inference: `--resume`, `--update` (amend the pending handoff in place), `--archive` (clear without resuming), `--list` (list the archive), `--dry-run`. Write mode first assesses whether the session produced design-level changes and, if so, dispatches the `design-docs:design-doc-agent` via the `Agent` tool to persist them to `.claude/design/` before writing the handoff — durable design context must land in tracked design docs rather than the transient handoff file. Like `/review` and `/merge-prep`, `/handoff` is user-invocable only (`disable-model-invocation: true`).

Handoffs live under `.claude/handoffs/`: the active handoff at `.claude/handoffs/HANDOFF.md`, consumed or cleared handoffs archived to `.claude/handoffs/archive/<timestamp>-handoff.md`. This directory is project-scoped session state but, unlike `.claude/design/` and `.claude/plans/` which are git-tracked, it is transient per-machine state — the skill ensures `.claude/handoffs/` is in the project `.gitignore` and handoffs are never committed. Handoff documents carry YAML frontmatter (`created_at`, `updated_at`, `branch`, `status`, `reason`, `consumed_at`, `archived_at`) and eight fixed sections, with `status` transitioning `pending` → `consumed` (resumed) or `pending` → `archived` (cleared).

`/finalize` is a **plugin-with-agents orchestrator**: it does not call individual documentation skills directly. Instead, it dispatches each of the three documentation agents via the `Agent` tool — design-doc-agent for `.claude/design/`, context-doc-agent for `CLAUDE.md` files, user-docs for README/contributing/site docs — and lets each agent decide which of its own skills apply. Step 6 follows the same pattern by dispatching `changesets:changeset-manager` rather than invoking `/changesets:create` directly. The orchestrator passes the branch diff summary plus the running list of files modified by earlier agents so each subsequent agent has the full picture. See `plugin/skills/finalize/SKILL.md` for the per-step dispatch contract and prompt structure. The agent suite is what gives finalize its leverage: agents are first-class subagents with their own toolset and (via the matching `*-docs-style` or `changesets:style` skill) the right conventions in scope, so each layer is updated in isolation rather than in the orchestrator's shared context.

Finalize uses negative-form skip flags rather than positive-form mode flags: each step runs by default, and `--no-context-docs`, `--no-user-docs`, `--no-squash`, `--no-push`, `--no-pr`, and `--dry-run` selectively suppress steps. `--no-push` and `--no-pr` are distinct: `--no-push` skips step 8 entirely (work stays local), while `--no-pr` pushes the branch but skips PR creation. The orchestrator builds a `TaskCreate`-tracked task list before Step 1 and flips each task to `in_progress`/`completed` via `TaskUpdate` as steps run, so the user sees live progress and any failure leaves the failed task visibly mid-flight rather than silently marked done.

Squash (Step 7) is the recommended default, not just an option: this project squash-merges into the default branch and uses agent reviewers, so per-commit history is discarded at merge anyway and granular history actively misleads a commit-walking reviewer (false positives from already-fixed issues, ambiguity about which revision is current). `--no-squash` is the escape hatch for the rare case where granular commits must survive. The opt-in `--split-docs` flag is the one positive-form mode flag: it squashes into **two** commits instead of one — functional changes carrying a `review-focus: primary` trailer and ancillary docs/changeset changes carrying `review-focus: ancillary`. The split is purely a **review-time focus signal** for agent reviewers; both commits collapse into one at squash-merge, so it changes nothing about the merged history. Finalize only emits the trailer — recognizing it is the reviewer's job, out of scope here. Path classification (which staged files are ancillary) reads the design-doc, plan, context and user-doc path roots from `design.config.json`; everything else is functional. `--split-docs` is ignored under `--no-squash` (nothing is squashed, so there is nothing to split).

### Agents

Three agents orchestrate multi-skill workflows:

- `agents/design-doc-agent.md` -- Design docs and plans lifecycle
- `agents/context-doc-agent.md` -- CLAUDE.md context files
- `agents/user-docs.md` -- User-facing documentation generation (replaced `docs-gen-agent.md` in 0.3.x; covers user-docs-*and docs-* skills)

Agent frontmatter declares skills and tools and includes a `color` field for the agent badge in transcripts (red for design-doc-agent, pink for context-doc-agent, blue for user-docs). Agent frontmatter does not declare hooks: Claude Code drops `hooks`, `mcpServers`, and `permissionMode` from plugin agent frontmatter at load time, so the design-dir write auto-approval agents rely on comes solely from the plugin-level PreToolUse registration in `hooks/hooks.json` (which applies in subagent contexts too). All three agents declare `SendMessage` in `tools` so they can answer teammate protocol messages (e.g. `shutdown_request`) when running as coordinated subagents. Each agent also lists the matching `*-docs-style` skill (`design-docs-style`, `context-docs-style`, `user-docs-style`) so the path-based style rule auto-loads when the agent opens its respective doc type. The agent markdown body describes purpose, available skills, common workflows, and best practices.

Agents are dispatched in two ways: directly by the user (`@design-doc-agent please audit the design docs`) for ad-hoc multi-skill work, or as orchestrated subagents from the `/finalize` skill, which calls each agent in turn with a shared branch summary so the three documentation layers stay coherent without leaking each domain's intermediate state into the orchestrator context.

---

## Rationale

### Architectural Decisions

#### Decision 1: Sidecar Distribution Pattern

**Context:** Plugins need dev tooling (tests, linting, CI) during development but must ship only the runtime code to users.

**Options considered:**

1. **Sidecar with sparse clone (Chosen):**
   - Pros: Clean separation, no build step needed for distribution, `plugin/` is always in a deployable state
   - Cons: Requires discipline to keep `plugin/` self-contained
   - Why chosen: git-subdir sparse cloning is native to the marketplace distribution mechanism; the `plugin/` directory can be independently cloned without any parent workspace context

2. **Build and publish to npm:**
   - Pros: Familiar distribution model
   - Cons: Claude Code plugins use git-based distribution, not npm
   - Why rejected: Does not align with Claude Code plugin marketplace conventions

3. **Ship entire repo:**
   - Pros: Simple
   - Cons: Ships test files, dev configs, CI scripts to users
   - Why rejected: Violates the principle of minimal distribution

#### Decision 2: Pure Bash Hooks (Replacing Compiled Binary)

**Context:** The plugin originally used compiled Bun bytecode binaries via `claude-binary-plugin` for hook execution. This was replaced with pure bash scripts on the feat/hook-permissions branch.

**Options considered:**

1. **Pure bash scripts (Chosen):**
   - Pros: Zero dependencies, no build step, no platform-specific binaries, instant execution, trivially inspectable, no JIT compilation needed
   - Cons: Limited to what bash can do (no complex type validation)
   - Why chosen: Hook logic is simple (read env vars, output text/JSON). The complexity was in the build system, not the hook logic. Removing the binary eliminated `plugin.config.ts`, `src/schema.ts`, `tsconfig.json`, `turbo.json`, `setup-proxy.sh`, and the `claude-binary-plugin` dependency entirely.

2. **Compiled Bun bytecode binary (Previous approach, rejected):**
   - Pros: Fast cold start, single file distribution
   - Cons: Platform-specific, requires build step, JIT compilation on first run, heavy dependency chain, complex three-layer state management
   - Why rejected: The build infrastructure was disproportionate to the hook logic complexity. Bash scripts start faster than the binary's fast path.

#### Decision 3: Minimal Hook Footprint (0.3.x)

**Context:** The original three-hook reinforcement system (SessionStart, SubagentStart, Stop) added maintenance overhead and the Stop/git-safety hooks introduced `jq` as a runtime dependency. In 0.3.x those responsibilities were delegated externally.

**Options considered:**

1. **Two-hook minimal footprint (Current):**
   - SessionStart: full context injection (philosophy + skill listing)
   - PreToolUse: auto-approve design directory writes
   - SubagentStart, Stop, and git-safety hooks removed
   - Pros: Reduced surface area, no jq dependency for critical hooks, no hook loop guard needed, fewer tests to maintain
   - Why chosen: External tooling (commit plugin, session workflow) can handle subagent awareness and git safety more reliably

2. **Three-hook reinforcement (Previous, 0.2.x):**
   - Pros: Multiple touchpoints; self-contained plugin
   - Cons: jq dependency, loop guard complexity, six hooks to maintain
   - Why superseded: Maintenance cost exceeded benefit once external tools provided equivalent coverage

#### Decision 4: Skills as Directories with SKILL.md

**Context:** Skills need definitions, supporting docs, templates, and scripts.

**Options considered:**

1. **Directory-based with SKILL.md (Chosen):**
   - Pros: Self-contained, supports co-located supporting files (instructions.md, examples.md, templates/, scripts/)
   - Cons: More files to maintain
   - Why chosen: Complex skills like `design-init` need templates and detailed instructions; a single-file format cannot accommodate this

2. **Single markdown file per skill:**
   - Pros: Simple, easy to browse
   - Cons: Cannot co-locate templates, scripts, or extended documentation
   - Why rejected: Insufficient for skills that need supporting assets

### Design Patterns Used

#### Pattern 1: Convention-Based Registration

- **Where used:** Skills and agents registration in plugin.json
- **Why used:** Eliminates explicit registration code; adding a skill is just creating a directory with a SKILL.md
- **Implementation:** plugin.json lists paths to skill directories and agent files; Claude Code discovers them at load time

#### Pattern 2: Agent-Skill Composition

- **Where used:** Agents orchestrating multiple skills
- **Why used:** Allows multi-step workflows to share context (file reads, config data) without redundant I/O
- **Implementation:** Agent frontmatter declares `skills:` list; the agent markdown body describes orchestration strategies

#### Pattern 3: Kill Switch + First-Install Detection

- **Where used:** Both hooks (`session-start/context-inject.sh`, `pre-tool-use/allow-design-writes.sh`)
- **Why used:** Graceful degradation when the user has not initialized the design docs system, and a single env var to disable everything
- **Implementation:** Each hook checks `DESIGN_DOCS_CONTEXT_ENABLED` first (kill switch). The SessionStart hook auto-creates `.claude/design/` and emits an initialization message if it was missing; the PreToolUse hook simply exits 0 (deferring to normal permissions) when criteria are not met.

#### Pattern 4: Session Tag Convention

- **Where used:** `session-start/context-inject.sh`, finalize skill, merge-prep skill
- **Why used:** Tracks session boundaries on feature branches for squash-merge workflows. The tag provides a stable anchor point for squash operations.
- **Implementation:** `session/start` is a local-only git tag created at the merge-base of the feature branch with the default branch. Created by `session-start/context-inject.sh` if missing, moved by finalize after squash, deleted by merge-prep after final squash.

#### Pattern 5: Plugin-with-Agents Orchestration

- **Where used:** `/finalize` skill -> design-doc-agent, context-doc-agent, user-docs agent
- **Why used:** Long multi-domain workflows (update design docs, update CLAUDE.md, update user docs, then squash/PR) would either bloat one skill's context with three orthogonal skill suites or fragment into three separate user invocations that lose the shared branch summary between them. Dispatching domain agents from a thin orchestrator skill keeps each agent's context narrow (only its own skills and style rule in scope) while letting the orchestrator pass the branch summary and running file-modification list forward so each agent sees what the previous one did.
- **Implementation:** The orchestrator skill declares `Agent` in its `allowed-tools` and dispatches each agent in turn with a prompt that includes (a) the Step 2 branch diff summary, (b) the cumulative list of files modified by earlier agents, (c) a directive to update what needs updating using whichever of the agent's skills apply, and (d) an instruction to report back which files were modified. The orchestrator does not enumerate specific skills for the agent to run -- the agent decides.

#### Pattern 6: Shared Hook Lib via Relative Source

- **Where used:** Both hook scripts source `hooks/lib/hook-output.sh` and `hooks/lib/hook-debug.sh`
- **Why used:** Centralizes the response-envelope JSON shape and stderr logging so hooks never hand-roll JSON and so a future schema change touches one file. Keeps the hooks small enough to read end-to-end.
- **Implementation:** Each hook resolves the lib directory relative to its own location: `_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)"` then sources `hook-output.sh` and `hook-debug.sh`. Works regardless of where the plugin is installed because the relative path is stable inside the distributable.

### Constraints and Trade-offs

#### Constraint: Git-Based Distribution

- **Description:** Claude Code plugins are distributed via git sparse clone, not npm
- **Impact:** The `plugin/` directory must be independently functional without any parent workspace files
- **Mitigation:** Plugin has zero runtime dependencies. No `package.json`, no `node_modules`, no build artifacts needed.

#### Constraint: No Executable Bits

- **Description:** Git repos and distribution mechanisms may strip executable permission bits
- **Impact:** Hook scripts cannot rely on being executable
- **Mitigation:** All hooks are invoked via `bash ${CLAUDE_PLUGIN_ROOT}/hooks/<event-kebab>/<name>.sh` rather than direct execution

#### Constraint: Bash 3.2 Portability

- **Description:** macOS ships `/bin/bash` 3.2, so every shipped script must avoid bash-4-only constructs (`mapfile`, associative arrays, and similar)
- **Impact:** `plan-explore/scripts/explore-plans.sh` and the design-audit workflow scripts were rewritten to comply — plan metadata is stored in per-plan indirect variables instead of associative arrays. `explore-plans.sh` also guards its `jq` usage, falling back to the default `.claude/plans` path when `jq` is absent.
- **Mitigation:** A static test (`__test__/portability/bash32.test.ts`) rejects bash-4-only constructs across `plugin/**/*.sh`, so regressions fail CI

#### Trade-off: jq Dependency for Hook JSON

- **What we gained:** Reliable JSON parsing for PreToolUse stdin and jq-encoded response envelopes from `lib/hook-output.sh`
- **What we sacrificed:** Both hooks degrade when jq is missing -- the PreToolUse hook logs `hook_error "jq not found, deferring to normal permissions"` and exits 0, and the SessionStart hook logs the same and emits `{}` (no-op) rather than blocking the session
- **Why it is worth it:** jq is ubiquitous on developer machines; both hooks fail open (the session still starts, the permission flow still works) so a missing dependency degrades gracefully. The stop-reminder and git-safety hooks (which also required jq) were removed in 0.3.x.

---

## System Architecture

### Layered Architecture

#### Layer 1: Plugin Infrastructure

**Responsibilities:**

- Hook registration and dispatch
- Plugin identity and manifest
- Environment variable configuration

**Components:**

- `.claude-plugin/plugin.json` -- Plugin identity manifest (name, version, skills, agents)
- `hooks/hooks.json` -- Hook configuration (hand-written, declares two hooks)
- `CLAUDE.md` -- Plugin workspace context for contributors

**Communication:** Claude Code reads `hooks.json` to discover hooks and invokes them as bash commands. Claude Code reads `plugin.json` to discover skills and agents.

#### Layer 2: Hook Handlers (Bash)

**Responsibilities:**

- Session context injection and session tag management (SessionStart)
- Auto-approving design directory writes (PreToolUse)
- Feature flag evaluation (DESIGN_DOCS_CONTEXT_ENABLED)
- First-install detection (.claude/design/ existence)

**Components:**

- `hooks/session-start/context-inject.sh` -- SessionStart handler (outputs XML context via `emit_session_start`, manages session/start git tag on feature branches, persists `DESIGN_DOCS_*` env vars to `$CLAUDE_ENV_FILE`)
- `hooks/pre-tool-use/allow-design-writes.sh` -- PreToolUse handler (auto-approves design dir and CLAUDE.md writes via `emit_permission_allow`)
- `hooks/lib/hook-output.sh` -- canonical JSON emitters shared by both hooks
- `hooks/lib/hook-debug.sh` -- structured stderr logging shared by both hooks
- `hooks/lib/source-session-env.sh` -- helper for non-producer hooks to load the SessionStart env file into their subprocess

**Communication:** Hooks receive a JSON envelope on stdin (both SessionStart and PreToolUse get an envelope with `session_id`, `cwd`, `hook_event_name`, and event-specific fields). Hooks output structured JSON shaped per the Claude Code hook schema for the specific event:

- SessionStart: `hookSpecificOutput.additionalContext` carries the XML context block (emitted via `emit_session_start`).
- PreToolUse: `hookSpecificOutput.permissionDecision: "allow"` plus a reason string (emitted via `emit_permission_allow`).

Exit code 0 indicates success.

#### Layer 3: Skills

**Responsibilities:**

- Design documentation lifecycle (create, validate, update, sync, archive, prune)
- Implementation plan management (create, validate, list, explore, complete)
- CLAUDE.md context file maintenance (validate, audit, review, update, split)
- User documentation generation (README, contributing, security, repo, site)
- End-of-branch finalization (finalize)
- Session handoff between Claude Code sessions (handoff)

**Components:**

50 skill directories organized in 6 categories:

| Category | Count | Skills |
| --- | --- | --- |
| design-* | 18 | init, validate, update, sync, review, audit, search, compare, link, index, report, export, archive, prune, config, groom, split, docs-style |
| context-* | 6 | validate, audit, review, update, split, docs-style |
| docs-* | 7 | generate-contributing, generate-security, generate-repo, generate-site, review-package, sync, update |
| plan-* | 5 | create, validate, list, explore, complete |
| user-docs-* | 10 | add-page, badges, build-badges, build-toc, create-docs, create-readme, detect-shape, humanize, review, style |
| workflow | 4 | finalize, review, merge-prep, handoff |

**Communication:** Skills are invoked as `/design-docs:{skill-name}`. Each skill reads its SKILL.md frontmatter for tool permissions (`allowed-tools`) and agent assignment.

#### Layer 4: Agents

**Responsibilities:**

- Orchestrate multi-skill workflows
- Provide shared context across skill executions
- Reduce redundant file reads and config loading

**Components:**

- `agents/design-doc-agent.md` -- Design docs and plans lifecycle
- `agents/context-doc-agent.md` -- CLAUDE.md context files
- `agents/user-docs.md` -- User-facing documentation generation

**Communication:** Agent frontmatter declares skills and tools; the agent markdown body describes purpose, available skills, common workflows, and best practices.

### Component Interactions

#### Interaction 1: Session Startup

**Participants:** Claude Code, `session-start/context-inject.sh`

**Flow:**

1. User starts a Claude Code session (or resumes, compacts, or clears)
2. Claude Code reads `hooks.json`, finds SessionStart hook
3. Claude Code invokes `bash ${CLAUDE_PLUGIN_ROOT}/hooks/session-start/context-inject.sh` with the SessionStart envelope on stdin
4. Script sources `lib/hook-output.sh` and `lib/hook-debug.sh` from the relative `../lib/` path
5. Script checks `DESIGN_DOCS_CONTEXT_ENABLED` (kill switch)
6. Script parses the envelope, picks up `cwd` as a fallback for `CLAUDE_PROJECT_DIR`, writes `DESIGN_DOCS_*` env vars to `$CLAUDE_ENV_FILE`, and manages the `session/start` tag on feature branches
7. If `.claude/design/` is missing: creates it and emits an initialization message
8. If initialized: emits the full philosophy-first context with skill listings via `emit_session_start`

```text
Claude Code           session-start/context-inject.sh
    |                          |
    |-- SessionStart -------->-|
    |    (envelope on stdin)   |-- source ../lib/hook-output.sh
    |                          |-- source ../lib/hook-debug.sh
    |                          |-- check DESIGN_DOCS_CONTEXT_ENABLED
    |                          |-- parse envelope, derive PROJECT_DIR
    |                          |-- persist env to $CLAUDE_ENV_FILE
    |                          |-- manage session/start tag
    |                          |-- ensure .claude/design/ exists
    |                          |-- emit_session_start "$CONTEXT"
    |<-- additionalContext ----|
    |                          |
```

#### Interaction 2: Skill Invocation

**Participants:** User, Claude Code, SKILL.md, Agent (optional)

**Flow:**

1. User types `/design-docs:design-validate effect-type-registry`
2. Claude Code reads `skills/design-validate/SKILL.md`
3. SKILL.md frontmatter specifies `agent: design-doc-agent` and `context: fork`
4. Claude Code spawns the agent as a subagent with declared tools
5. Agent follows SKILL.md instructions to validate the module
6. Agent uses co-located supporting files (frontmatter-rules.md, error-messages.md) as needed

#### Interaction 3: Agent Multi-Skill Workflow

**Participants:** User, design-doc-agent, multiple skills

**Flow:**

1. User requests "audit all design documentation"
2. design-doc-agent reads the request and plans execution
3. Agent runs design-audit logic (health scores)
4. Agent runs design-validate logic (structural checks)
5. Agent runs design-report logic (summary)
6. All three share the same context (config loaded once, files read once)
7. Agent produces a unified report with prioritized recommendations

#### Interaction 4: Finalize Orchestrator -> Documentation Agents

**Participants:** User, `/finalize` skill, design-doc-agent, context-doc-agent, user-docs agent, GitHub

**Flow:**

1. User invokes `/design-docs:finalize` (or a model-routed trigger like "wrap up this branch")
2. Skill creates the 8-task `TaskCreate` checklist (omitting tasks for flags that disable a step)
3. Skill runs preflight (Step 1) and builds the branch summary (Step 2): `git diff $BASE..HEAD --stat` plus the commit list
4. Skill dispatches design-doc-agent (Step 3) via the `Agent` tool with the branch summary as prompt context; agent decides which design skills apply, returns a report of files modified
5. Skill dispatches context-doc-agent (Step 4) with the branch summary plus the design-doc-agent's report so CLAUDE.md updates can track new or renamed design docs; agent returns its report
6. Skill dispatches user-docs agent (Step 5) with the branch summary plus both previous agent reports so README/contributing/site updates have the full picture
7. Skill runs the changeset (Step 6), squash (Step 7), push/PR (Step 8) sequence in the orchestrator context
8. Between each step the skill flips the matching task to `completed` via `TaskUpdate` and reports a one-line status

Each agent dispatch carries the running file-modification list forward but no other intermediate state, so each agent operates in an isolated context with only its own skill suite, tool permissions, and matching `*-docs-style` rule loaded. This is the **plugin-with-agents** orchestration pattern: the orchestrator skill stays small and steers the workflow while the agents own each documentation domain.

### Error Handling Strategy

- **Hook errors:** Hooks exit with code 0 in all normal cases (including when disabled or not initialized). Errors in bash cause immediate exit via `set -euo pipefail`. If a hook fails, Claude Code continues without the injected context.
- **Kill switch:** Setting `DESIGN_DOCS_CONTEXT_ENABLED=false` causes all hooks to exit 0 immediately with no output.
- **Missing jq:** Both hooks degrade gracefully when jq is missing. The PreToolUse hook logs via `hook_error` and exits 0, deferring to normal permissions. The SessionStart hook logs via `hook_error` and emits `{}` (no-op) so the session still starts.
- **Debug logging:** Setting `DESIGN_DOCS_HOOK_DEBUG=1` enables `hook_debug` output to stderr. Setting `DESIGN_DOCS_HOOK_LOG=1` additionally appends every log line to `/tmp/design-docs-hook-errors.log` (overridable via `DESIGN_DOCS_HOOK_LOG_PATH`).
- **Skill errors:** Skills report errors via structured output (severity levels: ERROR, WARNING, INFO) with actionable fix recommendations.

---

## Data Flow

### Data Model

**Hook Configuration (hooks.json):**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start/context-inject.sh\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use/allow-design-writes.sh\"",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

**Design Config (design.config.json):**

```typescript
{
  version: string;
  project: { name, type, repository, maintainer };
  paths: { designDocs, plans, skills, context, localContext };
  modules: Record<string, {
    path, designDocsPath, categories, maintainer, userDocs
  }>;
  skills: { baseNamespace, enabled: string[] };
  quality: {
    designDocs: { requireFrontmatter, requireTOC, minSections };
    userDocs: { level1, level2, level3 };
    context: { rootMaxWords, childMaxWords, requireDesignDocPointers,
               requirePointerHashes, hardWrap };
    plans: { maxLineLength, requireFrontmatter, requiredFields, validStatuses,
             progressRange, stalenessThresholdDays, archiveAfterDays };
  };
  integration: { ci, git, plans };
  subagents: Record<string, { enabled, description, skills, tools, file }>;
}
```

`design-validate` derives its recommended-section warnings from `quality.designDocs.minSections`: when a `design.config.json` exists, an omitted or empty `minSections` means no recommended sections are required; the built-in `Overview` / `Current State` / `Rationale` default applies only when no config file exists at all. Heading matches are case-insensitive, so sentence-case headings satisfy title-case entries. The script also warns on hard-wrapped prose — one WARNING per offending paragraph, with line-level detail capped at 5 per file and a trailing summary reporting the true total whenever the cap is exceeded — enforcing the one-source-line-per-paragraph style (markdownlint MD013 stays disabled intentionally). The cap once truncated the count as well as the display, which made a document wrapped end to end indistinguishable from one with five bad lines and starved list-item wraps of any output at all; the detector's block-marker heuristic had always caught wrapped list continuations, but paragraph wraps earlier in a file exhausted the budget before they could print (issue #68). It discovers docs recursively under the module directory while pruning `_archive` trees, matching `design-link`: the earlier flat glob silently skipped every doc in a subdirectory, so a run that validated a third of a corpus was indistinguishable from a clean full run (issue #62). `plugin/skills/design-validate/scripts/validate.sh` is the single canonical validator (the earlier duplicate pair `validate-all-docs.sh` / `validate-design-doc.sh` was deleted); design-audit's three workflow scripts (`maintenance-workflow.sh`, `quality-workflow.sh`, `release-workflow.sh`) invoke it with the `all` argument rather than carrying their own copies. design-audit's four scripts and plan-explore's `explore-plans.sh` are documented in their own SKILL.md files.

**Silent-partial validation is the failure mode to design against.** Both #62 and a companion bug (a bare `grep` command substitution under `set -e` aborting the whole run on the first frontmatter-less doc) produced the same shape: the validator stopped covering the corpus without saying so. A validator that under-reports is worse than one that is merely wrong, because its clean exit is read as a guarantee. Any change to doc discovery or the per-file loop must preserve the invariant that every non-archived `.md` under the module dir is either validated or explicitly reported as skipped.

For context files the wrapping policy is configurable via `quality.context.hardWrap` (`"forbid"`, the default, or `"allow"`): `context-docs-style` consults it, and under `"allow"` it enforces per-file wrapping consistency instead of forbidding hard wraps outright — accommodating repos with an entrenched hard-wrap convention.

`design-link` is likewise backed by a deterministic script, `plugin/skills/design-link/scripts/link.sh`. It discovers module docs recursively — docs in module subdirectories such as `packages/*.md` are graph nodes — while pruning `_archive` trees, and its heading slugger matches GitHub's anchor algorithm by turning each space into a hyphen individually, preserving consecutive hyphens (e.g. "API Extractor × Effect class factories" → `api-extractor--effect-class-factories`). Its broken-reference check covers **every relative link in a doc body, not just links to other design docs** — links to source paths are extracted and existence-checked like any other, each occurrence reported separately with its line number. This matters because the design-doc style rule tells authors to point at source paths rather than re-document them, so a check that only understood doc-to-doc `.md` links left the most style-compliant docs the least verified (issue #63).

**Reference classification is a single awk pass (#65).** `link.sh` was once subprocess-bound — roughly 45s on a 22-doc corpus, forking a `grep` per reference for node membership, a subshell per `resolve_ref`, and re-parsing a doc's heading slugs for every anchor reference, for 1,600+ process spawns. Collection now only extracts raw reference records, and one `awk` invocation classifies the entire corpus: path resolution, node-set membership, and the heading-anchor pipeline all run inside the awk program, where associative arrays are available regardless of the bash 3.2 constraint on shipped scripts, and heading slugs are memoized per target file. A 22-doc synthetic corpus went from 29.6s to 2.0s with byte-identical output. The cost model now scales with corpus size rather than reference count, which removes the constraint that made design-link unfit for a hook or a per-commit gate, and correspondingly lowers the cost of the "hook-driven index/validate" directions inventoried in [system-model-vs-observed.md](./system-model-vs-observed.md).

The node list reaches awk as a file argument read via the `FNR==NR` idiom, never through `-v`. This is load-bearing for portability, not a stylistic choice: macOS ships the BWK "one true awk" as `/usr/bin/awk`, which rejects `-v name=value` when the value contains a literal newline, so passing the newline-delimited node list that way fails on a stock Mac while working under gawk and mawk. The failure is silent in effect — classification simply finds zero references — so any future awk work here must keep multi-line data out of `-v`.

**Design Doc Frontmatter:**

```yaml
status: stub | draft | current | needs-review | archived
module: string
category: architecture | performance | observability | testing | ...
created: YYYY-MM-DD
updated: YYYY-MM-DD
last-synced: never | YYYY-MM-DD
completeness: 0-100
related: string[]
dependencies: string[]   # OPTIONAL — every other field is required
```

`dependencies` is the sole optional field, and deliberately so. It was required until 0.9.x, which meant every doc not scaffolded from a plugin template — the common case in repos that adopted the system by hand — failed validation with an error the author could not act on and that never went away. A permanently-red validator does not get fixed; it gets ignored, and it takes the validator's genuine findings down with it. Templates still scaffold the field because declaring dependencies is worth doing, but a doc without one is not invalid. See `plugin/skills/design-validate/frontmatter-rules.md` for the field contract; that file, not this doc, is authoritative on per-field rules.

**SKILL.md Frontmatter:**

```yaml
name: string                    # kebab-case skill identifier
description: string             # human-readable description
allowed-tools: string           # comma-separated tool list; Bash grants are command-scoped, e.g. Bash(bash *), Bash(grep *)
context: fork                   # execution context mode (optional)
agent: string                   # agent that orchestrates this skill (optional)
disable-model-invocation: true  # prevent model from auto-invoking (optional)
when_to_use: string             # multi-line block: trigger phrases for model-invokable skills (optional)
model: string                   # routing hint, e.g. "sonnet" (optional)
argument-hint: string           # usage hint shown to users (optional)
```

**Agent Frontmatter:**

```yaml
name: string           # agent identifier
description: string    # when to use this agent
skills: string         # comma-separated skill list (includes the matching *-docs-style skill)
tools: string          # comma-separated tool list (includes SendMessage for teammate protocol replies)
color: string          # transcript badge color: red | pink | blue | ...
```

Agent frontmatter deliberately declares no `hooks`, `mcpServers`, or `permissionMode` fields — Claude Code drops all three from plugin agent frontmatter at load time. Auto-approval of design-directory and CLAUDE.md writes in subagent contexts comes from the plugin-level PreToolUse registration in `hooks/hooks.json`.

### Data Flow Diagrams

#### Flow 1: Hook System

```text
[Session Start]
  |
  v
[hooks/session-start/context-inject.sh]
  Source lib/hook-output.sh, lib/hook-debug.sh
  Check DESIGN_DOCS_CONTEXT_ENABLED env var
  Parse stdin envelope; derive PROJECT_DIR
  Persist DESIGN_DOCS_* env to $CLAUDE_ENV_FILE
  Ensure .claude/design/ exists
  Output: philosophy-first context + skill listing
  Manage session/start git tag on feature branches
  |
  v
[Claude Code Session Active]
  |
  +-- Write/Edit/MultiEdit to .claude/design/, .claude/plans/, or a CLAUDE.md
        |
        v
      [hooks/pre-tool-use/allow-design-writes.sh]
        Source lib/hook-output.sh, lib/hook-debug.sh
        Read tool_input.file_path from stdin
        Output: permissionDecision: "allow"
        (prevents repeated permission prompts)
```

#### Flow 2: Design Doc Lifecycle

```text
[/design-docs:design-init module topic]
        |
        v
[Read design.config.json]
  Get module config, categories, paths
        |
        v
[Select Template]
  architecture.template.md | performance.template.md | ...
        |
        v
[Populate Frontmatter]
  Set status=stub, dates, module, category
        |
        v
[Write .claude/design/{module}/{topic}.md]
        |
        v
[/design-docs:design-validate module]
  Validate frontmatter, structure, cross-refs
        |
        v
[/design-docs:design-update module doc]
  Update content, status, completeness
        |
        v
[/design-docs:design-sync module]
  Verify docs match code, update last-synced
        |
        v
[/design-docs:design-archive module doc]
  Set status=archived, add archival notice
```

#### Flow 3: Finalize Orchestration

```text
[/design-docs:finalize  (or model-routed trigger)]
        |
        v
[TaskCreate: build 8-task checklist (omit steps disabled by flags)]
        |
        v
[Step 1: Preflight]
  branch check, dirty tree, base branch, session/start tag, gh auth
        |
        v
[Step 2: Branch summary]
  git diff $BASE..HEAD --stat ; git log $BASE..HEAD --oneline
        |
        v
[Step 3: Agent dispatch -> design-doc-agent]
  prompt: branch summary
  returns: list of design docs modified (or "no changes")
        |
        v
[Step 4: Agent dispatch -> context-doc-agent]   (skipped by --no-context-docs)
  prompt: branch summary + Step 3 report
  returns: list of CLAUDE.md files modified
        |
        v
[Step 5: Agent dispatch -> user-docs agent]     (skipped by --no-user-docs)
  prompt: branch summary + Step 3 + Step 4 reports
  returns: list of user-facing docs modified
        |
        v
[Step 6: Changeset]   /changesets:create  OR  manual .changeset/*.md
        |
        v
[Step 7: Squash]      (skipped by --no-squash; --split-docs -> 2 commits w/ review-focus trailers)
  git reset --soft $(git merge-base HEAD $BASE) ; git commit ; tag -f session/start HEAD
        |
        v
[Step 8: Push and PR] (skipped entirely by --no-push; PR-only skipped by --no-pr)
  git push -u origin HEAD ; gh pr create
```

Between steps, `TaskUpdate` flips each task to `completed`. On failure the in-progress task stays in its current state — it is not flipped to `completed` — so the user can see exactly where the workflow stopped.

### State Management

- **Hook state** is stateless -- each hook invocation is independent. Hooks read environment variables and stdin, produce output, and exit. No state is persisted between hook invocations.
- **Configuration** is a single env var: `DESIGN_DOCS_CONTEXT_ENABLED`. There is no plugin.config.ts, no options schema, no three-layer state merge.
- **Design doc state** lives in YAML frontmatter within each markdown file. Status transitions follow: `stub` (0-20%) -> `draft` (21-90%) -> `current` (61-100%) -> `archived`. The draft and current bands overlap deliberately: a pre-implementation design can be fully fleshed out (high completeness) while its code is not yet written and stays `draft` — `current` asserts the doc reflects implemented code, not that the design is finished.
- **Plan state** lives in YAML frontmatter with explicit `status` and `progress` fields. Status-progress alignment is enforced: `ready`=0%, `completed`=100%.
- **Configuration state** lives in `.claude/design/design.config.json`, validated against the canonical JSON schema `design-docs.schema.json` at the repo root. The schema sits deliberately outside `plugin/` — it does not ship with the plugin — and is published for public raw access at `https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json`. The plan frontmatter schema lives beside it at repo-root `plan-frontmatter.schema.json`, published at the analogous raw URL. Context size limits are measured in words (`rootMaxWords` / `childMaxWords`), not lines.
- **Pointer baseline state** lives in `.claude/design/refs.json`, a committed manifest recording the body hash each CLAUDE.md `@` pointer was written against (see [Pointer Integrity](#pointer-integrity-content-drift-detection)).

---

## Pointer Integrity (Content-Drift Detection)

CLAUDE.md files point at design docs with `@` pointers (e.g. `@./.claude/design/design-docs-plugin/plugin-architecture.md`). A pointer can rot in two ways: the target file moves or is deleted (a broken link, already caught by context validation), or the target's *content* drifts so far from what the pointer's surrounding prose claims that the pointer is now misleading while still resolving. The second failure is invisible to a path-existence check. The pointer-integrity subsystem detects it.

### Topology

The subsystem has three parts. The hashing primitive `plugin/lib/ref-hash.sh` emits a deterministic body-only sha256 of a design doc — it strips a leading YAML frontmatter block before hashing, so routine `updated` / `last-synced` timestamp bumps do not move the hash and only real content edits do. The manifest `.claude/design/refs.json` (`{version, refs:[{source, target, hash, recordedAt}]}`) is committed and records, per pointer, the content hash the pointer was written against. The record side and the check side both shell out to `ref-hash.sh` so the two hashes are computed identically.

- **Record side:** the `context-update` skill and the `context-doc-agent` write or refresh a `refs.json` entry when they confirm a pointer — capturing the target's current body hash as the baseline. The recorder (`plugin/lib/refs-record.sh`) is idempotent on unchanged content: it preserves an entry's existing `recordedAt` when the same (source, target, hash) already exists and only stamps today's date when the target's body hash actually changed, so it is safe to run repeatedly as a verification step. It resolves the repo root via the standard `DESIGN_DOCS_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → git-toplevel → cwd chain (canonicalized with `pwd -P`) rather than bare `pwd`, so it works from any cwd inside the project.
- **Check side:** `context-validate` and `context-audit` recompute each pointer's target hash and compare it to the recorded baseline. A mismatch is a WARNING ("pointer may be stale (content drift)"); a pointer with no recorded entry is INFO by default, escalated to WARNING when `quality.context.requirePointerHashes` is `true`.

```text
[context-update / context-doc-agent]          [context-validate / context-audit]
  confirm a @ pointer                            walk every @ pointer
      |                                              |
      v                                              v
  ref-hash.sh <target>  ----record---->  refs.json  <----read----  recorded hash
      |                                                                  |
  write {source,target,hash,recordedAt}                          ref-hash.sh <target>
                                                                         |
                                                                  compare: drift? -> WARNING
```

### Load-bearing invariant

Both sides MUST call `ref-hash.sh` — never reimplement the body-stripping or hashing inline. Any divergence in how the hash is computed produces a permanent false-positive drift warning that no edit can clear. This is the one constraint a contributor touching either side must preserve; see the header comment in `plugin/lib/ref-hash.sh`.

### Lifecycle interaction with finalize

The drift baseline is refreshed as a side effect of normal documentation flow, not as a separate chore. When `/finalize` Step 3 dispatches the design-doc-agent and design doc bodies change, their hashes change too — which is expected and would otherwise show as drift. Step 4 then dispatches the context-doc-agent, which re-records `refs.json` for every pointer it confirms, so a finalize run that edits design docs leaves their pointers drift-clean. The ordering matters: design docs are edited before pointers are re-recorded.

---

## Integration Points

### Internal Integrations

#### Integration 1: Claude Code Plugin Runtime

**How it integrates:** The plugin registers via `plugin.json` manifest and `hooks.json` hook configuration. Claude Code discovers hooks, skills, and agents from these files.

**Interface:** `hooks.json` declares bash commands that Claude Code executes directly. Skills are discovered from the `skills` array in `plugin.json`. Agents from the `agents` array.

**Data exchange:** SessionStart hooks output plain text that becomes `claudeContext`. SubagentStart hooks output JSON with `hookSpecificOutput`. Stop hooks output plain text context. Skills receive user input via Claude Code's skill invocation system.

#### Integration 2: Changesets Version Management

**How it integrates:** `@savvy-web/changesets` manages version bumps. The `versionFiles` config ensures version is updated in both the root `package.json` and `plugin/.claude-plugin/plugin.json` simultaneously.

### External Integrations

#### Integration 1: Claude Code Marketplace

**Purpose:** Distribute the plugin to users

**Protocol:** Git sparse clone via `spencerbeggs/bot` marketplace repository

**Flow:**

1. Plugin `plugin/` directory is pushed to marketplace repo via git-subdir
2. Users install via Claude Code plugin marketplace commands
3. Plugin works immediately -- no build step, no JIT compilation, no dependency installation

#### Integration 2: GitHub (CI/CD)

**Purpose:** Automated testing, linting, and release

**Protocol:** GitHub Actions workflows

**Workflows:**

- `release.yml`: Changeset-based release pipeline
- Pre-commit hooks via Husky: lint-staged (Biome), commitlint (conventional commits)

---

## Testing Strategy

### Architecture Testing

The test suite validates the hook scripts by running them as subprocesses with controlled environments. Tests use `Bun.spawnSync` to execute bash scripts and assert on exit codes, stdout, and stderr.

**Component isolation:**

- Hook scripts are tested by spawning bash with controlled env vars and temp directories
- Tests create temporary directories with or without `.claude/design/` to test first-install detection
- Tests set `DESIGN_DOCS_CONTEXT_ENABLED` to test the kill switch
- Stop hook tests pipe JSON to stdin to test loop guard and keyword detection
- No integration tests with actual Claude Code runtime (would require E2E setup)

### Test Location and Structure

All tests live in `__test__/` at the repository root, mirroring the `plugin/` structure:

```text
__test__/
+-- hooks/
|   +-- session-start.test.ts       # Tests plugin/hooks/session-start/context-inject.sh
|   +-- allow-design-writes.test.ts # Tests plugin/hooks/pre-tool-use/allow-design-writes.sh
+-- portability/
|   +-- bash32.test.ts              # Static scan: rejects bash-4-only constructs in plugin/**/*.sh
```

Test file names track the hook concept (one test file per hook) rather than the on-disk path, but each `HOOK_PATH` constant points at the new event- subdirectory location under `plugin/hooks/<event-kebab>/`.

Tests live outside `plugin/` because `plugin/` ships to users. Tests must not be distributed. Tests for the removed hooks (subagent-start, stop-reminder, git-safety, git-safety-mcp) were deleted in 0.3.x alongside the hooks.

### Framework and Configuration

- **Test runner:** Bun test (`bun:test`)
- **Config:** `bunfig.toml`
- **Coverage thresholds:** 80% per file for lines, functions, and statements
- **Coverage reporters:** text (terminal) and lcov (CI integration)

### What Is Tested

**session-start/context-inject.sh tests** (`__test__/hooks/session-start.test.ts`):

- Enabled state: outputs context containing "Design Documentation System", agent names, "institutional memory"
- Disabled state: outputs nothing when `DESIGN_DOCS_CONTEXT_ENABLED=false`
- First-install: outputs initialization guidance when `.claude/design/` is missing
- Session tag management (4 tests): skips on default branch, creates tag at merge-base on feature branch, reports existing tag, creates at HEAD when branch is even with main
- All paths exit with code 0

**pre-tool-use/allow-design-writes.sh tests** (`__test__/hooks/allow-design-writes.test.ts`):

- Approves Write/Edit/MultiEdit operations targeting `.claude/design/` and `.claude/plans/`
- Approves writes to `CLAUDE.md` files at any depth, while rejecting files whose names merely end in `CLAUDE.md`
- Passes through operations targeting other paths
- Disabled state: outputs nothing when `DESIGN_DOCS_CONTEXT_ENABLED=false`

**Portability tests** (`__test__/portability/bash32.test.ts`):

- Static scan of every `plugin/**/*.sh` file rejecting bash-4-only constructs (`mapfile`, `declare -A`, and similar), keeping all shipped scripts runnable under macOS `/bin/bash` 3.2

---

## Future Enhancements

### Phase 1: Short-term

- Add slash commands for common operations (no commands exist yet; the `plugin/commands/` directory is prepared)
- ~~Consider adding PreToolUse/PostToolUse hooks~~ (implemented: `pre-tool-use/allow-design-writes.sh`)
- ~~Extract common hook patterns (kill switch, JSON emit, debug logging) into a shared bash library~~ (implemented: `hooks/lib/hook-output.sh`, `hooks/lib/hook-debug.sh`, `hooks/lib/source-session-env.sh`)

### Phase 2: Medium-term

- Add CI integration (validate design docs on PR, sync on merge) using the `integration.ci` config section
- Add Level 3 site documentation generation (RSPress framework support)
- Implement plan-design bidirectional linking validation in pre-commit hooks

### Phase 3: Long-term

- Multi-project design doc federation (cross-repo design doc references)
- Design doc versioning with semantic diffing
- Interactive design doc explorer (HTML export with navigation)

### Potential Refactoring

- Migrate hook tests from `Bun.spawnSync` to BATS (Bash Automated Testing System) so the test harness matches the implementation language
- Promote `lib/source-session-env.sh` to a standard preamble for any new non-producer hook (PostToolUse, UserPromptSubmit, etc.) so the `DESIGN_DOCS_*` env contract is uniform across the hook set

---

## Related Documentation

**Internal Design Docs:**

- [system-model-vs-observed.md](./system-model-vs-observed.md) -- five-repo field study of how the system behaves in practice; brainstorm input for the next iteration
- `.claude/design/design.config.json` -- System configuration
- `design-docs.schema.json` / `plan-frontmatter.schema.json` -- repo-root JSON schemas for the config and plan frontmatter, published via `raw.githubusercontent.com` (kept outside `plugin/`, so they do not ship)

**Context Files:**

- `CLAUDE.md` -- Root project context (build commands, architecture overview)
- `plugin/CLAUDE.md` -- Plugin workspace context (hook patterns, skill structure)

**Templates:**

- `plugin/skills/design-init/templates/architecture.template.md`
- `plugin/skills/design-init/templates/performance.template.md`
- `plugin/skills/design-init/templates/observability.template.md`
- `plugin/skills/design-init/templates/design-doc.template.md`

**External Resources:**

- [Claude Code Plugin Documentation](https://docs.anthropic.com/en/docs/claude-code)

---

**Document Status:** Current -- covers all major architectural components including the branch lifecycle workflow (session tag management, squash workflow skills, the `--split-docs` review-focus signal), the pointer-integrity content-drift subsystem (`plugin/lib/ref-hash.sh`, committed `refs.json` baseline, record/check split, finalize re-record interaction), the bidirectional session-handoff skill (`.claude/handoffs/` transient state, mode inference, design-doc-agent dispatch in write mode), the plugin-with-agents finalize orchestration pattern (agent dispatch instead of sub-skill invocation, `TaskCreate`-based task tracking, negative-form skip flags, model-invokable routing via `when_to_use`), the user-docs skill suite, the reduced two-hook footprint (0.3.x), and the event-subdirectory hook layout with shared `hooks/lib/` helpers (0.4.x). Missing coverage: detailed per-skill internal architecture, the autonomous `design-groom` / `design-split` grooming workflow, detailed command system design (no commands exist yet).

**Next Steps:** Add design docs for individual subsystems (skill framework internals, agent orchestration patterns) as complexity warrants separate documents.
