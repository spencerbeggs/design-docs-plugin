# Context Validation Detailed Instructions

Complete step-by-step workflow for validating CLAUDE.md files.

## 1. Parse Parameters

Extract parameters from the user's request:

**Required:**

- `target`: Path to CLAUDE.md file, or "all" for all context files

**Optional:**

- `strict`: Enable strict mode with additional quality checks (default: false)
- `check-refs`: Validate design doc references exist and check pointer content drift (default: true)

**Examples:**

- "Validate the root CLAUDE.md"
  - target: `CLAUDE.md`
  - strict: false
  - check-refs: true

- "Validate CLAUDE.md for effect-type-registry"
  - target: `pkgs/effect-type-registry/CLAUDE.md`
  - strict: false
  - check-refs: true

- "Strict validation of all CLAUDE.md files"
  - target: `all`
  - strict: true
  - check-refs: true

## 2. Load Configuration

Read `.claude/design/design.config.json` to understand:

- Context quality standards (`quality.context`)
- Root max words limit (default: 2000)
- Child max words limit (default: 1000)
- Whether design doc pointers are required

**Example config:**

```json
{
  "quality": {
    "context": {
      "rootMaxWords": 2000,
      "childMaxWords": 1000,
      "requireDesignDocPointers": true,
      "requirePointerHashes": false
    }
  }
}
```

`requirePointerHashes` (default `false`) controls drift-check strictness: when `true`, a pointer with no recorded hash in `refs.json` is a WARNING rather than INFO.

If `.claude/design/design.config.json` does not exist, fall back to the defaults above (root 2000 words / child 1000 words) and add one INFO line to the report noting that default limits are in effect — so a passing word-count check is not mistaken for a configured one.

## 3. Find Context Files

Based on target parameter:

**Specific file:**

```bash
# Validate single file
read {file-path}
```

**All files:**

```bash
# Find all CLAUDE.md files
glob "**/CLAUDE.md" --path="."
```

Typical locations:

- Root: `CLAUDE.md`
- Packages: `pkgs/*/CLAUDE.md`
- Website: `website/CLAUDE.md`

## 4. Validate Each File

For each CLAUDE.md file, run the structure, formatting, content-quality,
strict-mode, cross-reference, and markdown-lint checks. See
[checks.md](checks.md) for the full per-check specification (required
sections, word-count rules, pointer content-drift detection, and the
markdown-lint invocation).

## 5. Report Validation Results

Generate validation report:

**Report Format:**

```markdown
# CLAUDE.md Validation Report

**Target:** {file-path|all}
**Files Validated:** {count}
**Status:** ✅ PASS / ⚠️  WARNINGS / ❌ FAIL

## Summary

- Errors: {count}
- Warnings: {count}
- Info: {count}

## Issues by File

### {file-path}

**Status:** ✅ PASS / ⚠️  WARNINGS / ❌ FAIL
**Words:** {count} / {limit}
**Type:** Root / Package

#### Errors

- [Line X] Missing required section: {section}
- [Structure] Heading level skipped (H1 → H3)
- [References] Broken design doc reference: {path}

#### Warnings

- [Word count] Word limit exceeded ({actual} > {limit})
- [Content] Overview is verbose (350 words, recommend <200)
- [References] Design doc not referenced (observability.md exists)

#### Info

- Consider splitting into child CLAUDE.md files
- Add design doc pointer for {topic}
- Update command examples to use latest syntax

## Recommendations

1. {actionable fix recommendation}
2. {actionable fix recommendation}
```

## 6. Validation Rules Reference

### Root CLAUDE.md Rules

| Rule | Validation |
| :--- | :--------- |
| Max words | 2000 (configurable) |
| Required sections | Project Overview, Commands, Architecture, Tooling |
| Design doc refs | Optional but recommended |
| Heading level | Must start with H1 |
| Organization | Logical section order |

### Package CLAUDE.md Rules

| Rule | Validation |
| :--- | :--------- |
| Max words | 1000 (configurable) |
| Required sections | Package Overview, API/Exports, Development, Testing |
| Design doc refs | Required if design docs exist |
| File paths | Should reference package-relative paths |
| Scope | Package-specific, not general project info |

### Severity Levels

- **ERROR**: Must be fixed (missing sections, broken refs, invalid markdown)
- **WARNING**: Should be fixed (word limit, quality issues, missing refs)
- **INFO**: Nice to have (optimization suggestions, style improvements)
