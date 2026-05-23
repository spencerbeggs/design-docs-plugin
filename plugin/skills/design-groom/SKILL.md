---
name: design-groom
description: Autonomous top-to-bottom overhaul of design docs — validate, restyle, resync against code, prune stale context, split oversized docs, reconcile cross-references, update CLAUDE.md references, then commit. Runs unattended with no confirmation gates. Use to groom design documentation before a review or release.
allowed-tools: Skill, Agent, Read, Glob, Grep, Bash(git *), Write, Edit, TaskCreate, TaskUpdate
disable-model-invocation: true
user-invocable: true
argument-hint: "[module] [--dry-run] [--no-commit]"
---

# Design Documentation Grooming

Drive a complete, **unattended** overhaul of the project's design docs. For each module, dispatch the design-doc-agent to validate, restyle, resync against code, prune stale context, and split oversized docs. Then reconcile cross-references across modules, dispatch the context-doc-agent to update CLAUDE.md references, and commit the result.

This skill runs **without confirmation gates** — once invoked it does the full pass autonomously. The commit (which is **not** pushed) is the review gate: inspect the diff, amend, or `git reset` afterward.

## Argument Parsing

Parse `$ARGUMENTS`:

- `[module]` — a single module name. If present, groom only that module. If absent, groom every module in `design.config.json`.
- `--dry-run` — report what each module's groom would change; make NO edits, create NO files, NO commit. Stop after reporting.
- `--no-commit` — run the full groom and leave changes in the working tree; skip the commit step.

## Task Tracking

Before Step 1, use `TaskCreate` to add one task per step below (omit Step 6 if `--no-commit`; in `--dry-run`, only Steps 1–3 run, so create just those three tasks). Flip each to `in_progress` when you start it and `completed` when it finishes. If a step fails, leave its task in place and stop.

1. Preflight checks
2. Discover modules
3. Groom each module (design-doc-agent)
4. Reconcile cross-references
5. Update CLAUDE.md references (context-doc-agent)
6. Commit

## Step 1: Preflight Checks

### Branch check

This skill commits, and the default branch is protected (squash-only). Verify you are NOT on the default branch:

!`git rev-parse --abbrev-ref HEAD`

If on the default branch, stop:

> "You are on the default branch. design-groom commits its changes; run it on a feature branch."

### Dirty-tree check (path-scoped)

Run `git status --porcelain`. Classify each modified path:

- **In-domain:** under `.claude/design/`, or any file named `CLAUDE.md`.
- **Out-of-domain:** anything else.

If there are any out-of-domain changes, stop:

> "Your working tree has uncommitted changes outside design docs: [list]. Commit or stash them first — design-groom commits everything it touches and must not bundle unrelated work."

If only in-domain changes exist, report and continue (this is a report, not a prompt; the skill proceeds):

> "Note: N in-domain files are already modified ([list]) and will be included in the groom commit. Abort now (Ctrl-C) if you want them committed separately."

### Design docs present

Confirm `.claude/design/design.config.json` exists. If not, stop:

> "Design docs are not initialized (no .claude/design/design.config.json). Run /design-docs:design-init first."

## Step 2: Discover Modules

Read `.claude/design/design.config.json` and list the modules under `.modules`. If a `[module]` argument was given, restrict to that one (error if it is not in the config). Report the module list.

## Step 3: Groom Each Module

For each module, dispatch the `design-docs:design-doc-agent` via the `Agent` tool. The dispatch prompt MUST be imperative — the agent runs unattended and there is no mid-run correction. Name the goals, not the skills (the agent chooses which of its skills apply):

> You MUST review every design doc in `.claude/design/<module>/` against the current code and bring it fully into shape:
>
> 1. **Valid state.** Every doc MUST have valid frontmatter, resolvable cross-references, a status that matches its completeness, and clean markdown lint.
> 2. **Style.** Every doc MUST conform to the design-docs style. Remove pre-existing formatting violations even if they predate this pass.
> 3. **Reflect the code; strip stale context.** Every doc MUST match the current implementation. Remove every reference to plans, specs, or prior states that a first-time reader would not benefit from — a doc that is ambiguous about what is current versus historical is failing.
> 4. **Split oversized docs.** If a doc covers more than one unrelated subsystem, split it into atomic, cross-referenced pieces with your design-split skill, unless you can state a specific reason its scope is warranted.
> 5. **Stop over-recording.** Remove exact test counts, method counts, and exhaustive parameter enumerations. Keep load-bearing code references and "where this system lives" pointers; point at the source file instead of restating it.
>
> Report back: the files you modified, any docs you split (with the new file paths), or that no changes were needed.

**In `--dry-run`:** change the directive's final instruction to "Report what you WOULD change for each doc — make NO edits and create NO files." Collect the reports, then skip Steps 4–6, report all module plans, and stop.

Collect each module's report (including new files from splits) for Steps 4 and 5.

**No-op handling:** a module reporting "no changes needed" is success.

**On failure:** report what the agent reported and stop; leave the in-progress task as-is.

## Step 4: Reconcile Cross-References

Splits in Step 3 may have created files that docs in other modules link to, so reconciliation must consider the whole post-groom tree, not one module in isolation. Invoke via the `Skill` tool:

- `design-validate` — confirm every doc's frontmatter and links are valid post-groom.
- `design-link` — rebuild the cross-reference graph and surface any now-broken links.

Both run in the design-doc-agent (they are `context: fork` skills); each reads the full design tree from disk, so a single invocation of each already covers every module — there is no need for a per-module pass here. If validation surfaces broken links, fix them yourself with `Edit`/`Write` in this orchestrator context, then re-invoke `design-validate` to confirm. Report the reconciliation result.

## Step 5: Update CLAUDE.md References

Dispatch the `design-docs:context-doc-agent` via the `Agent` tool. Pass the Step 3 reports — especially every new file created by a split:

> Design docs were just groomed and some were split into new files: [list new files]. Review every CLAUDE.md that references design docs and update the `@`-pointers and references to match the new structure: fix paths to split docs, add pointers to new child docs where the parent pointer no longer suffices, and remove pointers to anything deleted. Report which CLAUDE.md files you modified.

**No-op handling:** same as Step 3.

**On failure:** report and stop.

## Step 6: Commit

**Skip entirely if `--no-commit`.** Report: "Grooming complete. Changes left in the working tree (--no-commit). Review with `git diff` and commit when ready."

If every step reported "no changes needed" and `git status --porcelain` is empty, there is nothing to commit. Report the clean bill of health and stop — do NOT create an empty commit.

Otherwise stage and commit (git-only — no `gh`, no push). Stage exactly the files reported modified or created in Steps 3–5 — the design docs the agents changed, any new files from splits, and the `CLAUDE.md` files the context-doc-agent updated — not the whole tree. This keeps the commit structurally limited to what the groom touched, beyond the preflight's starting-state guarantee:

```bash
git add <files reported modified/created in Steps 3–5>
```

Generate a conventional commit message satisfying `@savvy-web/commitlint`: a `docs` type, a subject summarizing what changed (modules groomed, docs split, CLAUDE.md updated), and a DCO `Signed-off-by` trailer from `git config user.name` and `git config user.email`. Shape:

```text
docs: groom design documentation

Grooming pass across [modules]: validated frontmatter, conformed style,
resynced against code, pruned stale context, split [N] oversized docs,
reconciled cross-references, and updated CLAUDE.md pointers.

Signed-off-by: <name> <email>
```

```bash
git commit -m "<generated message>"
```

Report the commit SHA. Do NOT push — the commit is the review gate.

## Progress Reporting

After each step, mark its task `completed` via `TaskUpdate` and report a one-line status (preflight result, module count, per-module groom summary, reconciliation result, CLAUDE.md files updated, commit SHA).

## Error Recovery

If any step fails: stop immediately, leave the in-progress task as-is, report which step failed and why, list files modified so far, and suggest recovery (`git diff`, `git checkout -- .`, or fix and re-run). Steps 3–5 are idempotent; re-running against already-groomed docs produces no changes.
