---
name: context-validate
description: Validate CLAUDE.md structure, formatting, and quality. Use when checking context files for compliance, ensuring proper structure, or verifying before commits.
allowed-tools: Read, Glob, Bash(pnpm *), Bash(bash *)
context: fork
agent: context-doc-agent
---

# LLM Context File Validation

Validates CLAUDE.md files for structure, formatting, and quality compliance
with Claude Code best practices.

## Overview

This skill validates LLM context files by:

1. Reading CLAUDE.md files (root and package-level)
2. Validating markdown structure and formatting
3. Checking for required sections
4. Analyzing content quality and organization
5. Verifying design doc references
6. Checking word limits and organization
7. Reporting issues with severity levels

## Quick Start

**Validate the root CLAUDE.md:**

```bash
/design-docs:context-validate CLAUDE.md
```

**Validate a package CLAUDE.md:**

```bash
/design-docs:context-validate pkgs/effect-type-registry/CLAUDE.md
```

**Strict validation of every context file:**

```bash
/design-docs:context-validate all --strict
```

## Supporting Documentation

When you need detailed information, load the appropriate supporting file:

### For the Full Validation Workflow

See [instructions.md](instructions.md) for:

- Parameter parsing, config loading, and file discovery
- The validation report format and the validation-rules reference tables (root vs. package, severity levels)

**Load when:** running a validation or need the report format

### For Per-File Check Specifications

See [checks.md](checks.md) for:

- Structure, formatting, and content-quality checks
- Strict-mode checks (conciseness, relevance, specificity)
- Cross-reference validation, including pointer content-drift detection via `ref-hash.sh`
- The markdown-lint invocation

**Load when:** implementing or debugging a specific check

### For Usage Examples

See [examples.md](examples.md) for:

- A clean pass, a strict-mode failure, and a validate-all run
- Special cases: new packages, child CLAUDE.md files, archived modules

**Load when:** user needs examples or clarification

### For Error Messages

See [error-messages.md](error-messages.md) for:

- Every ERROR/WARNING message format and its fix

**Load when:** diagnosing a specific validation failure

## Success Criteria

A valid CLAUDE.md file has:

- ✅ All required sections present
- ✅ Proper markdown structure
- ✅ Within word limit
- ✅ Valid design doc references
- ✅ No markdown linting errors
- ✅ Concise, imperative content
- ✅ Up-to-date commands and paths

## Integration with Other Skills

Works well with:

- `/design-docs:context-review` - Fix issues before validation
- `/design-docs:context-update` - Update files based on validation
- `/design-docs:context-split` - Split overlimit files
- `/design-docs:design-validate` - Ensure referenced design docs are valid
- `/design-docs:design-review` - Check design doc health

## CI/CD Integration

Can be integrated into workflows:

```bash
# Pre-commit hook
claude code --skill context-validate --args "all"

# CI pipeline
- name: Validate CLAUDE.md files
  run: claude code --skill context-validate --args "all --strict"
```

Exit codes:

- 0: All validations pass
- 1: Warnings present
- 2: Errors found
