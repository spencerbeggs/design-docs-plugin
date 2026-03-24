# CONTRIBUTING.md Generation Instructions

Detailed step-by-step instructions for generating CONTRIBUTING.md files.

## Core Principle

**Use actual values, not placeholders.**

Every version number, command, and requirement should be extracted from the
actual project configuration. Never use generic placeholders like "X.x" or
"your-package" - always use real values.

## Implementation Steps

### Step 1: Read Package Configuration

```bash
# Read package.json
cat {module.path}/package.json
```

Extract:

- `name` → Package name for title
- `engines.node` → Node.js version requirement
- `packageManager` → pnpm/npm/yarn with version
- `scripts` → Available development commands
- `devDependencies` → TypeScript version, test framework

### Step 2: Detect Package Manager

Check for lock files to determine package manager:

```bash
# Check which lock file exists
ls {module.path}/pnpm-lock.yaml
ls {module.path}/package-lock.json
ls {module.path}/yarn.lock
ls {module.path}/bun.lock
```

Map to package manager:

- `pnpm-lock.yaml` → pnpm
- `package-lock.json` → npm
- `yarn.lock` → yarn
- `bun.lock` → bun

Also check `packageManager` field in package.json for exact version.

### Step 3: Extract Node.js Version

Check multiple sources:

```bash
# From package.json engines
jq '.engines.node' package.json

# From .nvmrc
cat .nvmrc

# From .node-version
cat .node-version
```

Use the most specific version found.

### Step 4: Categorize Scripts

Read `scripts` from package.json and categorize:

**Building:**

| Script | Description |
| ------ | ----------- |
| `build` | Full build |
| `build:dev` | Development build with source maps |
| `build:prod` | Production-optimized build |
| `build:npm` | Build for npm publishing |
| `build:inspect` | Display build configuration |

**Testing:**

| Script | Description |
| ------ | ----------- |
| `test` | Run test suite |
| `test:watch` | Run tests in watch mode |
| `test:coverage` | Generate coverage report |

**Code Quality:**

| Script | Description |
| ------ | ----------- |
| `lint` | Check for issues |
| `lint:fix` | Auto-fix issues |
| `lint:md` | Check markdown |
| `lint:md:fix` | Fix markdown issues |
| `typecheck` | Validate TypeScript |

Only include scripts that actually exist in package.json.

### Step 5: Extract Code Quality Standards

**From biome.jsonc or .eslintrc:**

- Formatting rules
- Linting standards

**From tsconfig.json:**

- `strict` mode enabled?
- Module system (ESM/CJS)
- Import requirements

**From vitest.config.ts or jest.config.js:**

- Coverage thresholds
- Test file patterns

**Common standards to document:**

- Avoid `any` types
- Use `import type` for type imports
- Include `.js` extensions in imports (ESM)
- Coverage thresholds (e.g., 85%)

### Step 6: Generate Content

Fill the template with extracted values:

**Environment Setup section:**

```markdown
**Environment Setup:**

- Node.js {actual_node_version} or later
- {package_manager} {actual_pm_version} or later
- TypeScript {actual_ts_version} or later
```

**Development Commands section:**

Only list commands that exist. Group by category.

**Code Quality Standards section:**

Extract actual rules from config files.

### Step 7: Include Contribution Process

Standard contribution workflow:

```markdown
## Contribution Process

1. Create a feature branch from the main branch
2. Ensure all tests pass and meet coverage thresholds
3. Execute `{pm} lint:fix` before committing changes
4. Sign commits using the Developer Certificate of Origin (DCO)
5. Compose descriptive commit messages
6. Refresh relevant documentation

**DCO Requirement:** Add `Signed-off-by: Your Name <email@example.com>` to
commits, or use `git commit -s` for automatic inclusion.
```

### Step 8: Write Output

Write to module root:

```bash
# Write CONTRIBUTING.md
cat > {module.path}/CONTRIBUTING.md <<'EOF'
{generated content}
EOF
```

### Step 9: Validate Output

Check that:

- All referenced commands exist in package.json
- Version numbers are real (not X.x placeholders)
- No template placeholders remain (`{...}`)
- Markdown is valid

## Content Guidelines

### Tone

- Direct and actionable
- Use imperative mood for instructions
- Be concise - developers want to get started quickly

### What to Include

- Environment requirements (versions)
- Setup command (`pnpm install`)
- Available development commands
- Code quality standards
- Contribution process
- DCO requirement

### What NOT to Include

- Detailed architecture (put in docs/)
- API documentation (put in docs/)
- Extensive troubleshooting (put in docs/)
- License text (separate file)

## Example Output

```markdown
# Contributing to @savvy-web/my-package

## Overview

This project welcomes contributors and maintains clear standards for code
quality and development practices.

## Essential Requirements

**Environment Setup:**

- Node.js 24.x or later
- pnpm 10.x or later
- TypeScript 5.9.x or later

**Initial Setup:**

Clone the repository and run `pnpm install` to get started.

## Development Commands

**Building:**

- `pnpm build` — creates full build
- `pnpm build:dev` — creates development builds with source maps

**Testing:**

- `pnpm test` — runs the full test suite
- `pnpm test:coverage` — generates coverage metrics

**Code Quality:**

- `pnpm lint` — identifies issues
- `pnpm lint:fix` — corrects fixable problems
- `pnpm typecheck` — validates TypeScript

## Code Quality Standards

**TypeScript Practices:**

- Avoid `any` types; use proper interfaces instead
- Import types separately using `import type` syntax
- Include `.js` extensions in all import statements

**Testing Requirements:**

- Maintain minimum 85% coverage per file
- Place tests adjacent to source files (e.g., `module.test.ts`)

## Contribution Process

1. Create a feature branch from the main branch
2. Ensure all tests pass and meet coverage thresholds
3. Execute `pnpm lint:fix` before committing changes
4. Sign commits using the Developer Certificate of Origin (DCO)
5. Compose descriptive commit messages

**DCO Requirement:** Add `Signed-off-by: Your Name <email@example.com>` to
commits, or use `git commit -s` for automatic inclusion.
```

## Error Handling

### Missing package.json

```text
Error: package.json not found at {module.path}/package.json
Cannot generate CONTRIBUTING.md without package metadata
```

### No Scripts Found

```text
Warning: No scripts found in package.json
CONTRIBUTING.md will have minimal development commands section
```

### Unknown Package Manager

```text
Warning: Could not detect package manager
Defaulting to npm for command examples
```
