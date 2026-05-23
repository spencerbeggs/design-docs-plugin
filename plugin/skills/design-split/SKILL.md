---
name: design-split
description: Split an oversized design doc into atomic, cross-referenced pieces. Use when a design doc covers more than one unrelated subsystem or has grown far larger than its peers in the same module.
allowed-tools: Read, Write, Edit, Glob, Bash
context: fork
agent: design-doc-agent
---

# Design Documentation Split

Break one oversized design doc into several atomic docs, each covering a single subsystem or concern, wired together with bidirectional cross-references. The original doc becomes a short overview that links to its children.

## When to Split

Split a doc when it covers **more than one unrelated subsystem**, or when it has grown far larger than its peers in the same module so a first-time reader cannot find the part they need. Size alone is not the trigger — a long doc about one cohesive system stays whole. The `design-docs-style` rules (auto-loaded when you read `.claude/design/**/*.md`) define what "focused" means; this skill is the mechanics once a split is warranted.

Do **not** split when:

- The doc covers a single subsystem, however long.
- Splitting would create stubs with no real content.
- The content cross-cuts every section and has no clean seam.

## Arguments

- `module` (required): the module whose doc is being split.
- `doc` (required): the design doc file to split.
- `--dry-run`: report the proposed split (parent overview + child files + section mapping) without writing anything.

## Workflow

1. **Read the target doc** and its frontmatter. Identify the distinct subsystems — the natural seams. If there is only one cohesive subsystem, report that no split is warranted and stop.
2. **Plan the split:** one child doc per seam. Choose kebab-case filenames derived from the parent (e.g. `caching.md` → `caching-eviction.md`, `caching-warmup.md`). Decide which sections move into each child.
3. **In `--dry-run`, report the plan and stop** — name the parent overview, each child file, and the section-to-child mapping. Write nothing, create nothing.
4. **Create each child doc** with `Write`, carrying valid frontmatter adapted from the parent: `status`, `module`, `category`, `created` (today), `updated` (today), `last-synced` (today), `completeness`. Move the relevant sections, then tighten per `design-docs-style`.
5. **Rewrite the parent into an overview/index:** a short intro plus a list linking to each child with a one-line description. Keep any genuinely cross-cutting context in the parent.
6. **Wire bidirectional links:** in the parent's frontmatter `related` list each child; in each child's frontmatter `related` list the parent and sibling children. Add inline markdown links in both directions.
7. **Validate:** confirm the parent and every child have valid frontmatter, resolvable links, and clean markdown lint. Fix anything that fails before finishing.
8. **Report:** list the parent overview and every child created, with the section mapping, so the orchestrator (or user) can reconcile CLAUDE.md `@`-pointers afterward.

## Scope

`design-split` operates **only within `.claude/design/`**. It does not touch `CLAUDE.md` files — updating `@`-pointers to the new child docs is the context-doc-agent's job, handled after this skill runs. Always report the new file paths so that work can happen.

## Success Criteria

- ✅ Each child doc covers exactly one subsystem and has valid frontmatter.
- ✅ The parent is a concise overview linking to every child.
- ✅ Bidirectional cross-references exist (frontmatter + inline) between parent and children.
- ✅ Every resulting doc validates and lints clean.
- ✅ No content was lost — every section from the original lives in the parent or a child.
- ✅ The report lists all new files for downstream CLAUDE.md reconciliation.
