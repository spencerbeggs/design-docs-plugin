---
name: finalize
description: End-of-branch workflow. Dispatches the design-doc, context-doc, and user-docs agents to update every documentation layer, then creates a changeset, squashes commits, pushes, and opens a PR. Use when finishing work on a branch before merge.
when_to_use: >
  Trigger phrases — "finalize", "finalize this branch", "wrap up",
  "wrap up this branch", "ship it", "ship this branch",
  "close out this branch", "end-of-branch workflow",
  "I'm done with this work, prep it for merge",
  "ready to merge — run the prep",
  "update docs and open a PR for this branch". Do NOT trigger for:
  mid-task WIP commits (use a normal commit), addressing PR review
  comments (use /design-docs:review), or the final post-approval squash
  (use /design-docs:merge-prep).
allowed-tools: Skill, Agent, Read, Glob, Grep, Bash(git *), Bash(gh *), Bash(bun *), Bash(ls *), Write, Edit, TaskCreate, TaskUpdate
model: sonnet
argument-hint: "[--no-push] [--no-pr] [--no-squash] [--no-context-docs] [--no-user-docs] [--dry-run]"
---

# Branch Finalization

Orchestrates the end-of-branch workflow: analyze what changed, dispatch each documentation agent to update its domain, create a changeset, squash commits into a single clean commit, push, and open a PR.

## Argument Parsing

Parse `$ARGUMENTS` for flags:

- `--no-push` — skip pushing to the remote in step 8 (implies no PR, since a PR requires a pushed branch)
- `--no-pr` — push the branch in step 8 but skip PR creation (useful when the PR will be opened separately, e.g. by CI)
- `--no-squash` — skip the squash step (step 7), commit docs/changeset normally
- `--no-context-docs` — skip step 4 (Update CLAUDE.md Files / context-doc-agent dispatch)
- `--no-user-docs` — skip step 5 (Update User Docs / user-docs agent dispatch)
- `--dry-run` — preview what each step would do without modifying any files

If no arguments are provided, run the full workflow.

## Task Tracking

Before starting Step 1, use `TaskCreate` to add one task per step below. Omit any step that the parsed flags disable so the user sees the real plan, not a list with skipped items still on it.

Default task list (no flags):

1. Preflight checks
2. Analyze branch changes
3. Update design docs
4. Update CLAUDE.md files
5. Update user docs
6. Create changeset
7. Squash commits
8. Push and open PR

Use `TaskUpdate` to flip each task to `in_progress` when you start the step and `completed` when the step finishes successfully. If a step fails or is aborted, leave the task in its current state and stop — do not flip it to completed.

In `--dry-run` mode, still create the task list so the user sees the plan, but only the first two tasks will run.

## Agent Dispatch Convention

Steps 3-6 dispatch domain agents via the `Agent` tool rather than invoking individual sub-skills. Each agent has its full domain skill suite wired (including the matching `*-docs-style` or `changesets:style` skill that enforces project conventions), so the work stays inside an isolated context with the right toolset and rules already in scope.

When dispatching a documentation agent (Steps 3-5), pass a prompt that includes:

1. The branch change summary from Step 2 (diff stat + commit list)
2. The list of files modified by previous documentation steps in this finalize run (so the next agent has the full picture)
3. A directive: "Review the documentation in your domain against these branch changes and update what needs updating. Use whichever of your skills apply."
4. An instruction to report back which files were modified (or that no changes were needed)

When dispatching the changeset-manager (Step 6), pass a prompt that includes:

1. The branch change summary
2. A concise description of what changed in shipped surface (features, breaking changes, behavior shifts, fixes) — not the file list
3. The reports from Steps 3-5 about which doc files were modified, so the agent can decide which of those are user-facing changelog material and which are internal-only
4. A bump-type recommendation if you have one (the agent makes the final call)

Do not enumerate which specific skills the agent should run — the agent decides based on its skill suite.

## Step 1: Preflight Checks

Run these checks before any work. If any check fails, stop and report.

### GitHub call convention

Every `gh` invocation in this workflow must be prefixed with:

```bash
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat gh …
```

Why: the session-start hook sets `DESIGN_DOCS_GH_TOKEN` from `GITHUB_PERSONAL_ACCESS_TOKEN`. If it's set, that token authenticates the call. If it's unset, the empty assignment scrubs any inherited `GH_TOKEN` in the shell so `gh` falls back to the keyring credentials that `gh auth status` reports — keeping the auth check and the writes on the same identity. `GH_PAGER=cat` prevents `gh` from blocking on a pager.

### Branch check

Verify you are NOT on the default branch:

!`git rev-parse --abbrev-ref HEAD`

If on the default branch, stop:

> "You are on the default branch. Finalize is for feature branches only."

### Dirty working tree

Run `git status --porcelain`. If there are uncommitted changes, list them and ask the user:

> "There are uncommitted changes in your working tree: [list files]. These will be included in the finalize commit. Continue or abort so you can commit/stash first?"

Wait for the user's response. If they say abort, stop the workflow.

### Base branch detection

Detect the default branch:

!`GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' 2>/dev/null || git rev-parse --verify main 2>/dev/null && echo main || echo master`

Store the result as `BASE_BRANCH` for use in subsequent steps.

### Empty diff check

Run `git log $BASE_BRANCH..HEAD --oneline`. If there are no commits ahead of the base branch, report:

> "No changes detected on this branch compared to $BASE_BRANCH. Nothing to finalize."

And stop the workflow.

### Session tag check

Check if the `session/start` tag exists:

```bash
git rev-parse session/start 2>/dev/null
```

If it does not exist, create it at the merge-base:

```bash
git tag session/start $(git merge-base HEAD $BASE_BRANCH)
```

Report: "Created session/start tag at merge-base."

### GitHub auth check

Run the auth check using the same env hygiene as every other `gh` call in this workflow — the check site and the use sites in step 8 must agree on which credential is in play, otherwise the probe passes while the write later fails or posts to the wrong account:

```bash
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat gh auth status
```

If not authenticated, warn the user:

> "GitHub CLI is not authenticated. PR creation and the existing-PR check will fail without it. Run `gh auth login` to fix this, continue with `--no-pr` (push the branch but skip PR creation — `git push` uses git's own credentials, not gh), or continue with `--no-push` to skip the remote entirely."

If the user wants to continue with `--no-pr`, treat the rest of the workflow as if `--no-pr` were set. Same for `--no-push`.

## Step 2: Analyze Branch Changes

Build a summary of what changed on this branch:

```bash
git diff $BASE_BRANCH...HEAD --stat
git log $BASE_BRANCH..HEAD --oneline
```

Present a brief summary to the user:

> "This branch has N commits ahead of $BASE_BRANCH, touching N files. Key changes: [summarize from the diff stat]"

This summary is passed as the context payload to every agent dispatch in Steps 3-5.

**In `--dry-run` mode:** Show the summary and describe what each subsequent step would do, then stop.

## Step 3: Update Design Docs

Dispatch the `design-docs:design-doc-agent` via the `Agent` tool. Pass a prompt containing the Step 2 branch summary and the list of changed files. Tell the agent to review design docs in `.claude/design/` against the branch changes and update or create design docs where the architecture, data flows, design decisions, or implementation-plan outcomes have changed. The agent has its full design skill suite wired — let it decide which skills apply.

When the agent returns, capture its report (which files it modified, or "no changes needed") for the Step 4 dispatch context.

**No-op handling:** If the agent reports no design doc updates are needed, that is success. Report "No design doc updates needed" and proceed to step 4.

**On failure:** Report what the agent reported and stop. Tell the user which files the agent modified so they can review or revert.

## Step 4: Update CLAUDE.md Files

**Skip if `--no-context-docs` flag is set.** Proceed to step 5.

Dispatch the `design-docs:context-doc-agent` via the `Agent` tool. Pass a prompt containing the Step 2 branch summary plus whatever the design-doc-agent reported in Step 3 — the context agent needs to know which design docs were touched so it can update `@` pointers, references, and CLAUDE.md sections that index those docs.

When the agent returns, capture its report for the Step 5 dispatch context.

**No-op handling:** Same as step 3.

**On failure:** Report and stop.

## Step 5: Update User Docs

**Skip if `--no-user-docs` flag is set.** Proceed to step 6.

Dispatch the `design-docs:user-docs` agent via the `Agent` tool. Pass a prompt containing the Step 2 branch summary plus the Step 3 design doc updates and the Step 4 CLAUDE.md updates — the user-docs agent needs the full picture to decide whether READMEs, contributing docs, security docs, or other user-facing pages should be touched.

**No-op handling:** Same as step 3.

**On failure:** Report and stop.

## Step 6: Create Changeset

Dispatch the `changesets:changeset-manager` agent via the `Agent` tool. Pass a prompt following the Agent Dispatch Convention for Step 6 — the branch change summary, a concise description of what changed in shipped surface, the Step 3-5 reports, and a bump-type recommendation. The agent has the full changesets skill suite wired (`changesets:create`, `changesets:update`, `changesets:delete`, `changesets:merge`, `changesets:style`, `changesets:status`, `changesets:dependencies`, `changesets:config`) and decides whether to create a new changeset, update an existing one, or report that the diff has no changelog-worthy items.

If the `Agent` call fails because the `changesets:changeset-manager` agent type is unknown (the changesets plugin is not installed), fall back to creating the changeset manually:

1. Ask the user: "What type of change is this? (major/minor/patch)"
2. Ask the user: "Describe the user-facing changes for the changelog:"
3. Read the package name from `package.json` (or the plugin's `package.json`)
4. Write the changeset file to `.changeset/` in the standard format:

```markdown
---
"package-name": patch
---

User's description here
```

Generate a random changeset filename (lowercase adjective-noun pattern).

**On failure:** Report and stop.

## Step 7: Squash Commits

**Skip if `--no-squash` flag is set.** Proceed directly to step 8 with a normal commit of just the docs/changeset changes.

### Stage all changes

Stage everything including doc updates and changeset from previous steps:

```bash
git add -A
```

### Show squash preview

Show the user what will be squashed:

```bash
git log $(git merge-base HEAD $BASE_BRANCH)..HEAD --oneline
```

> "The following N commits will be squashed into a single commit: [list commits]. Continue? (yes/no)"

Wait for confirmation. If the user says no, stop.

### Squash via soft reset

```bash
git reset --soft $(git merge-base HEAD $BASE_BRANCH)
```

### Generate commit message

Generate a conventional commit message from:

- The changeset content (for the description)
- The branch name (for inferring type and scope)
- The diff stat (for context)

Present the generated message to the user for review/editing.

Format:

```text
type(scope): subject

[Description from changeset and branch changes]

Signed-off-by: [from git config]
```

### Create squashed commit

```bash
git commit -m "<generated message>"
```

### Move session tag

Move the session tag to the new squashed commit:

```bash
git tag -f session/start HEAD
```

**On failure:** Report the git error. The user can recover with `git reflog` to find the pre-squash state.

## Step 8: Push and Open PR

**Skip entirely if `--no-push` flag is set.** Report: "Changes committed locally on `$BRANCH`. Not pushed (--no-push). Run `git push -u origin HEAD` to push manually."

### Check for existing PR

```bash
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat gh pr view --json number,url 2>/dev/null
```

If a PR already exists, report:

> "A PR already exists for this branch: [url]. Pushing latest changes."

Push and stop (don't create a duplicate PR).

### Push

```bash
git push -u origin HEAD
```

**Stop here if `--no-pr` flag is set.** Report: "Pushed to `origin/$BRANCH`. No PR opened (--no-pr). Open one manually via `gh pr create` or your CI workflow."

### Create PR

Generate a PR title from the changeset content or branch name. Generate the body from the branch diff summary and changeset description.

```bash
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat gh pr create --title "[title]" --body "[body]"
```

Report the PR URL to the user.

## Progress Reporting

Between each step, mark the matching task `completed` via `TaskUpdate` and report a brief status update:

- "Step 1: Preflight checks passed (session tag at abc1234)"
- "Step 2: Branch has 8 commits touching 12 files"
- "Step 3: Design docs updated (3 files modified)"
- "Step 4: CLAUDE.md files are current (no changes needed)"
- "Step 5: README.md updated with new API documentation"
- "Step 6: Changeset created (.changeset/fuzzy-cats.md)"
- "Step 7: Squashed 8 commits into 1 (feat: add merge commit support)"
- "Step 8: PR opened: <https://github.com/>..."

## Error Recovery

If any step fails:

1. Stop immediately — do not continue to subsequent steps
2. Leave the in-progress task in its current state (do not flip it to completed via `TaskUpdate`)
3. Report which step failed and why
4. List any files that were modified by previous steps or by agents in this finalize run
5. Suggest recovery: "You can review the changes with `git diff`, revert with `git checkout -- .`, or fix the issue and re-run `/design-docs:finalize`"
6. If the squash step (7) fails mid-operation, remind the user they can use `git reflog` to find the pre-squash state

Steps 3-5 are idempotent — re-running against already-updated docs produces no changes. Steps 6-8 are not idempotent — the skill should detect existing changesets and PRs before creating duplicates.
