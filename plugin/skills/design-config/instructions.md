# Workflow

Step-by-step processes for each `design-config` operation. See
[config-reference.md](config-reference.md) for the field definitions each
step validates against.

## Validate Configuration

Validates design.config.json against the JSON schema.

**Steps:**

1. Read `.claude/design/design.config.json`
2. Fetch schema from `https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json`
3. Validate JSON structure
4. Check all required fields present
5. Validate field types and values
6. Check enum values are valid
7. Report validation errors or success

**Validation tools:**

```bash
# Using Node.js with ajv
npm install -g ajv-cli
curl -s https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json | ajv validate -s /dev/stdin -d .claude/design/design.config.json

# Using Python with jsonschema
pip install jsonschema
python -c "import json, jsonschema; ..."
```

## Initialize Configuration

Creates a new design.config.json file with sensible defaults.

**Steps:**

1. Check if config already exists (warn if it does)
2. Detect project type (monorepo, package, app)
3. Scan for existing modules
4. Generate module definitions
5. Set default quality standards
6. Write config file
7. Validate against schema
8. Report success

**Example:**

```json
{
  "version": "1.0.0",
  "project": {
    "name": "my-project",
    "type": "monorepo",
    "maintainer": "Your Name"
  },
  "paths": {
    "designDocs": ".claude/design",
    "skills": ".claude/skills",
    "context": "CLAUDE.md"
  },
  "modules": {},
  "quality": {
    "designDocs": {
      "requireFrontmatter": true,
      "requireTOC": true,
      "minSections": ["Overview", "Current State", "Rationale"]
    }
  }
}
```

## Add Module

Adds a new module definition to the configuration.

**Steps:**

1. Read current config
2. Validate module doesn't already exist
3. Detect module path (from pnpm workspace, package.json, etc.)
4. Prompt for module details:
   - Design docs path
   - Categories
   - Maintainer
   - User docs paths
5. Add module to config
6. Validate updated config
7. Write config file
8. Report success

**Example:**

```bash
/design-docs:design-config add-module effect-type-registry \
  --path=pkgs/effect-type-registry \
  --categories=architecture,performance,observability
```

## Update Quality Standards

Updates quality standards for design docs, user docs, or context files.

**Steps:**

1. Read current config
2. Parse update parameters
3. Update specified quality fields
4. Validate updated config
5. Write config file
6. Report changes

**Example:**

```bash
/design-docs:design-config update-quality \
  --designDocs.requireTOC=false \
  --context.rootMaxWords=2000
```

## Update Module

Updates an existing module definition.

**Steps:**

1. Read current config
2. Validate module exists
3. Parse update parameters
4. Update module fields
5. Validate updated config
6. Write config file
7. Report changes

**Example:**

```bash
/design-docs:design-config update-module effect-type-registry \
  --add-category=testing \
  --siteDocs=website/docs/en/packages/effect-type-registry
```

## Enable/Disable Skills

Manages the list of enabled skills.

**Steps:**

1. Read current config
2. Validate skill names exist
3. Add/remove from enabled list
4. Validate updated config
5. Write config file
6. Report changes

**Example:**

```bash
/design-docs:design-config enable-skill design-prune design-export
/design-docs:design-config disable-skill design-archive
```
