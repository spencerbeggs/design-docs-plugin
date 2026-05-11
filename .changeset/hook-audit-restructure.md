---
"design-docs": patch
---

## Refactoring

### Per-event hook directory layout

Hook scripts now live in event-name subdirectories under `plugin/hooks/`, with shared helpers in a `lib/` sibling. The flat layout (`plugin/hooks/session-start.sh`, `plugin/hooks/allow-design-writes.sh`) is gone.

- `plugin/hooks/session-start/context-inject.sh` — SessionStart context injection
- `plugin/hooks/pre-tool-use/allow-design-writes.sh` — PreToolUse auto-approve for `.claude/design/` and `.claude/plans/`
- `plugin/hooks/lib/` — shared helpers (`hook-output.sh`, `hook-debug.sh`, `source-session-env.sh`) sourced via relative paths

The new layout makes path-based plugin-bash-engineer skills auto-load when hook scripts are edited, and keeps shared code out of the registration surface. `hooks.json` was updated to point at the new paths and quotes `${CLAUDE_PLUGIN_ROOT}` so paths with spaces survive expansion.

### Skill script hardening

Bash scripts across `design-audit/`, `design-validate/`, `design-update/`, `plan-complete/`, `plan-explore/`, `plan-validate/`, and `review/` were tightened — stricter shell options, clearer error reporting, safer path handling, and consistent exit-code semantics. No behavior change for existing successful invocations; failure modes are clearer.

## Features

### PreToolUse now covers MultiEdit

The `allow-design-writes` matcher was extended from `Write|Edit` to `Write|Edit|MultiEdit`. MultiEdit operations against `.claude/design/` and `.claude/plans/` are now auto-approved on the same terms as Write and Edit, eliminating a permission prompt that previously interrupted multi-step doc edits.

## Documentation

- Synced the plugin architecture design doc with the new hook layout, shared `lib/`, and updated diagrams.
- Updated root and plugin `CLAUDE.md` to reflect the per-event subdirectory convention and the third `lib/` helper.
- Corrected `CONTRIBUTING.md` hook-path convention to `plugin/hooks/<event-kebab>/{name}.sh`.
- Style-skill content (`context-docs-style`, `design-docs-style`) refined; finalize/review/merge-prep workflow `SKILL.md` files updated.
