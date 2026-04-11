---
name: review
description: Fetch and address PR review feedback. Filters resolved/outdated
  comments, triages by severity, makes fixes, runs lightweight doc check,
  commits and pushes. Use during PR review cycles.
allowed-tools: Skill, Read, Glob, Grep, Bash, Write, Edit
disable-model-invocation: true
argument-hint: "[pr-number] [--force-docs] [--no-push] [--dry-run]"
---

# PR Review Cycle

Fetches active review feedback from the current branch's PR, triages by
severity, addresses each item, runs verification, and commits fixes.
Designed for iterative review cycles where small fix commits are preferred.

## Argument Parsing

Parse `$ARGUMENTS` for:

- First positional argument: PR number (optional, auto-detects from branch)
- `--force-docs` — run full docs pipeline instead of lightweight check
- `--no-push` — commit but don't push
- `--dry-run` — show what would be addressed without making changes

## Step 0: Detect PR

### 0.1 Find the PR

If a PR number was provided as an argument, use it directly:

```bash
gh pr view $PR_NUMBER --json number,url,title,headRefName
```

If no PR number, auto-detect from the current branch:

```bash
gh pr view --json number,url,title,headRefName
```

If no PR exists for the current branch, stop:

> "No PR found for branch [branch-name]. Open a PR first with
> `/design-docs:finalize`, or specify a PR number."

### 0.2 Display PR Info

> "Reviewing PR #N: [title]
> URL: [url]"

## Step 1: Fetch Active Comments

### 1.1 Get All Review Comments

Fetch review comments (inline code comments) and issue comments (general PR
comments):

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate
gh api repos/{owner}/{repo}/issues/{number}/comments --paginate
```

### 1.2 Filter to Active Comments

Remove from the list:

- **Resolved threads**: Comments where the review thread is marked resolved
  (`isResolved: true` on the thread, or the comment is in a resolved
  conversation)
- **Outdated comments**: Comments marked as outdated by GitHub (the diff they
  reference has changed)
- **Hidden comments**: Comments with `minimized` or hidden state
- **PR author's own comments**: Filter out comments from the PR author
  (these are responses, not review feedback)

### 1.3 Handle No Active Comments

If no active comments remain after filtering:

> "No unresolved review feedback found. The PR is clean."

Stop the workflow.

## Step 2: Triage

### 2.1 Classify Each Comment

For each active comment, determine:

**Severity:**

- **Critical**: Security issues, bugs, breaking changes. Keywords: "bug",
  "security", "breaking", "crash", "vulnerability", "must fix"
- **High**: Important improvements, missing error handling, test gaps.
  Keywords: "should", "important", "missing", "error handling"
- **Medium**: Code quality, refactoring suggestions, style issues.
  Keywords: "consider", "suggest", "could", "refactor", "nit" (when
  substantive)
- **Low**: Minor style, formatting, optional improvements.
  Keywords: "nit", "optional", "minor", "style"

**Type:**

- Code fix (change implementation)
- Test addition (add or modify tests)
- Documentation update (change docs/comments)
- Defer (too complex for review cycle, create issue)

### 2.2 Present Triage Summary

Group comments by severity and show:

> "Found N active review comments:
>
> Critical (N):
> \- [file:line] commenter: excerpt...
>
> High (N):
> \- [file:line] commenter: excerpt...
>
> Medium (N):
> \- [file:line] commenter: excerpt...
>
> Low (N):
> \- [file:line] commenter: excerpt...
>
> Proceed with addressing these? (yes/skip-low/abort)"

If the user says "skip-low", exclude low severity items. If "abort", stop.

**In `--dry-run` mode:** Show the triage summary and stop.

## Step 3: Address Comments

Work through comments starting from highest severity.

### 3.1 For Each Comment

1. Read the relevant file and surrounding context
2. Understand what the reviewer is asking for
3. Determine if the suggestion is valid and applicable
4. If valid and straightforward: make the fix
5. If valid but complex: offer to create a GitHub issue
6. If unclear: skip and note for the user to address manually

### 3.2 Track Progress

After addressing each comment, report:

> "[severity] [file:line] — Fixed: [brief description]"
> "[severity] [file:line] — Deferred: created issue #N"
> "[severity] [file:line] — Skipped: needs manual review"

## Step 4: Verify

After all fixes are made:

### 4.1 Run Tests

```bash
bun run test
```

If tests fail, report which tests failed and stop. The user needs to review
the fixes before continuing.

### 4.2 Run Linting

```bash
bun run lint
```

If lint fails, attempt auto-fix:

```bash
bun run lint:fix
```

### 4.3 Run Type Check

```bash
bun run typecheck
```

If type check fails, report errors and stop.

## Step 5: Doc Check

### 5.1 Lightweight Check (Default)

Scan the files changed in step 3 for architecture-impacting changes:

- New or removed exports
- Modified function signatures or interfaces
- Changed data flows (new dependencies, modified API boundaries)
- New or removed modules/files

If architecture-impacting changes are found, run design-sync and
context-update for the affected modules only:

```text
/design-docs:design-sync [affected-module]
/design-docs:context-update [affected-file]
```

If only implementation details changed (bug fixes, internal refactors,
style changes), skip the doc update:

> "Changes are implementation-only. No doc updates needed."

### 5.2 Full Pipeline (--force-docs)

If `--force-docs` flag is set, run the full pipeline regardless:

```text
/design-docs:design-sync
/design-docs:design-validate
/design-docs:context-update
/design-docs:context-validate
/design-docs:docs-update
```

## Step 6: Commit

### 6.1 Stage Changes

Stage all modified files. Use `git add` with specific paths based on what
was changed in steps 3-5. Do NOT use `git add -A`.

### 6.2 Generate Commit Message

Generate a conventional commit message. Use `fix:` prefix since this is
addressing review feedback:

```text
fix: address PR review feedback

- [Brief description of each fix made]

Signed-off-by: [from git config]
```

### 6.3 Commit

```bash
git commit -m "<generated message>"
```

## Step 7: Push

**Skip if `--no-push` flag is set.** Report that changes are committed locally.

```bash
git push
```

## Summary

After completing all steps, report:

> "Review cycle complete:
> \- Fixed: N comments (list)
> \- Deferred: N comments (list with issue links)
> \- Skipped: N comments (list, need manual review)
> \- Docs: [updated/not needed]
> \- Pushed to: [branch]"
