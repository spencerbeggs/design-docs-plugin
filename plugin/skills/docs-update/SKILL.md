---
name: docs-update
description: Comprehensive documentation review and update. Use before merging
  branches to ensure all docs are current, complete, and consistent.
allowed-tools: Read, Glob, Grep, Edit, Write, WebSearch
context: fork
agent: docs-gen-agent
---

# Comprehensive Documentation Update

Systematically review and update all user-facing documentation before merging
a branch. This skill orchestrates the individual documentation skills into a
complete pre-merge documentation audit.

## When to Use

Run this skill when:

- Completing a feature branch before merge
- Preparing for a release
- After significant code changes
- Periodic documentation maintenance

## Quick Start

**Full documentation update:**

```bash
/docs-update
```

**Update specific module only:**

```bash
/docs-update my-package
```

**Review only (no changes):**

```bash
/docs-update --review-only
```

## Systematic Workflow

This skill follows a specific order to ensure consistency:

### Phase 1: Package Foundation

#### 1.1 Review package.json

Run package.json review first - it's the source of truth for metadata.

```bash
# Internally runs: /docs-review-package
```

Check:

- [ ] Metadata complete (name, description, repository, bugs, homepage)
- [ ] Dependencies appropriate and up-to-date
- [ ] peerDependencies have proper ranges
- [ ] NEVER modify version (changesets handles that)

#### 1.2 Fix package.json issues

Apply safe fixes for metadata issues identified in review.

### Phase 2: Core Documentation

#### 2.1 README.md

Generate or update the package README.

```bash
# Internally runs: /docs-generate-readme
```

Ensure:

- [ ] Badges are current and accurate
- [ ] Problem statement is clear
- [ ] Features reflect current capabilities
- [ ] Quick start example works
- [ ] Links to docs/ for advanced usage

#### 2.2 CONTRIBUTING.md

Generate or update contribution guide.

```bash
# Internally runs: /docs-generate-contributing
```

Ensure:

- [ ] Environment requirements match package.json
- [ ] Commands match actual scripts
- [ ] Code quality standards are accurate
- [ ] DCO requirement is documented

#### 2.3 SECURITY.md

Generate or update security policy.

```bash
# Internally runs: /docs-generate-security
```

Ensure:

- [ ] Supported versions are accurate
- [ ] Security contact is valid
- [ ] Reporting process is clear

### Phase 3: Extended Documentation

#### 3.1 docs/ folder (Level 2)

If design docs exist, generate repository documentation.

```bash
# Internally runs: /docs-generate-repo (if applicable)
```

Ensure:

- [ ] Architecture docs reflect implementation
- [ ] Guides are current
- [ ] Examples work

### Phase 4: Cross-Reference Validation

#### 4.1 Link validation

Check all internal links work:

- [ ] README links to docs/
- [ ] docs/ links are valid
- [ ] No broken anchors

#### 4.2 Version consistency

Ensure version references are consistent:

- [ ] README badges use correct package name
- [ ] SECURITY.md versions match package.json
- [ ] CONTRIBUTING.md versions match requirements

#### 4.3 Example validation

Verify code examples:

- [ ] Imports match actual exports
- [ ] Examples are syntactically valid
- [ ] API usage is current

## Output Summary

After completion, provide a summary:

```markdown
## Documentation Update Summary

### Files Updated
- ✅ README.md - Updated badges, refreshed features
- ✅ CONTRIBUTING.md - Updated Node version requirement
- ✅ SECURITY.md - No changes needed
- ⏭️ docs/ - Skipped (no design docs)

### Issues Found and Fixed
1. package.json: Added missing `bugs` field
2. README.md: Updated quick start example
3. CONTRIBUTING.md: Fixed incorrect pnpm version

### Issues Requiring Manual Review
1. README.md: Feature list may need human review
2. docs/api.md: Complex example needs verification

### Validation Results
- ✅ All internal links valid
- ✅ Version references consistent
- ⚠️ 1 example needs manual testing
```

## Constraints

- **NEVER modify package.json version** - Changesets handles versioning
- **Preserve custom sections** - Don't overwrite user customizations
- **Report, don't assume** - Flag issues that need human judgment
- **Keep README concise** - Defer details to docs/

## Related Skills

This skill orchestrates:

- `/docs-review-package` - Package.json review
- `/docs-generate-readme` - README generation
- `/docs-generate-contributing` - CONTRIBUTING.md generation
- `/docs-generate-security` - SECURITY.md generation
- `/docs-generate-repo` - Level 2 docs generation
- `/docs-review` - Documentation quality review
