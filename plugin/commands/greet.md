---
allowed-tools: Read
description: Demo command that generates a greeting message
argument-hint: "[name] [--shout] [--repeat N]"
---

# Greet Command

A demo command showing how to define arguments with Zod schemas
and implement a command handler.

## Usage

```bash
$CLAUDE_PLUGIN_ROOT/claude-plugin-template.plugin --cmd=greet $ARGUMENTS
```

## Arguments

- `name` (positional, optional) - Name to greet. Defaults to "World".
- `--shout` (flag) - Uppercase the greeting.
- `--repeat N` (number) - Repeat the greeting N times. Defaults to 1.

## Exit Codes

| Code | Meaning |
| ---- | ------- |
| 0 | Greeting generated successfully |
| 1 | Repeat count exceeds maximum of 10 |
| 2 | Plugin setup did not provide a greeting prefix |
