---
name: context-audit
description: Comprehensive quality audit for CLAUDE.md context files. Use when performing thorough quality checks, preparing for releases, ensuring context efficiency, or verifying token optimization.
allowed-tools: Read, Glob, Grep, Bash
context: fork
agent: context-doc-agent
---

# LLM Context Comprehensive Audit

Performs deep quality audits of CLAUDE.md context files, checking structure,
content quality, efficiency, design doc references, and compliance with
standards.

## Overview

This skill provides comprehensive quality auditing for LLM context files
by running all validation checks, analyzing content efficiency, verifying
design doc pointers, checking word limits, and generating detailed audit
reports with prioritized recommendations.

## Quick Start

**Audit all context files:**

```bash
/design-docs:context-audit
```

**Audit specific file:**

```bash
/design-docs:context-audit CLAUDE.md
```

**Audit package context:**

```bash
/design-docs:context-audit pkgs/effect-type-registry/CLAUDE.md
```

**Quick audit (non-strict):**

```bash
/design-docs:context-audit --strict=false
```

## Parameters

### Optional

- `target`: Path to CLAUDE.md file or "all" (default: all)
- `strict`: Enable strict mode with additional checks (default: true)
- `check-refs`: Validate design doc references exist and check pointer content drift (default: true)
- `output`: Output file path for audit report

## Workflow

High-level audit process:

1. **Parse parameters** to determine audit scope and strictness
2. **Load design.config.json** to get quality standards (word limits, etc.)
3. **Discover CLAUDE.md files** using Glob (root + package-level)
4. **Run validation checks** (structure, formatting, markdown quality)
5. **Analyze content quality** (efficiency, organization, token usage)
6. **Check design doc pointers** (existence, validity, coverage)
7. **Verify word limits** (root: 2000, child: 1000 from config)
8. **Calculate health scores** (file, package, overall)
9. **Identify issues** by severity (critical, high, medium, low)
10. **Generate recommendations** prioritized by impact
11. **Output audit report** with actionable improvements

## Instructions

**IMPORTANT:** Follow the detailed step-by-step instructions in
`instructions.md` to perform the audit correctly.

For usage examples and common scenarios, see `examples.md`.

## Output Format

The audit generates a structured report with:

### Summary Section

- Total files audited
- Overall health score (0-100)
- Critical/high/medium/low issue counts
- Pass/fail status

### File-Level Details

For each CLAUDE.md file:

- File path and role (root vs child)
- Word count vs limit
- Structure validation results
- Content quality score
- Design doc pointer status
- Specific issues found

### Recommendations

Prioritized list of improvements:

1. Critical issues (must fix)
2. High priority (should fix)
3. Medium priority (nice to have)
4. Low priority (optional)

### Quality Metrics

- Average word count
- Design doc pointer coverage
- Content efficiency score
- Token optimization score

## Success Criteria

The audit passes when:

- All files under word limits (root: 2000, child: 1000)
- No critical or high severity issues
- All design doc pointers valid and exist
- Content is lean imperative instructions (not implementation details)
- Proper separation between root and child contexts

## Related Skills

- `/design-docs:context-validate` - Basic structure and formatting validation
- `/design-docs:context-review` - Quality and efficiency review
- `/design-docs:context-update` - Update context files based on audit findings
- `/design-docs:context-split` - Split large files that exceed limits
- `/design-docs:design-audit` - Similar comprehensive audit for design docs
