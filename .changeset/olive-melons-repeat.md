---
"design-docs": minor
---

## Features

`design-link` now checks links that resolve outside the design tree. Its broken-reference check previously only fired for targets landing inside `.claude/design/`, and it only ever extracted links to `.md` files — so dead links to source files, READMEs and configs were invisible. Whether a dead link was caught depended solely on where its path happened to land. This mattered most for the docs that follow the style guide, since the guide tells authors to point at real source paths. Every relative link is now existence-checked wherever it resolves, broken references report the source line, and repeated occurrences are each reported instead of collapsing into one. The `--format=json` output gained a `line` field on broken references.

## Bug Fixes

`design-validate` now recurses into module subdirectories. It previously iterated a flat glob, so docs nested under a module (`<module>/packages/*.md`) were never validated and never reported as skipped — a partial run was indistinguishable from a complete one. On a 22-document corpus it had been validating 7. `_archive/` is still pruned.

The `dependencies` frontmatter field is now optional. It was in the validator's required set but in nothing else, so every doc not scaffolded from a template failed with an error no author could act on. A permanently red validator teaches readers to skip its genuine findings too. Templates still scaffold the field — declaring dependencies is worth doing, a doc is just not invalid without it.

`design-validate` no longer aborts partway through a run. A design doc with no frontmatter made it exit mid-report, silently skipping every doc sorted after it while still returning a failing status.

## Documentation

`design-validate`'s `frontmatter-rules.md` records `dependencies` as optional, and `design-link`'s `SKILL.md` documents the broadened broken-reference check and the line numbers in its report.
