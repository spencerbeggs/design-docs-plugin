---
name: docs-generate-readme
description: Generate Level 1 (README.md) user documentation from design docs. Use when creating or updating package README files for npm/GitHub.
allowed-tools: Read, Glob, Edit, Write
context: fork
agent: docs-gen-agent
---

# Generate Package README

Generates Level 1 user documentation (README.md) from design docs and package
metadata.

## Philosophy

**READMEs should be concise entry points, not comprehensive documentation.**

A good README answers three questions quickly:

1. **What is this?** - Clear problem statement and solution
2. **How do I install it?** - Single command
3. **How do I start?** - Minimal working example

Advanced configuration, detailed API reference, and in-depth guides belong in
Level 2 documentation (`docs/` folder). READMEs should link there, not duplicate.

## Overview

This skill transforms internal design documentation into a focused package
README by:

1. Reading design docs for the module
2. Extracting package.json metadata
3. Writing a clear problem/solution statement
4. Generating a minimal quick start example
5. Linking to Level 2 docs for comprehensive information
6. Keeping total length under 500 words

## Quick Start

**Generate README for a module:**

```bash
/docs-generate-readme effect-type-registry
```

**Update existing README preserving custom sections:**

```bash
/docs-generate-readme rspress-plugin-api-extractor --update
```

**Preview without writing:**

```bash
/docs-generate-readme website --dry-run
```

## How It Works

### 1. Parse Parameters

- `module`: Module name to generate README for [REQUIRED]
- `--template`: Custom template path (default: `.claude/skills/docs-generate-readme/templates/readme.template.md`)
- `--dry-run`: Preview output without writing
- `--update`: Update existing README preserving custom sections

### 2. Load Configuration and Context

Read `.claude/design/design.config.json` to get:

- Module configuration and paths
- User docs configuration (Level 1 settings)
- Quality standards for READMEs

Read module metadata:

- `package.json` - name, version, description, license, dependencies
- Design docs in module's `designDocsPath`
- Existing README.md (if `--update` mode)

### 3. Extract Content from Design Docs

**Badges (2-4 badges):**

Generate appropriate badges based on package.json:

- npm version badge (always include)
- License badge (always include)
- Node.js version badge (if engines specified)
- TypeScript badge (if types included)
- Build status badge (if CI configured)

**Problem Statement (1-2 sentences):**

- What problem does this package solve?
- Why would someone need it?
- Avoid implementation details

**Features (3-5 bullet points):**

- Extract key capabilities from design docs
- Transform to user benefits, not technical features
- Keep each bullet to one line
- Focus on "what you can do" not "how it works"

**Quick Start (5-15 lines max):**

- Find the simplest common usage pattern
- Include only essential imports
- Show one working example, not multiple variations
- Link to docs/ for more examples

### 4. Apply Transformation Rules

Transform internal terminology to user-friendly language:

- "Architecture" → omit (too technical)
- "Implementation Details" → simplify to "How it works" (optional)
- "Integration Points" → "Usage with other tools"
- Effect-TS patterns → plain TypeScript
- Internal service names → public API names

### 5. Generate README Content

Fill the Level 1 template with extracted content:

- Package name and problem statement
- Brief features list (3-5 bullets)
- Installation command
- Minimal quick start example
- Link to `docs/` for comprehensive documentation
- License

### 6. Write or Update README

**New README mode (default):**

- Write complete README.md to module root
- Validate against Level 1 quality standards
- Check line length, word count, required sections

**Update mode (`--update`):**

- Parse existing README.md
- Preserve custom sections (badges, screenshots, etc.)
- Update standard sections with new content
- Maintain user-added examples

**Dry-run mode (`--dry-run`):**

- Generate content but don't write
- Display preview to user
- Show what would change

### 7. Validate Output

Check generated README against quality standards:

- Length: 150-400 words (warn if >500)
- Required sections: Problem statement, Installation, Quick Start
- Single code example that works
- Links to docs/ for more information
- Markdown linting passes

## Supporting Documentation

When you need detailed information, load these files:

- `instructions.md` - Detailed step-by-step implementation
- `transformation-rules.md` - Content transformation guidelines
- `examples.md` - Example READMEs and transformations
- `quality-standards.md` - Validation criteria

## Success Criteria

A generated README is successful when:

- ✅ Clear problem statement (what it solves, why you need it)
- ✅ 3-5 concise feature bullets
- ✅ Single working quick start example (copy-paste ready)
- ✅ 150-400 words total (under 500 max)
- ✅ Links to `docs/` for configuration, API reference, advanced usage
- ✅ No API documentation in README (that's Level 2)
- ✅ Valid markdown

## Example Usage

```bash
# Generate README for effect-type-registry
/docs-generate-readme effect-type-registry

# Output: pkgs/effect-type-registry/README.md created
# Content:
# - Title: effect-type-registry
# - Description: TypeScript type definition registry with caching
# - Features: Version-aware caching, HTTP retry, VFS generation
# - Quick start: 10-line working example
# - Links: API docs, contributing, license
```

## Integration Points

- Uses `.claude/design/design.config.json` for module configuration
- Uses `.claude/skills/docs-generate-readme/templates/readme.template.md` for structure
- Reads design docs from module's `designDocsPath`
- Reads `package.json` for metadata
- Writes to module's `userDocs.readme` path
- Validates against `quality.userDocs.level1` standards

## Related Skills

- `/docs-sync` - Sync README with design doc changes
- `/docs-review` - Review README quality
- `/docs-generate-repo` - Generate Level 2 repository docs
- `/design-review` - Review source design documentation
