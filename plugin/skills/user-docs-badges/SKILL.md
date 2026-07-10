---
description: Generate or normalize the four standard badges at the top of a package README. Detects shape, runtime, license, and TypeScript version automatically. Preserves any custom badges (CI, codecov, downloads, social) by appending them after the standard four. Falls back gracefully when engines or typescript are missing. Delegates to user-docs.
disable-model-invocation: true
argument-hint: "[readme-path]"
---

# /design-docs:user-docs-badges

Generate or normalize the four standard badges at the top of a package README. Defaults to `./README.md`. Custom badges (CI status, codecov, downloads, social, sponsorship) are preserved.

## What this does

1. Reads the target README.
2. Determines if it is a package README (has badges or should have them) or a monorepo root README (no standard badges).
3. Delegates to `user-docs` to invoke `design-docs:user-docs-detect-shape` and `design-docs:user-docs-build-badges`, then surgically replace just the standard badges and preserve any custom ones.

## Standard vs custom badges

The four "standard" badges are identified by URL substring:

| Badge | URL pattern |
| ----- | ----------- |
| npm | contains `/npm/v/` |
| License | contains `/badge/License-` |
| Runtime | contains `/badge/Node.js-`, `/badge/Bun-`, or `/badge/Deno-` |
| TypeScript | contains `/badge/TypeScript-` |

Anything else in the badge block is a custom badge: build/CI status, codecov, npm downloads, bundle size, social, sponsorship. Custom badges are preserved across normalizations.

Final order: standard 4 first (in their canonical order), custom badges after.

## Implementation

Resolve `$ARGUMENTS` to a path; default to `./README.md`. Dispatch agent:

```markdown
Use the Agent tool with subagent_type="user-docs". Prompt:

"Normalize badges in <readme-path>. Steps:

1. Invoke design-docs:user-docs-detect-shape to classify the repo and read package metadata.
2. If kind is 'monorepo-root': remove only the standard badges (npm, License, Runtime, TypeScript) and report 'monorepo root README — standard badges removed (developer-facing hub); any custom badges preserved'. Stop.
3. Otherwise: invoke design-docs:user-docs-build-badges with the detected metadata to produce the standard block. If engines is missing, omit the runtime badge. If no typescript dependency is found, omit the TypeScript badge.
4. Locate the existing badge block in the README (the run of consecutive lines at the top, after any H1, where every line is a markdown image-link of the form [![...](https://...)](...)).
5. Classify each existing badge by URL pattern: standard or custom. Standard badges get replaced by the freshly-built ones (matched by category). Custom badges are kept as-is.
6. Final block layout: standard 4 first in canonical order (npm, License, Runtime, TypeScript), then any custom badges in the order they appeared previously.
7. Write the new block. If no block existed, insert the standard 4 immediately after the H1.
8. Report back with:
   - the package name detected
   - which standard badges were emitted (and which were skipped due to missing metadata)
   - which custom badges were preserved (list URLs or alt-text)
   - a diff summary of what changed"
```

## Pre-flight checks

- Target file must exist. If not, abort with: "README not found at `<path>`."
- Target must have an H1 in the first 5 lines. If not, ask whether to add a default H1 first.
