# design-docs

A Claude Code plugin for managing design documentation, CLAUDE.md context files, implementation plans, and user-facing documentation. Injects structured context into every Claude session and provides 35 skills and 3 specialized agents for working with design docs end-to-end.

## What's Included

* **3 lifecycle hooks** -- SessionStart injects philosophy-first design doc context into each session; SubagentStart reinforces design doc awareness in spawned subagents; Stop nudges you to update docs after implementation work. All configurable via `DESIGN_DOCS_CONTEXT_ENABLED`.
* **35 skills across 5 categories** -- covering design doc creation, context file management, documentation generation, implementation planning, and branch finalization
* **3 specialized agents** -- for orchestrating complex multi-step documentation workflows

## Skill Categories

### design-* (15 skills)

Skills for creating and managing design documents: initializing new design docs, updating existing ones, reviewing for completeness, extracting requirements, and more.

### context-* (5 skills)

Skills for working with CLAUDE.md context files: validating structure, generating context from existing code, syncing context with project state, and auditing coverage.

### docs-* (9 skills)

Skills for generating user-facing documentation: README generation, API docs, changelog management, and documentation site scaffolding.

### plan-* (5 skills)

Skills for creating and tracking implementation plans: breaking design docs into tasks, estimating effort, tracking progress, and generating status reports.

### finalize (1 skill)

End-of-branch workflow orchestration via `/design-docs:finalize`. Updates design docs, CLAUDE.md files, and user docs, then creates a changeset, commits, pushes, and opens a PR. Supports `--no-pr`, `--docs-only`, and `--dry-run` flags.

## Agents

* **design-doc-agent** -- Orchestrates full design document creation workflows, from requirements gathering through final review
* **context-doc-agent** -- Manages CLAUDE.md context files across a project, ensuring accuracy and completeness
* **docs-gen-agent** -- Drives end-to-end documentation generation from source code and design artifacts

## Installation

Install from the Claude Code plugin marketplace:

```bash
claude plugin marketplace add spencerbeggs/bot
claude plugin add spencerbeggs/design-docs
```

Or install locally for development:

```bash
claude plugin add ./plugin
```

## Configuration

| Environment Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `DESIGN_DOCS_CONTEXT_ENABLED` | `"true"` \| `"false"` | `"true"` | Enable/disable context injection at session start |

## Development

| Command | Description |
| --- | --- |
| `bun run test` | Run all tests (Bun test runner) |
| `bun run validate` | Validate plugin manifest (`claude plugin validate plugin`) |
| `bun run lint` | Biome lint check |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run lint:md` | Markdown lint check |
| `bun run lint:md:fix` | Auto-fix markdown lint issues |

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and release process.

## License

[MIT](LICENSE)
