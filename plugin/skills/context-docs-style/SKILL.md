---
name: context-docs-style
description: Style rules for LLM context files (CLAUDE.md, AGENTS.md and their .local variants). Fires automatically when these files are opened. Enforces on-demand loading patterns, proper @-reference syntax and lean context structure.
user-invocable: false
paths:
  - "**/CLAUDE.md"
  - "**/CLAUDE.local.md"
  - "**/AGENTS.md"
  - "**/AGENTS.local.md"
---

# Context file style rules

## Purpose of context files

CLAUDE.md and AGENTS.md files orient an agent at session start. They describe commands, conventions and where to find deeper documentation — not the deep documentation itself. Every token loaded unconditionally costs the same whether or not the agent needs it this session. Keep these files lean.

## @-reference syntax

Always write file references in backtick-code format:

- Correct: `@.claude/design/auth/overview.md`
- Wrong: @.claude/design/auth/overview.md (bare, not in backtick code)

This applies to both prose and Load when directives in the file.

## Load on demand, not by default

Prefer conditional Load when references over unconditional imports. An agent working on a bug fix does not need the full architecture loaded — it needs to know that the architecture doc exists and when to reach for it.

Wrong pattern — force-loading a large file unconditionally:

```markdown
@.claude/design/my-module/architecture.md
```

Right pattern — directing the agent to load it when relevant:

```markdown
Architecture → `@.claude/design/my-module/architecture.md`
Load when: modifying the data layer or adding new service boundaries.
```

## Avoid large embedded architecture sections

Do not copy architecture descriptions, data-flow diagrams or module inventories into the context file itself. These belong in design docs. The context file's job is to say where that information lives, not to reproduce it.

A context file that exceeds ~1000 words for the root or ~500 words for a package is almost always embedding content that should live in a design doc instead.

## No artificial line breaks

Each paragraph and each list item occupies a single source line. The renderer handles wrapping. Do not insert hard line breaks inside a sentence or bullet point. If you encounter a pre-existing violation of this rule, you MUST fix it when you edit the file for other reasons, but do not add new violations.

Wrong:

```markdown
This is a paragraph that has an artificial line break in the 
middle of a sentence, which is against the style rules.
- This is a bullet item
  that continues on a second source line.
```

Right:

```markdown
This paragraph occupies a single source line, with no artificial breaks. The renderer wraps it appropriately.
- This is a bullet item that stays on a single source line.
```
