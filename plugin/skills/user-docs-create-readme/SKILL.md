---
description: Bootstrap a README from scratch for the current repo. Auto-detects single-package, monorepo root, or sub-package and produces the right shape. Delegates to user-docs.
disable-model-invocation: true
argument-hint: "[path]"
---

# /design-docs:user-docs-create-readme

Bootstrap a README for the repo or package at `$ARGUMENTS` (defaults to current working directory).

## What this does

1. Resolves the target directory.
2. Confirms there is no existing `README.md` at that path. If one exists, asks whether to overwrite.
3. Delegates to the `design-docs:user-docs` agent with a clear directive.

## Implementation

Resolve the target path — `$ARGUMENTS` if non-empty, otherwise `.`. Check whether `<target>/README.md` exists.

If it exists, ask:

> A README.md already exists at `<target>/README.md`. Overwrite it, or run `/design-docs:user-docs-review` to refactor instead?

If the user confirms overwrite, or if no README exists, dispatch the agent:

```markdown
Use the Agent tool with subagent_type="user-docs". Prompt:

"Bootstrap a README for the repo at <target>. Detect the shape (single-package, monorepo root, or sub-package), invoke design-docs:user-docs-build-badges for the badge block (skip badges if monorepo root), and produce the appropriate README skeleton filled with real content drawn from the codebase. After detection, list the files you intend to write, write them, then report back with the path and a one-paragraph summary of structural choices you made."
```

## Pre-flight checks

- The target directory must contain a `package.json`. If not, abort with: "No package.json found at `<target>`. /design-docs:user-docs-create-readme requires a package to bootstrap docs for."
