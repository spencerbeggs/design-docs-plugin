---
name: bootstrap
description: Guide through customizing this plugin template for a new project. Trigger when user says "set up my plugin", "customize this template", "bootstrap", "initialize my plugin", "rename the template", or "retrofit this template for my project".
---

# Plugin Template Bootstrap

You are guiding the user through customizing the claude-plugin-template for their own Claude Code plugin.

## Information to Gather

Ask the user for the following. If they don't have an answer for optional fields, use sensible defaults.

1. **Plugin name** (required): kebab-case name (e.g., "my-awesome-plugin")
2. **Description** (required): One-line description of what the plugin does
3. **Env var prefix** (required): UPPER_SNAKE_CASE prefix (e.g., "MY_PLUGIN")
4. **Author name** (required): Full name for plugin.json author field
5. **Author email** (optional): For SECURITY.md and DCO sign-off
6. **Author URL** (optional): Personal website URL
7. **GitHub username/org** (required): For repository URLs
8. **Repository name** (optional, defaults to plugin name): GitHub repo name
9. **License** (optional, defaults to MIT): License identifier

## Files to Update

After gathering information, update these files in order:

### 1. Plugin Manifest

**File**: `plugin/.claude-plugin/plugin.json`

* `name` -- plugin name
* `description` -- user's description
* `version` -- keep `0.0.0` or set initial version
* `author.name` -- author name
* `author.url` -- author URL (or remove field if not provided)
* `homepage` -- `https://github.com/{username}/{repo}`
* `repository` -- `https://github.com/{username}/{repo}.git`
* `license` -- user's license choice

### 2. Plugin Package

**File**: `plugin/package.json`

* `name` -- plugin name

### 3. Root Package

**File**: `package.json`

* `name` -- `{plugin-name}-root`
* `description` -- `Root package for the {plugin-name} monorepo`

### 4. Plugin Config

**File**: `plugin/plugin.config.ts`

Update both the prefix AND the setup function in one pass:

* `prefix` -- user's env var prefix
* `setup()` -- ask what the plugin needs to detect or initialize at startup. Implement accordingly. If unsure, leave the placeholder but update it to return meaningful field names.

### 5. Options Schema

**File**: `plugin/src/schema.ts`

Ask the user if they want to:

* Keep the example options as a starting point
* Clear the schema and start fresh
* Define their initial options now

### 6. Example Command

**File**: `plugin/commands/greet.md`

Line 15 hardcodes the binary name `claude-plugin-template.plugin`. Update to `{plugin-name}.plugin`. The user may also want to rename or remove this demo command entirely.

### 7. Changeset Config

**File**: `.changeset/config.json`

* `repo` in changelog config -- `{username}/{repo}`

### 8. Security Policy

**File**: `SECURITY.md`

* Contact email -- author email (or remove email contact if not provided)

### 9. GitHub CODEOWNERS

**File**: `.github/CODEOWNERS`

* Replace `@spencerbeggs` with `@{username}`

### 10. Dependabot

**File**: `.github/dependabot.yml`

* Replace `spencerbeggs` assignee (line 30) with `{username}`

### 11. Release Workflow

**File**: `.github/workflows/release.yml`

This references `spencerbeggs/.github/.github/workflows/release.yml@main` -- a reusable workflow from the template author's org. The user must either:

* Replace with their own reusable release workflow
* Rewrite as a standalone workflow
* Remove the file if they don't need automated releases yet

### 12. Claude Settings

**File**: `.claude/settings.local.json`

* Attribution commit/pr sign-off -- `Signed-off-by: {author name} <{author email}>`

### 13. Root CLAUDE.md

**File**: `CLAUDE.md`

Update throughout:

* Project name and description in the header
* Author info and repository URL
* Project structure tree (plugin name in paths)
* Distribution section (marketplace repo if applicable)
* Hardcoded personal values table

### 14. README.md

**File**: `README.md`

Rewrite with the new plugin name, description, repository URLs, and quick start instructions.

### 15. CONTRIBUTING.md

**File**: `CONTRIBUTING.md`

Update the fork/clone instructions with the new repository URL.

### 16. Hooks

Ask the user which Claude Code events they want to handle:

* **SessionStart** -- Inject context at session start (template includes this)
* **PreToolUse** -- Validate or gate tool usage before execution
* **PostToolUse** -- Run checks after a tool executes
* **Stop** -- Run preflight checks before Claude finishes
* **SubagentStop** -- Checks before a subagent finishes

For each selected event, create stub hook files following the pattern in `plugin/hooks/context.hook.ts`. Each handler file MUST `export default handler`.

### 17. Commands

Ask the user if they want to add slash commands. For each command:

1. Create `plugin/commands/{name}.md` with frontmatter
2. Create `plugin/commands/{name}.cmd.ts` with handler stub (MUST `export default handler`)
3. Register in `plugin.config.ts` under `commands` with: `description`, `args` (Zod schema), `pipeline` (path)
4. Add the `.md` path to `plugin/.claude-plugin/plugin.json` commands array

### 18. Regenerate Lockfile

Run `bun install` to regenerate the lockfile after package name changes:

```bash
bun install
```

### 19. Build and Validate

```bash
bun run build
bun run validate
bun run typecheck
bun run test
```

Fix any errors before completing.

**Note**: `plugin/scripts/setup-proxy.sh` and `plugin/hooks/hooks.json` are auto-generated by the build. Do not edit them manually -- they will be regenerated with the correct plugin name.

## Troubleshooting

* **TypeScript errors after schema changes** -- Fix the types in `plugin/src/schema.ts`, then run `bun run typecheck`
* **Plugin validation failures** -- Check `plugin/.claude-plugin/plugin.json` is valid JSON with all required fields. Run `claude plugin validate ./plugin`
* **Binary name mismatch** -- The binary name is derived from the plugin name. Run `bun run build` to regenerate `setup-proxy.sh` with the correct name
* **Lockfile conflicts** -- Delete `bun.lock` and run `bun install` to regenerate

## Completion Checklist

Before finishing, verify:

* `bun run build` succeeds
* `bun run validate` passes
* `bun run typecheck` passes
* `bun run test` passes
* No remaining template references -- grep for each:
  * `spencerbeggs`
  * `claude-plugin-template`
  * `beggs.codes`
  * `spencerbeg.gs`
  * `C. Spencer Beggs`
* `bun.lock` regenerated cleanly after `bun install`
* README.md reflects the new plugin name and description
