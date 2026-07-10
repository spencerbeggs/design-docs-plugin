---
name: review
description: Fetch and address PR review feedback. Filters resolved/outdated
  comments, triages by severity, makes fixes, runs lightweight doc check,
  commits and pushes. Use during PR review cycles.
allowed-tools: Skill, Read, Glob, Grep, Bash(git *), Bash(gh *), Bash(bun *), Bash(bash *), Write, Edit
disable-model-invocation: true
argument-hint: "[pr-number] [--force-docs] [--no-push] [--dry-run] [--squash]"
---

# PR Review Cycle

Fetches active review feedback from the current branch's PR, triages by
severity, addresses each item, runs verification, and commits fixes.
Designed for iterative review cycles where small fix commits are preferred.

## GitHub API operations

Several steps call `gh-pr-review.sh` to perform GitHub operations (resolving threads, minimizing stale comments). Authentication resolves in this order: `DESIGN_DOCS_GH_TOKEN` (the session-start hook maps `GITHUB_PERSONAL_ACCESS_TOKEN` → `DESIGN_DOCS_GH_TOKEN` at session start), then `GH_TOKEN`, then the `gh` keyring credentials from `gh auth login`. The plugin uses a namespaced variable so it does not override the user's own `GH_TOKEN`; every `gh` call site injects the resolved token — or an empty `GH_TOKEN=` scrub when none is set, which lets `gh` fall back to its keyring.

An unset `DESIGN_DOCS_GH_TOKEN` is therefore normal and NOT worth reporting when keyring auth exists. Probe once and reuse the result:

```bash
GH_AUTH_OK=false
if [ -n "${DESIGN_DOCS_GH_TOKEN:-}" ] || GH_TOKEN='' GITHUB_TOKEN='' gh auth status &>/dev/null; then
  GH_AUTH_OK=true
fi
```

Only if `GH_AUTH_OK` is `false` are the `gh-pr-review.sh` calls skipped gracefully (the code-change workflow still runs normally); mention it once in the final summary, not per step.

Local agents never call `approve-pr`. Approval is left to the cloud reviewer
after it confirms the push resolves all outstanding issues.

## Argument Parsing

Parse `$ARGUMENTS` for:

- First positional argument: PR number (optional, auto-detects from branch)
- `--force-docs` — run full docs pipeline instead of lightweight check
- `--no-push` — commit but don't push
- `--dry-run` — show what would be addressed without making changes
- `--squash` — after committing, squash all review commits into the previous commit

## Step 0: Capture Pre-Review State

Record the current HEAD so the squash step knows how many commits this review
cycle will add:

```bash
PRE_REVIEW_SHA=$(git rev-parse HEAD)
```

Store this value for use in Step 7.5.

## Step 1: Detect PR

### 1.1 Find the PR

If a PR number was provided as an argument, use it directly:

```bash
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat \
  gh pr view $PR_NUMBER --json number,url,title,headRefName
```

If no PR number, auto-detect from the current branch:

```bash
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat \
  gh pr view --json number,url,title,headRefName
```

If no PR exists for the current branch, stop:

> "No PR found for branch [branch-name]. Open a PR first with
> `/design-docs:finalize`, or specify a PR number."

### 1.2 Display PR Info

> "Reviewing PR #N: [title]
> URL: [url]"

## Step 1.5: Pre-Review Cleanup

Clean up stale cloud reviewer output before reading active comments. Old
summary comments from previous pushes clutter the thread and make it harder
to see what is still open. This step runs before triage so the filtered
comment list reflects current state only.

**Skip this entire step only if `GH_AUTH_OK` is `false` (no token and no `gh` keyring auth).**

### 1.5.1 Resolve context

```bash
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-$(GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)}"
CURRENT_SHA=$(git rev-parse HEAD)
SCRIPT="${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/gh-pr-review.sh"
```

### 1.5.2 Detect cloud reviewer bot name

Scan PR issue comments for patterns that match cloud review summaries to
identify the bot's login automatically. Inject the plugin's token at the
call site so a stale shell `GH_TOKEN` cannot win:

```bash
BOT_NAME=$(GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat \
  gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
  --jq '.[] | select(.body | test("# Code Review|<!-- claude-(code-review|review-sticky:)")) | .user.login' \
  2>/dev/null | head -n1)
```

### 1.5.3 Minimize old summaries

If a bot name was found, minimize review summaries from previous pushes that
are now outdated. Pass `DESIGN_DOCS_GH_TOKEN` (not `GH_TOKEN`) so the script
resolves the plugin-scoped token rather than the user's shell token:

```bash
APP_BOT_NAME="$BOT_NAME" DESIGN_DOCS_GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" \
  GITHUB_REPOSITORY="$GITHUB_REPOSITORY" \
  bash "$SCRIPT" minimize-old-summaries "$PR_NUMBER" "$CURRENT_SHA"
```

If no bot name was detected, skip:

> "No cloud reviewer summaries found — nothing to minimize."

## Step 2: Fetch Active Comments

### 2.1 Get All Review Comments

Fetch review comments (inline code comments) and issue comments (general PR
comments). Inject the plugin token and disable the pager on every `gh`
invocation:

```bash
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat \
  gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate
GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" GH_PAGER=cat \
  gh api repos/{owner}/{repo}/issues/{number}/comments --paginate
```

### 2.2 Filter to Active Comments

Remove from the list:

- **Resolved threads**: Comments where the review thread is marked resolved
  (`isResolved: true` on the thread, or the comment is in a resolved
  conversation)
- **Outdated comments**: Comments marked as outdated by GitHub (the diff they
  reference has changed)
- **Hidden/minimized comments**: Comments with `minimized` or hidden state
- **PR author's own comments**: Filter out comments from the PR author
  (these are responses, not review feedback)

### 2.3 Handle No Active Comments

If no active comments remain after filtering:

> "No unresolved review feedback found. The PR is clean."

Stop the workflow.

## Step 3: Triage

### 3.1 Classify Each Comment

For each active comment, first determine its **validity** by reading the
referenced code, then assign a **severity** if it requires a fix.

**Validity (read the code before deciding):**

- **Already fixed**: The concern was valid but the referenced code has already
  been corrected in a prior commit. Confirm by reading the current state of
  the file at the referenced location — if the issue is gone, mark as
  already-fixed. Never mark as already-fixed without checking.
- **Invalid**: The concern is a false positive — factually wrong about the
  current codebase (e.g., flagging a module as private when the build
  pipeline publishes it, misidentifying a pattern that is intentional).
  Confirm by reading the referenced location and understanding the context.
- **Legitimate**: The concern is accurate and the code should be changed.
- **Defer**: Legitimate but too complex for this review cycle.

**Severity (for legitimate comments only):**

- **Critical**: Security issues, bugs, breaking changes. Keywords: "bug",
  "security", "breaking", "crash", "vulnerability", "must fix"
- **High**: Important improvements, missing error handling, test gaps.
  Keywords: "should", "important", "missing", "error handling"
- **Medium**: Code quality, refactoring suggestions, style issues.
  Keywords: "consider", "suggest", "could", "refactor", "nit" (when
  substantive)
- **Low**: Minor style, formatting, optional improvements.
  Keywords: "nit", "optional", "minor", "style"

### 3.2 Present Triage Summary

Group and show all comments by category:

> "Found N active review comments:
>
> Already fixed (N) — will resolve thread:
> \- [file:line] commenter: excerpt...
>
> Invalid (N) — will reply and resolve:
> \- [file:line] commenter: excerpt...
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

If the user says "skip-low", exclude low severity items from the fix list
(already-fixed and invalid still get handled). If "abort", stop.

**In `--dry-run` mode:** Show the triage summary and stop.

## Step 4: Address Comments

Work through all comments. Handle already-fixed and invalid first (no code
changes needed), then legitimate fixes by severity.

### 4.1 Already-Fixed Comments

For each already-fixed comment (requires GitHub auth, i.e. `GH_AUTH_OK`):

1. Confirm one more time by reading the current code
2. Post a reply explaining the current state:
   > "Already addressed — [one sentence describing what the code does now]."
3. Resolve the thread:

   ```bash
   DESIGN_DOCS_GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" \
     GITHUB_REPOSITORY="$GITHUB_REPOSITORY" \
     bash "$SCRIPT" resolve-thread "$COMMENT_ID" "$PR_NUMBER" "$CURRENT_SHA"
   ```

4. Report: `[already-fixed] [file:line] — Resolved: [brief description]`

If `GH_AUTH_OK` is `false`, skip the GitHub call and report that the thread could not be resolved but the issue is confirmed fixed in code.

### 4.2 Invalid Comments

For each invalid comment (requires GitHub auth, i.e. `GH_AUTH_OK`):

1. Read the referenced code and understand what the reviewer misidentified
2. Post a reply explaining why the comment is incorrect and what the code
   actually does:
   > "[Specific explanation of why this is not an issue. E.g.: 'This package
   > is marked `private: true` in source but `publishConfig.access: public`
   > in the build output — the builder transforms this before publishing.']"
3. Resolve the thread:

   ```bash
   DESIGN_DOCS_GH_TOKEN="${DESIGN_DOCS_GH_TOKEN:-}" \
     GITHUB_REPOSITORY="$GITHUB_REPOSITORY" \
     bash "$SCRIPT" resolve-thread "$COMMENT_ID" "$PR_NUMBER" "$CURRENT_SHA"
   ```

4. Report: `[invalid] [file:line] — Replied and resolved: [brief description]`

### 4.3 Legitimate Fixes

Work through legitimate comments by severity (Critical → Low).

For each comment:

1. Read the relevant file and surrounding context
2. Understand what the reviewer is asking for
3. Make the fix
4. **Do NOT call `resolve-thread`.** The push will trigger cloud re-review,
   which will confirm whether the fix is satisfactory. Resolving before
   re-review bypasses that check.
5. For complex issues: offer to create a GitHub issue instead, and skip the
   code change

### 4.4 Deferred Comments

For each deferred comment:

1. Create a GitHub issue with the reviewer's concern and context
2. Reply to the thread with the issue link
3. Do NOT resolve the thread — leave it open for the issue to be tracked

### 4.5 Track Progress

After addressing each comment, report:

> "[category] [file:line] — Fixed: [brief description]"
> "[category] [file:line] — Resolved (already fixed): [current code state]"
> "[category] [file:line] — Resolved (invalid): [why it was a false positive]"
> "[category] [file:line] — Deferred: created issue #N"
> "[category] [file:line] — Skipped: needs manual review"

## Step 5: Verify

After all code changes are made:

### 5.1 Run Tests

```bash
bun run test
```

If tests fail, report which tests failed and stop. The user needs to review
the fixes before continuing.

### 5.2 Run Linting

```bash
bun run lint
```

If lint fails, attempt auto-fix:

```bash
bun run lint:fix
```

### 5.3 Run Type Check

```bash
bun run typecheck
```

If type check fails, report errors and stop.

## Step 6: Doc Check

### 6.1 Lightweight Check (Default)

Scan the files changed in step 4 for architecture-impacting changes:

- New or removed exports
- Modified function signatures or interfaces
- Changed data flows (new dependencies, modified API boundaries)
- New or removed modules/files

If architecture-impacting changes are found, run `design-docs:design-sync` and `design-docs:context-update` for the affected modules only:

```text
/design-docs:design-sync [affected-module]
/design-docs:context-update [affected-file]
```

If only implementation details changed (bug fixes, internal refactors,
style changes), skip the doc update:

> "Changes are implementation-only. No doc updates needed."

### 6.2 Full Pipeline (--force-docs)

If `--force-docs` flag is set, run the full pipeline regardless:

```text
/design-docs:design-sync
/design-docs:design-validate
/design-docs:context-update
/design-docs:context-validate
/design-docs:docs-update
```

## Step 7: Commit

### 7.1 Stage Changes

Stage all modified files. Use `git add` with specific paths based on what
was changed in steps 4–6. Do NOT use `git add -A`.

### 7.2 Generate Commit Message

Generate a conventional commit message. Use `fix:` prefix since this is
addressing review feedback:

```text
fix: address PR review feedback

- [Brief description of each fix made]

Signed-off-by: [from git config]
```

### 7.3 Commit

```bash
git commit -m "<generated message>"
```

## Step 7.5: Squash (--squash only)

**Skip this step if `--squash` was not provided.**

Count the commits this review cycle added since the pre-review HEAD:

```bash
COMMIT_COUNT=$(git rev-list ${PRE_REVIEW_SHA}..HEAD --count)
```

If `COMMIT_COUNT` is 0, nothing to squash — skip. Otherwise, soft-reset back
to the pre-review commit and amend it with all the staged changes:

```bash
git reset --soft HEAD~${COMMIT_COUNT}
git commit --amend --no-edit
```

This folds all review fix commits into the previous commit, keeping the branch
history clean for merge.

## Step 8: Push

**Skip if `--no-push` flag is set.** Report that changes are committed locally.

If `--squash` was used, history was rewritten — force-push is required:

```bash
git push --force-with-lease
```

Otherwise, standard push:

```bash
git push
```

Cloud reviewers will re-review after the push. Legitimate issues that were
fixed in step 4.3 remain open as unresolved threads — the cloud reviewer
will confirm and resolve them when it sees the fix.

## Summary

After completing all steps, report:

> "Review cycle complete:
> \- Summaries minimized: N
> \- Already fixed (resolved): N (list)
> \- Invalid (replied and resolved): N (list)
> \- Fixed: N comments (list)
> \- Deferred: N comments (list with issue links)
> \- Skipped: N comments (list, need manual review)
> \- Docs: [updated/not needed]
> \- Pushed to: [branch] — cloud reviewer will re-review open threads"
