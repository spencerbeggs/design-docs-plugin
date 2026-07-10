# Examples

## Example 1: Validate root CLAUDE.md

**User request:**

> Validate the root CLAUDE.md

**Execution:**

1. Load config for quality standards
2. Read CLAUDE.md
3. Check structure, formatting, content
4. Validate design doc references
5. Run markdown linter
6. Generate report

**Output:**

```markdown
# CLAUDE.md Validation Report

**Target:** CLAUDE.md
**Files Validated:** 1
**Status:** ⚠️  WARNINGS

## Summary

- Errors: 0
- Warnings: 2
- Info: 1

## Issues by File

### CLAUDE.md

**Status:** ⚠️  WARNINGS
**Words:** 2150 / 2000
**Type:** Root

#### Errors

None found.

#### Warnings

- [Line 234] Design doc exists but not referenced (performance-observability.md)
- [Content] Commands section verbose (280 words, recommend <150)

#### Info

- Consider adding design doc pointer for build architecture

## Recommendations

1. Add reference to performance-observability.md in relevant section
2. Condense Commands section to focus on essentials
3. Add pointer to build-architecture.md with when-to-load guidance
```

## Example 2: Strict validation with errors

**User request:**

> Strict validation of pkgs/effect-type-registry/CLAUDE.md

**Execution:**

1. Load config
2. Read package CLAUDE.md
3. Perform strict validation
4. Check all references
5. Generate report

**Output:**

```markdown
# CLAUDE.md Validation Report

**Target:** pkgs/effect-type-registry/CLAUDE.md
**Files Validated:** 1
**Status:** ❌ FAIL

## Summary

- Errors: 3
- Warnings: 2
- Info: 1

## Issues by File

### pkgs/effect-type-registry/CLAUDE.md

**Status:** ❌ FAIL
**Words:** 1180 / 1000
**Type:** Package

#### Errors

- [Line 12] Missing required section: Testing
- [Line 89] Broken design doc reference:
  @./.claude/design/effect-type-registry/caching.md
- [Structure] Heading level skipped (H1 → H3 at line 45)

#### Warnings

- [References] Design doc exists but not referenced (observability.md)
- [Content] Package Overview is generic boilerplate

#### Info

- Add when-to-load guidance for design doc references

## Recommendations

1. Add Testing section documenting test strategy
2. Fix broken reference: create caching.md or update reference
3. Fix heading hierarchy at line 45 (use H2 instead of H3)
4. Reference observability.md in Development Notes
5. Customize Package Overview with specific purpose and features
```

## Example 3: Validate all CLAUDE.md files

**User request:**

> Validate all CLAUDE.md files

**Execution:**

1. Find all CLAUDE.md files
2. Validate each file
3. Generate comprehensive report

**Output:**

```markdown
# CLAUDE.md Validation Report

**Target:** all
**Files Validated:** 4
**Status:** ⚠️  WARNINGS

## Summary

- Errors: 1
- Warnings: 5
- Info: 3

## Files by Status

- ✅ PASS: 2 files
- ⚠️  WARNINGS: 1 file
- ❌ FAIL: 1 file

## Issues by File

### CLAUDE.md (Root)

**Status:** ⚠️  WARNINGS
**Words:** 2150 / 2000
**Type:** Root

#### Warnings

- [References] 2 design docs not referenced
- [Content] Commands section verbose

### pkgs/effect-type-registry/CLAUDE.md

**Status:** ❌ FAIL
**Words:** 1180 / 1000
**Type:** Package

#### Errors

- [Line 12] Missing required section: Testing

### pkgs/rspress-plugin-api-extractor/CLAUDE.md

**Status:** ✅ PASS
**Words:** 890 / 1000
**Type:** Package

No issues found.

### website/CLAUDE.md

**Status:** ✅ PASS
**Words:** 480 / 1000
**Type:** Package

No issues found.

## Recommendations

1. Fix missing Testing section in effect-type-registry/CLAUDE.md
2. Add design doc references to root CLAUDE.md
3. Condense Commands section in root CLAUDE.md
```

## Special Cases

## New Packages

Packages without existing CLAUDE.md:

```text
INFO: No CLAUDE.md found for package
- Package: {package-name}
- Expected location: {path}/CLAUDE.md
- Recommendation: Create CLAUDE.md using package template
```

## Child CLAUDE.md Files

Some packages may have CLAUDE.local.md or other child files:

- Validate against package rules (not root rules)
- Check that parent CLAUDE.md references child
- Ensure child doesn't duplicate parent content

## Archived Modules

Modules marked as archived in config:

- Don't require up-to-date content
- Don't penalize for missing design doc refs
- Validate structure only
- Should have archival notice
