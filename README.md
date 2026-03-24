# claude-plugin-template

A template for creating Claude Code plugins with [claude-binary-plugin](https://www.npmjs.com/package/claude-binary-plugin). Claude Code plugins let you extend Claude's behavior -- inject project context at session start, validate tool usage, add custom slash commands, and define reusable skills. This template compiles your TypeScript hooks, commands, and skills into a single Bun bytecode binary for fast, zero-dependency distribution.

## What's Included

The template ships with working demo components you can explore, modify, or replace:

* **SessionStart context hook** -- injects environment and greeting data into each Claude session (`plugin/hooks/context.hook.ts`)
* **Greet slash command** -- demonstrates Zod argument validation, exit code conventions, and typed state access (`plugin/commands/greet.cmd.ts`)
* **Bootstrap skill** -- a guided workflow (in `.claude/skills/bootstrap/`) that walks you through renaming the plugin, setting your env var prefix, and wiring up hooks and commands
* **Full test suite** -- integration tests with a fluent test API for hooks and commands (`__test__/`)

## Prerequisites

* [Bun](https://bun.sh) >= 1.3.9
* [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
* [Turbo](https://turbo.build) (installed as a peer dependency)
* [GitHub CLI](https://cli.github.com) (`gh`) -- optional, for creating repos from the template

## Quick Start

### 1. Clone and Install

Using the GitHub CLI:

```bash
gh repo create my-plugin --template spencerbeggs/claude-plugin-template
cd my-plugin
bun install
```

Or with `git clone`:

```bash
git clone https://github.com/spencerbeggs/claude-plugin-template.git my-plugin
cd my-plugin
rm -rf .git && git init
bun install
```

### 2. Verify the Template Works

Build and test the demo plugin out of the box:

```bash
bun run build && bun run test
```

A successful run looks like:

```text
 Tasks:    4 successful, 4 total
 Cached:   0 already cached
  Time:    Xs

bun test v1.x.x
  ✓ context hook > returns context when enabled
  ✓ context hook > returns disabled when context is off
  ✓ greet command > greets with default name
  ✓ greet command > validates repeat argument
```

### 3. Customize

The fastest path is to open Claude Code in the project and use the `/bootstrap` skill, which walks you through renaming, configuring your env var prefix, and wiring up hooks and commands interactively.

To customize manually:

* Update `plugin/.claude-plugin/plugin.json` with your plugin name, description, and author
* Change the `prefix` in `plugin/plugin.config.ts` to your env var namespace
* Define your options schema in `plugin/src/schema.ts`
* Implement your `setup()` function for environment detection

### 4. Test with Claude Code

Install the plugin locally and start a session:

```bash
claude plugin add ./plugin
claude
```

## Project Structure

Only the `plugin/` directory reaches end users. Everything else is development infrastructure. This is sometimes called a sidecar distribution pattern -- you develop with full tooling but ship only the plugin.

```text
claude-plugin-template/
├── plugin/                  <- Ships to users (via git-subdir sparse clone)
│   ├── .claude-plugin/      Plugin manifest
│   ├── src/                 Shared source code
│   ├── hooks/               Event handlers (.hook.ts files)
│   ├── commands/            Slash commands (.cmd.ts + .md pairs)
│   ├── skills/              Skill definitions (SKILL.md)
│   ├── agents/              Agent definitions (.md)
│   └── plugin.config.ts     Central plugin definition
├── __test__/                <- Tests (not shipped)
├── lib/                     <- Dev tooling configs (not shipped)
└── package.json             <- Root workspace with dev dependencies
```

## Adding Plugin Components

### Hooks

Create `plugin/hooks/{name}.hook.ts`:

```typescript
import type { Pipeline } from "../plugin.config.js";

const handler: Pipeline["SessionStart"] = ({ state }) => {
  return {
    status: "executed",
    action: "context",
    summary: "Injected context",
    claudeContext: "Your markdown context here",
  };
};

export default handler;
```

Register in `plugin.config.ts` under `hooks`.

### Commands

Create paired files in `plugin/commands/`:

* `example.md` -- frontmatter with description, allowed-tools, argument-hint
* `example.cmd.ts` -- handler implementation

```typescript
import type { CommandOutput } from "claude-binary-plugin";
import type { Commands } from "../plugin.config.js";

const handler: Commands["example"] = async ({ args, state }): Promise<CommandOutput> => {
  const name = args._positionals[0] ?? "World";
  return {
    exitCode: 0,
    output: `Hello, ${name}!`,
  };
};

export default handler;
```

Nested directories create namespaced commands:

* `commands/test.md` maps to `/plugin-name:test`
* `commands/test/coverage.md` maps to `/plugin-name:test:coverage`

### Skills

Create `plugin/skills/{name}/SKILL.md` with your skill definition.

### Agents

Create `plugin/agents/{name}.md` with agent frontmatter and system prompt.

## How State Works

Plugin state flows through environment variables, a setup function, and into your hooks and commands -- all fully typed. Access everything through the `state` parameter in any handler.

## Development

| Command | Description |
| --- | --- |
| `bun run build` | Build plugin binary |
| `bun run test` | Run tests |
| `bun run typecheck` | Type-check all workspaces |
| `bun run validate` | Validate plugin manifest |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run lint:md:fix` | Auto-fix markdown lint issues |

## Distribution

Plugins are distributed via git-subdir sparse cloning from a GitHub marketplace repository. Only the `plugin/` directory is cloned to the user's machine. The JIT build system handles compilation automatically on first use.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and release process.

## License

[MIT](LICENSE)
