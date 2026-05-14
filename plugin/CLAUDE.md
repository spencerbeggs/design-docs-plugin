# Plugin Directory

This is the distributable plugin directory. Everything here ships to end users via git-subdir sparse cloning. Keep it minimal -- no tests, no dev tooling.

## Structure

* `.claude-plugin/plugin.json` -- Plugin manifest (name, version, author)
* `hooks/hooks.json` -- Hook configuration consumed by Claude Code
* `hooks/lib/` -- Shared bash helpers sourced by hook scripts
  * `hook-output.sh` -- canonical JSON emitters (`emit_session_start`, `emit_permission_allow`, `emit_noop`)
  * `hook-debug.sh` -- structured stderr logging (`hook_debug`, `hook_error`)
  * `source-session-env.sh` -- loads `$CLAUDE_ENV_FILE` exports for non-producer hooks
* `hooks/session-start/context-inject.sh` -- SessionStart context injection
* `hooks/pre-tool-use/allow-design-writes.sh` -- PreToolUse auto-approve for design dirs
* `hooks/fixtures/` -- Reserved for hook-payload fixtures (empty)
* `skills/` -- 47 SKILL.md files across design-*, context-*, docs-*, user-docs-*, plan-*, finalize, review, merge-prep groups
* `agents/` -- design-doc-agent, context-doc-agent, user-docs
* `commands/` -- (no commands yet; create the directory when adding the first command)

## Hooks

Hooks are organized by event name as subdirectories: `hooks/<event-kebab>/<script>.sh`. Each script is invoked via `bash "${CLAUDE_PLUGIN_ROOT}/hooks/<event-kebab>/<script>.sh"`. This layout lets the path-based plugin-bash-engineer skills (`cc-hook-session-lifecycle`, `cc-hook-pre-tool-use`, …) auto-load when an author opens a hook file.

Hook scripts source shared helpers from `hooks/lib/` via relative paths so they work regardless of where the plugin is installed.

All hooks check `DESIGN_DOCS_CONTEXT_ENABLED` environment variable. Set to `false` to disable all hook behavior.

### session-start/context-inject.sh (SessionStart)

Injects design documentation system context into new sessions. Fires on all SessionStart sources (startup, resume, compact, clear). Outputs a philosophy-first message that explains what design docs are, why they matter, and when to update them. Parses the envelope to pick up `cwd` as a fallback for `CLAUDE_PROJECT_DIR`. If `.claude/design/` does not exist, shows initialization guidance instead. On feature branches, manages the `session/start` local git tag for session boundary tracking — creates at merge-base if missing, reports existing tag without moving it. Writes `DESIGN_DOCS_GH_TOKEN` and `GITHUB_REPOSITORY` to `$CLAUDE_ENV_FILE` for downstream skills.

### pre-tool-use/allow-design-writes.sh (PreToolUse)

Auto-approves Write/Edit/MultiEdit operations targeting `.claude/design/` and `.claude/plans/` directories. Prevents repeated permission prompts when agents update documentation. Requires `jq`.

## Key Skills

### finalize

End-of-branch orchestration workflow invoked via `/design-docs:finalize`. Dispatches the design-doc-agent, context-doc-agent, and user-docs agents to update each documentation layer, then creates a changeset, squashes all branch commits into a single clean commit, pushes, and opens a PR.

Flags: `--no-push`, `--no-pr`, `--no-squash`, `--no-context-docs`, `--no-user-docs`, `--dry-run`

### review

PR review cycle workflow invoked via `/design-docs:review`. Fetches active (unresolved, not outdated) PR comments, triages by severity, addresses fixes, runs verification and lightweight doc check, then commits and pushes. Designed for iterative review cycles with small fix commits.

Flags: `--force-docs`, `--no-push`, `--dry-run`, `--squash`

User-invocable only (`disable-model-invocation: true`).

### merge-prep

Final merge preparation invoked via `/design-docs:merge-prep`. Squashes all branch commits from merge-base into a single clean commit and force pushes. No docs pipeline — docs were handled during finalize and review. Verifies PR approval before proceeding.

Flags: `--no-push`, `--dry-run`

User-invocable only (`disable-model-invocation: true`).

## Adding Hooks

1. Create `hooks/<event-kebab>/{name}.sh` as a bash script (e.g. `hooks/post-tool-use/log-edits.sh`)
1. Source the shared lib helpers via `source "$(dirname "${BASH_SOURCE[0]}")/../lib/hook-output.sh"`
1. Add an entry to `hooks/hooks.json` using `bash "${CLAUDE_PLUGIN_ROOT}/hooks/<event-kebab>/{name}.sh"`
1. Use `emit_*` functions from `lib/hook-output.sh` for response JSON; never hand-roll the envelope
1. Add a bun test at `__test__/hooks/{name}.test.ts` that pipes a payload into the script and asserts on exit code and stdout

## Adding Skills

1. Create `skills/{name}/SKILL.md` with YAML frontmatter and instructions
1. Add the skill directory path to `.claude-plugin/plugin.json` skills array
1. Supported frontmatter: `name`, `description`, `when_to_use`, `allowed-tools`, `context`, `agent`, `model`, `effort`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `hooks`, `paths`, `shell`. Use `when_to_use` to declare trigger phrases for model-invokable workflow skills (see `finalize` for the canonical example).

## Adding Agents

1. Create `agents/{name}.md` with YAML frontmatter and system prompt
1. Add the agent file path to `.claude-plugin/plugin.json` agents array
1. Supported frontmatter: `name`, `description`, `tools`, `disallowedTools`, `model`, `skills`, `color`, `hooks`, `maxTurns`, `memory`, `effort`, `isolation`. Use `color` for the transcript badge (red/pink/blue used by the three doc agents); use `hooks` to declare per-agent PreToolUse approvals (all three doc agents auto-approve Write/Edit on design dirs)
1. Note: plugin agents ignore `mcpServers` and `permissionMode` fields
1. Each doc agent should also list its matching `*-docs-style` skill in `skills:` so the style rule auto-loads

## Adding Commands

1. Create `commands/{name}.md` with frontmatter (`description`, `allowed-tools`, `argument-hint`)
1. Add to `.claude-plugin/plugin.json` commands array
1. Namespacing: `commands/foo.md` becomes `/design-docs:foo`
