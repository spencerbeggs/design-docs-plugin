---
name: handoff
description: Capture the current task state into .claude/handoffs/HANDOFF.md so a fresh Claude Code session can resume the work, or read a pending handoff back into context. Bidirectional — writes a handoff when none is pending, resumes one when it exists.
allowed-tools: Read, Write, Edit, Glob, Agent, Bash(git *), Bash(mv .claude/handoffs/*), Bash(date *), Bash(touch *), Bash(grep *), Bash(printf *), Bash(tr *), Bash(echo *)
disable-model-invocation: true
argument-hint: "[reason] [--resume] [--update] [--archive] [--list] [--dry-run]"
---

# Session Handoff

Capture the state of the current task into a known file so a fresh Claude Code session can resume it, or resume a handoff a previous session left behind.

Use `/design-docs:handoff` when a session has gone wrong in a way that cannot be fixed in flight — context exhaustion, a wedged tool or environment — and restoring context by hand would cost more than starting fresh.

## Paths

All paths are relative to the project root.

- Active handoff: `.claude/handoffs/HANDOFF.md`
- Archive directory: `.claude/handoffs/archive/`
- Archived file: `.claude/handoffs/archive/<timestamp>-handoff.md`

`.claude/handoffs/` is project-scoped session state — it lives in the project's `.claude/` tree alongside `.claude/design/` and `.claude/plans/`, never in plugin data.

Generate timestamps with `date -u` only — never `date --iso-8601`, `date -d`, or `date --utc` (GNU-only, wrong on macOS):

- Frontmatter (`created_at`, `updated_at`, `consumed_at`, `archived_at`): `date -u +%Y-%m-%dT%H:%M:%SZ`
- Archive filename: `date -u +%Y-%m-%d-%H%M%S`

## Argument Parsing

Parse `$ARGUMENTS`:

- `--list` — list archived handoffs, then stop.
- `--resume` — force read mode.
- `--update` — force amend mode.
- `--archive` — force archive mode.
- `--dry-run` — preview only: write nothing, move nothing, do not touch `.gitignore`.
- Any remaining non-flag text — the positional `reason` string.

At most one of `--list`, `--resume`, `--update`, `--archive` may be present. If two or more are given, stop:

> "Conflicting flags: `--X` and `--Y` cannot be combined. Pick one."

## Mode Resolution

Check whether the active handoff exists with `Glob` on `.claude/handoffs/HANDOFF.md`. Then resolve the mode in this precedence order:

1. `--list` present → **List mode**.
2. `--archive` present → **Archive mode**.
3. `--resume` present → **Read mode**.
4. `--update` present → **Amend mode**.
5. No mode flag, active handoff exists → **Read mode**.
6. No mode flag, no active handoff → **Write mode**.

## Write Mode

Create a fresh handoff.

1. If `.claude/handoffs/HANDOFF.md` already exists, stop — never overwrite:
   > "A handoff is already pending at `.claude/handoffs/HANDOFF.md`. Run `/design-docs:handoff` to resume it, `/design-docs:handoff --update` to revise it, or `/design-docs:handoff --archive` to clear it before writing a new one."
2. **Preserve design context first — your judgment.** Assess whether this session produced design-level changes — new or revised architecture, system boundaries, data flows, or design decisions — that belong in the project's durable design docs. The `HANDOFF.md` is gitignored and transient; `.claude/design/` is the project's institutional memory, so design-level context must land there to survive past the next resume. If such changes exist and `.claude/design/` is present, dispatch the `design-docs:design-doc-agent` via the `Agent` tool with a targeted prompt that names exactly what changed and what it should record or update. Dispatching a subagent gives that work a fresh context budget, so this is safe even when the current session is nearly out of context. If the work was purely mechanical with no design-level changes, skip this step. **If `--dry-run`:** state whether you would dispatch the agent and why, but do not dispatch it.
3. Gather the task state from this session. Fill **every** section of the template in "The Handoff Document" below. Be concrete and specific — the next agent has zero context. If you dispatched the design-doc-agent in the previous step, point the "Read first" section at the design docs it created or updated.
4. Build the frontmatter:
   - `created_at`: `date -u +%Y-%m-%dT%H:%M:%SZ`
   - `updated_at`: empty
   - `branch`: `git branch --show-current` (empty if not in a git repo)
   - `status`: `pending`
   - `reason`: the positional `reason` argument; if none was given, infer a one-line reason from the session
   - `consumed_at`, `archived_at`: empty
5. **If `--dry-run`:** print the full document that would be written, then stop. Do not write, do not touch `.gitignore`.
6. Write the document to `.claude/handoffs/HANDOFF.md` with the `Write` tool — it creates `.claude/handoffs/`.
7. Ensure the archive directory exists for later modes: if `.claude/handoffs/archive/` is absent, `Write` an empty file at `.claude/handoffs/archive/.gitkeep`. This is purely a directory-creation step — the `Write` tool creates parent directories, so the placeholder only exists to bring `archive/` into being. Despite the conventional `.gitkeep` name, the file is never tracked: `.claude/handoffs/` is gitignored.
8. Ensure `.gitignore` ignores the directory. Run:

   ```bash
   touch .gitignore && grep -qF '.claude/handoffs/' .gitignore || printf '.claude/handoffs/\n' >> .gitignore
   ```

9. Report: "Handoff written to `.claude/handoffs/HANDOFF.md`. Start a fresh Claude Code session and run `/design-docs:handoff` to resume."

## Amend Mode (`--update`)

Revise the pending handoff in place.

1. If `.claude/handoffs/HANDOFF.md` does not exist, stop:
   > "No pending handoff to update. Run `/design-docs:handoff` to create one."
2. `Read` the existing file.
3. Re-assess this session and rewrite the body sections so they reflect the latest state.
4. Update the frontmatter: preserve `created_at`; set `updated_at` to `date -u +%Y-%m-%dT%H:%M:%SZ`; keep `status: pending`. If a new positional `reason` was passed, replace `reason`; otherwise keep it.
5. **If `--dry-run`:** print the revised document, then stop.
6. Write the revised document to `.claude/handoffs/HANDOFF.md` with `Write` (overwrites in place).
7. Report: "Handoff at `.claude/handoffs/HANDOFF.md` updated."

## Read Mode (resume)

1. If `.claude/handoffs/HANDOFF.md` does not exist, stop:
   > "No pending handoff at `.claude/handoffs/HANDOFF.md`. Run `/design-docs:handoff --list` to see archived handoffs."
2. `Read` the file.
3. Compare the current branch (`git branch --show-current`) to the `branch` field. If they differ, warn the user:
   > "This handoff was written on branch `<frontmatter branch>`; you are on `<current branch>`. Switch branches before resuming if that was unintended."
4. Read every design doc and plan listed under "Read first" so the resumed work has its full context.
5. **If `--dry-run`:** report the file that would be resumed, print its content, state it would be archived to `.claude/handoffs/archive/<timestamp>-handoff.md`, then stop. Do not edit or move anything.
6. Ensure the archive directory exists: if `.claude/handoffs/archive/` is absent, `Write` `.claude/handoffs/archive/.gitkeep` with empty content.
7. In a **single** `Bash` call, capture both timestamp forms from one `date` reading — the `Bash` tool does not persist shell state between calls, so a variable set here cannot be read in a later call:

   ```bash
   STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ); echo "$STAMP"; printf '%s\n' "$STAMP" | tr -d ':Z' | tr 'T' '-'
   ```

   Line 1 of the output is the ISO-8601 stamp (for frontmatter); line 2 is the compact `YYYY-MM-DD-HHMMSS` form (for the archive filename), both derived from the same reading so they cannot drift. Use these two literal values directly in the next two steps — do not reference `$STAMP` in a later `Bash` call.
8. `Edit` the active file's frontmatter: set `status: consumed` and `consumed_at` to the ISO-8601 literal from step 7.
9. Archive it with a single atomic rename, substituting the compact literal from step 7 for `<compact-stamp>`:

   ```bash
   mv .claude/handoffs/HANDOFF.md ".claude/handoffs/archive/<compact-stamp>-handoff.md"
   ```

10. Report: "Resumed handoff from `.claude/handoffs/archive/<timestamp>-handoff.md`. Continuing the task." Then carry out the work described under "Next steps".

## Archive Mode (`--archive`)

Clear a pending handoff without resuming it.

1. If `.claude/handoffs/HANDOFF.md` does not exist, stop:
   > "No pending handoff to archive."
2. **If `--dry-run`:** report the archive path that would be written and the frontmatter that would be stamped (`status: archived`, `archived_at`), then stop.
3. Ensure the archive directory exists: if `.claude/handoffs/archive/` is absent, `Write` `.claude/handoffs/archive/.gitkeep` with empty content.
4. In a **single** `Bash` call, capture both timestamp forms from one `date` reading — the `Bash` tool does not persist shell state between calls, so a variable set here cannot be read in a later call:

   ```bash
   STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ); echo "$STAMP"; printf '%s\n' "$STAMP" | tr -d ':Z' | tr 'T' '-'
   ```

   Line 1 of the output is the ISO-8601 stamp (for frontmatter); line 2 is the compact `YYYY-MM-DD-HHMMSS` form (for the archive filename), both derived from the same reading so they cannot drift. Use these two literal values directly in the next two steps — do not reference `$STAMP` in a later `Bash` call.
5. `Edit` the frontmatter: set `status: archived` and `archived_at` to the ISO-8601 literal from step 4.
6. Archive it with a single atomic rename, substituting the compact literal from step 4 for `<compact-stamp>`:

   ```bash
   mv .claude/handoffs/HANDOFF.md ".claude/handoffs/archive/<compact-stamp>-handoff.md"
   ```

7. Report: "Archived the pending handoff to `.claude/handoffs/archive/<timestamp>-handoff.md`. The known location is now clear."

## List Mode (`--list`)

1. `Glob` `.claude/handoffs/archive/*-handoff.md`.
2. If there are none, report "No archived handoffs." and stop.
3. Sort the matched paths by filename in descending order (the leading timestamps sort chronologically, so this puts the newest first). `Read` the frontmatter of each. Print one line per handoff: `<filename> — <status> — <reason>`.
4. Stop. `--list` never writes or moves anything.

## The Handoff Document

Write the active handoff with this exact structure — YAML frontmatter followed by the eight fixed sections:

```markdown
---
created_at: 2026-05-16T14:30:22Z
updated_at:
branch: feat/handoff-skill
status: pending
reason: context exhausted mid-refactor
consumed_at:
archived_at:
---

# Handoff: <short task title>

## Task & goal
What we set out to do and the definition of done.

## Progress so far
What is done and verified working. What is partially done.

## Why this handoff
The technical failure or blocker that forced a fresh session.

## Next steps
Ordered, concrete actions for the next agent to take first.

## Key files & locations
Files touched or relevant, with paths.

## Git state
Branch, last commit, dirty / uncommitted files, session/start tag.

## Gotchas & dead ends
Approaches already tried that did not work — so the next agent does not repeat them.

## Read first
@-pointers to design docs / plans the next session should load.
```

## Frontmatter Reference

| Field | Set when | Value |
| ----- | -------- | ----- |
| `created_at` | Write mode | ISO-8601 UTC, never changes after creation |
| `updated_at` | Amend mode | ISO-8601 UTC of the last `--update` |
| `branch` | Write mode | `git branch --show-current` at write time |
| `status` | every mode | `pending` (active), `consumed` (resumed), `archived` (cleared via `--archive`) |
| `reason` | Write / Amend | One-line reason for the handoff |
| `consumed_at` | Read mode | ISO-8601 UTC when the handoff was resumed |
| `archived_at` | Archive mode | ISO-8601 UTC when the handoff was cleared |
