---
"design-docs": minor
---

## Features

### Branch Lifecycle Workflow

Adds squash-merge workflow support with three skills and git safety hooks for feature branch development.

**Skills:**

* `/design-docs:finalize` — revised to squash all branch commits into a single clean commit before pushing and opening a PR. Adds `--no-squash` flag and session tag verification.
* `/design-docs:review` — new skill that fetches active PR review comments, triages by severity, addresses fixes, and commits with small fix commits during review cycles.
* `/design-docs:merge-prep` — new skill for final squash of all branch commits and force push after PR approval. Cleans up session tag.

**Git Safety Hooks:**

* `git-safety.sh` (PreToolUse, Bash) — blocks destructive git operations on the default branch while auto-allowing them on feature branches. Always blocks `gh repo delete`, branch protection removal, and admin PR merges.
* `git-safety-mcp.sh` (PreToolUse, GitKraken MCP) — same branch-aware rules for GitKraken MCP tools (`git_push`, `git_branch`, `git_checkout`).

**Session Tag Management:**

* `session-start.sh` now creates a local `session/start` git tag at the merge-base on feature branches for session boundary tracking.
