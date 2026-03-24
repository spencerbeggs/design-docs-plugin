# Plugin Workspace

This is the distributable plugin workspace. Everything in this directory ships to end users via git-subdir sparse cloning. Keep it minimal — no tests, no dev tooling, no unnecessary files.

## Plugin Configuration

The central file is `plugin.config.ts`. It defines:

* **prefix**: Environment variable namespace (currently `DESIGN_DOCS`)
* **options**: Zod schema imported from `./src/schema.ts` — user-configurable via env vars
* **setup()**: Async function that returns computed values
* **bytecode/persistLocal**: Build options for the binary compiler
* **hooks**: Event handlers mapped to `.hook.ts` files

## State Flow

The `state` object in hooks contains all three layers merged:

```text
Layer 1 (Base)     → projectDir, pluginDir, pluginEnvFile
Layer 2 (Options)  → CONTEXT_ENABLED (raw user config)
Layer 3 (Computed) → contextEnabled
```

Access in handlers: `({ state }) => { state.projectDir; state.contextEnabled; }`

Options are the raw user-facing config surface. The `setup()` function in `plugin.config.ts` transforms them into typed state. Hooks should operate on computed state fields, not raw options.

## Type System

The key type export from `plugin.config.ts`:

* **`Pipeline`**: Hook handler types. Use as `Pipeline["SessionStart"]`, `Pipeline["PreToolUse"]`, etc.

Import in handlers:

```typescript
import type { Pipeline } from "../plugin.config.js";
```

Note: Use `.js` extension in imports (`verbatimModuleSyntax` is enabled).

## Adding Hooks

1. Create `hooks/{name}.hook.ts` implementing the handler
1. The handler file MUST `export default handler`
1. Add the hook to `plugin.config.ts` under the appropriate event
1. Run `bun run build` — this regenerates `hooks/hooks.json` and `scripts/setup-proxy.sh`

Available hook events:

* **SessionStart**: Session init, context injection. Return `claudeContext` for markdown injection.
* **PreToolUse**: Before tool executes. Return `action: "allow"|"deny"|"block"` to control execution.
* **PostToolUse**: After tool executes. For validation and side effects.
* **Stop/SubagentStop**: Before Claude/subagent stops. For preflight checks.
* **Notification**: On notification events.

Hook return shape:

```typescript
{
  status: "executed" | "skipped" | "disabled",
  action: "allow" | "deny" | "block" | "context" | "none",
  summary: string,
  reason?: string,         // Required for deny/block
  claudeContext?: string,  // SessionStart only — markdown injected into session
}
```

## Adding Commands

This plugin currently has no slash commands. To add one:

1. Create `commands/{name}.md` with frontmatter (description, allowed-tools, argument-hint)
1. Create `commands/{name}.cmd.ts` with the handler — the file MUST `export default handler`
1. Register in `plugin.config.ts` under `commands`. Each command entry needs:
   * `description` (string): Brief summary of what the command does
   * `args` (Zod schema): Defines the command's accepted arguments
   * `pipeline` (path to `.cmd.ts`): Points to the handler file
1. Add the `.md` path to `.claude-plugin/plugin.json` commands array

Command namespacing via directories:

* `commands/lint.md` → `/plugin-name:lint`
* `commands/test/coverage.md` → `/plugin-name:test:coverage`

Command `.md` frontmatter:

```yaml
---
allowed-tools: Bash, Read, Edit
description: Brief description of what this command does
argument-hint: [optional-arg]
---
```

### Exit Code Conventions

Commands communicate status to the agent through exit codes:

| Exit Code | Meaning | Behavior |
| --- | --- | --- |
| 0 | Success | Output markdown is shown to the user or agent |
| 1 | Issues found | Output contains warnings for the agent to act on |
| 2 | Fatal error | Command could not execute; agent should report the failure |

## Adding Skills

1. Create `skills/{name}/SKILL.md` with the skill definition
1. Add the skill directory path to `.claude-plugin/plugin.json` skills array

## Adding Agents

1. Create `agents/{name}.md` with agent definition and frontmatter
1. Agent files define autonomous subagents with model, tools, and system prompt

## Shared Source Code

Place shared utilities in `src/` as specifically-named files (NOT barrel/index.ts files):

* `src/schema.ts` — Options schema (required)

Add additional specifically-named files to `src/` as needed for environment detection, output formatting, or other shared logic.

Import with `.js` extension: `import { foo } from "./src/bar.js";`

## Generated Files

Do NOT edit these — they are overwritten by `claude-binary-plugin build`:

* `hooks/hooks.json` — Hook manifest consumed by Claude Code
* `scripts/setup-proxy.sh` — JIT build wrapper
