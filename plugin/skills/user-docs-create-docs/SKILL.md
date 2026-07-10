---
description: Scaffold a docs/ folder with README.md (TOC) plus 01-getting-started.md, 02-api-reference.md, and 03-troubleshooting.md as a starter walk-through. Numbered prefixes are the standard. Delegates to user-docs.
disable-model-invocation: true
argument-hint: "[path]"
---

# /design-docs:user-docs-create-docs

Scaffold a `docs/` folder for the package at `$ARGUMENTS` (defaults to current working directory).

## What this does

1. Resolves the target directory.
2. Confirms no `docs/` folder exists at that path. If one exists, asks whether to merge new starter pages or abort.
3. Delegates to `user-docs` to scaffold the starter set.

## Starter set

The default scaffold contains four files:

- `docs/README.md` — TOC plus install recap; pulls TOC from `design-docs:user-docs-build-toc`.
- `docs/01-getting-started.md` — install, import, minimal worked example.
- `docs/02-api-reference.md` — every export with type signatures and short examples.
- `docs/03-troubleshooting.md` — common stumbling blocks with concrete fixes.

The walk-through is numbered. Getting-started is always first. API-reference and troubleshooting are always last in that order. Future topical pages slot between them and the file numbers shift.

## Implementation

Resolve target. If `<target>/docs/` exists, ask:

> A docs/ folder already exists at `<target>/docs/`. Run /design-docs:user-docs-add-page to add new pages, or confirm to overwrite the starter set.

Dispatch agent:

```markdown
Use the Agent tool with subagent_type="user-docs". Prompt:

"Scaffold a docs/ folder for the package at <target>. Create the four starter files: README.md (TOC), 01-getting-started.md, 02-api-reference.md, 03-troubleshooting.md. Each starter page should have an H1, a brief summary of what the page covers, and clearly-marked TODO sections for the maintainer to fill. Use design-docs:user-docs-build-toc to generate the README.md TOC after the other files exist. After writing, also update the package's README.md to add a ## Documentation section (placed before ## License) listing the new pages, using the same TOC builder. Report back with all files written."
```
