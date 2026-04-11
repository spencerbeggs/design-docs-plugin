---
status: current
module: design-docs-plugin
category: architecture
created: 2026-03-24
updated: 2026-04-10
last-synced: 2026-04-10
completeness: 95
related: []
dependencies: []
---

# Design Docs Plugin - Architecture

Comprehensive architecture of the design-docs Claude Code plugin: a pure bash
and markdown documentation management system distributed via sidecar sparse
cloning.

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Rationale](#rationale)
4. [System Architecture](#system-architecture)
5. [Data Flow](#data-flow)
6. [Integration Points](#integration-points)
7. [Testing Strategy](#testing-strategy)
8. [Future Enhancements](#future-enhancements)
9. [Related Documentation](#related-documentation)

---

## Overview

The design-docs plugin provides design documentation management, implementation
plan tracking, CLAUDE.md context file maintenance, and user-facing documentation
generation to Claude Code users. It ships as pure bash hooks and markdown
skills/agents with no compiled binary, no TypeScript runtime, and no runtime
dependencies. The plugin has 37 skills organized across 3 specialized agents,
activated through six hooks: a SessionStart hook that injects context and manages
session tags, a SubagentStart hook for subagent awareness, a Stop hook for
post-implementation nudges, a PreToolUse hook for auto-approving design directory
writes, and two PreToolUse git safety hooks that protect the default branch from
destructive operations while auto-allowing them on feature branches.

The plugin follows a **sidecar distribution pattern**: it is developed inside a
monorepo with full dev tooling (linting, testing, CI), but only the `plugin/`
directory reaches end users via git-subdir sparse cloning from a marketplace
repository. This separation ensures dev infrastructure never ships.

**Key Design Principles:**

- Sidecar isolation: the `plugin/` directory is fully self-contained and
  independently distributable
- Pure bash hooks: no compiled binary, no TypeScript runtime, no build step --
  hooks are plain bash scripts invoked via `bash ${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`
- Convention over configuration: skills follow a strict directory structure
  (`skills/{name}/SKILL.md`) with optional supporting files
- Agents as orchestrators: agents coordinate multiple skills within a shared
  context, reducing redundant file reads and enabling multi-step workflows
- Hook reinforcement system: six hooks (SessionStart, SubagentStart, Stop,
  three PreToolUse) work together to ensure design docs stay current, auto-
  approve safe operations, and protect the default branch

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
+-- plugin/             # DISTRIBUTABLE -- everything here ships to users
|   +-- .claude-plugin/ # Plugin manifest (plugin.json)
|   +-- hooks/          # Bash hook scripts + hooks.json
|   +-- skills/         # 35 skill directories
|   +-- agents/         # 3 agent definitions
|   +-- commands/       # (no commands yet)
|   +-- CLAUDE.md
+-- __test__/           # ALL tests (mirrors plugin/ structure)
+-- docs/               # User-facing public documentation
+-- lib/                # Dev tooling configs and scripts
```

**Boundary rule:** Nothing outside `plugin/` ships to users. Tests live in
`__test__/` to keep the distributable clean. The plugin directory has no
`package.json`, no `tsconfig.json`, no build tooling -- it is purely markdown
and bash.

### Plugin Manifest

The plugin identity is declared in `plugin/.claude-plugin/plugin.json`:

- **name**: `design-docs`
- **version**: `0.2.0` (managed by changesets)
- **skills**: 37 skill directory paths
- **agents**: 3 agent markdown files
- **commands**: none currently

### Hook System

Hooks are pure bash scripts declared in `plugin/hooks/hooks.json` (hand-written,
not generated). Each hook entry uses the `command` type with
`bash ${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh` to avoid executable bit issues when
distributed from repos that strip them.

All hooks check the `DESIGN_DOCS_CONTEXT_ENABLED` environment variable. Setting
it to `"false"` disables all hook behavior (kill switch).

**session-start.sh (SessionStart, timeout 5s):**

Injects philosophy-first design documentation context into every Claude Code
session. Fires on all SessionStart sources (startup, resume, compact, clear).
Includes first-install detection: if `.claude/design/` does not exist, shows
initialization guidance instead of the full context. The context message explains
what design docs are, why they matter, when to update them, and lists all
available skills organized by category. On feature branches, manages the
`session/start` local git tag for session boundary tracking -- creates at
merge-base if missing, reports existing tag without moving it. Outputs branch
session context as XML within the design documentation system block.

**subagent-start.sh (SubagentStart, timeout 3s):**

Injects a condensed (<50 word) design docs awareness message into every spawned
subagent via JSON `additionalContext`. Tells subagents to flag architecture-
relevant changes to the parent agent. Consumes stdin (required by hook protocol)
and skips silently if the design docs system is not initialized.

**stop-reminder.sh (Stop, timeout 10s):**

Soft post-implementation nudge. Reads stdin JSON and checks `stop_hook_active`
as a loop guard (bails if true to prevent infinite loops). Scans
`last_assistant_message` for multi-word implementation keyword patterns (e.g.,
"created file", "refactored", "implemented", "added feature"). If implementation
signals are detected, outputs a plain text reminder suggesting design doc updates
and the `/design-docs:finalize` workflow. Does not block -- context-only.
Requires `jq` for JSON parsing.

**allow-design-writes.sh (PreToolUse, matcher: Write|Edit, timeout 3s):**

Auto-approves Write and Edit operations targeting `.claude/design/` and
`.claude/plans/` directories. Prevents repeated permission prompts when agents
update documentation. Reads stdin JSON, extracts `tool_input.file_path`, and
outputs a JSON `permissionDecision: "allow"` if the path matches. Requires `jq`.

**git-safety.sh (PreToolUse, matcher: Bash, timeout 5s):**

Git safety checks for Bash commands. Parses the command string from stdin JSON
and detects destructive git operations: force push, hard reset, soft reset,
rebase, and branch deletion. On the default branch, denies these operations. On
feature branches, auto-allows them to support squash-merge workflows. Always
blocks `gh repo delete`, branch protection modification via `gh api`, and
`gh pr merge --admin` regardless of branch. Uses `git rev-parse --abbrev-ref HEAD`
for current branch detection and `git symbolic-ref refs/remotes/origin/HEAD` with
`main` fallback for default branch detection. Requires `jq`.

**git-safety-mcp.sh (PreToolUse, matcher: mcp__gitkraken__git_push|git_branch|git_checkout, timeout 5s):**

Git safety checks for GitKraken MCP tools. Same branch-aware rules as
git-safety.sh but reads tool name and structured parameters from MCP tool input
format instead of parsing a command string. Handles `mcp__gitkraken__git_push`
(force flag), `mcp__gitkraken__git_branch` (delete action targeting default),
and `mcp__gitkraken__git_checkout` (force flag targeting default). Requires `jq`.

### Skills

37 skill directories organized in 5 categories:

| Category | Count | Skills |
| :------- | :---- | :----- |
| design-* | 15 | init, validate, update, sync, review, audit, search, compare, link, index, report, export, archive, prune, config |
| context-* | 5 | validate, audit, review, update, split |
| docs-* | 9 | generate-readme, generate-contributing, generate-security, generate-repo, generate-site, review, review-package, sync, update |
| plan-* | 5 | create, validate, list, explore, complete |
| workflow | 3 | finalize (end-of-branch orchestration with squash), review (PR feedback cycles), merge-prep (final squash before merge) |

Skill frontmatter uses `allowed-tools` (not `tools`) for declaring tool
permissions. Skills that need isolation use `context: fork` in frontmatter.
Skills are invoked as `/design-docs:{skill-name}`.

The three workflow skills form a branch lifecycle: `/finalize` squashes commits
and opens a PR, `/review` addresses PR feedback in small fix commits, and
`/merge-prep` does a final squash for merge. All three are user-invocable only
(`disable-model-invocation: true`).

### Agents

Three agents orchestrate multi-skill workflows:

- `agents/design-doc-agent.md` -- Design docs and plans lifecycle
- `agents/context-doc-agent.md` -- CLAUDE.md context files
- `agents/docs-gen-agent.md` -- User-facing documentation generation

Agent frontmatter declares skills and tools. All three agents include `hooks`
frontmatter with a PreToolUse entry for `allow-design-writes.sh` to auto-approve
Write/Edit operations to design directories in subagent contexts. The agent
markdown body describes purpose, available skills, common workflows, and best
practices.

---

## Rationale

### Architectural Decisions

#### Decision 1: Sidecar Distribution Pattern

**Context:** Plugins need dev tooling (tests, linting, CI) during development
but must ship only the runtime code to users.

**Options considered:**

1. **Sidecar with sparse clone (Chosen):**
   - Pros: Clean separation, no build step needed for distribution, `plugin/` is
     always in a deployable state
   - Cons: Requires discipline to keep `plugin/` self-contained
   - Why chosen: git-subdir sparse cloning is native to the marketplace
     distribution mechanism; the `plugin/` directory can be independently cloned
     without any parent workspace context

2. **Build and publish to npm:**
   - Pros: Familiar distribution model
   - Cons: Claude Code plugins use git-based distribution, not npm
   - Why rejected: Does not align with Claude Code plugin marketplace conventions

3. **Ship entire repo:**
   - Pros: Simple
   - Cons: Ships test files, dev configs, CI scripts to users
   - Why rejected: Violates the principle of minimal distribution

#### Decision 2: Pure Bash Hooks (Replacing Compiled Binary)

**Context:** The plugin originally used compiled Bun bytecode binaries via
`claude-binary-plugin` for hook execution. This was replaced with pure bash
scripts on the feat/hook-permissions branch.

**Options considered:**

1. **Pure bash scripts (Chosen):**
   - Pros: Zero dependencies, no build step, no platform-specific binaries,
     instant execution, trivially inspectable, no JIT compilation needed
   - Cons: Limited to what bash can do (no complex type validation)
   - Why chosen: Hook logic is simple (read env vars, output text/JSON). The
     complexity was in the build system, not the hook logic. Removing the binary
     eliminated `plugin.config.ts`, `src/schema.ts`, `tsconfig.json`,
     `turbo.json`, `setup-proxy.sh`, and the `claude-binary-plugin` dependency
     entirely.

2. **Compiled Bun bytecode binary (Previous approach, rejected):**
   - Pros: Fast cold start, single file distribution
   - Cons: Platform-specific, requires build step, JIT compilation on first run,
     heavy dependency chain, complex three-layer state management
   - Why rejected: The build infrastructure was disproportionate to the hook
     logic complexity. Bash scripts start faster than the binary's fast path.

#### Decision 3: Hook Reinforcement System

**Context:** Design docs only stay valuable if they are updated after
implementation work. A single SessionStart injection is insufficient.

**Options considered:**

1. **Three-hook reinforcement (Chosen):**
   - SessionStart: full context injection (philosophy + skill listing)
   - SubagentStart: condensed awareness for spawned subagents
   - Stop: soft post-implementation nudge with keyword detection
   - Pros: Multiple touchpoints catch different scenarios; non-blocking
   - Cons: Three hooks to maintain; Stop hook requires `jq`
   - Why chosen: Different moments need different interventions. SessionStart
     teaches, SubagentStart propagates, Stop reminds.

2. **SessionStart only:**
   - Pros: Simple, single hook
   - Cons: Subagents have no awareness; no post-implementation reminder
   - Why rejected: Context is lost in subagent forks and forgotten after long
     implementation sessions

#### Decision 4: Skills as Directories with SKILL.md

**Context:** Skills need definitions, supporting docs, templates, and scripts.

**Options considered:**

1. **Directory-based with SKILL.md (Chosen):**
   - Pros: Self-contained, supports co-located supporting files (instructions.md,
     examples.md, templates/, scripts/)
   - Cons: More files to maintain
   - Why chosen: Complex skills like `design-init` need templates and detailed
     instructions; a single-file format cannot accommodate this

2. **Single markdown file per skill:**
   - Pros: Simple, easy to browse
   - Cons: Cannot co-locate templates, scripts, or extended documentation
   - Why rejected: Insufficient for skills that need supporting assets

### Design Patterns Used

#### Pattern 1: Convention-Based Registration

- **Where used:** Skills and agents registration in plugin.json
- **Why used:** Eliminates explicit registration code; adding a skill is just
  creating a directory with a SKILL.md
- **Implementation:** plugin.json lists paths to skill directories and agent
  files; Claude Code discovers them at load time

#### Pattern 2: Agent-Skill Composition

- **Where used:** Agents orchestrating multiple skills
- **Why used:** Allows multi-step workflows to share context (file reads, config
  data) without redundant I/O
- **Implementation:** Agent frontmatter declares `skills:` list; the agent
  markdown body describes orchestration strategies

#### Pattern 3: Kill Switch + First-Install Detection

- **Where used:** All three hooks
- **Why used:** Graceful degradation when the user has not initialized the
  design docs system, and a single env var to disable everything
- **Implementation:** Each hook checks `DESIGN_DOCS_CONTEXT_ENABLED` first
  (kill switch), then checks for `.claude/design/` directory existence
  (first-install detection). Both conditions exit silently.

#### Pattern 4: Branch-Aware Git Safety

- **Where used:** `git-safety.sh` and `git-safety-mcp.sh` PreToolUse hooks
- **Why used:** Squash-merge workflows require destructive operations (force
  push, soft reset, rebase) on feature branches but never on the default branch
- **Implementation:** Hooks detect the current branch via
  `git rev-parse --abbrev-ref HEAD` and the default branch via
  `git symbolic-ref refs/remotes/origin/HEAD` with `main` fallback. On the
  default branch, destructive operations are denied. On feature branches, they
  are auto-allowed with a permissionDecision response. Certain operations
  (repo deletion, protection removal, admin merge) are always blocked.

#### Pattern 5: Session Tag Convention

- **Where used:** `session-start.sh`, finalize skill, merge-prep skill
- **Why used:** Tracks session boundaries on feature branches for squash-merge
  workflows. The tag provides a stable anchor point for squash operations.
- **Implementation:** `session/start` is a local-only git tag created at the
  merge-base of the feature branch with the default branch. Created by
  session-start.sh if missing, moved by finalize after squash, deleted by
  merge-prep after final squash.

#### Pattern 6: Loop Guard for Stop Hook

- **Where used:** `stop-reminder.sh`
- **Why used:** The Stop hook's nudge can cause Claude to continue working,
  which triggers another Stop event. Without a guard, this creates an infinite
  loop.
- **Implementation:** The hook reads `stop_hook_active` from stdin JSON. If it
  is true (or missing/null), the hook exits immediately. Only fires when
  `stop_hook_active` is explicitly false, meaning this is the first stop after
  actual user-initiated work.

### Constraints and Trade-offs

#### Constraint: Git-Based Distribution

- **Description:** Claude Code plugins are distributed via git sparse clone,
  not npm
- **Impact:** The `plugin/` directory must be independently functional without
  any parent workspace files
- **Mitigation:** Plugin has zero runtime dependencies. No `package.json`, no
  `node_modules`, no build artifacts needed.

#### Constraint: No Executable Bits

- **Description:** Git repos and distribution mechanisms may strip executable
  permission bits
- **Impact:** Hook scripts cannot rely on being executable
- **Mitigation:** All hooks are invoked via `bash ${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`
  rather than direct execution

#### Trade-off: jq Dependency for Stop Hook

- **What we gained:** Reliable JSON parsing for stdin (stop_hook_active,
  last_assistant_message extraction)
- **What we sacrificed:** Stop hook fails silently if jq is not installed
- **Why it is worth it:** jq is ubiquitous on developer machines; the stop hook
  is a soft nudge, not critical infrastructure

---

## System Architecture

### Layered Architecture

#### Layer 1: Plugin Infrastructure

**Responsibilities:**

- Hook registration and dispatch
- Plugin identity and manifest
- Environment variable configuration

**Components:**

- `.claude-plugin/plugin.json` -- Plugin identity manifest (name, version,
  skills, agents)
- `hooks/hooks.json` -- Hook configuration (hand-written, declares three hooks)
- `CLAUDE.md` -- Plugin workspace context for contributors

**Communication:** Claude Code reads `hooks.json` to discover hooks and invokes
them as bash commands. Claude Code reads `plugin.json` to discover skills and
agents.

#### Layer 2: Hook Handlers (Bash)

**Responsibilities:**

- Session context injection and session tag management (SessionStart)
- Subagent awareness propagation (SubagentStart)
- Post-implementation nudging (Stop)
- Auto-approving design directory writes (PreToolUse)
- Git safety: branch-aware permission decisions (PreToolUse)
- Feature flag evaluation (DESIGN_DOCS_CONTEXT_ENABLED)
- First-install detection (.claude/design/ existence)

**Components:**

- `hooks/session-start.sh` -- SessionStart handler (outputs markdown context,
  manages session/start git tag on feature branches)
- `hooks/subagent-start.sh` -- SubagentStart handler (outputs JSON
  additionalContext)
- `hooks/stop-reminder.sh` -- Stop handler (keyword detection + plain text
  nudge)
- `hooks/allow-design-writes.sh` -- PreToolUse handler (auto-approves design
  dir writes)
- `hooks/git-safety.sh` -- PreToolUse handler (branch-aware git safety for
  Bash commands)
- `hooks/git-safety-mcp.sh` -- PreToolUse handler (branch-aware git safety for
  GitKraken MCP tools)

**Communication:** Hooks receive JSON on stdin (SubagentStart, Stop, PreToolUse)
or nothing (SessionStart). Hooks output either plain text (becomes
`claudeContext`) or structured JSON (for `hookSpecificOutput` with
`permissionDecision`). Exit code 0 indicates success. PreToolUse hooks output
`permissionDecision: "allow"` or `"deny"` with a reason string.

#### Layer 3: Skills

**Responsibilities:**

- Design documentation lifecycle (create, validate, update, sync, archive,
  prune)
- Implementation plan management (create, validate, list, explore, complete)
- CLAUDE.md context file maintenance (validate, audit, review, update, split)
- User documentation generation (README, contributing, security, repo, site)
- End-of-branch finalization (finalize)

**Components:**

37 skill directories organized in 5 categories:

| Category | Count | Skills |
| :------- | :---- | :----- |
| design-* | 15 | init, validate, update, sync, review, audit, search, compare, link, index, report, export, archive, prune, config |
| context-* | 5 | validate, audit, review, update, split |
| docs-* | 9 | generate-readme, generate-contributing, generate-security, generate-repo, generate-site, review, review-package, sync, update |
| plan-* | 5 | create, validate, list, explore, complete |
| workflow | 3 | finalize, review, merge-prep |

**Communication:** Skills are invoked as `/design-docs:{skill-name}`. Each skill
reads its SKILL.md frontmatter for tool permissions (`allowed-tools`) and agent
assignment.

#### Layer 4: Agents

**Responsibilities:**

- Orchestrate multi-skill workflows
- Provide shared context across skill executions
- Reduce redundant file reads and config loading

**Components:**

- `agents/design-doc-agent.md` -- Design docs and plans lifecycle
- `agents/context-doc-agent.md` -- CLAUDE.md context files
- `agents/docs-gen-agent.md` -- User-facing documentation generation

**Communication:** Agent frontmatter declares skills and tools; the agent
markdown body describes purpose, available skills, common workflows, and best
practices.

### Component Interactions

#### Interaction 1: Session Startup

**Participants:** Claude Code, session-start.sh

**Flow:**

1. User starts a Claude Code session (or resumes, compacts, or clears)
2. Claude Code reads `hooks.json`, finds SessionStart hook
3. Claude Code invokes `bash ${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh`
4. Script checks `DESIGN_DOCS_CONTEXT_ENABLED` (kill switch)
5. Script checks for `.claude/design/` directory (first-install detection)
6. If not initialized: outputs initialization guidance, exits
7. If initialized: outputs full philosophy-first context with skill listings

```text
Claude Code          session-start.sh
    |                     |
    |-- SessionStart ---->|
    |                     |-- check env var
    |                     |-- check .claude/design/
    |                     |-- output context
    |<-- claudeContext ---|
    |                     |
```

#### Interaction 2: Subagent Spawning

**Participants:** Claude Code, subagent-start.sh

**Flow:**

1. Claude Code spawns a subagent
2. Claude Code reads `hooks.json`, finds SubagentStart hook
3. Claude Code invokes `bash ${CLAUDE_PLUGIN_ROOT}/hooks/subagent-start.sh`
4. Script checks kill switch and first-install detection
5. Script consumes stdin (required by hook protocol)
6. Script outputs JSON with `hookSpecificOutput.additionalContext`
7. Subagent receives the context as a system-level injection

#### Interaction 3: Post-Implementation Nudge

**Participants:** Claude Code, stop-reminder.sh

**Flow:**

1. Claude Code agent reaches a stop point
2. Claude Code reads `hooks.json`, finds Stop hook
3. Claude Code invokes `bash ${CLAUDE_PLUGIN_ROOT}/hooks/stop-reminder.sh`
4. Script reads stdin JSON, extracts `stop_hook_active` and
   `last_assistant_message`
5. If `stop_hook_active` is not false: exits (loop guard)
6. If no implementation keywords detected: exits silently
7. If implementation keywords found: outputs soft nudge mentioning design docs
   and `/design-docs:finalize`

#### Interaction 4: Skill Invocation

**Participants:** User, Claude Code, SKILL.md, Agent (optional)

**Flow:**

1. User types `/design-docs:design-validate effect-type-registry`
2. Claude Code reads `skills/design-validate/SKILL.md`
3. SKILL.md frontmatter specifies `agent: design-doc-agent` and `context: fork`
4. Claude Code spawns the agent as a subagent with declared tools
5. Agent follows SKILL.md instructions to validate the module
6. Agent uses co-located supporting files (frontmatter-rules.md,
   error-messages.md) as needed

#### Interaction 5: Agent Multi-Skill Workflow

**Participants:** User, design-doc-agent, multiple skills

**Flow:**

1. User requests "audit all design documentation"
2. design-doc-agent reads the request and plans execution
3. Agent runs design-audit logic (health scores)
4. Agent runs design-validate logic (structural checks)
5. Agent runs design-report logic (summary)
6. All three share the same context (config loaded once, files read once)
7. Agent produces a unified report with prioritized recommendations

### Error Handling Strategy

- **Hook errors:** Hooks exit with code 0 in all normal cases (including when
  disabled or not initialized). Errors in bash cause immediate exit via
  `set -euo pipefail`. If a hook fails, Claude Code continues without the
  injected context.
- **Kill switch:** Setting `DESIGN_DOCS_CONTEXT_ENABLED=false` causes all hooks
  to exit 0 immediately with no output.
- **Missing jq:** The stop-reminder.sh hook requires jq for JSON parsing. If jq
  is not installed, the `set -euo pipefail` will cause the script to exit on the
  first jq call, and the nudge is silently skipped.
- **Skill errors:** Skills report errors via structured output (severity levels:
  ERROR, WARNING, INFO) with actionable fix recommendations.

---

## Data Flow

### Data Model

**Hook Configuration (hooks.json):**

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "bash ...", "timeout": 5 }] }],
    "PreToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "bash .../allow-design-writes.sh", "timeout": 3 }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash .../git-safety.sh", "timeout": 5 }] },
      { "matcher": "mcp__gitkraken__git_push|...", "hooks": [{ "type": "command", "command": "bash .../git-safety-mcp.sh", "timeout": 5 }] }
    ],
    "SubagentStart": [{ "hooks": [{ "type": "command", "command": "bash ...", "timeout": 3 }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "bash ...", "timeout": 10 }] }]
  }
}
```

**SubagentStart Hook Output (JSON):**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "This project uses design docs..."
  }
}
```

**Stop Hook Input (JSON on stdin):**

```json
{
  "stop_hook_active": false,
  "last_assistant_message": "I created the file and implemented..."
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
    designDocs: { maxLineLength, requireFrontmatter, requireTOC, minSections };
    userDocs: { level1, level2, level3 };
    context: { rootMaxLines, childMaxLines, requireDesignDocPointers };
    plans: { maxLineLength, requireFrontmatter, requiredFields, validStatuses,
             progressRange, stalenessThresholdDays, archiveAfterDays };
  };
  integration: { ci, git, plans };
  subagents: Record<string, { enabled, description, skills, tools, file }>;
}
```

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
dependencies: string[]
```

**SKILL.md Frontmatter:**

```yaml
name: string                    # kebab-case skill identifier
description: string             # human-readable description
allowed-tools: string           # comma-separated tool list (Read, Write, Glob, etc.)
context: fork                   # execution context mode (optional)
agent: string                   # agent that orchestrates this skill (optional)
disable-model-invocation: true  # prevent model from auto-invoking (optional)
argument-hint: string           # usage hint shown to users (optional)
```

**Agent Frontmatter:**

```yaml
name: string           # agent identifier
description: string    # when to use this agent
skills: string         # comma-separated skill list
tools: string          # comma-separated tool list
```

### Data Flow Diagrams

#### Flow 1: Hook Reinforcement System

```text
[Session Start]
  |
  v
[session-start.sh]
  Check DESIGN_DOCS_CONTEXT_ENABLED env var
  Check .claude/design/ exists
  Output: philosophy-first context + skill listing
  |
  v
[Claude Code Session Active]
  |
  +-- spawns subagent --> [subagent-start.sh]
  |                         Output: JSON additionalContext (<50 words)
  |                         Subagent knows to flag design-doc-relevant changes
  |
  +-- agent stops --> [stop-reminder.sh]
                        Read stdin JSON (stop_hook_active, last_assistant_message)
                        Loop guard check
                        Keyword pattern scanning
                        Output: soft nudge if implementation detected
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

### State Management

- **Hook state** is stateless -- each hook invocation is independent. Hooks read
  environment variables and stdin, produce output, and exit. No state is
  persisted between hook invocations.
- **Configuration** is a single env var: `DESIGN_DOCS_CONTEXT_ENABLED`. There is
  no plugin.config.ts, no options schema, no three-layer state merge.
- **Design doc state** lives in YAML frontmatter within each markdown file.
  Status transitions follow: `stub` (0-20%) -> `draft` (21-60%) -> `current`
  (61-100%) -> `archived`.
- **Plan state** lives in YAML frontmatter with explicit `status` and `progress`
  fields. Status-progress alignment is enforced: `ready`=0%, `completed`=100%.
- **Configuration state** lives in `.claude/design/design.config.json`, validated
  against a JSON schema at
  `plugin/skills/design-config/json-schemas/current.json`.

---

## Integration Points

### Internal Integrations

#### Integration 1: Claude Code Plugin Runtime

**How it integrates:** The plugin registers via `plugin.json` manifest and
`hooks.json` hook configuration. Claude Code discovers hooks, skills, and agents
from these files.

**Interface:** `hooks.json` declares bash commands that Claude Code executes
directly. Skills are discovered from the `skills` array in `plugin.json`. Agents
from the `agents` array.

**Data exchange:** SessionStart hooks output plain text that becomes
`claudeContext`. SubagentStart hooks output JSON with `hookSpecificOutput`. Stop
hooks output plain text context. Skills receive user input via Claude Code's
skill invocation system.

#### Integration 2: Changesets Version Management

**How it integrates:** `@savvy-web/changesets` manages version bumps. The
`versionFiles` config ensures version is updated in both the root
`package.json` and `plugin/.claude-plugin/plugin.json` simultaneously.

### External Integrations

#### Integration 1: Claude Code Marketplace

**Purpose:** Distribute the plugin to users

**Protocol:** Git sparse clone via `spencerbeggs/bot` marketplace repository

**Flow:**

1. Plugin `plugin/` directory is pushed to marketplace repo via git-subdir
2. Users install via Claude Code plugin marketplace commands
3. Plugin works immediately -- no build step, no JIT compilation, no dependency
   installation

#### Integration 2: GitHub (CI/CD)

**Purpose:** Automated testing, linting, and release

**Protocol:** GitHub Actions workflows

**Workflows:**

- `release.yml`: Changeset-based release pipeline
- Pre-commit hooks via Husky: lint-staged (Biome), commitlint (conventional
  commits)

---

## Testing Strategy

### Architecture Testing

The test suite validates the hook scripts by running them as subprocesses with
controlled environments. Tests use `Bun.spawnSync` to execute bash scripts and
assert on exit codes, stdout, and stderr.

**Component isolation:**

- Hook scripts are tested by spawning bash with controlled env vars and temp
  directories
- Tests create temporary directories with or without `.claude/design/` to test
  first-install detection
- Tests set `DESIGN_DOCS_CONTEXT_ENABLED` to test the kill switch
- Stop hook tests pipe JSON to stdin to test loop guard and keyword detection
- No integration tests with actual Claude Code runtime (would require E2E setup)

### Test Location and Structure

All tests live in `__test__/` at the repository root, mirroring the `plugin/`
structure:

```text
__test__/
+-- hooks/
|   +-- session-start.test.ts     # Tests for SessionStart hook + session tags
|   +-- subagent-start.test.ts    # Tests for SubagentStart hook
|   +-- stop-reminder.test.ts     # Tests for Stop hook
|   +-- allow-design-writes.test.ts # Tests for PreToolUse auto-approve
|   +-- git-safety.test.ts        # Tests for git safety Bash hook (18 tests)
|   +-- git-safety-mcp.test.ts    # Tests for git safety MCP hook (5 tests)
```

Tests live outside `plugin/` because `plugin/` ships to users. Tests must not be
distributed.

### Framework and Configuration

- **Test runner:** Bun test (`bun:test`)
- **Config:** `bunfig.toml`
- **Coverage thresholds:** 80% per file for lines, functions, and statements
- **Coverage reporters:** text (terminal) and lcov (CI integration)

### What Is Tested

**session-start.sh tests:**

- Enabled state: outputs context containing "Design Documentation System",
  agent names, "institutional memory"
- Disabled state: outputs nothing when `DESIGN_DOCS_CONTEXT_ENABLED=false`
- First-install: outputs initialization guidance when `.claude/design/` is
  missing
- Session tag management (4 tests): skips on default branch, creates tag at
  merge-base on feature branch, reports existing tag, creates at HEAD when
  branch is even with main
- All paths exit with code 0

**git-safety.sh tests (18 tests):**

- Default branch (6 tests): blocks force push (--force, -f, --force-with-lease),
  hard reset, rebase, branch deletion
- Feature branch (5 tests): auto-allows force push, soft reset, hard reset,
  rebase, force-with-lease
- Always blocked (3 tests): gh repo delete, gh api branch protection, gh pr
  merge --admin
- Non-git commands (3 tests): skips non-git, safe git commands, git log
- Kill switch (1 test): exits silently when disabled

**git-safety-mcp.sh tests (5 tests):**

- Default branch: blocks force push via MCP, blocks branch delete targeting
  default
- Feature branch: auto-allows force push via MCP
- Non-matching: skips unrelated MCP tools
- Kill switch: exits silently when disabled

**subagent-start.sh tests:**

- Outputs JSON with `hookSpecificOutput` containing `additionalContext`
- Disabled state: outputs nothing
- Not initialized: outputs nothing
- Consumes stdin without hanging

**stop-reminder.sh tests:**

- Loop guard: exits silently when `stop_hook_active` is true or missing
- Keyword detection: outputs nudge when implementation keywords are found
- No keywords: exits silently when no implementation signals detected
- Disabled state: outputs nothing
- Not initialized: outputs nothing

---

## Future Enhancements

### Phase 1: Short-term

- Add slash commands for common operations (no commands exist yet; the
  `plugin/commands/` directory is prepared)
- Improve stop-reminder.sh keyword patterns based on real-world usage data
- ~~Consider adding PreToolUse/PostToolUse hooks~~ (implemented: allow-design-writes.sh,
  git-safety.sh, git-safety-mcp.sh)

### Phase 2: Medium-term

- Add CI integration (validate design docs on PR, sync on merge) using the
  `integration.ci` config section
- Add Level 3 site documentation generation (RSPress framework support)
- Implement plan-design bidirectional linking validation in pre-commit hooks
- Explore replacing jq dependency in stop-reminder.sh with pure bash JSON
  parsing for the simple fields used

### Phase 3: Long-term

- Multi-project design doc federation (cross-repo design doc references)
- Design doc versioning with semantic diffing
- Interactive design doc explorer (HTML export with navigation)
- Escalation path for stop hook: graduate from soft nudge to stronger
  intervention based on configurable policy

### Potential Refactoring

- Extract common hook patterns (kill switch, first-install detection) into a
  shared bash library sourced by each hook
- Consider adding a `hooks/lib/` directory for shared bash functions as the
  hook count grows

---

## Related Documentation

**Internal Design Docs:**

- `.claude/design/design.config.json` -- System configuration

**Context Files:**

- `CLAUDE.md` -- Root project context (build commands, architecture overview)
- `plugin/CLAUDE.md` -- Plugin workspace context (hook patterns, skill
  structure)

**Templates:**

- `plugin/skills/design-init/templates/architecture.template.md`
- `plugin/skills/design-init/templates/performance.template.md`
- `plugin/skills/design-init/templates/observability.template.md`
- `plugin/skills/design-init/templates/design-doc.template.md`

**External Resources:**

- [Claude Code Plugin Documentation](https://docs.anthropic.com/en/docs/claude-code)

---

**Document Status:** Current -- covers all major architectural components
including the branch lifecycle workflow (git safety hooks, session tag management,
squash workflow skills). Missing coverage: detailed per-skill internal
architecture, detailed command system design (no commands exist yet).

**Next Steps:** Add design docs for individual subsystems (skill framework
internals, agent orchestration patterns) as complexity warrants separate
documents.
