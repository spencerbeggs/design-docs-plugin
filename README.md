# design-docs

A Claude Code plugin for managing design documentation, CLAUDE.md context files, implementation plans and user-facing documentation. Injects structured context into every Claude session and provides 47 skills and 3 specialized agents for working with design docs end-to-end.

## What's included

* **2 lifecycle hooks** -- SessionStart injects philosophy-first design doc context into each session and sets up branch session tags; PreToolUse auto-approves writes to `.claude/design/` and `.claude/plans/` so agents never get blocked mid-update. Both configurable via `DESIGN_DOCS_CONTEXT_ENABLED`.
* **47 skills across 6 categories** -- covering design doc creation, context file management, documentation generation, user-facing docs, implementation planning and branch finalization
* **3 specialized agents** -- for orchestrating complex multi-step documentation workflows

## Skill categories

### design-* (16 skills)

Skills for creating and managing design documents: initializing new design docs, updating existing ones, reviewing for completeness, extracting requirements and more.

### context-* (6 skills)

Skills for working with CLAUDE.md context files: validating structure, generating context from existing code, syncing context with project state and auditing coverage.

### docs-* (7 skills)

Skills for generating standalone documentation: CONTRIBUTING.md, SECURITY.md, repository documentation sites and ancillary repo docs. README generation lives in the `user-docs-*` category.

### user-docs-* (10 skills)

Skills for writing and maintaining polished user-facing docs: creating READMEs and docs/ folders, adding pages, normalizing badges, building tables of contents, humanizing prose and reviewing against the style guide.

### plan-* (5 skills)

Skills for creating and tracking implementation plans: breaking design docs into tasks, estimating effort, tracking progress and generating status reports.

### Branch finalization (3 skills)

End-of-branch workflow orchestration. `/design-docs:finalize` dispatches the three documentation agents to update design docs, CLAUDE.md files and user docs in turn, then creates a changeset, squashes commits, pushes and opens a PR. Trigger phrases like "finalize this branch", "wrap up" or "ship it" route to it automatically. Flags: `--no-pr`, `--no-squash`, `--no-context-docs`, `--no-user-docs`, `--dry-run`. `/design-docs:review` runs an iterative PR review cycle. `/design-docs:merge-prep` squashes all branch commits into a single clean commit for final merge. The review and merge-prep workflows are user-invocable only. All three support `--dry-run`.

## Agents

* **design-doc-agent** -- Orchestrates full design document creation workflows, from requirements gathering through final review
* **context-doc-agent** -- Manages CLAUDE.md context files across a project, ensuring accuracy and completeness
* **user-docs** -- Writes and refactors user-facing docs: READMEs, docs/ folders, badge normalization and prose humanization

## Install

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
