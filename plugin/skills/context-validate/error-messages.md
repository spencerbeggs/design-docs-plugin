# Error Messages

## Missing Required Section

```text
ERROR: Missing required section: {section}
- Expected: ## {section}
- File type: {Root|Package}
- Fix: Add section following CLAUDE.md template
```

## Word Limit Exceeded

```text
WARNING: File exceeds word limit
- Limit: {limit} words
- Actual: {actual} words
- Overage: {actual - limit} words
- Fix: Split into child CLAUDE.md files or remove redundant content
```

## Broken Design Doc Reference

```text
ERROR: Referenced design doc does not exist
- Reference: @./.claude/design/{path}
- Fix: Create the design doc or fix the reference path
```

## Pointer May Be Stale

```text
WARNING: Pointer may be stale (content drift)
- Reference: @./.claude/design/{path}
- Recorded hash: {short-recorded} (when the pointer's guidance was written)
- Current hash:  {short-current} (target doc body now)
- Meaning: the link resolves, but the doc's content changed since the
  pointer was recorded — the "Load when" guidance may no longer match.
- Fix: re-verify the pointer's "Load when" line against the current doc,
  then re-record the hash in .claude/design/refs.json (the design-docs:context-doc-agent
  does this when it confirms the pointer).
```

## Missing Design Doc Pointer

```text
WARNING: Design doc exists but not referenced in CLAUDE.md
- Design doc: .claude/design/{module}/{doc}.md
- Category: {category}
- Fix: Add reference in relevant section with when-to-load guidance
```

## Invalid Heading Hierarchy

```text
ERROR: Heading level skipped
- Line: {line}
- Found: H3
- Expected: H2 (after H1)
- Fix: Use proper heading progression (H1 → H2 → H3)
```

## Verbose Content

```text
WARNING: Section is verbose
- Section: {section}
- Word count: {count}
- Recommended: <{limit}
- Fix: Make content more concise and imperative
```
