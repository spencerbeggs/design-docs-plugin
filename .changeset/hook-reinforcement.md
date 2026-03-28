---
"design-docs": minor
---

## Features

### Hook Reinforcement System

Three new lifecycle hooks that reinforce design docs awareness across context-loss boundaries:

- **SessionStart** rewritten with philosophy-first context, fires on all session sources (startup, resume, compact, clear), includes first-install detection
- **SubagentStart** injects condensed design docs awareness into every spawned subagent
- **Stop** provides a soft post-implementation nudge using keyword detection with a loop guard

### Finalize Skill

New `/design-docs:finalize` skill orchestrates the end-of-branch workflow: update design docs, CLAUDE.md files, and user docs, create a changeset, commit, push, and open a PR. Supports `--no-pr`, `--docs-only`, and `--dry-run` flags.

## Refactoring

### Pure Bash Hooks

Replaced the compiled TypeScript binary plugin build system with pure bash hooks. Removes all build dependencies and simplifies distribution.

### Skill Frontmatter Fixes

- Renamed `tools` to `allowed-tools` across all 35 skills
- Added missing `context: fork` to 5 skills
- Fixed agent tool lists (added WebSearch to docs-gen-agent)
