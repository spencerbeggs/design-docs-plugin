---
description: Run a deep humanizer-style rewrite on a docs file. Identifies AI tells (promotional phrasing, filler, -ing analyses, elegant variation, copula avoidance), then rewrites passages to sound natural while preserving meaning and technical accuracy. Reads bundled humanizer-pairs.md for before/after exemplars. Em dashes are preserved (project style override).
disable-model-invocation: false
argument-hint: "<file-path>"
---

# /user-docs-humanize

Deep humanizer-style rewrite of a docs file. The rewrite preserves meaning and technical accuracy; it changes voice and rhythm to read more like a human-written document.

## What this does

1. Reads the target file.
2. Reads `humanizer-pairs.md` (in the same directory as this SKILL.md) for before/after exemplars.
3. Delegates to `user-docs` with a humanizer-specific directive.

## Project style overrides

The general humanizer guide discourages em dashes. This project's style ALLOWS and ENCOURAGES em dashes for parenthetical asides. Do not flag or rewrite em dashes.

## Implementation

Require `$ARGUMENTS` to be a path to an existing file. If empty or not-found, abort with a clear message.

Dispatch agent:

```markdown
Use the Agent tool with subagent_type="user-docs". Prompt:

"Humanize the prose in <file-path>. Read humanizer-pairs.md from this skill's directory for before/after exemplars.

Process:
1. First pass — identify every AI tell in the file. List them grouped by category: promotional phrasing, inflated significance, -ing analyses, filler, elegant variation, copula avoidance, knowledge-cutoff disclaimers, sycophantic chatbot pleasantries, false ranges, rule-of-three forcing.
2. Second pass — rewrite each flagged passage to be more direct, more specific, and varied in rhythm. Preserve technical accuracy and any code blocks unchanged.
3. Third pass — re-read and ask: 'What still reads as AI-generated?' Revise remaining tells.

Project overrides: em dashes are allowed and encouraged. Do not remove them.

Report back with: count of tells found per category, summary of voice changes, and the path to the rewritten file."
```
