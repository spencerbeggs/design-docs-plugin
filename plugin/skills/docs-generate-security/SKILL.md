---
name: docs-generate-security
description: Generate SECURITY.md for vulnerability reporting. Use when creating
  or updating security policies with supported versions and reporting instructions.
allowed-tools: Read, Glob, Edit, Write
context: fork
agent: docs-gen-agent
---

# Generate SECURITY.md

Generates a SECURITY.md file with supported versions and vulnerability reporting
instructions.

## Philosophy

**SECURITY.md should be clear and actionable.**

A good SECURITY.md tells security researchers:

1. Which versions are actively supported
2. How to report vulnerabilities
3. What to expect after reporting

Keep it simple - most projects only support the latest version.

## Overview

This skill generates SECURITY.md by:

1. Detecting current and supported versions from package.json
2. Checking for changesets to determine pending versions
3. Extracting contact info from package.json author
4. Generating standard security policy sections

## Quick Start

**Generate SECURITY.md:**

```bash
/docs-generate-security
```

**With custom security contact:**

```bash
/docs-generate-security --email=security@example.com
```

**Preview without writing:**

```bash
/docs-generate-security --dry-run
```

## How It Works

### 1. Parse Parameters

- `--email`: Custom security contact email (default: from package.json author)
- `--dry-run`: Preview output without writing

### 2. Detect Supported Versions

**From package.json:**

- `version` field → Current published version
- If version is `0.0.0` or pre-release → "Latest" only

**From changesets (if enabled):**

- Check `.changeset/` directory exists
- Read pending changeset files for next version bump type
- Calculate next version if changesets pending

**Version support policy:**

| Scenario | Supported Versions |
| -------- | ------------------ |
| Stable (≥1.0.0) | Current major only |
| Pre-release (<1.0.0) | Latest only |
| Monorepo | Per-package or "Latest" |

### 3. Extract Contact Information

From `package.json`:

- `author.email` → Security contact
- `repository.url` → For GitHub security advisories link

Fallback: Prompt for security email if not found.

### 4. Generate SECURITY.md

Standard sections:

- **Supported Versions** - Table of version support status
- **Reporting a Vulnerability** - Contact and process
- **Response Timeline** - What reporters can expect

### 5. Write Output

Write to repository root as `SECURITY.md`.

## Supporting Documentation

Load these files for detailed guidance:

- `instructions.md` - Step-by-step implementation
- `templates/security.template.md` - Output template

## Success Criteria

A generated SECURITY.md is successful when:

- ✅ Supported versions are accurate
- ✅ Security contact email is valid
- ✅ Reporting process is clear
- ✅ Response timeline is stated
- ✅ Valid markdown

## Integration Points

- Reads `package.json` for version and contact info
- Checks `.changeset/` for pending versions
- Writes to repository root as `SECURITY.md`
- Uses docs-gen-agent for generation

## Related Skills

- `/docs-generate-readme` - Generate package README
- `/docs-generate-contributing` - Generate CONTRIBUTING.md
