# Error Handling

## Invalid Schema

```text
ERROR: Configuration validation failed

Schema: https://raw.githubusercontent.com/spencerbeggs/design-docs-plugin/main/design-docs.schema.json
Config: .claude/design/design.config.json

Errors:
- .version: Must match pattern ^[0-9]+\.[0-9]+\.[0-9]+$
- .modules.my-package.categories[0]: Must be one of:
  architecture, performance, ...
- .context.rootMaxWords: Must be <= 5000

Fix these errors and run validate again.
```

## Missing Required Fields

```text
ERROR: Missing required fields

- project.name is required
- project.type is required
- quality.designDocs is required

Add these fields and validate again.
```

## Module Already Exists

```text
ERROR: Module already exists

Module: effect-type-registry

To update existing module, use:
/design-docs:design-config update-module effect-type-registry
```
