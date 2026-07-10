---
"design-docs": patch
---

## Bug Fixes

* GitHub auth no longer requires an env token: `review`, `finalize`, `merge-prep` and `gh-pr-review.sh` now resolve credentials as `DESIGN_DOCS_GH_TOKEN` -> `GH_TOKEN` -> `GITHUB_TOKEN` -> `gh` keyring (`gh auth login`), scrubbing stale env tokens at each call site. Previously the script hard-errored and agents falsely reported "DESIGN_DOCS_GH_TOKEN is not set" even when the user was already logged in via `gh`.
* All skill, slash-command and agent references across the plugin are namespace-qualified (`design-docs:<name>` / `/design-docs:<name>`), fixing "Unknown skill" errors triggered when agents followed their own in-body instructions.
* Fixed references to two nonexistent skills (`/plan-update`, `/design-list`) and a stale path in `design-link`'s `SKILL.md`.
* `design-validate`: recommended-section warnings now derive from `design.config.json`'s `minSections` instead of a hardcoded list; heading matching is case-insensitive so sentence-case headings pass; the draft-completeness band widened to 21-90% with a pre-implementation carve-out that was producing false "promote to current" suggestions; added a new warning for hard-wrapped prose.
* `design-link`: validates `#heading` anchor links against GitHub's slug rules, including cross-file anchors and duplicate-heading suffixes; `brokenAnchors` added to the JSON output.
* `design-doc-agent`, `context-doc-agent` and `user-docs` agents declare `SendMessage` so orchestrators can reclaim them via `shutdown_request`.

## Documentation

* README: documented the GitHub auth resolution order and the optional `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable; corrected skill counts (48 -> 50 total, `design-*` 16 -> 18).
* CONTRIBUTING: corrected the minimum Bun version prerequisite.
