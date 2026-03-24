# design-docs

A Claude Code plugin for managing design documentation and implementation plans.

## Quick Reference

```bash
bun run build        # Build plugin binary (turbo orchestrated)
bun run test         # Run all tests (Bun test runner)
bun run typecheck    # Type-check all workspaces (turbo + tsgo)
bun run lint         # Biome lint check
```

* **Author**: C. Spencer Beggs ([spencer@beggs.codes](mailto:spencer@beggs.codes), [spencerbeg.gs](https://spencerbeg.gs))
* **Repository**: [spencerbeggs/design-docs-plugin](https://github.com/spencerbeggs/design-docs-plugin)
* **License**: MIT

## Architecture

This is a monorepo with a **sidecar distribution pattern**. The plugin is developed alongside dev tooling but distributed independently. Only the `plugin/` directory reaches end users via git-subdir sparse cloning. This ensures dev tooling never ships to users and the `plugin/` directory can be sparse-cloned independently.

* **Root workspace** -- Development infrastructure only (linting, commitlint, changesets, testing). Nothing ships.
* **`plugin/`** -- Everything that gets distributed. Contains source, hooks, skills, agents, and the compiled binary. See `plugin/CLAUDE.md` for implementation details (hook handler patterns, type imports, return shapes).
* **`__test__/`** -- All tests live at root level, NOT inside `plugin/`. Because `plugin/` ships to users and tests should not be distributed.
* **`docs/`** -- User-facing public documentation about the plugin.
* **`lib/`** -- Dev tooling configs (commitlint, lint-staged, markdownlint) and scripts. Not shipped.

## Project Structure

```text
design-docs-plugin/
├── __test__/                    # ALL tests (mirrors plugin/ structure)
│   ├── hooks/
│   │   └── context.hook.test.ts
│   ├── src/
│   │   └── schema.test.ts
│   ├── utils/
│   │   ├── fixtures.ts
│   │   ├── mocks.ts
│   │   └── test-types.ts
│   └── demo.test.ts
├── plugin/                      # DISTRIBUTABLE — everything here ships
│   ├── .claude-plugin/
│   │   └── plugin.json          # Plugin manifest (name, version, author)
│   ├── src/
│   │   └── schema.ts            # Options schema (Zod)
│   ├── hooks/
│   │   ├── hooks.json           # GENERATED — do not edit
│   │   └── context.hook.ts      # Hook handler
│   ├── commands/                # (no commands yet)
│   ├── skills/
│   │   ├── design-init/          # 15 design-* skills
│   │   ├── context-validate/     # 5 context-* skills
│   │   ├── docs-generate-readme/ # 9 docs-* skills
│   │   └── plan-create/          # 5 plan-* skills
│   ├── agents/
│   │   ├── design-doc-agent.md
│   │   ├── context-doc-agent.md
│   │   └── docs-gen-agent.md
│   ├── scripts/
│   │   └── setup-proxy.sh       # GENERATED — do not edit
│   ├── plugin.config.ts         # Central plugin definition
│   ├── CLAUDE.md
│   ├── package.json
│   ├── turbo.json
│   └── tsconfig.json
├── docs/                        # (empty — add yours here)
├── lib/
│   ├── configs/                 # commitlint, lint-staged, markdownlint
│   ├── scripts/
│   │   └── kill-otel.ts
│   └── turbo/
│       └── packages-with-tasks.gql
├── CLAUDE.md                    # This file
├── README.md
├── CONTRIBUTING.md
└── package.json                 # Root workspace (dev deps only)
```

## Build System

The build system uses `claude-binary-plugin` which compiles TypeScript into a single Bun bytecode binary (`.plugin` file).

### Three-Layer State Architecture

The plugin configuration (`plugin/plugin.config.ts`) uses three layers that merge into the `state` object available in every hook handler:

1. **Layer 1 (Base)** -- Built-in, provided automatically:
   * `projectDir`: The user's project root
   * `pluginDir`: The plugin's install directory
   * `pluginEnvFile`: Path to persisted state file

2. **Layer 2 (Options)** -- User-configurable via environment variables:
   * Defined in `plugin/src/schema.ts` using Zod
   * Each field becomes `<PREFIX>_<FIELD_NAME>` environment variable
   * Current prefix: `DESIGN_DOCS` (options: `CONTEXT_ENABLED`)

3. **Layer 3 (Computed)** -- Dynamic values from `setup()`:
   * Runs once at build/startup
   * Returns: `contextEnabled`
   * Used for feature flags and async init

### Build Pipeline

`bun run build` triggers turbo which runs:

* `types:check` -- TypeScript checking via tsgo
* `//#kill:otel` -- Cleans orphaned OTEL sidecar processes
* `validate` -- Runs `claude plugin validate .` on the plugin manifest
* `build` -- Compiles to bytecode binary via `claude-binary-plugin build`

Output: `plugin/design-docs.plugin` (gitignored)

### Turbo Task Graph

Root `turbo.json` defines global tasks (`//#kill:otel`, `types:check`). Plugin `turbo.json` extends root and adds `build` (depends on `types:check`, `//#kill:otel`, `validate`), `test` (no cache), and `validate` (no cache).

### Generated Files

**Do not edit these files.** They are regenerated by `claude-binary-plugin build`:

* `plugin/hooks/hooks.json` -- Hook manifest consumed by Claude Code
* `plugin/scripts/setup-proxy.sh` -- JIT build wrapper for first-run compilation

The `setup-proxy.sh` provides just-in-time compilation:

* **Fast path**: Binary exists + `node_modules` present -- execute directly
* **Slow path**: Buffer stdin -- acquire lock -- `bun install` -- build -- forward stdin
* **Error path**: Emit JSON error context + exit 2

## Commands and Scripts

| Command | Description |
| ------- | ----------- |
| `bun run build` | Build plugin binary (turbo orchestrated) |
| `bun run test` | Run all tests (Bun test runner) |
| `bun run typecheck` | Type-check all workspaces (turbo + tsgo) |
| `bun run validate` | Validate plugin manifest |
| `bun run lint` | Biome lint check |
| `bun run lint:fix` | Biome lint auto-fix |
| `bun run lint:md` | Markdown lint check |
| `bun run lint:md:fix` | Markdown lint auto-fix |

See `package.json` for the full script list (includes `lint:fix:unsafe`, `ci:build`, `ci:test`, `ci:version`).

This plugin has no slash commands currently. The `plugin/commands/` directory exists for future additions.

## Naming Conventions

* **Hooks**: `{name}.hook.ts` in `plugin/hooks/` -- e.g., `context.hook.ts`
* **Skills**: `plugin/skills/{name}/SKILL.md`
* **Agents**: `plugin/agents/{name}.md`
* **Shared source**: `plugin/src/{descriptive-name}.ts` -- NO barrel/index.ts files. Avoids circular imports and keeps the bytecode bundler's tree-shaking effective.
* **Tests**: Mirror plugin structure under `__test__/` -- e.g., `__test__/hooks/context.hook.test.ts`

## Hook Status Values

SessionStart hooks support these status values: `"executed"`, `"disabled"`, `"error"`, `"timeout"`. Action values: `"allow"`, `"deny"`, `"block"`, `"context"`, `"none"`. The `claudeContext` field is only available on `SessionStart` hooks.

## Testing

* **Framework**: Bun test runner (`bun:test`)
* **Config**: `bunfig.toml` (coverage thresholds: 80% lines/functions/statements)
* **Location**: All tests in `__test__/` directory, NOT inside `plugin/`
* **Run**: `bun run test` or `bun test`

## Linting and Formatting

* **Code**: Biome (config: `biome.jsonc`, extends `@savvy-web/lint-staged/biome/silk.jsonc`)
* **Markdown**: markdownlint-cli2 (config: `lib/configs/.markdownlint-cli2.jsonc`)
* **Commits**: Conventional commits enforced by `@savvy-web/commitlint`
* **Pre-commit**: Husky + lint-staged runs Biome on staged files

## TypeScript

* TypeScript 5.9+ with strict mode
* Type checker: `tsgo` (native Go-based, fast)
* Module: `Preserve` with bundler resolution
* Verbatim module syntax enabled (use `.js` extensions in imports)
* JSX: react-jsx (available if needed)

## Versioning and Releases

* Changesets (`@savvy-web/changesets`) manage versioning
* Version bumps update both `plugin/package.json` AND `plugin/.claude-plugin/plugin.json` (via `versionFiles` config)
* Release workflow: `.github/workflows/release.yml`
* Commit sign-off required (DCO)

## Git Conventions

* **Branch**: `main` (protected, squash-merge only)
* **Commits**: Conventional commits, DCO sign-off required
* **Hooks**: Husky manages pre-commit (lint-staged) and commit-msg (commitlint)

## Distribution

Plugins are distributed via sparse git cloning from a marketplace repository. Only the `plugin/` directory is cloned -- none of the dev infrastructure ships.

* **Marketplace repo**: `spencerbeggs/bot`
* **Distribution**: The `plugin/` subdirectory is published to the marketplace via git-subdir
* **Installation by users**: Via Claude Code plugin marketplace commands

## Dependencies

Root has dev-only deps (turbo, husky, linting). Plugin ships only `zod`; `claude-binary-plugin` is a devDep.

## Plugin Identity

Key locations with plugin-specific values:

| Value | Location(s) |
| ----- | ----------- |
| `C. Spencer Beggs` | `plugin/.claude-plugin/plugin.json` (author.name) |
| `spencer@beggs.codes` | `.claude/settings.local.json` (attribution), `SECURITY.md` |
| `https://spencerbeg.gs` | `plugin/.claude-plugin/plugin.json` (author.url) |
| `spencerbeggs` | `plugin/.claude-plugin/plugin.json` (repository), `.github/CODEOWNERS` |
| `spencerbeggs/design-docs-plugin` | `.changeset/config.json` (repo), `plugin/.claude-plugin/plugin.json` (homepage, repository) |
