---
name: user-docs-style
description: Auto-loads user-facing documentation style rules when README.md, docs/**/*.md, CONTRIBUTING.md or SECURITY.md files are read. Enforces badge standards, prose mechanics, heading case, code example format and AI-tell avoidance.
user-invocable: false
paths:
  - "**/README.md"
  - "**/docs/**/*.md"
  - "!**/docs/superpowers/**"
  - "!**/.claude/**"
  - "**/CONTRIBUTING.md"
  - "**/SECURITY.md"
---

# User-Facing Documentation Style

These guidelines apply to user-facing documentation in repos that publish public packages to npm: package READMEs, monorepo root READMEs, `docs/` folders, `CONTRIBUTING.md`, and `SECURITY.md`.

## Audience

These docs are read by first-time viewers on npm or GitHub. Describe what the package does now. Do not reference internal design documents, refactor history, prior implementations, branch state, or commit-flow context. That information lives in `.claude/design/` and design docs, not user-facing docs.

## Markdown dialect

Strict GitHub-flavored markdown. Allowed advanced features:

- Tables
- Collapsed sections via `<details><summary>...</summary>...</details>`
- Fenced code blocks (always with a language identifier)
- Mermaid diagrams (fenced code blocks with `mermaid` as the language identifier)

Allowed HTML elements: `br`, `details`, `summary`, `img`, `sup`, `sub`. No other raw HTML.

## Prose mechanics

- **No artificial line-breaks** inside paragraphs or list items. Wrap at natural prose boundaries and let the renderer flow.
- **No Oxford commas.** Write `A, B and C`, not `A, B, and C`.
- **Em dashes are encouraged** for parenthetical asides — they read more naturally than commas in long sentences.
- **Sentence case** for headings. No title case, no all-caps section titles.

### Line-breaks: WRONG vs RIGHT

A paragraph in markdown source must be on a single line. The renderer wraps it.

WRONG:

```markdown
This is a paragraph.
It continues on the next line.
A third line for good measure.
```

RIGHT:

```markdown
This is a paragraph. It continues seamlessly into the next sentence. A third sentence for good measure.
```

The same applies to list items. Continuation lines under a bullet are a frequent offender.

WRONG:

```markdown
- This is a bullet item
  that wraps onto a second source line
  because the agent thought it was being tidy.
```

RIGHT:

```markdown
- This is a bullet item that stays on a single source line; the renderer handles wrapping.
```

### Heading case: WRONG vs RIGHT

**Sentence case** means: the first word is capitalized, every subsequent word is lowercase, EXCEPT acronyms and proper nouns which keep their case.

- **Acronym** = an entirely uppercase token of 2–5 letters that names a thing (`CLI`, `XDG`, `API`, `URL`, `OSC8`). `Reference` is not an acronym.
- **Proper noun** = the name of a specific product, person, or place (`TypeScript`, `GitHub`, `Effect`, `Node.js`, `MIT`). Common words are never proper nouns regardless of context — `Reference`, `Start`, `Guide`, `Documentation`, `Installation` are all common.

WRONG: `## API Reference`, `## Getting Started`, `## Quick Start`, `## At A Glance`

RIGHT: `## API reference`, `## Getting started`, `## Quick start`, `## At a glance`

Acronyms keep their case: `## CLI flags`, `## XDG paths`. Proper nouns keep their case: `## TypeScript support`, `## Effect concepts`.

### Canonical section names

Use these exact section names and headings rather than synonyms or variants:

- `## Install` (not `Installation`)
- `## Quick start` (not `Quick example`, `30-second quick start`, `Getting started`)
- `## Features` (not `At a glance`, `Capabilities`, `Highlights`)
- `## Documentation` (when listing topical docs/ pages)
- `## License` (always last)

The agent and review skills enforce these names so cross-repo READMEs scan identically.

## Avoid AI tells

When writing prose, avoid these patterns that mark text as AI-generated:

- Promotional or breathless phrasing (`breathtaking`, `nestled`, `pivotal moment`, `testament to`)
- Inflated significance (`revolutionary`, `game-changing`)
- Banned tagline adjectives (the most common LLM filler in opening sentences): `ultimate`, `modern`, `ergonomic`, `powerful`, `flexible`, `simple`, `elegant`, `lightweight`, `blazing-fast`, `robust`, `seamless`. Describe what the package *does* and what it *outputs*, not how it feels.
- `-ing` analyses (`emphasizing how X`, `showcasing the power of Y`)
- Filler (`in order to`, `at this point in time`, `it is worth noting that`)
- Elegant variation (cycling through synonyms instead of repeating a word)
- Knowledge-cutoff disclaimers (`As of my last update...`)
- Sycophantic chatbot pleasantries (`I hope this helps!`)
- False ranges (`between basic and advanced`) and rule-of-three forcing
- Copula avoidance (`serves as` instead of `is`)
- **Em dash overuse.** Em dashes are encouraged but cap at one per paragraph and aim for no more than two per page. "Encouraged" means available, not preferred — overuse is the most reliable AI tell of all.

For a deeper rewrite pass, run `/design-docs:user-docs-humanize`.

## Package-manager style for installs

Always show npm and npx in install commands, regardless of what the repo itself uses. Add one alternative line for pnpm or yarn or bun if relevant. Exception: when demonstrating package-manager-specific behavior (e.g. `pnpm dlx`).

```bash
npm install <pkg>
# or
pnpm add <pkg>
```

## Badge standard

Each package README has exactly four standard badges, in this order, with these brand colors:

1. **npm package** — `cb3837` (npm red)
   `https://img.shields.io/npm/v/<pkg>?label=npm&color=cb3837`
2. **License** — `4caf50` (green) for permissive licenses (MIT, Apache-2.0, BSD); match SPDX ID
   `https://img.shields.io/badge/License-MIT-4caf50.svg`
3. **Runtime** — based on `engines` field in `package.json`:
   - Node: `5fa04e` (Node green)
   - Bun: `f9f1e1` with dark text (`?labelColor=...&color=f9f1e1`)
   - Deno: `000000` with white text
   - If `engines` is missing, omit this badge rather than guess.
4. **TypeScript** — `3178c6` (TS brand blue), version from the `typescript` dev dep range
   - If no `typescript` dependency is found, omit this badge.

### Custom badges

The four standard badges are the *required minimum*. If a repo has additional custom badges (CI status, codecov, downloads, social, sponsorship), they are preserved. Order: standard 4 first, custom badges after.

When normalizing or rewriting badges, identify the standard badges by URL pattern and only replace those:

- npm: URL contains `/npm/v/`
- License: URL contains `/badge/License-`
- Runtime: URL contains `/badge/Node.js-`, `/badge/Bun-`, or `/badge/Deno-`
- TypeScript: URL contains `/badge/TypeScript-`

Anything else is a custom badge and stays put.

Multi-package monorepo root READMEs have zero standard badges — they are developer-facing hubs, not npm-facing. Custom badges (e.g. CI status for the repo as a whole) are still allowed there.

## Documentation list pattern

When a package's `docs/` folder contains any topical page beyond the `docs/README.md` TOC itself, the package README's `## Documentation` section MUST list each page as a bulleted item with a terse one-line description, not as a single `see docs` link.

A page counts as **topical** only if it contains at least one section of substantive content beyond TODO placeholders or empty stubs. Freshly-scaffolded pages with only an H1 and a `<!-- TODO -->` comment are NOT topical and are excluded from the README's `## Documentation` list until the maintainer fills them.

When `docs/` does not exist, contains only `README.md`, or contains only TODO-stub pages, omit the `## Documentation` section from the package README.

## File naming in `docs/`

Pages inside a `docs/` folder MUST use the format `{NN}-{slug}.md` where `NN` is a two-digit zero-padded number and `slug` is kebab-case. Examples: `01-getting-started.md`, `02-api-reference.md`, `09-troubleshooting.md`.

Files without a numeric prefix (e.g. `getting-started.md` or `api.md`) MUST be renamed to conform. Numbering establishes the walk-through reading order: getting-started is always first; api-reference and troubleshooting are always last in that order; topical pages slot between them and the numbers shift accordingly.

Exceptions: `docs/README.md` (the TOC) does not take a numeric prefix.

## Code examples

When a code example logs a value, prints output, or runs a CLI command that produces output, the expected output MUST be shown as a comment immediately after the producing line(s). The comment language matches the code-fence language (`//` for JS/TS, `#` for shell).

Without expected output, examples leave the reader guessing whether they ran it correctly.

WRONG:

````markdown
```ts
console.log(link("docs", "https://example.com"));
```
````

RIGHT:

````markdown
```ts
console.log(link("docs", "https://example.com"));
// In a supporting terminal: clickable hyperlink "docs"
// Elsewhere:                 docs (https://example.com)
```
````

WRONG:

````markdown
```bash
reposets validate
```
````

RIGHT:

````markdown
```bash
reposets validate
# ✓ config valid (3 groups, 12 repos, 8 secrets)
```
````

For longer or multi-line outputs, show enough to demonstrate the result without burying the user. If truncating, truncate from the **middle** with `# ...`, not the end — the most informative line of CLI output is often the last line (a warning, error, or summary). Never end-truncate.

### Never fabricate output

If the output cannot be verified by reading source or running the command, **do not invent specific numbers, paths, IDs, or messages**. Use a generic placeholder comment like `# example output (varies by environment)` or `// returns the resolved value`. Fabricated outputs (`# ✓ config valid (3 groups, 12 repos, 8 secrets)`) are worse than no output because users will quote them in bug reports when their actual output differs.

## Versions in prose

Do NOT write specific version numbers in docs unless the content is explicitly about migration between major versions (`v1` to `v2`, `0.x` to `1.0`). The npm badge and `package.json` are the source of truth for the current version; pinning version numbers in prose creates documentation that goes stale every release and is painful to maintain.

WRONG: `Current version: 0.2.0`, `As of v3.4.1, the cache is on by default`, `Requires effect ^3.21.0`.

RIGHT: `Current version is shown in the npm badge above`, `Recent versions enable the cache by default`, `effect is a peer dependency`. For migration docs (`docs/0X-migrating.md`), version numbers are appropriate because the document IS about a specific version transition.

## Shape detection

To classify a repo:

| Signal | Inference |
| ------ | --------- |
| Root `package.json` has `workspaces` | Monorepo |
| `pnpm-workspace.yaml` exists | Monorepo |
| `packages/` directory contains sub-package.jsons | Monorepo |
| None of the above | Single package |

The root README is npm-facing in single-package repos and developer-facing in monorepos. Sub-package READMEs in monorepos are always npm-facing.

## Skills for these tasks

- `/design-docs:user-docs-create-readme` — bootstrap a README from scratch
- `/design-docs:user-docs-create-docs` — scaffold a `docs/` folder
- `/design-docs:user-docs-add-page` — add a new page to existing `docs/`
- `/design-docs:user-docs-review` — review existing docs against this rule
- `/design-docs:user-docs-badges` — generate or normalize the 4-badge block
- `/design-docs:user-docs-humanize` — deep prose-rewrite pass
