---
"design-docs": patch
---

## Bug Fixes

- Fixed `stop-reminder` hook emitting an invalid JSON output format that caused a Claude Code schema validation error on every trigger. The hook was emitting `hookSpecificOutput.additionalContext`, which is only valid for `UserPromptSubmit`, `PostToolUse`, and `PostToolBatch` hooks. Stop hooks require the top-level `systemMessage` field — the output is now `{ "systemMessage": "..." }`.
