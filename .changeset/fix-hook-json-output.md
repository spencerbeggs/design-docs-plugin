---
"design-docs": patch
---

## Bug Fixes

Fix hook JSON output validation errors on startup

SessionStart and Stop hooks now output valid JSON with `hookEventName` in `hookSpecificOutput`, matching the schema Claude Code expects. SessionStart context restructured from markdown to XML tags wrapped in `<EXTREMELY_IMPORTANT>` for better agent prioritization. SessionStart hook now auto-creates `.claude/design/` and `.claude/plans/` directories when missing instead of omitting context.
