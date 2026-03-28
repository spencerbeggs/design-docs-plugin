# design-docs

A Claude Code plugin for managing design documentation and implementation plans.

## Quick Reference

```bash
bun run test         # Run all tests (Bun test runner)
bun run typecheck    # Type-check with tsgo
bun run lint         # Biome lint check
bun run validate     # Validate plugin manifest
```

* **Author**: C. Spencer Beggs ([spencer@beggs.codes](mailto:spencer@beggs.codes), [spencerbeg.gs](https://spencerbeg.gs))
* **Repository**: [spencerbeggs/design-docs-plugin](https://github.com/spencerbeggs/design-docs-plugin)
* **License**: MIT

## Architecture

This repo has a **sidecar distribution pattern**. The plugin is developed alongside dev tooling but distributed independently. Only the `plugin/` directory reaches end users via git-subdir sparse cloning.

* **Root** -- Development infrastructure only (linting, commitlint, changesets, testing). Nothing ships.
* **`plugin/`** -- Everything that gets distributed. Contains hooks (pure bash), skills, agents. See `plugin/CLAUDE.md` for details.
* **`__test__/`** -- All tests live at root level, NOT inside `plugin/`.
* **`docs/`** -- User-facing public documentation about the plugin.
* **`lib/`** -- Dev tooling configs (commitlint, lint-staged, markdownlint). Not shipped.

## Project Structure

```text
design-docs-plugin/
├── __test__/                    # ALL tests (mirrors plugin/ structure)
├── plugin/                      # DISTRIBUTABLE — everything here ships
│   ├── .claude-plugin/
│   │   └── plugin.json          # Plugin manifest (name, version, author)
│   ├── hooks/
│   │   ├── hooks.json           # Hook configuration
│   │   └── session-start.sh     # SessionStart context injection (bash)
│   ├── commands/                # (no commands yet)
│   ├── skills/                  # 34 skills
│   │   ├── design-init/         # 15 design-* skills
│   │   ├── context-validate/    # 5 context-* skills
│   │   ├── docs-generate-readme/# 9 docs-* skills
│   │   └── plan-create/         # 5 plan-* skills
│   ├── agents/
│   │   ├── design-doc-agent.md
│   │   ├── context-doc-agent.md
│   │   └── docs-gen-agent.md
│   ├── CLAUDE.md
│   └── package.json
├── docs/
├── lib/
│   └── configs/                 # commitlint, lint-staged, markdownlint
├── CLAUDE.md                    # This file
├── README.md
├── CONTRIBUTING.md
└── package.json
```

## Commands and Scripts

| Command | Description |
| ------- | ----------- |
| `bun run test` | Run all tests (Bun test runner) |
| `bun run typecheck` | Type-check with tsgo |
| `bun run validate` | Validate plugin manifest |
| `bun run lint` | Biome lint check |
| `bun run lint:fix` | Biome lint auto-fix |
| `bun run lint:md` | Markdown lint check |
| `bun run lint:md:fix` | Markdown lint auto-fix |

## Naming Conventions

* **Hooks**: `{name}.sh` in `plugin/hooks/` -- invoked via `bash ${CLAUDE_PLUGIN_ROOT}/hooks/{name}.sh`
* **Skills**: `plugin/skills/{name}/SKILL.md`
* **Agents**: `plugin/agents/{name}.md`
* **Tests**: Mirror plugin structure under `__test__/`

## Configuration

The `session-start.sh` hook respects `DESIGN_DOCS_CONTEXT_ENABLED` environment variable. Set to `false` to disable context injection.

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

Plugins are distributed via sparse git cloning from a marketplace repository. Only the `plugin/` directory is cloned.

* **Marketplace repo**: `spencerbeggs/bot`
* **Distribution**: The `plugin/` subdirectory is published to the marketplace via git-subdir
* **Installation by users**: Via Claude Code plugin marketplace commands

## Dependencies

Root has dev-only deps (husky, linting, changesets). Plugin has no runtime dependencies.

## Plugin Identity

| Value | Location(s) |
| ----- | ----------- |
| `C. Spencer Beggs` | `plugin/.claude-plugin/plugin.json` (author.name) |
| `spencer@beggs.codes` | `.claude/settings.local.json` (attribution), `SECURITY.md` |
| `https://spencerbeg.gs` | `plugin/.claude-plugin/plugin.json` (author.url) |
| `spencerbeggs` | `plugin/.claude-plugin/plugin.json` (repository), `.github/CODEOWNERS` |
| `spencerbeggs/design-docs-plugin` | `.changeset/config.json` (repo), `plugin/.claude-plugin/plugin.json` (homepage, repository) |
