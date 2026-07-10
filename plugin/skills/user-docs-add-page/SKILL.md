---
description: Add a single new topical page to an existing docs/ folder, slot it into the numbered walk-through, and update docs/README.md TOC. Does not touch cross-doc next-page nav links inside other pages. Delegates to user-docs.
disable-model-invocation: true
argument-hint: "<page-name> [topic-hint]"
---

# /design-docs:user-docs-add-page

Add a new topical page to `./docs/`. The first argument is the page slug (e.g. `comparison`). Remaining arguments form an optional topic hint that goes into the page's draft.

## What this does

1. Verifies `./docs/` exists and contains the standard starter pages.
2. Determines the new page's numeric prefix:
   - Find all existing `NN-*.md` files except `README.md`.
   - The new page slots between the last topical page and `02-api-reference.md`. Equivalently: it gets the number of `02-api-reference.md`, and `02-api-reference.md` and `03-troubleshooting.md` shift up by one.
   - If api-reference and troubleshooting are not the last two pages (custom layout), insert at the next available number before whichever page is last.
3. Renames downstream files as needed.
4. Drafts the new page using the topic hint.
5. Regenerates `docs/README.md` TOC via `design-docs:user-docs-build-toc`.

## Important

This skill ONLY touches `docs/README.md`. It does NOT update intra-doc next-page links (e.g. `[Next: Foo]` at the bottom of pages) or "What's Next" lists embedded in other pages. Those are too project-specific to automate reliably. The user updates them by hand or via `/design-docs:user-docs-review`.

## Implementation

Parse `$ARGUMENTS`:

- `$1` = page slug (required, kebab-case)
- `$2..$N` = topic hint (optional)

Dispatch agent:

```markdown
Use the Agent tool with subagent_type="user-docs". Prompt:

"Add a new docs page named '<slug>' to ./docs/. Topic hint: '<hint or empty>'.

Determine the next file's numeric prefix by scanning existing docs/NN-*.md files, slotting the new page before api-reference and troubleshooting per the walk-through ordering rule. Rename downstream files if needed (and use git mv if the project is git-tracked). Draft the new page with an H1 (sentence-case label derived from the slug), a one-paragraph summary, and clearly-marked TODO sections.

After writing, regenerate docs/README.md TOC using design-docs:user-docs-build-toc.

Do NOT edit cross-doc next-page links or 'What's Next' lists inside other docs files.

Report back with: files written, files renamed (if any), and the updated TOC."
```
