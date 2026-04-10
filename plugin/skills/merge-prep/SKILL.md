---
name: merge-prep
description: Final squash of all branch commits into one clean commit and
  force push for merge. Use after PR approval, before merging.
allowed-tools: Bash, Read, Glob, Grep
disable-model-invocation: true
argument-hint: "[--no-push] [--dry-run]"
---

# Merge Preparation

Squashes all branch commits into a single clean commit and force pushes
for the final merge. This is the last step before merging the PR on GitHub.

No documentation pipeline is run — docs were handled during finalize and
review cycles.

## Argument Parsing

Parse `$ARGUMENTS` for flags:

- `--no-push` — squash and commit but don't force push
- `--dry-run` — show what would be squashed without doing it

## Step 0: Preflight Checks

### 0.1 Branch Check

Verify you are NOT on the default branch:

!`git rev-parse --abbrev-ref HEAD`

If on the default branch, stop:

> "You are on the default branch. Merge-prep is for feature branches only."

### 0.2 Base Branch Detection

Detect the default branch:

!`gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' 2>/dev/null || git rev-parse --verify main 2>/dev/null && echo main || echo master`

Store as `BASE_BRANCH`.

### 0.3 Clean Working Tree

Run `git status --porcelain`. If there are uncommitted changes, stop:

> "Working tree has uncommitted changes. Commit or stash them first."

Merge-prep should only operate on committed code.

### 0.4 PR Approval Check

```bash
gh pr view --json reviewDecision -q '.reviewDecision'
```

If the result is `APPROVED`, proceed normally.

If not approved (or no review), warn:

> "PR has not been approved yet (status: [status]).
> Continue anyway? This is unusual — merge-prep is typically run
> after approval. (yes/no)"

Wait for confirmation.

## Step 1: Analyze

### 1.1 Show Commits to Squash

```bash
git log $(git merge-base HEAD $BASE_BRANCH)..HEAD --oneline
```

### 1.2 Show Diff Stat

```bash
git diff $(git merge-base HEAD $BASE_BRANCH)..HEAD --stat
```

### 1.3 Confirm

> "The following N commits will be squashed into a single commit:
> [commit list]
>
> Touching N files:
> [diff stat summary]
>
> This will rewrite history and require a force push. Continue? (yes/no)"

Wait for confirmation. If no, stop.

**In `--dry-run` mode:** Show this preview and stop.

## Step 2: Squash

### 2.1 Soft Reset to Merge Base

```bash
git reset --soft $(git merge-base HEAD $BASE_BRANCH)
```

### 2.2 Verify Staged Changes

```bash
git diff --cached --stat
```

Confirm the staged changes match the diff stat from step 1. If they don't
match, something went wrong — stop and report.

## Step 3: Commit Message

### 3.1 Gather Context

Read the PR title and description:

```bash
gh pr view --json title,body
```

Read any changeset files:

```bash
ls .changeset/*.md 2>/dev/null
```

### 3.2 Generate Message

Generate a conventional commit message from:

- PR title (for the subject line)
- PR body and changeset content (for the description)
- The diff stat (for context)

Present to the user for review:

> "Proposed commit message:
>
> ```text
> type(scope): subject
>
> [description]
>
> Signed-off-by: [name] <[email]>
> ```
>
> Accept, edit, or abort? (accept/edit/abort)"

If "edit", ask the user for their changes. If "abort", the user can recover
with `git reflog`.

### 3.3 Create Commit

```bash
git commit -m "<final message>"
```

## Step 4: Force Push

**Skip if `--no-push` flag is set.** Report:

> "Squashed commit created locally. Push manually with:
> `git push --force-with-lease origin HEAD`"

### 4.1 Push

Use `--force-with-lease` for safety (fails if remote has commits not in local):

```bash
git push --force-with-lease origin HEAD
```

### 4.2 Report

> "Force pushed squashed commit to [branch].
> PR: [url]
> Ready to merge on GitHub."

## Step 5: Cleanup

### 5.1 Remove Session Tag

```bash
git tag -d session/start 2>/dev/null || true
```

### 5.2 Optional: Update PR Description

If the PR body has changed significantly from the squash (e.g., the commit
message is now more comprehensive), offer to update:

> "Update PR description with the final commit message? (yes/no)"

If yes:

```bash
gh pr edit --body "<updated body>"
```

## Error Recovery

If the squash fails mid-operation:

1. The pre-squash state is preserved in git reflog
2. Report: "Squash failed. Your previous commits are in the reflog.
   To recover: `git reflog` then `git reset --hard <pre-squash-ref>`"
3. Do NOT attempt automatic recovery — let the user decide

If the force push fails:

1. The local commit is intact
2. Report: "Force push failed (remote may have new commits).
   Check with `git fetch && git log origin/[branch]..HEAD` and retry."
