---
description: Builds a markdown TOC bulleted list from a docs/ folder for use in docs/README.md or a package README's Documentation section. Scans *.md files in numeric-prefix order, reads each file's H1 as the link label and first non-heading paragraph as the description.
user-invocable: false
---

# user-docs-build-toc

Generate a markdown bulleted-list TOC for a `docs/` folder. Used by `/user-docs-create-docs`, `/user-docs-add-page`, `/user-docs-review`, and `/user-docs-create-readme`.

## Inputs

`$ARGUMENTS` is an optional path to a `docs/` folder. If omitted, defaults to `./docs`.

## Behavior

1. Glob `<docs-dir>/*.md` excluding `README.md`. Sort by filename — numeric prefixes (`01-`, `02-`) sort naturally.
2. **If `<docs-dir>/README.md` already exists, parse its TOC bullets first** to capture any user-customized descriptions. A user-customized description is any TOC line of the form `- [Label](./<filename>.md) — <description>` where `<description>` differs from what would be auto-generated from the file's first paragraph. Preserve those descriptions in the new output.
3. For each file in the glob, extract:
   - The H1 (`# ...`) as the link label. **Strip leading emoji** (any non-alphanumeric tokens before the first letter), markdown formatting (`**bold**`, `*italic*`), and trailing punctuation. If no H1, derive a sentence-case label from the filename (strip numeric prefix and `.md`, replace `-` with spaces, capitalize only the first letter).
   - The description, in priority order:
     1. If the existing `docs/README.md` had a user-customized description for this file AND the file's first paragraph has not changed since: keep the customized description.
     2. If the existing description WAS customized but the file's first paragraph has changed: regenerate from the new first paragraph (the page content moved on; the TOC follows).
     3. Else, the first non-heading, non-blank paragraph in the file. Truncate to one sentence (split on `.` and take the first segment, append `.` if missing).
     4. Else, omit the description.
4. Emit a markdown bulleted list with relative links:

   ```markdown
   - [Label](./filename.md) — Description sentence.
   ```

5. If a description is omitted (no source paragraph and no preserved override), drop the trailing em dash too:

   ```markdown
   - [Label](./filename.md)
   ```

## Detecting user customization

A description is treated as user-customized when:

- It does not match the file's current first-paragraph content (after the same one-sentence truncation rule).
- It is non-empty.

When uncertain, prefer to keep the existing description rather than overwrite. The whole point of regenerating the TOC is filename ordering and link correctness, not micromanaging descriptions.

## Output

Output only the bulleted list, no surrounding prose. The caller chooses the heading and placement.

## Example

Given `docs/01-getting-started.md` starting with:

```markdown
# Getting started

Install the package and import it.
```

And `docs/02-api-reference.md` starting with:

```markdown
# API reference

Every export, every option, every field on the public surface.
```

Output:

```markdown
- [Getting started](./01-getting-started.md) — Install the package and import it.
- [API reference](./02-api-reference.md) — Every export, every option, every field on the public surface.
```

## Tools

Use Read and Glob only. No Write, no Edit. Pure projection from existing files (plus any preserved descriptions from an existing `docs/README.md`) to a TOC string.
