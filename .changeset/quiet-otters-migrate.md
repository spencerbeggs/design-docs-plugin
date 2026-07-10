---
"design-docs": minor
---

## Features

### `quality.context.hardWrap` config option

Repos with an entrenched hard-wrapped `CLAUDE.md` convention can opt out of the single-line-per-paragraph rule. `context-docs-style` then enforces per-file consistency instead of flagging the wrapping. Defaults to `forbid`.

```json
{
	"quality": {
		"context": {
			"hardWrap": "allow"
		}
	}
}
```

`quality.context.requirePointerHashes` was also added to the published config schema, controlling whether `context-validate`/`context-audit` treat a design-doc pointer with no recorded content hash in `refs.json` as a warning.

### Published JSON Schemas

`design-docs.schema.json` (the `design.config.json` contract) and `plan-frontmatter.schema.json` (the plan frontmatter contract) are now published at the repository root with stable `raw.githubusercontent.com` URLs, so editors can validate and autocomplete plugin config files in consuming repos:

```json
{
	"$schema": "https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json"
}
```

## Bug Fixes

* `design-link` discovers design docs in module subdirectories -- `packages/*.md` docs were previously invisible, so every link to them was falsely reported broken -- and its anchor slugger now matches GitHub's algorithm exactly, preserving consecutive hyphens (closes #58)
* Skill docs reference shipped scripts and templates via `${CLAUDE_PLUGIN_ROOT}` instead of nonexistent repo-local `.claude/skills/` paths, so the `design-validate` script and the `design-init`/`docs-generate` templates resolve correctly in consuming repos (closes half of #59)
* All shipped bash scripts now run on stock macOS `/bin/bash` 3.2: `plan-explore`'s `explore-plans.sh` no longer relies on `mapfile`/associative arrays -- which previously crashed outright without Homebrew bash, and also crashed on any plan missing an optional frontmatter field -- and works without `jq`; the `design-audit` workflow scripts received the same fix. A portability test guards against regressions.
* `refs-record.sh` resolves the repo root via `DESIGN_DOCS_PROJECT_DIR`/`CLAUDE_PROJECT_DIR` instead of bare `pwd`, so pointer recording works from any working directory
* Removed stale cross-references to nonexistent `plan-update`/`design-list` skills and the `/rspress-page` command; `plan-*` skill references are now namespace-qualified
