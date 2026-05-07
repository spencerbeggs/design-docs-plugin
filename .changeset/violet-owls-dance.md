---
"design-docs": minor
---

## Features

Integrate user-docs skill suite, add path-based style skills, remove unused hooks and update audit metrics.

- Add 10 `user-docs-*` skills and `user-docs` agent, replacing the `docs-gen-agent` and two superseded skills (`docs-generate-readme`, `docs-review`)
- Add `user-docs-style` and `design-docs-style` path-based skills that inject style rules when matching files are read
- Add `context-docs-style` path-based skill for `CLAUDE.md`/`AGENTS.md` files enforcing LoadWhen references and lean context structure
- Remove `subagent-start`, `stop-reminder`, `git-safety` and `git-safety-mcp` hooks (responsibilities delegated externally)
- Switch context audit and validate from line-count to word-count metric (`rootMaxWords: 2000`, `childMaxWords: 1000`)
- Move `design-docs.schema.json` to repo root with a canonical GitHub raw URL; remove from plugin distribution
- Add `--squash` flag to `review` skill: folds fix commits into the previous commit and force-pushes
- Persist `GITHUB_PERSONAL_ACCESS_TOKEN` as `GH_TOKEN` in session-start hook via `CLAUDE_ENV_FILE`; derive `GITHUB_REPOSITORY` from git remote
- Expand `review` skill with pre-review cleanup (minimize stale bot summaries), triage of already-fixed and invalid comments, and `resolve-thread` calls for those two categories — legitimate fixes leave threads open for cloud re-review
