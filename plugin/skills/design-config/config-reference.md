# Configuration Reference

Full field-level reference for `design.config.json`.

## Configuration File

The design.config.json file is located at `.claude/design/design.config.json`
and follows the JSON schema at:

`https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json`

### Top-Level Structure

```json
{
  "$schema": "path/to/schema.json",
  "version": "1.0.0",
  "project": { ... },
  "paths": { ... },
  "modules": { ... },
  "skills": { ... },
  "quality": { ... },
  "integration": { ... }
}
```

## Core Sections

### Project Metadata

```json
"project": {
  "name": "spencerbeggs/website",
  "type": "monorepo",
  "repository": "https://github.com/spencerbeggs/website",
  "maintainer": "C. Spencer Beggs"
}
```

**Fields:**

- `name` - Project name
- `type` - Project type (monorepo, package, application)
- `repository` - Git repository URL
- `maintainer` - Primary maintainer

### Paths

```json
"paths": {
  "designDocs": ".claude/design",
  "skills": ".claude/skills",
  "context": "CLAUDE.md",
  "localContext": "CLAUDE.local.md"
}
```

**Fields:**

- `designDocs` - Root directory for design documentation
- `skills` - Root directory for skills
- `context` - Root context file (CLAUDE.md)
- `localContext` - Local context file (CLAUDE.local.md)

### Modules

```json
"modules": {
  "my-package": {
    "path": "pkgs/my-package",
    "designDocsPath": ".claude/design/my-package",
    "categories": ["architecture", "performance"],
    "maintainer": "Spencer Beggs",
    "userDocs": {
      "readme": "pkgs/my-package/README.md",
      "repoDocs": null,
      "siteDocs": "website/docs/en/packages/my-package"
    }
  }
}
```

**Module Fields:**

- `path` - Relative path to module directory
- `designDocsPath` - Path to module's design docs (null if none)
- `categories` - Allowed design doc categories
- `maintainer` - Module maintainer name
- `userDocs` - User documentation paths (Level 1/2/3)

**Valid Categories:**

- `architecture` - System/component architecture
- `performance` - Performance characteristics
- `observability` - Logging, metrics, events
- `testing` - Testing strategy
- `integration` - Integration patterns
- `cross-linking` - Cross-linking features
- `import-generation` - Import generation
- `source-mapping` - Source mapping
- `meta` - Meta documentation
- `documentation` - Documentation about documentation
- `other` - Other categories

### Quality Standards

```json
"quality": {
  "designDocs": {
    "requireFrontmatter": true,
    "requireTOC": true,
    "minSections": ["Overview", "Current State", "Rationale"]
  },
  "userDocs": {
    "level1": {
      "targetWordCount": [200, 500],
      "requireSections": ["Features", "Installation", "Usage"]
    }
  },
  "context": {
    "rootMaxWords": 2000,
    "childMaxWords": 1000,
    "requireDesignDocPointers": true,
    "requirePointerHashes": false,
    "hardWrap": "forbid"
  }
}
```

`requirePointerHashes` (default `false`): when `true`, `context-validate` / `context-audit` treat a design-doc pointer that has no recorded content hash in `.claude/design/refs.json` as a WARNING rather than INFO, pushing pointers to become drift-tracked.

`hardWrap` (default `forbid`): whether context-file paragraphs and list items may contain hard line breaks. `forbid` keeps each paragraph on a single source line; `allow` accepts a repo's entrenched hard-wrap convention — `context-docs-style` then enforces per-file consistency instead of flagging the wrapping itself.

**Quality Sections:**

- `designDocs` - Design documentation standards
- `userDocs` - User documentation standards (Level 1/2/3)
- `context` - CLAUDE.md context file standards

### Skills Configuration

```json
"skills": {
  "baseNamespace": "/",
  "enabled": [
    "design-init",
    "design-validate",
    "design-update"
  ]
}
```

**Fields:**

- `baseNamespace` - Base namespace for skills (usually "/")
- `enabled` - List of enabled skill names

### Integration Settings

```json
"integration": {
  "ci": {
    "enabled": false,
    "validateOnPR": false,
    "syncOnMerge": false
  },
  "git": {
    "trackDesignDocs": true,
    "requireReviewForChanges": false
  }
}
```

**Integration Options:**

- `ci` - CI/CD integration settings
- `git` - Git integration settings

## Schema Reference

The complete JSON schema is located at:

`https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json`

**To reference in config:**

```json
{
  "$schema": "https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json",
  "version": "1.0.0",
  ...
}
```

## Validation

### Required Fields

**Top-level:**

- `version` - Schema version (semver)
- `project` - Project metadata
- `paths` - Standard paths
- `modules` - Module definitions
- `quality` - Quality standards

**Project:**

- `name` - Project name
- `type` - Project type
- `maintainer` - Maintainer name

**Paths:**

- `designDocs` - Design docs root
- `skills` - Skills root
- `context` - Context file path

**Module:**

- `path` - Module directory path
- `maintainer` - Module maintainer

**Quality.designDocs:**

- `requireFrontmatter` - Frontmatter required (boolean)
- `requireTOC` - TOC required (boolean)
- `minSections` - Minimum sections (array)

### Field Validation

**Version:** Must match semver pattern `^[0-9]+\.[0-9]+\.[0-9]+$`

**Project type:** Must be one of: `monorepo`, `package`, `application`

**Categories:** Must be one of the valid category enums

**Line lengths:** there is no line-length setting. For design docs the wrapping policy is fixed: each paragraph and list item occupies a single source line and the renderer wraps (markdownlint MD013 stays disabled intentionally). `design-validate` warns on hard-wrapped prose. For context files the policy is configurable via `context.hardWrap`.

**Context word counts:**

- `context.rootMaxWords`: 200-5000 (default 2000)
- `context.childMaxWords`: 100-2000 (default 1000)
- `context.hardWrap`: `forbid` | `allow` (default `forbid`)
