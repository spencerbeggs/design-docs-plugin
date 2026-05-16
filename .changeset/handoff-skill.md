---
"design-docs": minor
---

## Features

### Session handoff skill

Adds the `/design-docs:handoff` skill for transferring task state between Claude Code sessions.

* In a failing or context-exhausted session, captures the current task state to `.claude/handoffs/HANDOFF.md`
* In a fresh session, reads an existing handoff back into context and archives it
* Flags: `--resume`, `--update`, `--archive`, `--list`, `--dry-run`
* The skill is listed in the SessionStart hook's skill catalog; pickup is manual — run `/design-docs:handoff` in the fresh session to resume
