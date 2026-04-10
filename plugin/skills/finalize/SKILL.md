---
name: finalize
description: End-of-branch workflow. Updates design docs, CLAUDE.md files, and
  user docs, creates a changeset, squashes commits, pushes, and opens a PR.
  Use when finishing work on a branch before merge.
allowed-tools: Skill, Read, Glob, Grep, Bash, Write, Edit
disable-model-invocation: true
argument-hint: "[--no-pr] [--no-squash] [--docs-only] [--dry-run]"
---

# Branch Finalization

Orchestrates the end-of-branch workflow: analyze what changed, update all
documentation layers, create a changeset, squash commits into a single clean
commit, push, and open a PR.

## Argument Parsing

Parse `$ARGUMENTS` for flags:

- `--no-pr` — run steps 0-6, skip push and PR (step 7)
- `--no-squash` — skip the squash step (step 6), commit docs/changeset normally
- `--docs-only` — run steps 0-4 only, warn that changes are left uncommitted
- `--dry-run` — preview what each step would do without modifying any files

If no arguments are provided, run the full workflow.

## Step 0: Preflight Checks

Run these checks before any work. If any check fails, stop and report.

### 0.1 Branch Check

Verify you are NOT on the default branch:

!`git rev-parse --abbrev-ref HEAD`

If on the default branch, stop:

> "You are on the default branch. Finalize is for feature branches only."

### 0.2 Dirty Working Tree

Run `git status --porcelain`. If there are uncommitted changes, list them
and ask the user:

> "There are uncommitted changes in your working tree:
> [list files]
> These will be included in the finalize commit. Continue or abort so
> you can commit/stash first?"

Wait for the user's response. If they say abort, stop the workflow.

### 0.3 Base Branch Detection

Detect the default branch:

!`gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' 2>/dev/null || git rev-parse --verify main 2>/dev/null && echo main || echo master`

Store the result as `BASE_BRANCH` for use in subsequent steps.

### 0.4 Empty Diff Check

Run `git log $BASE_BRANCH..HEAD --oneline`. If there are no commits ahead
of the base branch, report:

> "No changes detected on this branch compared to $BASE_BRANCH.
> Nothing to finalize."

And stop the workflow.

### 0.5 Session Tag Check

Check if the `session/start` tag exists:

```bash
git rev-parse session/start 2>/dev/null
```

If it does not exist, create it at the merge-base:

```bash
git tag session/start $(git merge-base HEAD $BASE_BRANCH)
```

Report: "Created session/start tag at merge-base."

### 0.6 GitHub Auth Check

Run `gh auth status`. If not authenticated, warn the user:

> "GitHub CLI is not authenticated. The PR step will be skipped.
> Run `gh auth login` to enable PR creation, or continue with --no-pr."

If the user wants to continue, treat the rest of the workflow as `--no-pr`.

## Step 1: Analyze Branch Changes

Build a summary of what changed on this branch:

```bash
git diff $BASE_BRANCH...HEAD --stat
git log $BASE_BRANCH..HEAD --oneline
```

Present a brief summary to the user:

> "This branch has N commits ahead of $BASE_BRANCH, touching N files.
> Key changes: [summarize from the diff stat]"

This summary is passed as context to the documentation update steps.

**In `--dry-run` mode:** Show the summary and describe what each subsequent
step would do, then stop.

## Step 2: Update Design Docs

Invoke the design-sync skill to update design docs based on the branch changes:

```text
/design-docs:design-sync
```

Pass the branch change summary as the argument so the agent knows what changed.

After the skill completes, invoke validation:

```text
/design-docs:design-validate
```

**No-op handling:** If the agent reports no design docs need updating, this is
success. Report "No design doc updates needed" and proceed to step 3.

**On failure:** Report what happened and stop. Tell the user which files were
modified so they can review or revert.

## Step 3: Update CLAUDE.md Files

Invoke the context-update skill to review and update CLAUDE.md files:

```text
/design-docs:context-update
```

Pass context about the design doc changes from step 2 so the agent can update
`@` pointers and references accordingly.

After the skill completes, invoke validation:

```text
/design-docs:context-validate
```

**No-op handling:** Same as step 2.

**On failure:** Report and stop.

## Step 4: Update User Docs

Invoke the docs-update skill to review and update user-facing documentation:

```text
/design-docs:docs-update
```

Pass context about all changes (branch diff + design doc updates + CLAUDE.md
updates) so the agent has the full picture.

**No-op handling:** Same as step 2.

**On failure:** Report and stop.

**If `--docs-only` flag is set:** Stop here. Warn the user:

> "Documentation updates complete. Changes are left uncommitted in your
> working tree. Review the changes and commit manually, or re-run
> `/design-docs:finalize` for the full workflow."

## Step 5: Create Changeset

Try to invoke the changesets plugin:

```text
/changesets:create
```

If the skill is not available (the changesets plugin is not installed), create
the changeset manually:

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

## Step 6: Squash Commits

**Skip if `--no-squash` flag is set.** Proceed directly to step 7 with a
normal commit of just the docs/changeset changes.

### 6.1 Stage All Changes

Stage everything including doc updates and changeset from previous steps:

```bash
git add -A
```

### 6.2 Show Squash Preview

Show the user what will be squashed:

```bash
git log $(git merge-base HEAD $BASE_BRANCH)..HEAD --oneline
```

> "The following N commits will be squashed into a single commit:
> [list commits]
> Continue? (yes/no)"

Wait for confirmation. If the user says no, stop.

### 6.3 Squash via Soft Reset

```bash
git reset --soft $(git merge-base HEAD $BASE_BRANCH)
```

### 6.4 Generate Commit Message

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

### 6.5 Create Squashed Commit

```bash
git commit -m "<generated message>"
```

### 6.6 Move Session Tag

Move the session tag to the new squashed commit:

```bash
git tag -f session/start HEAD
```

**On failure:** Report the git error. The user can recover with
`git reflog` to find the pre-squash state.

## Step 7: Push and Open PR

**Skip if `--no-pr` flag is set.** Report that changes are committed locally.

### 7.1 Check for Existing PR

```bash
gh pr view --json number,url 2>/dev/null
```

If a PR already exists, report:

> "A PR already exists for this branch: [url]. Pushing latest changes."

Push and stop (don't create a duplicate PR).

### 7.2 Push

```bash
git push -u origin HEAD
```

### 7.3 Create PR

Generate a PR title from the changeset content or branch name. Generate the
body from the branch diff summary and changeset description.

```bash
gh pr create --title "[title]" --body "[body]"
```

Report the PR URL to the user.

## Progress Reporting

Between each step, report a brief status update:

- "Step 0: Preflight checks passed (session tag at abc1234)"
- "Step 1: Branch has 8 commits touching 12 files"
- "Step 2: Design docs updated (3 files modified)"
- "Step 3: CLAUDE.md files are current (no changes needed)"
- "Step 4: README.md updated with new API documentation"
- "Step 5: Changeset created (.changeset/fuzzy-cats.md)"
- "Step 6: Squashed 8 commits into 1 (feat: add merge commit support)"
- "Step 7: PR opened: <https://github.com/>..."

## Error Recovery

If any step fails:

1. Stop immediately — do not continue to subsequent steps
2. Report which step failed and why
3. List any files that were modified by previous steps
4. Suggest recovery: "You can review the changes with `git diff`, revert
   with `git checkout -- .`, or fix the issue and re-run `/design-docs:finalize`"
5. If the squash step (6) fails mid-operation, remind the user they can use
   `git reflog` to find the pre-squash state

Steps 2-4 are idempotent — re-running against already-updated docs produces no
changes. Steps 5-7 are not idempotent — the skill should detect existing
changesets and PRs before creating duplicates.
