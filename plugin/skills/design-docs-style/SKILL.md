---
name: design-docs-style
description: Auto-loads design documentation style rules when .claude/design/**/*.md files are read. Enforces focused, boundary-level documentation over exhaustive code re-documentation.
user-invocable: false
paths:
  - "**/.claude/design/**/*.md"
---

# Design doc style

These guidelines apply to files in `.claude/design/`. Design docs are read by agents working on implementation tasks — they provide context about key patterns, load-bearing interfaces, architectural decisions and the relationships between systems.

## Purpose of design docs

Design docs record *why* things are structured the way they are and *which* parts are load-bearing. They are not exhaustive code documentation. Code is authoritative about its own shape — design docs are authoritative about intent, decisions and topology.

A design doc that fits in one screenful is better than one that requires scrolling. Agents are good at exploring code; design docs should tell them where to look and what matters, not re-describe what they can read for themselves.

## What to document

**Document:** Key architectural decisions and their rationale. Cardinal types and interfaces that are load-bearing across many files. Data flow topology — which systems delegate to which, what crosses each boundary. Tradeoffs and constraints that are not obvious from reading the code.

**Do not document:** Exact method counts, test counts or error type enumerations. Internal implementation details of individual modules. Anything that is easy to discover with grep or by reading the source file.

## Data flow documentation

Document delegation chains and system boundaries at the topology level. "The DataLayer delegates to the DataReader, which resolves from cache or network" is worth writing down — agents lose track of this topology. How the DataReader internally resolves its value is not worth documenting — that is discoverable by reading the file.

**Document:** which component calls which, what data crosses each boundary, which interfaces must stay stable.

**Do not document:** the internal mechanics of how a component does its work.

## Point, don't re-document

Use file paths to direct agents to source locations rather than restating what code does. Prefer:

> See `src/services/DataReader.ts` for the full resolution logic.

Over rewriting the module's behavior in prose. The second form creates a second source of truth that drifts with every code change.

## Skip counts and enumerations

"There are 7 error types" is stale before the next commit. Write "see the `DataError` tagged union in `src/errors.ts`" instead. Exact method counts, parameter lists and error enumerations belong in code, not design docs.

Exception: cardinal types whose shapes must stay stable across many files. If a type shape is a genuine constraint agents must know before editing, document it. If it is just a snapshot of what the code currently looks like, leave it out.

## Prose mechanics

- **No artificial line-breaks** Each paragraph and list item occupies a single source line; the renderer wraps it.
- **Sentence case** for headings. First word capitalized, rest lowercase, except acronyms (`API`, `CLI`) and proper nouns (`TypeScript`, `Effect`).
- **No Oxford commas.** Write `A, B and C`, not `A, B, and C`.
