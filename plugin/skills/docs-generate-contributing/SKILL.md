---
name: docs-generate-contributing
description: Generate CONTRIBUTING.md for developer onboarding. Use when creating
  or updating contribution guides with setup instructions and development workflows.
allowed-tools: Read, Glob, Edit, Write
context: fork
agent: docs-gen-agent
---

# Generate CONTRIBUTING.md

Generates a CONTRIBUTING.md file to help developers set up their local
environment and contribute to the project.

## Philosophy

**CONTRIBUTING.md is a developer onboarding document.**

A good CONTRIBUTING.md helps new contributors:

1. Set up their local environment quickly
2. Understand available development commands
3. Follow code quality standards
4. Know the contribution process

Each project may have different requirements - extract actual values from
package.json and project configuration rather than using generic placeholders.

## Overview

This skill generates CONTRIBUTING.md by:

1. Reading package.json for environment requirements and scripts
2. Detecting tooling (package manager, linter, test framework)
3. Extracting code quality standards from config files
4. Generating project-specific setup instructions
5. Including contribution workflow (branching, commits, DCO)

## Quick Start

**Generate CONTRIBUTING.md for a module:**

```bash
/docs-generate-contributing my-package
```

**Update existing CONTRIBUTING.md:**

```bash
/docs-generate-contributing my-package --update
```

**Preview without writing:**

```bash
/docs-generate-contributing my-package --dry-run
```

## How It Works

### 1. Parse Parameters

- `module`: Module name to generate CONTRIBUTING.md for [REQUIRED]
- `--update`: Update existing file, preserving custom sections
- `--dry-run`: Preview output without writing

### 2. Extract Environment Requirements

From `package.json`:

- `engines.node` → Node.js version requirement
- `packageManager` field → pnpm/npm/yarn version
- `devDependencies` → TypeScript version, test framework

From project root:

- `.nvmrc` or `.node-version` → Node version
- `pnpm-lock.yaml` / `package-lock.json` → Package manager detection

### 3. Extract Development Commands

From `package.json.scripts`, categorize commands:

**Building:**

- `build`, `build:dev`, `build:prod`, `build:inspect`

**Testing:**

- `test`, `test:watch`, `test:coverage`

**Code Quality:**

- `lint`, `lint:fix`, `typecheck`

### 4. Detect Code Quality Standards

From configuration files:

- `biome.jsonc` / `.eslintrc` → Linting rules
- `tsconfig.json` → TypeScript strictness
- `vitest.config.ts` → Coverage thresholds

### 5. Include Contribution Process

Standard sections:

- Branch naming conventions
- Commit message format (conventional commits)
- DCO signoff requirement
- PR process

### 6. Generate CONTRIBUTING.md

Fill template with extracted values - use actual versions and commands,
not generic placeholders.

### 7. Validate Output

- All commands exist in package.json
- Version numbers are accurate
- No placeholder text remains

## Supporting Documentation

Load these files for detailed guidance:

- `instructions.md` - Step-by-step implementation
- `templates/contributing.template.md` - Output template

## Success Criteria

A generated CONTRIBUTING.md is successful when:

- ✅ Environment requirements match package.json
- ✅ All listed commands actually exist
- ✅ Version numbers are accurate (not placeholders)
- ✅ Code quality standards reflect actual config
- ✅ DCO requirement is clearly explained
- ✅ New contributors can set up environment from scratch

## Integration Points

- Reads `package.json` for scripts and engines
- Reads config files (biome.jsonc, tsconfig.json, vitest.config.ts)
- Writes to module root as `CONTRIBUTING.md`
- Uses docs-gen-agent for generation

## Related Skills

- `/docs-generate-readme` - Generate package README
- `/docs-generate-repo` - Generate Level 2 docs
- `/docs-sync` - Sync docs with changes
