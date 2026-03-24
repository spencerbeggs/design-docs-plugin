---
status: current
module: design-docs-plugin
category: architecture
created: 2026-03-24
updated: 2026-03-24
last-synced: 2026-03-24
completeness: 85
related: []
dependencies: []
---

# Design Docs Plugin - Architecture

Comprehensive architecture of the design-docs Claude Code plugin: a self-contained
documentation management system distributed as a compiled Bun bytecode binary via
sidecar sparse cloning.

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

The design-docs plugin provides design documentation management, implementation plan
tracking, CLAUDE.md context file maintenance, and user-facing documentation generation
to Claude Code users. It ships as a single compiled binary with 34 skills organized
across 3 specialized agents, activated through a SessionStart hook that injects context
into every Claude Code session.

The plugin follows a **sidecar distribution pattern**: it is developed inside a monorepo
with full dev tooling (linting, testing, CI), but only the `plugin/` directory reaches
end users via git-subdir sparse cloning from a marketplace repository. This separation
ensures dev infrastructure never ships.

**Key Design Principles:**

- Sidecar isolation: the `plugin/` directory is fully self-contained and independently
  distributable
- Three-layer state: Base (runtime paths), Options (user config via env vars), and
  Computed (derived values from `setup()`) merge into a single typed `state` object
- Convention over configuration: skills follow a strict directory structure
  (`skills/{name}/SKILL.md`) with optional supporting files
- Agents as orchestrators: agents coordinate multiple skills within a shared context,
  reducing redundant file reads and enabling multi-step workflows

**When to reference this document:**

- When modifying the plugin configuration system or adding new hooks
- When adding, removing, or restructuring skills or agents
- When changing the build pipeline or distribution mechanism
- When debugging state flow through hooks
- When onboarding contributors to the plugin architecture

---

## Current State

### Repository Structure

The monorepo has four top-level areas with distinct responsibilities:

```text
design-docs-plugin/
+-- plugin/             # DISTRIBUTABLE -- everything here ships to users
|   +-- .claude-plugin/ # Plugin manifest (plugin.json)
|   +-- src/            # Shared source (schema.ts)
|   +-- hooks/          # Hook handlers + generated hooks.json
|   +-- skills/         # 34 skill directories
|   +-- agents/         # 3 agent definitions
|   +-- scripts/        # Generated setup-proxy.sh
|   +-- plugin.config.ts
|   +-- package.json
|   +-- turbo.json
|   +-- tsconfig.json
|   +-- CLAUDE.md
+-- __test__/           # ALL tests (mirrors plugin/ structure)
+-- docs/               # User-facing public documentation
+-- lib/                # Dev tooling configs and scripts
```

**Boundary rule:** Nothing outside `plugin/` ships to users. Tests live in `__test__/`
to keep the distributable clean.

### Plugin Manifest

The plugin identity is declared in `plugin/.claude-plugin/plugin.json`:

- **name**: `design-docs`
- **version**: `0.0.0` (managed by changesets)
- **skills**: 34 skill directory paths
- **agents**: 3 agent markdown files
- **commands**: none currently

### Plugin Configuration

`plugin/plugin.config.ts` is the central definition file. It uses
`ClaudeBinaryPlugin.create()` from `claude-binary-plugin` to declare:

```typescript
const plugin = ClaudeBinaryPlugin.create({
  prefix: "DESIGN_DOCS",
  options: optionsSchema,
  setup: async (ctx: SetupContext<PluginOptions>) => {
    const { options } = ctx;
    const contextEnabled = options.CONTEXT_ENABLED;
    return { contextEnabled };
  },
  bytecode: true,
  persistLocal: true,
  hooks: {
    SessionStart: [{
      name: "context",
      description: "Injects design documentation system context into the session",
      pipeline: "./hooks/context.hook.ts",
    }],
  },
  commands: {},
});

export type Pipeline = InferPluginPipeline<typeof plugin>;
```

The exported `Pipeline` type provides strongly-typed handler signatures for each hook
event (e.g., `Pipeline["SessionStart"]`).

### Options Schema

Defined in `plugin/src/schema.ts` using Zod:

```typescript
export const optionsSchema = z.object({
  CONTEXT_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
});
```

Each field maps to an environment variable with the plugin prefix:
`DESIGN_DOCS_CONTEXT_ENABLED`. The string-to-boolean transform handles the fact that
environment variables are always strings.

### Three-Layer State Architecture

The `state` object available in every hook handler merges three layers:

**Layer 1 -- Base (automatic):**

- `projectDir`: The user's project root directory
- `pluginDir`: The plugin's installation directory
- `pluginEnvFile`: Path to persisted state file

**Layer 2 -- Options (user-configurable):**

- Raw values from the Zod schema, read from `DESIGN_DOCS_*` environment variables
- Currently: `CONTEXT_ENABLED` (string, defaults to `"true"`)

**Layer 3 -- Computed (from `setup()`):**

- Dynamic values returned by the async `setup()` function
- Currently: `contextEnabled` (boolean, transformed from the string option)
- Runs once at startup; used for feature flags and async initialization

Hooks should operate on Layer 3 computed state, not raw Layer 2 options. This
separation keeps the user-facing config surface (env vars) decoupled from the internal
typed API.

---

## Rationale

### Architectural Decisions

#### Decision 1: Sidecar Distribution Pattern

**Context:** Plugins need dev tooling (tests, linting, CI) during development but
must ship only the runtime code to users.

**Options considered:**

1. **Sidecar with sparse clone (Chosen):**
   - Pros: Clean separation, no build step needed for distribution, `plugin/` is
     always in a deployable state
   - Cons: Requires discipline to keep `plugin/` self-contained
   - Why chosen: git-subdir sparse cloning is native to the marketplace distribution
     mechanism; the `plugin/` directory can be independently cloned without any parent
     workspace context

2. **Build and publish to npm:**
   - Pros: Familiar distribution model
   - Cons: Claude Code plugins use git-based distribution, not npm
   - Why rejected: Does not align with Claude Code plugin marketplace conventions

3. **Ship entire repo:**
   - Pros: Simple
   - Cons: Ships test files, dev configs, CI scripts to users
   - Why rejected: Violates the principle of minimal distribution

#### Decision 2: Compiled Bytecode Binary

**Context:** Hook handlers are TypeScript files that need to execute quickly when
Claude Code triggers them.

**Options considered:**

1. **Bun bytecode binary (Chosen):**
   - Pros: Fast cold start, single file distribution, no runtime transpilation
   - Cons: Platform-specific binary, requires `claude-binary-plugin` build step
   - Why chosen: Sub-second execution is critical for SessionStart hooks that run on
     every session

2. **Raw TypeScript with tsx/ts-node:**
   - Pros: No build step, easy debugging
   - Cons: Slow cold start from transpilation
   - Why rejected: SessionStart latency is user-facing

#### Decision 3: Three-Layer State

**Context:** Hooks need access to runtime paths, user configuration, and derived
values.

**Options considered:**

1. **Three-layer merge (Chosen):**
   - Pros: Clean separation of concerns, typed state, user config decoupled from
     internal API
   - Cons: Indirection between raw options and computed state
   - Why chosen: Allows the `setup()` function to perform async initialization and
     type transformations while keeping the user-facing config surface simple (env vars)

2. **Flat config object:**
   - Pros: Simple
   - Cons: No separation between runtime, user, and derived values; no type
     transformation layer
   - Why rejected: Would conflate different concerns

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
- **Implementation:** plugin.json lists paths to skill directories and agent files;
  Claude Code discovers them at load time

#### Pattern 2: Agent-Skill Composition

- **Where used:** Agents orchestrating multiple skills
- **Why used:** Allows multi-step workflows to share context (file reads, config
  data) without redundant I/O
- **Implementation:** Agent frontmatter declares `skills:` list; the agent markdown
  body describes orchestration strategies

#### Pattern 3: JIT Compilation via Setup Proxy

- **Where used:** `scripts/setup-proxy.sh`
- **Why used:** First-run experience must work without requiring users to manually
  build
- **Implementation:** Shell script with three paths: fast (binary exists), slow
  (buffer stdin, acquire lock, install deps, build, forward), error (emit JSON
  context, exit 2)

### Constraints and Trade-offs

#### Constraint: Git-Based Distribution

- **Description:** Claude Code plugins are distributed via git sparse clone, not npm
- **Impact:** The `plugin/` directory must be independently functional without any
  parent workspace files
- **Mitigation:** All runtime dependencies (just `zod`) are in `plugin/package.json`;
  build tooling stays in root `package.json`

#### Trade-off: Binary vs Source Distribution

- **What we gained:** Fast cold start, single-file deployment
- **What we sacrificed:** Users cannot easily inspect or modify hook code
- **Why it is worth it:** Plugin hooks are infrastructure code, not user-customizable;
  the skill/agent markdown files remain human-readable and editable

---

## System Architecture

### Layered Architecture

#### Layer 1: Plugin Infrastructure

**Responsibilities:**

- Binary compilation and distribution
- Hook registration and dispatch
- State management (three-layer merge)
- JIT compilation on first run

**Components:**

- `plugin.config.ts` -- Central plugin definition
- `src/schema.ts` -- Options validation schema
- `scripts/setup-proxy.sh` -- JIT build wrapper (generated)
- `hooks/hooks.json` -- Hook manifest (generated)
- `.claude-plugin/plugin.json` -- Plugin identity manifest

**Communication:** Claude Code reads `hooks.json` to discover hooks; `setup-proxy.sh`
wraps binary execution with build-if-needed logic.

#### Layer 2: Hook Handlers

**Responsibilities:**

- Session context injection
- Feature flag evaluation
- Response formatting per Claude Code protocol

**Components:**

- `hooks/context.hook.ts` -- SessionStart handler

**Communication:** Receives `{ input, options, state }` from the plugin runtime;
returns structured response with `status`, `action`, `summary`, and optionally
`claudeContext` (markdown injected into the session).

#### Layer 3: Skills

**Responsibilities:**

- Design documentation lifecycle (create, validate, update, sync, archive, prune)
- Implementation plan management (create, validate, list, explore, complete)
- CLAUDE.md context file maintenance (validate, audit, review, update, split)
- User documentation generation (README, contributing, security, repo, site)

**Components:**

34 skill directories organized in 4 categories:

| Category | Count | Skills |
| :------- | :---- | :----- |
| design-* | 15 | init, validate, update, sync, review, audit, search, compare, link, index, report, export, archive, prune, config |
| context-* | 5 | validate, audit, review, update, split |
| docs-* | 9 | generate-readme, generate-contributing, generate-security, generate-repo, generate-site, review, review-package, sync, update |
| plan-* | 5 | create, validate, list, explore, complete |

**Communication:** Skills are invoked as `/design-docs:{skill-name}`. Each skill reads
its SKILL.md frontmatter for tool permissions and agent assignment.

#### Layer 4: Agents

**Responsibilities:**

- Orchestrate multi-skill workflows
- Provide shared context across skill executions
- Reduce redundant file reads and config loading

**Components:**

- `agents/design-doc-agent.md` -- Design docs and plans lifecycle
- `agents/context-doc-agent.md` -- CLAUDE.md context files
- `agents/docs-gen-agent.md` -- User-facing documentation generation

**Communication:** Agent frontmatter declares skills and tools; the agent markdown
body describes purpose, available skills, common workflows, and best practices.

### Component Interactions

#### Interaction 1: Session Startup

**Participants:** Claude Code, setup-proxy.sh, binary, context.hook.ts

**Flow:**

1. User starts a Claude Code session
2. Claude Code reads `hooks.json`, finds SessionStart hook
3. Claude Code invokes `setup-proxy.sh --hook=SessionStart/context`
4. setup-proxy.sh checks for binary, runs fast path if present
5. Binary executes `context.hook.ts` handler with merged state
6. Handler checks `state.contextEnabled`
7. If enabled: returns `claudeContext` markdown listing all skills and agents
8. If disabled: returns `status: "disabled"` with summary

```text
Claude Code          setup-proxy.sh       Binary          context.hook.ts
    |                     |                  |                   |
    |-- SessionStart ---->|                  |                   |
    |                     |-- binary? ------>|                   |
    |                     |                  |-- handler() ----->|
    |                     |                  |                   |-- check state
    |                     |                  |<-- response ------|
    |                     |<-- stdout -------|                   |
    |<-- claudeContext ---|                  |                   |
    |                     |                  |                   |
```

#### Interaction 2: Skill Invocation

**Participants:** User, Claude Code, SKILL.md, Agent (optional)

**Flow:**

1. User types `/design-docs:design-validate effect-type-registry`
2. Claude Code reads `skills/design-validate/SKILL.md`
3. SKILL.md frontmatter specifies `agent: design-doc-agent` and `context: fork`
4. Claude Code spawns the agent as a subagent with declared tools
5. Agent follows SKILL.md instructions to validate the module
6. Agent uses co-located supporting files (frontmatter-rules.md, error-messages.md)
   as needed

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

### Error Handling Strategy

- **Hook errors:** setup-proxy.sh catches failures and emits JSON with
  `additionalContext` explaining the build error, then exits with code 2. Claude Code
  displays the context to the user.
- **Skill errors:** Skills report errors via structured output (severity levels:
  ERROR, WARNING, INFO) with actionable fix recommendations.
- **State errors:** If `DESIGN_DOCS_CONTEXT_ENABLED` is set to `"false"`, the hook
  returns `status: "disabled"` gracefully rather than erroring.

---

## Data Flow

### Data Model

**Plugin Configuration (plugin.config.ts):**

```typescript
{
  prefix: string;                    // "DESIGN_DOCS"
  options: ZodSchema;                // optionsSchema from schema.ts
  setup: (ctx) => ComputedState;     // async setup function
  bytecode: boolean;                 // true -- compile to binary
  persistLocal: boolean;             // true -- persist env file
  hooks: Record<HookEvent, HookDef[]>;
  commands: Record<string, CommandDef>;
}
```

**Hook Handler State:**

```typescript
{
  // Layer 1 - Base
  projectDir: string;
  pluginDir: string;
  pluginEnvFile: string;
  // Layer 2 - Options
  CONTEXT_ENABLED: string;
  // Layer 3 - Computed
  contextEnabled: boolean;
}
```

**Hook Response:**

```typescript
{
  status: "executed" | "disabled" | "error" | "timeout";
  action?: "allow" | "deny" | "block" | "context" | "none";
  summary: string;
  reason?: string;
  claudeContext?: string;  // SessionStart only
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
name: string           # kebab-case skill identifier
description: string    # human-readable description
tools: string          # comma-separated tool list (Read, Write, Glob, etc.)
context: fork          # execution context mode
agent: string          # agent that orchestrates this skill
```

**Agent Frontmatter:**

```yaml
name: string           # agent identifier
description: string    # when to use this agent
skills: string         # comma-separated skill list
tools: string          # comma-separated tool list
```

### Data Flow Diagrams

#### Flow 1: Plugin Startup and Context Injection

```text
[Environment Variables]
  DESIGN_DOCS_CONTEXT_ENABLED=true
        |
        v
[Options Schema (Zod)]
  Validates + transforms string to boolean
        |
        v
[setup() Function]
  Returns { contextEnabled: true }
        |
        v
[State Merge]
  Layer 1 (base) + Layer 2 (options) + Layer 3 (computed)
        |
        v
[context.hook.ts Handler]
  Checks state.contextEnabled
        |
        v
[Claude Code Session]
  Receives claudeContext markdown with skill/agent listing
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

- **Plugin state** lives in the three-layer merge, computed once at startup. The
  `persistLocal: true` flag enables an env file for cross-session state.
- **Design doc state** lives in YAML frontmatter within each markdown file. Status
  transitions follow: `stub` (0-20%) -> `draft` (21-60%) -> `current` (61-100%) ->
  `archived`.
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
`hooks.json` generated manifest. Claude Code discovers hooks, skills, and agents
from these files.

**Interface:** `hooks.json` declares commands that Claude Code executes via
`setup-proxy.sh`. Skills are discovered from the `skills` array in `plugin.json`.
Agents from the `agents` array.

**Data exchange:** Hook handlers receive JSON input on stdin and return JSON on
stdout. Skills receive user input via Claude Code's skill invocation system.

#### Integration 2: Turbo Build Orchestration

**How it integrates:** Root `turbo.json` defines global tasks (`//#kill:otel`,
`types:check`). Plugin `turbo.json` extends root and adds `build`, `test`, and
`validate` tasks with dependency chains.

**Task dependency graph:**

```text
types:check ----+
                |
//#kill:otel ---+--> build --> *.plugin
                |
validate -------+
```

- `types:check`: Runs `tsgo` for TypeScript type checking
- `//#kill:otel`: Cleans orphaned OpenTelemetry sidecar processes
- `validate`: Runs `claude plugin validate .` on the manifest
- `build`: Compiles to `design-docs.plugin` via `claude-binary-plugin build`

#### Integration 3: Changesets Version Management

**How it integrates:** `@savvy-web/changesets` manages version bumps. The
`versionFiles` config ensures version is updated in both `plugin/package.json` and
`plugin/.claude-plugin/plugin.json` simultaneously.

### External Integrations

#### Integration 1: Claude Code Marketplace

**Purpose:** Distribute the plugin to users

**Protocol:** Git sparse clone via `spencerbeggs/bot` marketplace repository

**Flow:**

1. Plugin `plugin/` directory is pushed to marketplace repo via git-subdir
2. Users install via Claude Code plugin marketplace commands
3. On first run, `setup-proxy.sh` performs JIT compilation
4. Binary is cached for subsequent sessions

#### Integration 2: GitHub (CI/CD)

**Purpose:** Automated testing, linting, and release

**Protocol:** GitHub Actions workflows

**Workflows:**

- `release.yml`: Changeset-based release pipeline
- Pre-commit hooks via Husky: lint-staged (Biome), commitlint (conventional commits)

---

## Testing Strategy

### Architecture Testing

The test suite validates the plugin infrastructure layer: schema validation, hook
handler behavior, and state management.

**Component isolation:**

- Hook handlers are tested by mocking the state object
- Schema validation is tested with valid and invalid inputs
- No integration tests with actual Claude Code runtime (would require E2E setup)

### Test Location and Structure

All tests live in `__test__/` at the repository root, mirroring the `plugin/`
structure:

```text
__test__/
+-- hooks/
|   +-- context.hook.test.ts    # Tests for SessionStart context hook
+-- src/
|   +-- schema.test.ts          # Tests for options schema validation
+-- utils/
|   +-- fixtures.ts             # Shared test fixtures
|   +-- mocks.ts                # Shared mocks
|   +-- test-types.ts           # Test-specific type utilities
+-- demo.test.ts                # Demo/smoke tests
```

Tests live outside `plugin/` because `plugin/` ships to users. Tests must not be
distributed.

### Framework and Configuration

- **Test runner:** Bun test (`bun:test`)
- **Config:** `bunfig.toml`
- **Coverage thresholds:** 80% per file for lines, functions, and statements
- **Coverage exclusions:** `plugin/plugin.config.ts` (setup() runs at build time,
  not in unit tests)
- **Coverage reporters:** text (terminal) and lcov (CI integration)

### What Is Tested

**Schema tests (`schema.test.ts`):**

- Default value behavior (`CONTEXT_ENABLED` defaults to `"true"`)
- String-to-boolean transformation (`"false"` -> `false`, `"true"` -> `true`)
- Edge cases (empty string, undefined)

**Hook tests (`context.hook.test.ts`):**

- Enabled state: returns `status: "executed"`, `action: "context"`, `claudeContext`
  contains skill listings
- Disabled state: returns `status: "disabled"`, no `claudeContext`
- Context content: verifies all 34 skills and 3 agents are listed

---

## Future Enhancements

### Phase 1: Short-term

- Add slash commands for common operations (no commands exist yet; the
  `plugin/commands/` directory is prepared)
- Add PreToolUse/PostToolUse hooks for design doc validation before writes

### Phase 2: Medium-term

- Add CI integration (validate design docs on PR, sync on merge) using the
  `integration.ci` config section
- Add Level 3 site documentation generation (RSPress framework support)
- Implement plan-design bidirectional linking validation in pre-commit hooks

### Phase 3: Long-term

- Multi-project design doc federation (cross-repo design doc references)
- Design doc versioning with semantic diffing
- Interactive design doc explorer (HTML export with navigation)

### Potential Refactoring

- Extract common skill patterns (config loading, frontmatter parsing) into shared
  utilities in `plugin/src/` as the skill count grows
- Consider splitting the 34 skills into sub-packages if the binary size becomes
  a concern (currently compiled as a single binary)

---

## Related Documentation

**Internal Design Docs:**

- `.claude/design/design.config.json` -- System configuration

**Context Files:**

- `CLAUDE.md` -- Root project context (build commands, architecture overview)
- `plugin/CLAUDE.md` -- Plugin workspace context (hook patterns, type system)

**Templates:**

- `plugin/skills/design-init/templates/architecture.template.md`
- `plugin/skills/design-init/templates/performance.template.md`
- `plugin/skills/design-init/templates/observability.template.md`
- `plugin/skills/design-init/templates/design-doc.template.md`

**External Resources:**

- [Claude Code Plugin Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [claude-binary-plugin](https://github.com/anthropics/claude-binary-plugin)

---

**Document Status:** Current -- covers all major architectural components as
implemented. Missing coverage: detailed command system design (no commands exist yet),
detailed per-skill internal architecture.

**Next Steps:** Add design docs for individual subsystems (skill framework internals,
agent orchestration patterns) as complexity warrants separate documents.
