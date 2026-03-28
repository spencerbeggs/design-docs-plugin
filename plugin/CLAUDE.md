# Plugin Directory

This is the distributable plugin directory. Everything here ships to end users via git-subdir sparse cloning. Keep it minimal -- no tests, no dev tooling.

## Structure

* `.claude-plugin/plugin.json` -- Plugin manifest (name, version, author)
* `hooks/hooks.json` -- Hook configuration consumed by Claude Code
* `hooks/session-start.sh` -- SessionStart hook (pure bash)
* `skills/` -- 35 SKILL.md files across design-*, context-*, docs-*, plan-*, finalize groups
* `agents/` -- design-doc-agent, context-doc-agent, docs-gen-agent
* `commands/` -- (no commands yet)

## Hooks

Hooks are pure bash scripts invoked via `bash ${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`. This avoids executable bit issues when distributed from repos that strip them.

All hooks check `DESIGN_DOCS_CONTEXT_ENABLED` environment variable. Set to `false` to disable all hook behavior.

### session-start.sh (SessionStart)

Injects design documentation system context into new sessions. Fires on all SessionStart sources (startup, resume, compact, clear). Outputs a philosophy-first message that explains what design docs are, why they matter, and when to update them. If `.claude/design/` does not exist, shows initialization guidance instead.

### subagent-start.sh (SubagentStart)

Injects condensed (<50 word) design docs awareness into every spawned subagent via JSON `additionalContext`. Tells subagents to flag architecture-relevant changes to the parent agent. Skips if `.claude/design/` does not exist.

### stop-reminder.sh (Stop)

Soft nudge after implementation work. Reads `stop_hook_active` from stdin JSON as a loop guard, then scans `last_assistant_message` for multi-word implementation keyword patterns. Outputs plain text reminder if detected. Does not block — context-only v1 with a documented escalation path. Skips if `.claude/design/` does not exist. Requires `jq`.

## Key Skills

### finalize

End-of-branch orchestration workflow invoked via `/design-docs:finalize`.
Updates design docs, CLAUDE.md files, and user docs by delegating to
existing plugin skills (design-sync, context-update, docs-update), then
creates a changeset, commits, pushes, and opens a PR.

Flags: `--no-pr`, `--docs-only`, `--dry-run`

User-invocable only (`disable-model-invocation: true`).

## Adding Hooks

1. Create `hooks/{name}.sh` as a bash script
1. Add an entry to `hooks/hooks.json` using `bash ${CLAUDE_PLUGIN_ROOT}/hooks/{name}.sh`
1. Script outputs become `claudeContext` for SessionStart hooks, or stdout for other hook types

## Adding Skills

1. Create `skills/{name}/SKILL.md` with YAML frontmatter and instructions
1. Add the skill directory path to `.claude-plugin/plugin.json` skills array
1. Supported frontmatter: `name`, `description`, `allowed-tools`, `context`, `agent`, `model`, `effort`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `hooks`, `paths`, `shell`

## Adding Agents

1. Create `agents/{name}.md` with YAML frontmatter and system prompt
1. Add the agent file path to `.claude-plugin/plugin.json` agents array
1. Supported frontmatter: `name`, `description`, `tools`, `disallowedTools`, `model`, `skills`, `maxTurns`, `memory`, `effort`, `isolation`
1. Note: plugin agents ignore `hooks`, `mcpServers`, and `permissionMode` fields

## Adding Commands

1. Create `commands/{name}.md` with frontmatter (`description`, `allowed-tools`, `argument-hint`)
1. Add to `.claude-plugin/plugin.json` commands array
1. Namespacing: `commands/foo.md` becomes `/design-docs:foo`
