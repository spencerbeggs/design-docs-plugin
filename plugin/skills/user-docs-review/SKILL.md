---
description: Review existing user-facing docs against the user-docs style rule. Reports issues by file with line numbers, then offers to fix in place. Catches badge mistakes (wrong package name, wrong colors, custom badges clobbered), Oxford commas, artificial line-breaks in paragraphs and list items, title-case headings, missing code-fence languages, code examples without expected output, internal-design references, package-manager inconsistencies, filename-format violations in docs/, and AI tells.
disable-model-invocation: true
argument-hint: "[path]"
---

# /user-docs-review

Review user-facing docs at `$ARGUMENTS` (defaults to `README.md` and `docs/` in the current directory).

## What this does

1. Resolves targets:
   - If `$ARGUMENTS` is a file, just that file.
   - If `$ARGUMENTS` is a directory, the `README.md` plus every file in `docs/`.
   - If `$ARGUMENTS` is empty, the current directory's `README.md` plus `docs/`.
2. **Filters to git-tracked files only.** Run `git ls-files <target>` to get the tracked set; skip anything not in that list. Untracked or gitignored files (e.g. `docs/superpowers/`, work-in-progress drafts) are NOT user-facing and must not be reviewed.
3. Delegates to `user-docs` with a review-specific directive.

## What the review checks

- **Badge correctness:** package name in npm badge URL matches `package.json` name. The four standard badges use the brand-color palette. Custom badges (CI, codecov, downloads, etc.) are preserved at the end of the badge block, not clobbered. Multi-package monorepo root READMEs have zero standard badges.
- **Markdown:** GFM compliance, no disallowed HTML, every code fence has a language identifier.
- **Heading case:** every heading is sentence-case (`## API reference`, not `## API Reference`). Acronyms and proper nouns keep their case.
- **Hard line-breaks:** paragraphs and list items each occupy a single source line. Continuation lines under bullets (`- foo\n  bar`) are flagged.
- **Filename format:** every file in `docs/` (other than `README.md`) follows `{NN}-{slug}.md` — two-digit zero-padded number, kebab-case slug. Files like `getting-started.md` (no number) are flagged for renaming.
- **Code examples:** every example that logs a value or runs a CLI command shows the expected output as comments on the lines after the producing line (`// ...` for JS/TS, `# ...` for shell). Bare examples without expected output are flagged.
- **Prose mechanics:** no Oxford commas, no artificial line-breaks.
- **AI tells:** the patterns listed in the rule's "Avoid AI tells" section.
- **Package-manager style:** install commands lead with npm/npx.
- **Internal references:** no mentions of design docs, refactor history, branch state, prior implementations, or commit-flow context. When auto-fixing, REWRITE to describe current behavior — do NOT delete the prose unless its only content is historical. Embedded technical facts must survive.
- **Version pins:** no specific version numbers in prose (e.g. `Current version: 0.2.0`, `As of v3.4.1`, `Requires effect ^3.21.0`). Exception: explicit migration documents (e.g. `docs/0X-migrating.md`). Flag any version-string match outside those.
- **Documentation list:** if `docs/` has topical pages, the package README has a `## Documentation` section listing them as bullets, not a single `see docs` link.

## Implementation

Resolve targets. Dispatch agent:

```markdown
Use the Agent tool with subagent_type="user-docs". Prompt:

"Review user-facing docs at <targets>. For each file, report issues by line number under these categories:

- Badges (correctness, brand colors, custom-badge preservation)
- Markdown (GFM compliance, code-fence languages)
- Heading case
- Hard line-breaks
- Filename format (docs/ only)
- Code examples (expected-output comments)
- Prose mechanics (Oxford commas, em-dash usage)
- AI tells
- Package-manager style
- Internal references
- Documentation list pattern

After reporting, ask: 'Apply fixes in place?'

If the user agrees, apply ONLY the mechanical issues:
- Wrong package name in npm badge URL
- Brand-color drift in standard badges
- Custom badges that were displaced (re-append at end of block)
- Missing language tags on code fences
- Title-case headings (rewrite to sentence-case, preserving acronyms and proper nouns)
- Hard line-breaks in paragraphs and list items (join onto a single source line)
- Filename violations in docs/ (use git mv if git-tracked; update internal links)
- Missing expected-output comments after console.log/CLI invocations (add a brief one-line comment if you can plausibly infer the output, otherwise flag for the user to fill)
- Oxford commas (rewrite without)
- Package-manager inconsistencies (rewrite to npm-first)
- Internal-design references (remove)

Do NOT auto-rewrite prose for AI tells; flag them and recommend /design-docs:user-docs-humanize for the file.

Report back with: files reviewed, issues found per category, files modified, files renamed (if any)."
```

## Pre-flight checks

- At least one of the resolved targets must exist. If none exist, abort with a clear message.
