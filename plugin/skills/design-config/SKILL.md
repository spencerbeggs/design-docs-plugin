---
name: design-config
description: Manage design documentation system configuration. Use when initializing the system, adding modules, or updating quality standards.
allowed-tools: Read, Write, Bash(curl *), Bash(jq *), Bash(find *), Bash(cat *), Bash(ls *)
context: fork
agent: design-doc-agent
---

# Design Documentation Configuration

Manages the design.config.json file that configures the design documentation
system, including modules, paths, quality standards, and integrations.

## Overview

This skill manages configuration by:

1. Validating against JSON schema
2. Initializing new configuration files
3. Adding/updating module definitions
4. Configuring quality standards
5. Managing skill enablement
6. Setting up integrations

## Quick Start

**Validate current config:**

```bash
/design-docs:design-config validate
```

**Add new module:**

```bash
/design-docs:design-config add-module my-package
```

**Update quality standards:**

```bash
/design-docs:design-config update-quality --context.rootMaxWords=2500
```

## Configuration File

The design.config.json file is located at `.claude/design/design.config.json`
and follows the JSON schema at:

`https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json`

## Supporting Documentation

When you need detailed information, load the appropriate supporting file:

### For Configuration Field Reference

See [config-reference.md](config-reference.md) for:

- Full top-level structure and every core section (project metadata, paths, modules, quality standards, skills, integration)
- Required fields and field-validation rules (semver, enums, word-count ranges)
- The complete JSON schema URL and how to reference it from a config file

**Load when:** you need a field's exact name, default, or valid values

### For Workflow Steps

See [instructions.md](instructions.md) for:

- Step-by-step processes for validate, init, add-module, update-quality, update-module, and enable/disable-skill

**Load when:** performing a specific config operation

### For Usage Examples

See [examples.md](examples.md) for:

- Initializing a new project, adding a package, updating quality standards, enabling skills, validating after a manual edit

**Load when:** user needs examples or clarification

### For Error Handling

See [error-messages.md](error-messages.md) for:

- Invalid-schema, missing-required-field, and module-already-exists error formats and fixes

**Load when:** diagnosing a validation failure

## Integration

Works with all design documentation skills:

- `/design-docs:design-init` - Uses config for module paths and categories
- `/design-docs:design-validate` - Uses config for quality standards
- `/design-docs:design-sync` - Uses config for module definitions
- `/design-docs:design-audit` - Uses config for quality checks
- All skills - Read config for paths and settings

## Success Criteria

A valid configuration:

- ✅ Passes JSON schema validation
- ✅ All required fields present
- ✅ Field values match constraints
- ✅ Module paths exist
- ✅ Categories are valid enums
- ✅ Quality standards are reasonable
- ✅ No duplicate module names
