---
name: context-split
description: Split large CLAUDE.md into child files. Use when context files exceed word limits, are too verbose, or cover multiple distinct topics that should be separate.
allowed-tools: Read, Write, Edit, Bash(grep *), Bash(wc *)
context: fork
agent: context-doc-agent
---

# CLAUDE.md Context File Splitting

Splits large CLAUDE.md files into smaller, focused child files when they
exceed recommended word limits or cover too many topics.

## Overview

This skill splits CLAUDE.md files by:

1. Analyzing current CLAUDE.md structure
2. Identifying logical split points
3. Creating child CLAUDE.md files for sections
4. Updating parent with references to children
5. Preserving navigation and coherence
6. Validating split files

## Quick Start

**Split with auto-detected strategy:**

```bash
/design-docs:context-split CLAUDE.md
```

**Preview a split without executing:**

```bash
/design-docs:context-split CLAUDE.md --preview
```

**Split by topic instead of section:**

```bash
/design-docs:context-split pkgs/my-package/CLAUDE.md --strategy=topic
```

## Supporting Documentation

When you need detailed information, load the appropriate supporting file:

### For the Full Split Process

See [instructions.md](instructions.md) for:

- The 8-step process (parse parameters, analyze, choose strategy, plan, create children, update parent, validate, report)
- The section/topic/custom strategy comparison table
- Best practices for child file size, content organization, and navigation quality

**Load when:** performing a split or deciding between strategies

### For Usage Examples

See [examples.md](examples.md) for:

- A simple section split, a topic-based split, and a partial custom split

**Load when:** user needs examples or clarification

### For Error Handling

See [error-messages.md](error-messages.md) for:

- File-not-found, already-split, under-limit, and too-small-to-split cases

**Load when:** diagnosing why a split can't proceed

## Integration with Other Skills

Works well with:

- `/design-docs:context-review` - Identify split candidates
- `/design-docs:context-validate` - Validate before and after
- `/design-docs:context-update` - Optimize before splitting
- `/design-docs:design-validate` - Ensure design doc refs work

## Success Criteria

A successful split:

- ✅ All files under word limits
- ✅ Parent provides clear navigation
- ✅ Children are focused and coherent
- ✅ No content duplication
- ✅ Cross-references are valid
- ✅ When-to-load guidance is clear
- ✅ Markdown linting passes for all files
