---
name: docs-review-package
description: Review package.json for completeness and best practices. Use when
  auditing metadata, checking dependency versions, or validating peerDependencies.
allowed-tools: Read, Glob, Grep, WebSearch
context: fork
agent: docs-gen-agent
---

# Review Package.json

Reviews a module's package.json for completeness, best practices, and potential
improvements.

## Philosophy

**package.json is your package's identity and contract.**

A well-configured package.json:

1. Has complete metadata for npm/GitHub discoverability
2. Uses appropriate dependency version ranges
3. Defines clear peerDependency contracts
4. Follows npm best practices

## Critical Rule

**NEVER modify the `version` field.** Version management is handled by
changesets. The review should only report on version-related issues, not fix
them.

## Overview

This skill reviews package.json by:

1. Checking metadata completeness (name, description, repository, etc.)
2. Validating dependency version ranges
3. Reviewing peerDependency compatibility
4. Checking for outdated dependencies
5. Suggesting improvements

## Quick Start

**Review a module's package.json:**

```bash
/docs-review-package my-package
```

**Review with dependency update check:**

```bash
/docs-review-package my-package --check-updates
```

**Review all packages in monorepo:**

```bash
/docs-review-package --all
```

## How It Works

### 1. Parse Parameters

- `module`: Module name to review [REQUIRED unless --all]
- `--check-updates`: Check npm for newer dependency versions
- `--all`: Review all packages in monorepo
- `--fix`: Apply safe fixes (metadata only, never version)

### 2. Review Metadata Completeness

**Required fields:**

| Field | Purpose |
| ----- | ------- |
| `name` | Package identifier (scoped recommended) |
| `version` | Current version (DO NOT MODIFY) |
| `description` | Brief description for npm search |
| `license` | SPDX license identifier |

**Recommended fields:**

| Field | Purpose |
| ----- | ------- |
| `repository` | Source code location |
| `homepage` | Documentation/landing page |
| `bugs` | Issue tracker URL |
| `author` | Package maintainer |
| `keywords` | npm search keywords |
| `engines` | Node.js version requirement |

**Publishing fields (if publishable):**

| Field | Purpose |
| ----- | ------- |
| `files` | Files to include in package |
| `main` / `exports` | Entry points |
| `types` | TypeScript declarations |
| `publishConfig` | npm registry settings |

### 3. Review Dependencies

**Version range guidelines:**

| Range | Use Case |
| ----- | -------- |
| `^x.y.z` | Default for most deps (minor updates OK) |
| `~x.y.z` | Patch updates only (conservative) |
| `x.y.z` | Exact version (avoid unless necessary) |
| `>=x.y.z` | Minimum version (use sparingly) |
| `*` | Any version (never use in production) |

**Dependency placement:**

| Location | Contents |
| -------- | -------- |
| `dependencies` | Runtime requirements |
| `devDependencies` | Build/test tools |
| `peerDependencies` | Host-provided deps |
| `optionalDependencies` | Nice-to-have features |

### 4. Review peerDependencies

**Best practices:**

- Use wide ranges for flexibility: `^x.0.0` or `>=x.y.z`
- Match major version of actual usage
- Add `peerDependenciesMeta` for optional peers
- Document peer requirements in README

**Common issues:**

- Range too narrow (breaks with minor updates)
- Range too wide (includes incompatible versions)
- Missing peerDependency (runtime errors)
- peerDep should be regular dep (or vice versa)

### 5. Check for Updates (Optional)

If `--check-updates` flag:

- Query npm registry for latest versions
- Compare with current ranges
- Flag significantly outdated deps (>2 major versions)
- Suggest safe update ranges

**DO NOT automatically update versions.** Report findings only.

### 6. Generate Report

Output a structured review:

```markdown
## Package Review: @scope/package

### Metadata
- ✅ name: @scope/package
- ✅ description: Present
- ⚠️ homepage: Missing
- ⚠️ bugs: Missing
- ✅ repository: Present

### Dependencies
- ✅ 12 dependencies with appropriate ranges
- ⚠️ lodash@^3.0.0 - Consider updating (latest: 4.17.21)

### peerDependencies
- ✅ react: ^17.0.0 || ^18.0.0 (appropriate range)
- ⚠️ typescript: ^4.0.0 (consider adding ^5.0.0)

### Recommendations
1. Add homepage field pointing to documentation
2. Add bugs field pointing to issue tracker
3. Consider updating lodash to v4
```

## Supporting Documentation

Load these files for detailed guidance:

- `instructions.md` - Detailed review checklist

## Success Criteria

A package.json review is successful when:

- ✅ All required metadata fields checked
- ✅ Dependency ranges evaluated
- ✅ peerDependencies reviewed for compatibility
- ✅ Clear recommendations provided
- ✅ Version field NOT modified

## Integration Points

- Reads `package.json` from module path
- Optionally queries npm registry for version info
- Reports findings (does not auto-fix versions)
- Uses docs-gen-agent for review

## Related Skills

- `/docs-generate-readme` - Generate package README
- `/docs-generate-contributing` - Generate CONTRIBUTING.md
- `/docs-sync` - Sync docs with package.json changes
