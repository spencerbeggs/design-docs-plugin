# Contributing

Thank you for your interest in contributing to claude-plugin-template.

## Prerequisites

* [Bun](https://bun.sh) >= 1.3.9
* [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI (for plugin validation)
* Git

## Getting Started

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-plugin-template.git
   cd claude-plugin-template
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Verify the setup:

   ```bash
   bun run build
   bun run test
   bun run typecheck
   ```

## Development Workflow

### Branch Strategy

* `main` is protected -- no direct pushes
* Create feature branches for all changes: `git checkout -b feature/my-change`
* All merges use squash-merge

### Making Changes

1. Create a feature branch
2. Make your changes
3. Run checks:

   ```bash
   bun run lint:fix          # Auto-fix lint issues
   bun run lint:md:fix       # Auto-fix markdown issues
   bun run typecheck         # Type-check
   bun run test              # Run tests
   bun run build             # Build the plugin
   ```

4. Commit with conventional commit format (enforced by commitlint)
5. Open a pull request

### Project Structure

| Directory | Purpose | Ships to Users? |
| --- | --- | --- |
| `plugin/` | Plugin source, hooks, commands, skills | Yes |
| `plugin/src/` | Shared source code | Yes |
| `__test__/` | All tests | No |
| `lib/` | Dev tooling configs | No |
| `docs/` | Public documentation | No |

### Where to Put Things

* **Shared source code** -- `plugin/src/{descriptive-name}.ts` (no barrel/index files)
* **Hook handlers** -- `plugin/hooks/{name}.hook.ts`
* **Commands** -- `plugin/commands/{name}.cmd.ts` + `plugin/commands/{name}.md`
* **Skills** -- `plugin/skills/{name}/SKILL.md`
* **Agents** -- `plugin/agents/{name}.md`
* **Tests** -- `__test__/` (mirrors plugin/ structure, e.g., `__test__/hooks/context.hook.test.ts`)

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add new hook for PreToolUse validation
fix: correct schema validation for empty strings
docs: update README with command examples
chore: update dependencies
```

### DCO Sign-Off

All commits must include a Developer Certificate of Origin sign-off:

```bash
git commit -s -m "feat: add new feature"
```

This adds `Signed-off-by: Your Name <your@email.com>` to the commit message. See the [DCO](DCO) file for details.

## Pre-Commit Hooks

The following checks run automatically on commit:

* **pre-commit**: lint-staged runs Biome formatting and linting on staged files
* **commit-msg**: commitlint validates the commit message format

These are managed by Husky and should not be bypassed.

## Testing

* Tests use the [Bun test runner](https://bun.sh/docs/cli/test)
* All tests live in `__test__/` at the repo root
* Coverage thresholds: 80% for lines, functions, and statements
* Run tests: `bun run test`

## Linting

* **Code**: [Biome](https://biomejs.dev/) -- `bun run lint:fix`
* **Markdown**: [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) -- `bun run lint:md:fix`
* **Commits**: [@savvy-web/commitlint](https://github.com/savvy-web/commitlint) with conventional commit rules

## Releases

This project uses [changesets](https://github.com/changesets/changesets) for versioning:

1. Create a changeset: `bun x changeset`
2. Follow the prompts to describe your change
3. The changeset is committed with your PR
4. On merge, the release workflow processes changesets

Version bumps automatically update both `plugin/package.json` and `plugin/.claude-plugin/plugin.json`.

## Pull Request Process

1. Ensure all checks pass (lint, typecheck, test, build)
2. Include a changeset if your change affects the plugin
3. Fill out the PR template
4. Sign off your commits (DCO)
5. Request review

## Code of Conduct

Be respectful and constructive. We're all here to build great things.
